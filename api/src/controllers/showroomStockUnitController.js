import xlsx from 'xlsx'
import { safeReadExcel } from '../utils/excelValidator.js'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { clampLimit } from '../utils/pagination.js'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'
import { ensureNoActiveShowroomOpname } from './showroomOpnameController.js'
import { attachBookingToStockUnits } from './unitBookingController.js'
import { runShowroomSnapshotImport, getSnapshotPreviewMeta } from './showroomImport.js'
import {
  PRODUCT_CODE_ALIASES,
  normalizeLocation,
  cleanupUpload,
  buildStockUnitWhere,
  getAgingTagByIncomingDate,
  getAgingFifoDays,
  getMonthByAgingTag,
  matchesAgingTag,
  isPosOrPameranLocation,
} from './showroomUtils.js'
import {
  BATTERY_TYPES,
  ensureKsuStandards,
  ensureKsuChecksForStockUnits,
  attachKsuToStockUnits,
  getKsuSummaryData,
  buildKsuPayload,
  computeKsuStatus,
  computeKsuStandardVerified,
} from './showroomKsu.js'
import {
  excelDateToJSDate,
  parseDays,
  stringOrNull,
  formatForExcel,
} from '../utils/excelUtils.js'

function parseStockUnitFile(filePath) {
  const workbook = safeReadExcel(filePath)
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
        profit_center: row[3] ? String(row[3]) : null,
        product_type: row[4] ? String(row[4]) : null,
        color: row[5] ? String(row[5]) : null,
        incoming_date: excelDateToJSDate(row[6]),
        stock_aging_raw: row[7] ? String(row[7]) : null,
        stock_aging_days: parseDays(row[7]),
        location: normalizeLocation(row[8]),
        movement_aging_raw: row[9] ? String(row[9]) : null,
        movement_aging_days: parseDays(row[9]),
        engine_number: engineNumber,
        chassis_number: row[11] ? String(row[11]) : null,
        engine_state: row[12] ? String(row[12]) : null,
        year: row[13] ? String(row[13]) : null,
        quantity: parseInt(row[14]) || 0,
        cost: parseFloat(row[15]) || 0,
        freight_cost: parseFloat(row[16]) || 0,
        last_movement: row[17] ? String(row[17]) : null,
        last_transaction: row[18] ? String(row[18]) : null,
        branch_destination: row[19] ? String(row[19]) : null,
        parent_category: row[20] ? String(row[20]) : null,
        category_name: row[21] ? String(row[21]) : null,
        series: row[22] ? String(row[22]) : null,
        incoming_date_mutation: excelDateToJSDate(row[23]),
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  return { records, errors }
}

async function enrichStockUnitsWithPrices(units) {
  const productCodes = [...new Set(units.map((unit) => PRODUCT_CODE_ALIASES[unit.product_type] || unit.product_type).filter(Boolean))]
  const otrPrices = await prisma.showroom_otr_prices.findMany({ where: { product_code: { in: productCodes } } })
  const otrPriceByCode = new Map(otrPrices.map((item) => [item.product_code, item]))

  return units.map((unit) => {
    const lookupCode = PRODUCT_CODE_ALIASES[unit.product_type] || unit.product_type
    const otrPrice = otrPriceByCode.get(lookupCode)
    return {
      ...unit,
      otr_price: otrPrice?.otr_price || null,
      off_road_price: otrPrice?.off_road_price || null,
      dealer_purchase_price: otrPrice?.dealer_purchase_price || null,
      otr_product_code: otrPrice?.product_code || null,
      otr_model_name: otrPrice?.model_name || null,
    }
  })
}

