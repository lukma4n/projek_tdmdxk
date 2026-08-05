import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  getFollowupQueue,
  getFollowupAreas,
  scheduleFollowup,
  getFollowupHistory,
  recordFollowupContact,
  updateFollowupPhone,
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
// Bukan pengiriman: pesan dikirim manual oleh staf lewat WhatsApp Web, endpoint
// ini hanya mencatat kontaknya dan memotong jatah harian.
router.post('/contact/:kind/:key', authenticate, followupCenterAccess, recordFollowupContact)
// Koreksi nomor HP konsumen dari layar antrean.
router.patch('/phone/:kind/:key', authenticate, followupCenterAccess, updateFollowupPhone)

export default router
