import { Router } from 'express'
import { getSessions, createSession, getSessionItems, getReport, addItem, updateItem, deleteItem, completeSession, deleteSession, approveKabeng, sendToKacab, approveKacab, rejectApproval, markBasoPrinted, uploadBasoSigned, viewBasoSigned } from '../controllers/opnameController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { uploadPdf } from '../middleware/upload.js'

const router = Router()
const opnameReadAccess = authorize('Partman', 'Kepala Bengkel', 'Kepala Cabang')
const opnameOperateAccess = authorize('Partman')
const kabengAccess = authorize('Kepala Bengkel')
const kacabAccess = authorize('Kepala Cabang')

router.get('/', authenticate, opnameReadAccess, getSessions)
router.post('/', authenticate, opnameOperateAccess, createSession)
router.get('/:id/items', authenticate, opnameReadAccess, getSessionItems)
router.get('/:id/report', authenticate, opnameReadAccess, getReport)
router.post('/:id/items', authenticate, opnameOperateAccess, addItem)
router.patch('/:id/items/:itemId', authenticate, opnameOperateAccess, updateItem)
router.delete('/:id/items/:itemId', authenticate, opnameOperateAccess, deleteItem)
router.patch('/:id/complete', authenticate, opnameOperateAccess, completeSession)
router.patch('/:id/approve-kabeng', authenticate, kabengAccess, approveKabeng)
router.patch('/:id/send-kacab', authenticate, kabengAccess, sendToKacab)
router.patch('/:id/approve-kacab', authenticate, kacabAccess, approveKacab)
router.patch('/:id/reject', authenticate, authorize('Kepala Bengkel', 'Kepala Cabang'), rejectApproval)
router.patch('/:id/baso-print', authenticate, opnameReadAccess, markBasoPrinted)
router.post('/:id/baso-upload', authenticate, opnameOperateAccess, uploadPdf.single('file'), uploadBasoSigned)
router.get('/:id/baso-file', authenticate, opnameReadAccess, viewBasoSigned)
router.delete('/:id', authenticate, opnameOperateAccess, deleteSession)

export default router
