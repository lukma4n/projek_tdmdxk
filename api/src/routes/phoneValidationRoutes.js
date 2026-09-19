import { Router } from 'express'
import { getInvalidPhones } from '../controllers/phoneValidationController.js'
import { authenticate, authorizeMenu } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, authorizeMenu('VALIDASI_NOMOR_HP'), getInvalidPhones)

export default router
