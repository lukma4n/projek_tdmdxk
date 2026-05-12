import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getCustomers,
  getCustomerSummary,
  getCustomerAlerts,
  getCustomerModels,
  exportCustomersExcel,
  exportFollowupKpbExcel,
  getCustomerFollowups,
  createCustomerFollowup,
} from '../controllers/customerController.js'

const router = Router()
const customerAccess = authorize('CRM', 'Service Advisor', 'Kepala Bengkel')
const followupAccess = authorize('CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel')

router.get('/', authenticate, customerAccess, getCustomers)
router.get('/summary', authenticate, customerAccess, getCustomerSummary)
router.get('/alerts', authenticate, followupAccess, getCustomerAlerts)
router.get('/followups/export', authenticate, followupAccess, exportFollowupKpbExcel)
router.get('/models', authenticate, customerAccess, getCustomerModels)
router.get('/export', authenticate, customerAccess, exportCustomersExcel)
router.get('/:id/followups', authenticate, followupAccess, getCustomerFollowups)
router.post('/:id/followups', authenticate, followupAccess, validate(schemas.createFollowup), createCustomerFollowup)

export default router
