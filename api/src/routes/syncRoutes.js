import { Router } from 'express'
import {
  uploadHotline,
  uploadStock,
  uploadWorkshop,
  getSyncLogs,
  previewImport,
  createBackup,
  getBackups,
  restoreBackup,
  getAuditLogs,
  cleanupBackups,
} from '../controllers/syncController.js'
import { uploadSales } from '../controllers/customerController.js'
import { authenticate, authorize, authorizeMenu } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

import { validate, schemas } from '../middleware/validate.js'

const router = Router()
const backupAccess = authorize('IT Master')

const previewModule = (module) => (req, res, next) => {
  req.params.module = module
  next()
}

router.post('/hotline/preview', authenticate, authorizeMenu('IMPORT_HOTLINE'), upload.single('file'), previewModule('hotline'), previewImport)
router.post('/stock/preview', authenticate, authorizeMenu('IMPORT_STOCK'), upload.single('file'), previewModule('stock'), previewImport)
router.post('/workshop/preview', authenticate, authorizeMenu('IMPORT_WORKSHOP'), upload.single('file'), previewModule('workshop'), previewImport)
router.post('/sales/preview', authenticate, authorizeMenu('IMPORT_SALES'), upload.single('file'), previewModule('sales'), previewImport)
router.post('/hotline', authenticate, authorizeMenu('IMPORT_HOTLINE'), upload.single('file'), uploadHotline)
router.post('/stock', authenticate, authorizeMenu('IMPORT_STOCK'), upload.single('file'), uploadStock)
router.post('/workshop', authenticate, authorizeMenu('IMPORT_WORKSHOP'), upload.single('file'), uploadWorkshop)
router.post('/sales', authenticate, authorizeMenu('IMPORT_SALES'), upload.single('file'), uploadSales)
router.get('/logs', authenticate, backupAccess, getSyncLogs)
router.get('/audit-logs', authenticate, backupAccess, getAuditLogs)
router.get('/backups', authenticate, backupAccess, getBackups)
router.post('/backups', authenticate, backupAccess, createBackup)
router.post('/backups/cleanup', authenticate, backupAccess, validate(schemas.cleanupBackups), cleanupBackups)
router.post('/backups/:filename/restore', authenticate, backupAccess, restoreBackup)

export default router
