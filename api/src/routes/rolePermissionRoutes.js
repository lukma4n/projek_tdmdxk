import { Router } from 'express'
import * as rolePermissionController from '../controllers/rolePermissionController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Semua orang yang login bisa read (karena frontend butuh load config ini saat startup)
router.get('/', authenticate, rolePermissionController.getPermissions)

// Hanya IT Master (dan mungkin Kepala Cabang jika diinginkan) yang bisa edit
// Menurut kesepakatan, IT Master adalah penguasa mutlak.
router.put('/', authenticate, authorize('IT Master'), rolePermissionController.updatePermissions)

export default router
