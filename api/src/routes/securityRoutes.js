import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { getLoginLogs, getActiveSessions, resetUserSession } from '../controllers/securityController.js'

const router = Router()

// Audit & kontrol sesi — khusus IT Master.
const itMasterOnly = authorize('IT Master')

router.get('/login-logs', authenticate, itMasterOnly, getLoginLogs)
router.get('/active-sessions', authenticate, itMasterOnly, getActiveSessions)
router.post('/users/:id/reset-session', authenticate, itMasterOnly, resetUserSession)

export default router
