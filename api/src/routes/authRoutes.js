import { Router } from 'express'
import { login, logout, me } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = Router()

router.post('/login', validate(schemas.login), login)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, me)

export default router
