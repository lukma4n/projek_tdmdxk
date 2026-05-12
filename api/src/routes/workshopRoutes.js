import { Router } from 'express'
import { getWorkOrders, getSummary, getMechanics, getMechanicPerformance, getProgramSummary } from '../controllers/workshopController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
const workshopAccess = authorize('Frondesk', 'Service Advisor', 'Kepala Bengkel')
const workshopProgramAccess = authorize('Service Advisor', 'Kepala Bengkel')
const mechanicAccess = authorize('Kepala Bengkel')

router.get('/', authenticate, workshopAccess, getWorkOrders)
router.get('/summary', authenticate, workshopAccess, getSummary)
router.get('/program-summary', authenticate, workshopProgramAccess, getProgramSummary)
router.get('/mechanics', authenticate, mechanicAccess, getMechanics)
router.get('/mechanics/performance', authenticate, mechanicAccess, getMechanicPerformance)

export default router