export async function previewStockUnit(req, res, next) {
  try {
    const { records, errors } = parseStockUnitFile(req.file.path)
    const snapshot = await getSnapshotPreviewMeta('showroom_stock_units', records)
    await cleanupUpload(req)
    res.json({
      message: 'Preview stock unit berhasil',
      module: 'showroom_stock_unit',
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

export async function uploadStockUnit(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('showroom:unit', async () => {
      await ensureNoActiveShowroomOpname('unit')
      const { records, errors } = parseStockUnitFile(req.file.path)
      if (records.length === 0) {
        await cleanupUpload(req)
        return res.status(400).json({ error: 'File stock unit tidak berisi data DXK yang valid' })
      }

      const result = await runShowroomSnapshotImport({
        req,
        records,
        errors,
        model: 'showroom_stock_units',
        module: 'showroom_stock_unit',
        recordId: 'showroom_stock_unit',
        backupReason: 'pre_import_showroom_stock_unit',
        includeKsuCleanup: true,
      })

      await cleanupUpload(req)
      res.json({
        message: 'Import stock unit showroom selesai',
        success: records.length,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        backup: result.backup,
      })
    }, { module: 'showroom_stock_unit', reason: 'active_snapshot' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

function applyAgingTagFilter(where, agingTag) {
  const month = getMonthByAgingTag(agingTag)
  if (!month) return where

  const now = new Date()
  const year = now.getFullYear()
  const dateRanges = []
  for (let y = year - 2; y <= year; y++) {
    dateRanges.push({
      incoming_date: {
        gte: new Date(y, month - 1, 1),
        lt: new Date(y, month, 1),
      },
    })
  }

  const existingFilters = Object.entries(where).filter(([k]) => k !== 'OR' && k !== 'AND')
  const baseWhere = Object.fromEntries(existingFilters)
  const orConditions = [...dateRanges]
  if (where.OR) orConditions.push(...where.OR)

  return { ...baseWhere, OR: orConditions }
}

export async function getStockUnits(req, res, next) {
  try {
    const { page = 1, limit = 50, aging_tag } = req.query
    const pageInt = parseInt(page)
    const limitInt = clampLimit(limit, 50)
    let where = buildStockUnitWhere(req.query)
    if (aging_tag && /^[A-L]$/i.test(String(aging_tag))) {
      where = applyAgingTagFilter(where, aging_tag)
    }

    const [data, total] = await Promise.all([
      prisma.showroom_stock_units.findMany({
        where,
        skip: (pageInt - 1) * limitInt,
        take: limitInt,
        orderBy: { stock_aging_days: 'desc' },
      }),
      prisma.showroom_stock_units.count({ where }),
    ])

    const withKsu = await attachKsuToStockUnits(await enrichStockUnitsWithPrices(data), prisma)
    const enrichedData = await attachBookingToStockUnits(withKsu)

    res.json({ data: enrichedData, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) {
    next(error)
  }
}

export async function exportStockUnitsExcel(req, res, next) {
  try {
    const where = buildStockUnitWhere(req.query)
    let whereExport = buildStockUnitWhere(req.query)
    if (req.query.aging_tag && /^[A-L]$/i.test(String(req.query.aging_tag))) {
      whereExport = applyAgingTagFilter(whereExport, req.query.aging_tag)
    }
    const units = await prisma.showroom_stock_units.findMany({ where: whereExport, orderBy: { stock_aging_days: 'desc' } })
    const enriched = await enrichStockUnitsWithPrices(units)

    const exportData = enriched.map((unit, idx) => ({
      No: idx + 1,
      Series: unit.series || '-',
      Kode_Produk: unit.product_type || '-',
      Warna: unit.color || '-',
      No_Mesin: unit.engine_number || '-',
      No_Rangka: unit.chassis_number || '-',
      Lokasi: unit.location || '-',
      Aging_Hari: unit.stock_aging_days || 0,
      Tag_Aging: getAgingTagByIncomingDate(unit.incoming_date),
      Aging_FIFO_Hari: getAgingFifoDays(unit),
      Dasar_Aging_FIFO: isPosOrPameranLocation(unit.location) ? 'Movement Aging' : 'Incoming Date',
      Tgl_Masuk: formatForExcel(unit.incoming_date),
      State: unit.engine_state || '-',
      Tahun: unit.year || '-',
      Harga_OTR: unit.otr_price || 0,
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 22 },
      { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
      { wch: 14 }, { wch: 8 }, { wch: 14 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Stock Unit')

    let suffix = 'Semua'
    if (req.query.aging_min && req.query.aging_min !== 'all') suffix += `_aging${req.query.aging_min}`
    if (req.query.aging_tag && /^[A-L]$/i.test(String(req.query.aging_tag))) suffix += `_tag${String(req.query.aging_tag).toUpperCase()}`
    if (req.query.location && req.query.location !== 'all') suffix += `_${String(req.query.location).replace(/\s+/g, '_')}`
    const filename = `Stock_Unit_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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

export async function getStockUnitSummary(req, res, next) {
  try {
    const [total, aging60, aging90, bySeries, byLocation, ksu] = await Promise.all([
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK' } }),
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK', stock_aging_days: { gte: 60 } } }),
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK', stock_aging_days: { gte: 90 } } }),
      prisma.showroom_stock_units.groupBy({ by: ['series'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { series: 'desc' } }, take: 10 }),
      prisma.showroom_stock_units.groupBy({ by: ['location'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { location: 'desc' } }, take: 10 }),
      getKsuSummaryData(prisma),
    ])

    res.json({ total, aging60, aging90, bySeries, byLocation, ksu })
  } catch (error) {
    next(error)
  }
}

export async function getStockUnitFilters(req, res, next) {
  try {
    const [series, states, locations] = await Promise.all([
      prisma.showroom_stock_units.groupBy({ by: ['series'], where: { branch_code: 'DXK', series: { not: null } }, _count: true, orderBy: { _count: { series: 'desc' } } }),
      prisma.showroom_stock_units.groupBy({ by: ['engine_state'], where: { branch_code: 'DXK', engine_state: { not: null } }, _count: true, orderBy: { _count: { engine_state: 'desc' } } }),
      prisma.showroom_stock_units.groupBy({ by: ['location'], where: { branch_code: 'DXK', location: { not: null } }, _count: true, orderBy: { _count: { location: 'desc' } } }),
    ])

    res.json({
      series: series.map((item) => item.series),
      states: states.map((item) => item.engine_state),
      locations: locations.map((item) => item.location),
    })
  } catch (error) {
    next(error)
  }
}

export async function getKsuStandards(req, res, next) {
  try {
    await ensureKsuStandards(prisma)
    await ensureKsuChecksForStockUnits(null, prisma)
    const standards = await prisma.showroom_ksu_standards.findMany({ orderBy: [{ series: 'asc' }, { product_type: 'asc' }] })
    res.json({ data: standards, batteryTypes: BATTERY_TYPES })
  } catch (error) {
    next(error)
  }
}

export async function updateKsuStandard(req, res, next) {
  try {
    const productType = decodeURIComponent(req.params.productType)
    const { battery_required, standard_battery_type } = req.body
    if (standard_battery_type && !BATTERY_TYPES.includes(standard_battery_type)) {
      return res.status(400).json({ error: 'Tipe aki tidak valid' })
    }

    const data = {
      battery_required: Boolean(battery_required),
      helmet_required: req.body.helmet_required !== false,
      service_book_required: req.body.service_book_required !== false,
      tool_kit_required: req.body.tool_kit_required !== false,
      mirror_required: req.body.mirror_required !== false,
      standard_battery_type: battery_required ? (standard_battery_type || null) : null,
      updated_by: req.user?.userId || null,
    }

    const standard = await prisma.showroom_ksu_standards.update({
      where: { product_type: productType },
      data: {
        ...data,
        is_verified: computeKsuStandardVerified(data),
      },
    })

    res.json({ message: 'Master KSU diperbarui', data: standard })
  } catch (error) {
    next(error)
  }
}

export async function getUnitKsu(req, res, next) {
  try {
    await ensureKsuStandards(prisma)
    const engineNumber = decodeURIComponent(req.params.engineNumber)
    const unit = await prisma.showroom_stock_units.findUnique({ where: { engine_number: engineNumber } })
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })
    await ensureKsuChecksForStockUnits([unit], prisma)

    const [check, standard] = await Promise.all([
      prisma.showroom_unit_ksu_checks.findUnique({ where: { engine_number: engineNumber } }),
      unit.product_type ? prisma.showroom_ksu_standards.findUnique({ where: { product_type: unit.product_type } }) : null,
    ])

    res.json({ unit, ksu: buildKsuPayload(check, standard), batteryTypes: BATTERY_TYPES })
  } catch (error) {
    next(error)
  }
}

export async function updateUnitKsu(req, res, next) {
  try {
    await ensureKsuStandards(prisma)
    const engineNumber = decodeURIComponent(req.params.engineNumber)
    const unit = await prisma.showroom_stock_units.findUnique({ where: { engine_number: engineNumber } })
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })

    const standard = unit.product_type ? await prisma.showroom_ksu_standards.findUnique({ where: { product_type: unit.product_type } }) : null
    const actualBatteryType = stringOrNull(req.body.actual_battery_type)
    if (actualBatteryType && !BATTERY_TYPES.includes(actualBatteryType)) {
      return res.status(400).json({ error: 'Tipe aki aktual tidak valid' })
    }

    const baseData = {
      has_helmet: Boolean(req.body.has_helmet),
      has_service_book: Boolean(req.body.has_service_book),
      has_tool_kit: Boolean(req.body.has_tool_kit),
      has_mirror: Boolean(req.body.has_mirror),
      has_battery: Boolean(req.body.has_battery),
      actual_battery_type: actualBatteryType,
      notes: stringOrNull(req.body.notes),
      checked_by: req.user?.userId || null,
      checked_at: new Date(),
    }
    const draft = { ...baseData, status: req.body.status === 'sudah_diserahkan' ? 'sudah_diserahkan' : 'belum_lengkap' }
    const status = req.body.status === 'sudah_diserahkan' ? 'sudah_diserahkan' : computeKsuStatus(draft, standard)
    const handoverData = status === 'sudah_diserahkan' ? { handed_over_by: req.user?.userId || null, handed_over_at: new Date() } : {}

    const check = await prisma.showroom_unit_ksu_checks.upsert({
      where: { engine_number: engineNumber },
      update: { ...baseData, status, ...handoverData },
      create: { engine_number: engineNumber, ...baseData, status, ...handoverData },
    })

    res.json({ message: 'Checklist KSU diperbarui', ksu: buildKsuPayload(check, standard) })
  } catch (error) {
    next(error)
  }
}
