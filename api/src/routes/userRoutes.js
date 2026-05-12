import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
} from '../controllers/userController.js'

const router = Router()
  const userAdminAccess = authorize('Kepala Bengkel', 'Kepala Cabang', 'PIC Stock opname', 'Lead PIC Stock opname')
const userPicAccess = authorize('PIC Stock opname')

router.get('/', authenticate, userAdminAccess, getUsers)
router.get('/:id', authenticate, userAdminAccess, getUserById)
router.post('/', authenticate, userAdminAccess, validate(schemas.createUser), createUser)
router.patch('/:id', authenticate, userAdminAccess, validate(schemas.updateUser), updateUser)
router.delete('/:id', authenticate, userAdminAccess, deleteUser)
router.patch('/:id/reset-password', authenticate, userAdminAccess, resetPassword)

export default router
