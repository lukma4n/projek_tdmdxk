import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  listWhatsappTemplates, updateWhatsappTemplate, resetWhatsappTemplate,
  getWhatsappTemplateHistory, previewWhatsappTemplate,
} from '../controllers/whatsappTemplateController.js'

const router = Router()

// Hak ubah diberikan ke semua role yang bisa mengakses follow-up — keputusan
// pemilik sistem. Karena itu setiap perubahan dicatat di audit_logs beserta isi
// sebelum dan sesudahnya, dan versi lama tidak pernah dihapus.
const templateAccess = authorize('CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Kepala Cabang', 'Admin')

router.get('/', authenticate, templateAccess, listWhatsappTemplates)
router.get('/:key/history', authenticate, templateAccess, getWhatsappTemplateHistory)
router.post('/:key/preview', authenticate, templateAccess, previewWhatsappTemplate)
router.put('/:key', authenticate, templateAccess, updateWhatsappTemplate)
router.post('/:key/reset', authenticate, templateAccess, resetWhatsappTemplate)

export default router
