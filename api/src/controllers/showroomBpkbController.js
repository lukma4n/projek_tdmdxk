import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'
import { ensureNoActiveShowroomOpname } from './showroomOpnameController.js'
import { cleanupUpload, buildBpkbWhere, normalizeDocumentLocation } from './showroomUtils.js'
import { excelDateToJSDate, stringOrNull, parseIntOrZero, formatForExcel } from '../utils/excelUtils.js'
import { runShowroomSnapshotImport, getSnapshotPreviewMeta } from './showroomImport.js'

function parseBpkbFile(filePath) {
  const workbook = xlsx.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false }).slice(4)
  const records = []
  const errors = []
  const seen = new Set()

  for (const row of rows) {
    if (!row || !row[9]) continue
    try {
      if (row[1] !== 'DXK') continue
      const engineNumber = String(row[9]).trim()
      if (seen.has(engineNumber)) continue
      seen.add(engineNumber)

      records.push({
        branch_code: String(row[1] || ''),
        branch_name: String(row[2] || ''),
        stnk_name: stringOrNull(row[3]),
        applicant_name: stringOrNull(row[4]),
        customer_address: stringOrNull(row[5]),
        receipt_number: stringOrNull(row[6]),
        receipt_date: excelDateToJSDate(row[7]),
        bpkb_location: normalizeDocumentLocation(row[8]),
        engine_number: engineNumber,
        bpkb_number: stringOrNull(row[10]),
        bpkb_ready_date: excelDateToJSDate(row[11]),
        finance_company: stringOrNull(row[12]),
        invoice_number: stringOrNull(row[13]),
        customer_phone: stringOrNull(row[14]),
        salesman: stringOrNull(row[15]),
        requestor_name: stringOrNull(row[16]),
        age_raw: stringOrNull(row[17]),
        overdue_days: parseIntOrZero(row[18]),
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  return { records, errors }
}

export async function previewBpkb(req, res, next) {
  try {
    const { records, errors } = parseBpkbFile(req.file.path)
    const snapshot = await getSnapshotPreviewMeta('showroom_bpkbs', records)
    await cleanupUpload(req)
    res.json({
      message: 'Preview BPKB showroom berhasil',
      module: 'showroom_bpkb',
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

export async function uploadBpkb(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('showroom:bpkb', async () => {
      await ensureNoActiveShowroomOpname('bpkb')
      const { records, errors } = parseBpkbFile(req.file.path)
      if (records.length === 0) {
        await cleanupUpload(req)
        return res.status(400).json({ error: 'File BPKB tidak berisi data DXK yang valid' })
      }

      const result = await runShowroomSnapshotImport({
        req,
        records,
        errors,
        model: 'showroom_bpkbs',
        module: 'showroom_bpkb',
        recordId: 'showroom_bpkb',
        backupReason: 'pre_import_showroom_bpkb',
      })

      await cleanupUpload(req)
      res.json({ message: 'Import BPKB showroom selesai', success: records.length, created: result.created, updated: result.updated, deleted: result.deleted, errors: errors.length, errorDetails: errors.slice(0, 10), backup: result.backup })
    }, { module: 'showroom_bpkb', reason: 'active_snapshot' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function getBpkbs(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = buildBpkbWhere(req.query)

    const [data, total] = await Promise.all([
      prisma.showroom_bpkbs.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: { overdue_days: 'desc' } }),
      prisma.showroom_bpkbs.count({ where }),
    ])

    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) {
    next(error)
  }
}

export async function exportBpkbsExcel(req, res, next) {
  try {
    const where = buildBpkbWhere(req.query)
    const bpkbs = await prisma.showroom_bpkbs.findMany({ where, orderBy: { overdue_days: 'desc' } })
    const exportData = bpkbs.map((item, idx) => ({
      No: idx + 1,
      Nama_STNK: item.stnk_name || '-',
      Pemohon: item.applicant_name || item.requestor_name || '-',
      No_Mesin: item.engine_number || '-',
      No_BPKB: item.bpkb_number || '-',
      Lokasi_BPKB: item.bpkb_location || '-',
      Tgl_Terima: formatForExcel(item.receipt_date),
      Jadi_BPKB: formatForExcel(item.bpkb_ready_date),
      Overdue_Hari: item.overdue_days || 0,
      No_Invoice: item.invoice_number || '-',
      No_Resi: item.receipt_number || '-',
      No_HP: item.customer_phone || '-',
      Salesman: item.salesman || '-',
      Leasing: item.finance_company || '-',
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Stock BPKB')

    let suffix = 'Semua'
    if (req.query.location && req.query.location !== 'all') suffix = String(req.query.location).replace(/\s+/g, '_')
    const filename = `Stock_BPKB_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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

export async function getBpkbSummary(req, res, next) {
  try {
    const [total, overdue365, byLocation, latest] = await Promise.all([
      prisma.showroom_bpkbs.count({ where: { branch_code: 'DXK' } }),
      prisma.showroom_bpkbs.count({ where: { branch_code: 'DXK', overdue_days: { gte: 365 } } }),
      prisma.showroom_bpkbs.groupBy({ by: ['bpkb_location'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { bpkb_location: 'desc' } }, take: 10 }),
      prisma.showroom_bpkbs.findFirst({ where: { branch_code: 'DXK' }, orderBy: { synced_at: 'desc' }, select: { synced_at: true } }),
    ])

    res.json({ total, overdue365, byLocation, latestSyncedAt: latest?.synced_at || null })
  } catch (error) {
    next(error)
  }
}

export async function getBpkbFilters(req, res, next) {
  try {
    const locations = await prisma.showroom_bpkbs.groupBy({ by: ['bpkb_location'], where: { branch_code: 'DXK', bpkb_location: { not: null } }, _count: true, orderBy: { _count: { bpkb_location: 'desc' } } })
    res.json({ locations: locations.map((item) => item.bpkb_location) })
  } catch (error) {
    next(error)
  }
}
