import { Router } from 'express'
import { getSummary, getFreshness } from '../controllers/dashboardController.js'
import { authenticate, authorize, authorizeMenu } from '../middleware/auth.js'

const router = Router()
const dashboardAccess = authorize('Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman')

router.get('/summary', authenticate, dashboardAccess, getSummary)
// Halaman "Kesegaran Data" — gate via RBAC dinamis (menuKey DATA_FRESHNESS)
router.get('/freshness', authenticate, authorizeMenu('DATA_FRESHNESS'), getFreshness)

export default router
