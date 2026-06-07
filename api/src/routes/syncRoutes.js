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
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

import { validate, schemas } from '../middleware/validate.js'

const router = Router()
const backupAccess = authorize('Kepala Bengkel', 'Kepala Cabang')

const previewModule = (module) => (req, res, next) => {
  req.params.module = module
  next()
}

router.post('/hotline/preview', authenticate, authorize('Service Advisor', 'Partman', 'Kepala Bengkel'), upload.single('file'), previewModule('hotline'), previewImport)
router.post('/stock/preview', authenticate, authorize('Partman', 'Kepala Bengkel'), upload.single('file'), previewModule('stock'), previewImport)
router.post('/workshop/preview', authenticate, authorize('Frondesk', 'Service Advisor', 'Kepala Bengkel'), upload.single('file'), previewModule('workshop'), previewImport)
router.post('/sales/preview', authenticate, authorize('Service Advisor', 'Kepala Bengkel', 'Admin', 'Kepala Cabang'), upload.single('file'), previewModule('sales'), previewImport)
router.post('/hotline', authenticate, authorize('Service Advisor', 'Partman', 'Kepala Bengkel'), upload.single('file'), uploadHotline)
router.post('/stock', authenticate, authorize('Partman', 'Kepala Bengkel'), upload.single('file'), uploadStock)
router.post('/workshop', authenticate, authorize('Frondesk', 'Service Advisor', 'Kepala Bengkel'), upload.single('file'), uploadWorkshop)
router.post('/sales', authenticate, authorize('Service Advisor', 'Kepala Bengkel', 'Admin', 'Kepala Cabang'), upload.single('file'), uploadSales)
router.get('/logs', authenticate, backupAccess, getSyncLogs)
router.get('/audit-logs', authenticate, backupAccess, getAuditLogs)
router.get('/backups', authenticate, backupAccess, getBackups)
router.post('/backups', authenticate, backupAccess, createBackup)
router.post('/backups/cleanup', authenticate, backupAccess, validate(schemas.cleanupBackups), cleanupBackups)
router.post('/backups/:filename/restore', authenticate, backupAccess, restoreBackup)

export default router
