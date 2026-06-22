import { Router } from 'express'
import { checkStnkBpkb, requestPickup } from '../controllers/publicController.js'
import { uploadPickupKtp } from '../middleware/upload.js'

const router = Router()

router.get('/stnk-bpkb/check', checkStnkBpkb)
// FASE 2: permintaan ambil dokumen dari konsumen (token dari /check).
// Foto KTP wajib dilampirkan (multipart/form-data, field `ktp_photo`).
router.post('/stnk-bpkb/request-pickup', uploadPickupKtp.single('ktp_photo'), requestPickup)

export default router