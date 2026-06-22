import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { getApprovalNotifications, getOpnameNotifications } from '../controllers/notificationController.js'

const router = Router()

const opnameAccess = authorize('PIC Stock opname', 'ADH', 'Kepala Cabang')

// Feed "tugas saya": controller sudah memfilter per-role dari req.user.role
// (role tanpa tugas dapat daftar kosong). Header memanggil ini untuk semua
// user, jadi cukup butuh autentikasi — pembatasan role di sini menyebabkan
// 403 untuk role yang justru dilayani controller (ADH, Partman, CRM, dll).
router.get('/approvals', authenticate, getApprovalNotifications)
router.get('/opname', authenticate, opnameAccess, getOpnameNotifications)

export default router
