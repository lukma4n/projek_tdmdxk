import { prisma } from '../config/db.js'
import { delCache } from '../config/redis.js'
import fs from 'fs/promises'
import { createDatabaseBackup, listDatabaseBackups, restoreDatabaseBackup, cleanupPreImportBackups } from '../services/backupService.js'
import { parseHotlineFile, parseStockFile, parseWorkshopFile, parseImportFile } from '../services/importParsers.js'
import { createAuditLog, getOperationalAuditLogs } from '../services/auditService.js'
import { endMaintenance, startMaintenance } from '../services/maintenanceService.js'
import { withImportLock } from '../services/importLockService.js'
import { bulkUpsertWorkOrders } from '../services/workshopImportService.js'
import { ensureNoActiveOpname, OPEN_IMPORT_BLOCK_STATUSES } from './opnameController.js'

async function cleanupUpload(req) {
  if (req.file?.path) await fs.unlink(req.file.path).catch(() => { })
}

export async function uploadHotline(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('sync:hotline', async () => {
      const { records: validRecords, errors } = parseHotlineFile(req.file.path)
      const backup = await createDatabaseBackup('pre_import_hotline')

      // Upsert by no_hotline
      await prisma.$transaction(async (tx) => {
        for (const record of validRecords) {
          await tx.hotlines.upsert({
            where: { no_hotline: record.no_hotline },
            update: record,
            create: record
          })
        }
      }, { maxWait: 20000, timeout: 120000 })

      await prisma.sync_logs.create({
        data: {
          user_id: req.user?.userId,
          module: 'hotline',
          filename: req.file.originalname,
          rows_success: validRecords.length,
          rows_error: errors.length,
          error_detail: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        },
      })

      await createAuditLog({
        userId: req.user?.userId,
        tableName: 'sync_import',
        recordId: 'hotline',
        fieldName: 'upsert_by_no_hotline',
        newValue: {
          module: 'hotline',
          filename: req.file.originalname,
          rows_success: validRecords.length,
          rows_error: errors.length,
          backup: backup.filename,
        },
      })

      await delCache('dashboard:summary')
      await delCache('hotlines:*')
      await cleanupUpload(req)

      res.json({
        message: 'Import hotline selesai',
        success: validRecords.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        backup: backup.filename,
      })
    }, { module: 'hotline', reason: 'replace_all' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function uploadStock(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('sync:stock', async () => {
      await ensureNoActiveOpname()
      const { records: validRecords, locationRecords, errors } = parseStockFile(req.file.path)
      if (!validRecords.length) {
        const err = new Error('File tidak berisi data stock yang valid')
        err.statusCode = 400
        throw err
      }
      const backup = await createDatabaseBackup('pre_import_stock')

      // Snapshot Upsert by product_code
      await prisma.$transaction(async (tx) => {
        const activeProductCodes = validRecords.map(r => r.product_code).filter(Boolean)
        
        for (const record of validRecords) {
          await tx.stock_parts.upsert({
            where: { product_code: record.product_code },
            update: record,
            create: record
          })
        }
        
        await tx.stock_parts.deleteMany({
          where: { product_code: { notIn: activeProductCodes } }
        })

        // Bersihkan opname_items dari sesi non-aktif yang mereferensikan product_code yg sudah dihapus
        await tx.opname_items.deleteMany({
          where: {
            product_code: { notIn: activeProductCodes },
            session: { status: { notIn: OPEN_IMPORT_BLOCK_STATUSES } },
          },
        })

        await tx.stock_part_locations.deleteMany()
        if (locationRecords.length > 0) {
          await tx.stock_part_locations.createMany({ data: locationRecords })
        }
      }, { maxWait: 20000, timeout: 120000 })

      await prisma.sync_logs.create({
        data: {
          user_id: req.user?.userId,
          module: 'stock',
          filename: req.file.originalname,
          rows_success: validRecords.length,
          rows_error: errors.length,
          error_detail: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        },
      })

      await createAuditLog({
        userId: req.user?.userId,
        tableName: 'sync_import',
        recordId: 'stock',
        fieldName: 'active_snapshot_upsert',
        newValue: {
          module: 'stock',
          filename: req.file.originalname,
          rows_success: validRecords.length,
          rows_error: errors.length,
          backup: backup.filename,
        },
      })

      await delCache('dashboard:summary')
      await delCache('stock:*')
      await cleanupUpload(req)

      res.json({
        message: 'Import stok selesai',
        success: validRecords.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        locationDetailCount: locationRecords.length,
        backup: backup.filename,
      })
    }, { module: 'stock', reason: 'replace_all' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function uploadWorkshop(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('sync:workshop', async () => {
      const { records: finalRecords, errors, preview } = await parseWorkshopFile(req.file.path)
      const backup = await createDatabaseBackup('pre_import_workshop')

      const woNumbers = finalRecords.map((record) => record.wo_number)
      const existingWos = await prisma.work_orders.findMany({
        where: { wo_number: { in: woNumbers } },
        select: { wo_number: true },
      })
      const existingWoNumbers = new Set(existingWos.map((wo) => wo.wo_number))
      const createdCount = woNumbers.filter((wo) => !existingWoNumbers.has(wo)).length
      const updatedCount = woNumbers.length - createdCount

      // Upsert by wo_number: preserves other work orders, allows daily/incremental updates!
      await prisma.$transaction(async (tx) => {
        await bulkUpsertWorkOrders(tx, finalRecords)
      }, { maxWait: 20000, timeout: 120000 })

      await prisma.sync_logs.create({
        data: {
          user_id: req.user?.userId,
          module: 'workshop',
          filename: req.file.originalname,
          rows_success: finalRecords.length,
          rows_error: errors.length,
          error_detail: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        },
      })

      await createAuditLog({
        userId: req.user?.userId,
        tableName: 'sync_import',
        recordId: 'workshop',
        fieldName: 'upsert_by_wo_number',
        newValue: {
          module: 'workshop',
          import_mode: 'workshop_upsert_by_wo',
          filename: req.file.originalname,
          rows_success: finalRecords.length,
          rows_error: errors.length,
          created: createdCount,
          updated: updatedCount,
          date_range: preview.dateRange,
          warnings: preview.warnings,
          backup: backup.filename,
        },
      })

      await delCache('dashboard:summary')
      await delCache('workshop:*')
      await cleanupUpload(req)

      res.json({
        message: 'Import Workshop selesai',
        success: finalRecords.length,
        created: createdCount,
        updated: updatedCount,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        importMode: 'workshop_upsert_by_wo',
        dateRange: preview.dateRange,
        warnings: preview.warnings,
        backup: backup.filename,
      })
    }, { module: 'workshop', reason: 'upsert_wo' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function previewImport(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    const result = await parseImportFile(req.params.module, req.file.path)
    const preview = { ...result.preview }

    if (req.params.module === 'sales') {
      const soNumbers = result.records.map((record) => record.so_number)
      const existingCustomers = await prisma.customers.findMany({
        where: { so_number: { in: soNumbers } },
        select: { so_number: true },
      })
      const existingSoNumbers = new Set(existingCustomers.map((c) => c.so_number))
      const existingCount = soNumbers.filter((so) => existingSoNumbers.has(so)).length
      const newCount = result.records.length - existingCount
      preview.existingCount = existingCount
      preview.newCount = newCount
      preview.soNumbersSample = result.records.slice(0, 5).map((r) => r.so_number)
    } else if (req.params.module === 'workshop') {
      const woNumbers = result.records.map((record) => record.wo_number)
      const existingWos = await prisma.work_orders.findMany({
        where: { wo_number: { in: woNumbers } },
        select: { wo_number: true },
      })
      const existingWoNumbers = new Set(existingWos.map((w) => w.wo_number))
      const existingCount = woNumbers.filter((wo) => existingWoNumbers.has(wo)).length
      const newCount = result.records.length - existingCount
      preview.existingCount = existingCount
      preview.newCount = newCount
      preview.woNumbersSample = result.records.slice(0, 5).map((r) => r.wo_number)
    } else if (req.params.module === 'stock') {
      const activeProductCodes = result.records.map(r => r.product_code).filter(Boolean)
      const [currentRows, estimatedDeleted] = await Promise.all([
        prisma.stock_parts.count(),
        activeProductCodes.length > 0
          ? prisma.stock_parts.count({ where: { product_code: { notIn: activeProductCodes } } })
          : prisma.stock_parts.count()
      ])
      preview.currentRows = currentRows
      preview.estimatedDeleted = estimatedDeleted
      preview.finalRows = result.records.length
    }

    await cleanupUpload(req)
    res.json({ message: 'Preview import berhasil', ...preview })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function createBackup(req, res, next) {
  try {
    const backup = await createDatabaseBackup('manual')
    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'database_backup',
      recordId: backup.filename,
      fieldName: 'manual_backup',
      newValue: backup,
    })
    res.json({ message: 'Backup database berhasil dibuat', data: backup })
  } catch (error) {
    next(error)
  }
}

export async function getBackups(req, res, next) {
  try {
    const backups = await listDatabaseBackups()
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0)
    res.json({ data: backups, meta: { total: backups.length, total_size: totalSize } })
  } catch (error) {
    next(error)
  }
}

export async function cleanupBackups(req, res, next) {
  try {
    const keepLatest = req.body?.keep_latest || 30
    const result = await cleanupPreImportBackups(keepLatest)
    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'database_backup',
      recordId: 'pre_import_cleanup',
      fieldName: 'cleanup_pre_import_backups',
      newValue: result,
    })
    res.json({ message: 'Cleanup backup selesai', data: result })
  } catch (error) {
    next(error)
  }
}

export async function restoreBackup(req, res, next) {
  let maintenanceStarted = false
  try {
    maintenanceStarted = startMaintenance(`restore:${req.params.filename}`)
    if (!maintenanceStarted) {
      return res.status(409).json({ error: 'Operasi restore sedang berjalan. Coba lagi setelah selesai.' })
    }

    await prisma.$disconnect()
    const result = await restoreDatabaseBackup(req.params.filename)
    await prisma.$connect()

    const integrityRows = await prisma.$queryRawUnsafe('PRAGMA integrity_check;')
    const integrityValue = integrityRows?.[0]?.integrity_check || integrityRows?.[0]?.integrity_check?.toString?.() || null
    if (String(integrityValue).toLowerCase() !== 'ok') {
      const integrityError = new Error('Integrity check SQLite gagal setelah restore')
      integrityError.status = 500
      throw integrityError
    }

    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'database_restore',
      recordId: req.params.filename,
      fieldName: 'restore_backup',
      oldValue: { restored_from: req.params.filename },
      newValue: { ...result, integrity_check: integrityValue },
    })
    res.json({ message: 'Restore database berhasil', data: { ...result, integrity_check: integrityValue } })
  } catch (error) {
    await prisma.$connect().catch(() => { })
    next(error)
  } finally {
    if (maintenanceStarted) endMaintenance()
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const logs = await getOperationalAuditLogs()
    res.json({ data: logs })
  } catch (error) {
    next(error)
  }
}

export async function getSyncLogs(req, res, next) {
  try {
    const logs = await prisma.sync_logs.findMany({
      orderBy: { synced_at: 'desc' },
      take: 50,
    })

    res.json({ data: logs })
  } catch (error) {
    next(error)
  }
}
