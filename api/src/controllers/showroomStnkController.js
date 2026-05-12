import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'
import { ensureNoActiveShowroomOpname } from './showroomOpnameController.js'
import { cleanupUpload, buildStnkWhere, normalizeDocumentLocation } from './showroomUtils.js'
import { excelDateToJSDate, stringOrNull, formatForExcel } from '../utils/excelUtils.js'
import { runShowroomSnapshotImport, getSnapshotPreviewMeta } from './showroomImport.js'

function parseStnkFile(filePath) {
  const workbook = xlsx.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false }).slice(4)
  const records = []
  const errors = []
  const seen = new Set()

  for (const row of rows) {
    if (!row || !row[10]) continue
    try {
      if (row[1] !== 'DXK') continue
      const engineNumber = String(row[10]).trim()
      if (seen.has(engineNumber)) continue
      seen.add(engineNumber)

      records.push({
        branch_code: String(row[1] || ''),
        branch_name: String(row[2] || ''),
        stnk_name: stringOrNull(row[3]),
        customer_code: stringOrNull(row[4]),
        customer_address: stringOrNull(row[5]),
        sale_order_number: stringOrNull(row[6]),
        receipt_number: stringOrNull(row[7]),
        receipt_date: excelDateToJSDate(row[8]),
        stnk_location: normalizeDocumentLocation(row[9]),
        engine_number: engineNumber,
        stnk_ready_date: excelDateToJSDate(row[8]),
        stnk_expired_date: excelDateToJSDate(row[11]),
        police_number: stringOrNull(row[12]),
        mobile: stringOrNull(row[13]),
        applicant_name: stringOrNull(row[14]),
        age_raw: stringOrNull(row[15]),
        salesman: stringOrNull(row[16]),
        finance_company: stringOrNull(row[17]),
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  return { records, errors }
}

export async function previewStnk(req, res, next) {
  try {
    const { records, errors } = parseStnkFile(req.file.path)
    const snapshot = await getSnapshotPreviewMeta('showroom_stnks', records)
    await cleanupUpload(req)
    res.json({
      message: 'Preview STNK showroom berhasil',
      module: 'showroom_stnk',
      ...snapshot,
      validRows: records.length,
      errorRows: errors.length,
      sample: records.slice(0, 5),
      errorDetails: errors.slice(0, 10),
    })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function uploadStnk(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('showroom:stnk', async () => {
      await ensureNoActiveShowroomOpname('stnk')
      const { records, errors } = parseStnkFile(req.file.path)
      if (records.length === 0) {
        await cleanupUpload(req)
        return res.status(400).json({ error: 'File STNK tidak berisi data DXK yang valid' })
      }

      const result = await runShowroomSnapshotImport({
        req,
        records,
        errors,
        model: 'showroom_stnks',
        module: 'showroom_stnk',
        recordId: 'showroom_stnk',
        backupReason: 'pre_import_showroom_stnk',
      })

      await cleanupUpload(req)
      res.json({ message: 'Import STNK showroom selesai', success: records.length, created: result.created, updated: result.updated, deleted: result.deleted, errors: errors.length, errorDetails: errors.slice(0, 10), backup: result.backup })
    }, { module: 'showroom_stnk', reason: 'active_snapshot' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function getStnks(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = buildStnkWhere(req.query)

    const [data, total] = await Promise.all([
      prisma.showroom_stnks.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: { receipt_date: 'desc' } }),
      prisma.showroom_stnks.count({ where }),
    ])

    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) {
    next(error)
  }
}

export async function exportStnksExcel(req, res, next) {
  try {
    const where = buildStnkWhere(req.query)
    const stnks = await prisma.showroom_stnks.findMany({ where, orderBy: { receipt_date: 'desc' } })
    const exportData = stnks.map((item, idx) => ({
      No: idx + 1,
      Nama_STNK: item.stnk_name || '-',
      Pemohon: item.applicant_name || '-',
      No_Mesin: item.engine_number || '-',
      No_Polisi: item.police_number || '-',
      Lokasi_STNK: item.stnk_location || '-',
      Tgl_Terima: formatForExcel(item.receipt_date),
      Jadi_STNK: formatForExcel(item.stnk_ready_date),
      Expired_STNK: formatForExcel(item.stnk_expired_date),
      No_SO: item.sale_order_number || '-',
      No_Resi: item.receipt_number || '-',
      No_HP: item.mobile || '-',
      Salesman: item.salesman || '-',
      Leasing: item.finance_company || '-',
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Stock STNK')

    let suffix = 'Semua'
    if (req.query.location && req.query.location !== 'all') suffix = String(req.query.location).replace(/\s+/g, '_')
    const filename = `Stock_STNK_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
    const tmpPath = path.join(os.tmpdir(), filename)
    xlsx.writeFile(wb, tmpPath)

    res.download(tmpPath, filename, (err) => {
      if (err) console.error('Download error:', err)
      try { rmSync(tmpPath) } catch (e) {}
    })
  } catch (error) {
    next(error)
  }
}

export async function getStnkSummary(req, res, next) {
  try {
    const [total, byLocation, latest] = await Promise.all([
      prisma.showroom_stnks.count({ where: { branch_code: 'DXK' } }),
      prisma.showroom_stnks.groupBy({ by: ['stnk_location'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { stnk_location: 'desc' } }, take: 10 }),
      prisma.showroom_stnks.findFirst({ where: { branch_code: 'DXK' }, orderBy: { synced_at: 'desc' }, select: { synced_at: true } }),
    ])

    res.json({ total, byLocation, latestSyncedAt: latest?.synced_at || null })
  } catch (error) {
    next(error)
  }
}

export async function getStnkFilters(req, res, next) {
  try {
    const locations = await prisma.showroom_stnks.groupBy({ by: ['stnk_location'], where: { branch_code: 'DXK', stnk_location: { not: null } }, _count: true, orderBy: { _count: { stnk_location: 'desc' } } })
    res.json({ locations: locations.map((item) => item.stnk_location) })
  } catch (error) {
    next(error)
  }
}
