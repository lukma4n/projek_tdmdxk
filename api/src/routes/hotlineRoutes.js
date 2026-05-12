import { Router } from 'express'
import { getHotlines, getHotlineById, updateState } from '../controllers/hotlineController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
const hotlineAccess = authorize('Service Advisor', 'Partman', 'Kepala Bengkel')

router.get('/', authenticate, hotlineAccess, getHotlines)
router.get('/:id', authenticate, hotlineAccess, getHotlineById)
router.patch('/:id/state', authenticate, hotlineAccess, updateState)

export default router
