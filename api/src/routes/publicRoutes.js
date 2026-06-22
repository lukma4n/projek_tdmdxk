import { Router } from 'express'
import { checkStnkBpkb, requestPickup } from '../controllers/publicController.js'

const router = Router()

router.get('/stnk-bpkb/check', checkStnkBpkb)
// FASE 2: permintaan ambil dokumen dari konsumen (token dari /check).
router.post('/stnk-bpkb/request-pickup', requestPickup)

export default router