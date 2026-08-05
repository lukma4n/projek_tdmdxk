import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  getFollowupQueue,
  getFollowupAreas,
  scheduleFollowup,
  getFollowupHistory,
  sendFollowupWhatsapp,
} from '../controllers/followupController.js'

const router = Router()

// Antrean terpadu memuat KPB (bengkel) dan dokumen (showroom), jadi aksesnya
// gabungan dari kedua guard lama: followupAccess di customerRoutes dan
// documentFollowupAccess di showroomRoutes.
const followupCenterAccess = authorize('CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Kepala Cabang', 'Admin')

// Route statis didaftarkan sebelum route berparameter (Express 5 strict routing).
router.get('/queue', authenticate, followupCenterAccess, getFollowupQueue)
router.get('/areas', authenticate, followupCenterAccess, getFollowupAreas)
router.get('/history/:kind/:key', authenticate, followupCenterAccess, getFollowupHistory)
router.post('/schedule/:kind/:key', authenticate, followupCenterAccess, scheduleFollowup)
router.post('/send/:kind/:key', authenticate, followupCenterAccess, sendFollowupWhatsapp)

export default router
