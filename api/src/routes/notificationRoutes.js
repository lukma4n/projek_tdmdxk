import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { getApprovalNotifications, getOpnameNotifications } from '../controllers/notificationController.js'

const router = Router()

const approvalAccess = authorize('Kepala Bengkel', 'Kepala Cabang')
const opnameAccess = authorize('PIC Stock opname', 'ADH', 'Kepala Cabang')

router.get('/approvals', authenticate, approvalAccess, getApprovalNotifications)
router.get('/opname', authenticate, opnameAccess, getOpnameNotifications)

export default router
