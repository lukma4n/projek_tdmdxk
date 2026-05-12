import { Router } from 'express'
import { getSummary } from '../controllers/dashboardController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
const dashboardAccess = authorize('Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman')

router.get('/summary', authenticate, dashboardAccess, getSummary)

export default router
