import { prisma } from '../config/db.js'
import { createDatabaseBackup } from '../services/backupService.js'
import { createAuditLog } from '../services/auditService.js'
import { ensureNoActiveShowroomOpname } from './showroomOpnameController.js'
import { ensureKsuStandards, ensureKsuChecksForStockUnits } from './showroomKsu.js'

// Ambil set nilai unik yang SUDAH ada dalam 1 query (hindari findUnique per baris
// yang menggandakan jumlah query). Dipakai untuk menghitung created vs updated.
async function fetchExistingKeys(client, { records, model, uniqueField }) {
  const keys = [...new Set(records.map((r) => r[uniqueField]).filter((v) => v != null))]
  if (keys.length === 0) return new Set()
  const existing = await client[model].findMany({
    where: { [uniqueField]: { in: keys } },
    select: { [uniqueField]: true },
  })
  return new Set(existing.map((e) => e[uniqueField]))
}

export async function upsertRecords({ records, model, uniqueField }) {
  let created = 0
  let updated = 0

  await prisma.$transaction(async (tx) => {
    const existingKeys = await fetchExistingKeys(tx, { records, model, uniqueField })
    for (const record of records) {
      const where = { [uniqueField]: record[uniqueField] }
      await tx[model].upsert({ where, update: record, create: record })
      if (existingKeys.has(record[uniqueField])) updated++
      else created++
    }
  }, { maxWait: 20000, timeout: 120000 })

  return { created, updated }
}

export async function upsertRecordsInTx(tx, { records, model, uniqueField }) {
  let created = 0
  let updated = 0

  const existingKeys = await fetchExistingKeys(tx, { records, model, uniqueField })
  for (const record of records) {
    const where = { [uniqueField]: record[uniqueField] }
    await tx[model].upsert({ where, update: record, create: record })
    if (existingKeys.has(record[uniqueField])) updated++
    else created++
  }

  return { created, updated }
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
        filename: req.file.originalname,
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
