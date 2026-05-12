import { Router } from 'express'
import { getStock, getStockByCode, getCategories, getLocations, getStockByLocation } from '../controllers/stockController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
const stockAccess = authorize('Service Advisor', 'Partman', 'Kepala Bengkel')

router.get('/', authenticate, stockAccess, getStock)
router.get('/categories', authenticate, stockAccess, getCategories)
router.get('/locations', authenticate, stockAccess, getLocations)
router.get('/by-location/:location', authenticate, stockAccess, getStockByLocation)
router.get('/:code', authenticate, stockAccess, getStockByCode)

export default router
