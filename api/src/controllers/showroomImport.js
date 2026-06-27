import { Prisma } from '@prisma/client'
import { prisma } from '../config/db.js'
import { createDatabaseBackup } from '../services/backupService.js'
import { createAuditLog } from '../services/auditService.js'
import { ensureNoActiveShowroomOpname } from './showroomOpnameController.js'
import { ensureKsuStandards, ensureKsuChecksForStockUnits } from './showroomKsu.js'

// Batas aman jumlah parameter (?) per statement SQLite.
const SQL_VAR_CAP = 4000

// Ambil set nilai unik yang SUDAH ada dalam 1 query (hindari findUnique per baris).
// Dipakai untuk menghitung created vs updated.
async function fetchExistingKeys(client, { records, model, uniqueField }) {
  const keys = [...new Set(records.map((r) => r[uniqueField]).filter((v) => v != null))]
  if (keys.length === 0) return new Set()
  const existing = await client[model].findMany({
    where: { [uniqueField]: { in: keys } },
    select: { [uniqueField]: true },
  })
  return new Set(existing.map((e) => e[uniqueField]))
}

// Dedup by uniqueField (baris terakhir menang) — cegah error SQLite "ON CONFLICT
// cannot affect row a second time" bila ada engine_number ganda dalam 1 statement.
function dedupeByKey(records, uniqueField) {
  return [...new Map(records.map((r) => [r[uniqueField], r])).values()]
}

// Bulk upsert: banyak baris per statement via INSERT ... ON CONFLICT DO UPDATE.
// Jauh lebih cepat dari upsert per-baris (puluhan ribu statement → ratusan),
// terutama di disk lambat (VPS). Pakai Prisma.sql agar binding tipe (tanggal!) konsisten.
async function bulkUpsert(client, { records, model, uniqueField }) {
  if (records.length === 0) return
  const colSet = new Set()
  for (const r of records) for (const k of Object.keys(r)) colSet.add(k)
  const columns = [...colSet]

  const tableRaw = Prisma.raw(`"${model}"`)
  const colListRaw = Prisma.raw(columns.map((c) => `"${c}"`).join(', '))
  const conflictRaw = Prisma.raw(`"${uniqueField}"`)
  const updateSetRaw = Prisma.raw(
    columns.filter((c) => c !== uniqueField).map((c) => `"${c}" = excluded."${c}"`).join(', ')
  )
  const batchSize = Math.max(1, Math.floor(SQL_VAR_CAP / columns.length))

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize)
    const rowsSql = chunk.map((rec) => Prisma.sql`(${Prisma.join(columns.map((c) => rec[c] ?? null))})`)
    const query = Prisma.sql`INSERT INTO ${tableRaw} (${colListRaw}) VALUES ${Prisma.join(rowsSql)} ON CONFLICT(${conflictRaw}) DO UPDATE SET ${updateSetRaw}`
    await client.$executeRaw(query)
  }
}

function tally(records, existingKeys, uniqueField) {
  let created = 0
  let updated = 0
  for (const r of records) {
    if (existingKeys.has(r[uniqueField])) updated++
    else created++
  }
  return { created, updated }
}

export async function upsertRecords({ records, model, uniqueField }) {
  const deduped = dedupeByKey(records, uniqueField)
  let result = { created: 0, updated: 0 }
  await prisma.$transaction(async (tx) => {
    const existingKeys = await fetchExistingKeys(tx, { records: deduped, model, uniqueField })
    await bulkUpsert(tx, { records: deduped, model, uniqueField })
    result = tally(deduped, existingKeys, uniqueField)
  }, { maxWait: 20000, timeout: 120000 })
  return result
}

export async function upsertRecordsInTx(tx, { records, model, uniqueField }) {
  const deduped = dedupeByKey(records, uniqueField)
  const existingKeys = await fetchExistingKeys(tx, { records: deduped, model, uniqueField })
  await bulkUpsert(tx, { records: deduped, model, uniqueField })
  return tally(deduped, existingKeys, uniqueField)
}

export async function runShowroomSnapshotImport({
  req,
  records,
  errors,
  model,
  module,
  recordId,
  backupReason,
  includeKsuCleanup = false,
}) {
  const backup = await createDatabaseBackup(backupReason)
  const activeEngineNumbers = records.map((record) => record.engine_number)

  const result = await prisma.$transaction(async (tx) => {
    const { created, updated } = await upsertRecordsInTx(tx, { records, model, uniqueField: 'engine_number' })
    const deleted = await tx[model].deleteMany({
      where: { branch_code: 'DXK', engine_number: { notIn: activeEngineNumbers } },
    })

    if (includeKsuCleanup) {
      await tx.showroom_unit_ksu_checks.deleteMany({
        where: { engine_number: { notIn: activeEngineNumbers } },
      })

      const activeUnits = await tx.showroom_stock_units.findMany({
        where: { engine_number: { in: activeEngineNumbers } },
        select: { engine_number: true, product_type: true, series: true },
      })
      await ensureKsuStandards(tx)
      await ensureKsuChecksForStockUnits(activeUnits, tx)
    }

    if (req.user?.userId) {
      await tx.audit_logs.create({
        data: {
          table_name: 'sync_import',
          record_id: recordId,
          field_name: 'upsert_by_engine_number',
          old_value: null,
          new_value: JSON.stringify({
            rows_success: records.length,
            rows_error: errors.length,
            created,
            updated,
            deleted: deleted.count,
            backup: backup.filename,
          }),
          user_id: req.user.userId,
        },
      })
    }

    await tx.sync_logs.create({
      data: {
        user_id: req.user?.userId,
        module,
        // single import: req.file; combined import (.fields): req.files.file1/file2
        filename: req.file?.originalname
          || [req.files?.file1?.[0]?.originalname, req.files?.file2?.[0]?.originalname].filter(Boolean).join(' + ')
          || null,
        rows_success: records.length,
        rows_error: errors.length,
        error_detail: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
      },
    })

    return { created, updated, deleted: deleted.count }
  }, { maxWait: 20000, timeout: 180000 })

  return { ...result, backup: backup.filename }
}

export async function getSnapshotPreviewMeta(model, records) {
  const activeEngineNumbers = records.map((record) => record.engine_number).filter(Boolean)
  const [currentRows, estimatedDeleted] = await Promise.all([
    prisma[model].count({ where: { branch_code: 'DXK' } }),
    activeEngineNumbers.length > 0
      ? prisma[model].count({ where: { branch_code: 'DXK', engine_number: { notIn: activeEngineNumbers } } })
      : prisma[model].count({ where: { branch_code: 'DXK' } }),
  ])

  return {
    importMode: 'active_snapshot',
    currentRows,
    estimatedDeleted,
    finalRows: records.length,
  }
}
