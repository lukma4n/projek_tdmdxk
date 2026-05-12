import { prisma } from '../config/db.js'
import { createDatabaseBackup } from '../services/backupService.js'
import { createAuditLog } from '../services/auditService.js'
import { cleanupUpload, parseOtrPriceFile, parseOffPurchasePriceFile } from './showroomUtils.js'
import { parsePrice } from '../utils/excelUtils.js'
import { upsertRecords } from './showroomImport.js'
import { withImportLock } from '../services/importLockService.js'

export async function previewOtrPrices(req, res, next) {
  try {
    const { records, errors } = parseOtrPriceFile(req.file.path, req.file.originalname, parsePrice)
    await cleanupUpload(req)
    res.json({
      message: 'Preview Harga OTR berhasil',
      module: 'showroom_otr_price',
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

export async function uploadOtrPrices(req, res, next) {
  try {
    await withImportLock('showroom:otr', async () => {
    const { records, errors } = parseOtrPriceFile(req.file.path, req.file.originalname, parsePrice)
    const backup = await createDatabaseBackup('pre_import_showroom_otr_price')
    const { created, updated } = await upsertRecords({ records, model: 'showroom_otr_prices', uniqueField: 'product_code' })

    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'sync_import',
      recordId: 'showroom_otr_price',
      fieldName: 'upsert_by_product_code',
      newValue: { rows_success: records.length, rows_error: errors.length, created, updated, backup: backup.filename },
    })

    await cleanupUpload(req)
    res.json({ message: 'Import Harga OTR selesai', success: records.length, created, updated, errors: errors.length, errorDetails: errors.slice(0, 10), backup: backup.filename })
    })
  } catch (error) {
    await cleanupUpload(req).catch(() => {})
    next(error)
  }
}

export async function previewOffPurchasePrices(req, res, next) {
  try {
    const { records, purchaseRows, offRoadRows, errors } = parseOffPurchasePriceFile(req.file.path, req.file.originalname, parsePrice)
    await cleanupUpload(req)
    res.json({
      message: 'Preview Harga Off & Beli berhasil',
      module: 'showroom_off_purchase_price',
      validRows: records.length,
      purchaseRows,
      offRoadRows,
      errorRows: errors.length,
      sample: records.slice(0, 5),
      errorDetails: errors.slice(0, 10),
    })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function uploadOffPurchasePrices(req, res, next) {
  try {
    await withImportLock('showroom:off_purchase', async () => {
    const { records, purchaseRows, offRoadRows, errors } = parseOffPurchasePriceFile(req.file.path, req.file.originalname, parsePrice)
    const backup = await createDatabaseBackup('pre_import_showroom_off_purchase_price')
    const { created, updated } = await upsertRecords({ records, model: 'showroom_otr_prices', uniqueField: 'product_code' })

    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'sync_import',
      recordId: 'showroom_off_purchase_price',
      fieldName: 'upsert_by_product_code',
      newValue: { rows_success: records.length, purchase_rows: purchaseRows, off_road_rows: offRoadRows, rows_error: errors.length, created, updated, backup: backup.filename },
    })

    await cleanupUpload(req)
    res.json({ message: 'Import Harga Off & Beli selesai', success: records.length, purchaseRows, offRoadRows, created, updated, errors: errors.length, errorDetails: errors.slice(0, 10), backup: backup.filename })
    })
  } catch (error) {
    await cleanupUpload(req).catch(() => {})
    next(error)
  }
}

export async function getOtrPrices(req, res, next) {
  try {
    const { page = 1, limit = 100, search } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = {}

    if (search) {
      where.OR = [
        { product_code: { contains: search } },
        { model_name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.showroom_otr_prices.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: { product_code: 'asc' } }),
      prisma.showroom_otr_prices.count({ where }),
    ])

    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) {
    next(error)
  }
}

export async function getOtrPriceSummary(req, res, next) {
  try {
    const [total, completePrices, latest] = await Promise.all([
      prisma.showroom_otr_prices.count(),
      prisma.showroom_otr_prices.count({ where: { otr_price: { gt: 0 }, off_road_price: { gt: 0 }, dealer_purchase_price: { gt: 0 } } }),
      prisma.showroom_otr_prices.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, effective_date: true, source_file: true } }),
    ])
    res.json({ total, completePrices, latestSyncedAt: latest?.synced_at || null, effectiveDate: latest?.effective_date || null, sourceFile: latest?.source_file || null })
  } catch (error) {
    next(error)
  }
}
