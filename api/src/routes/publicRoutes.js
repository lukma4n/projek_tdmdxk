import { Router } from 'express'
import { checkStnkBpkb, requestPickup, checkStockUnits } from '../controllers/publicController.js'
import { createUnitBooking, cancelUnitBookingSelf } from '../controllers/unitBookingController.js'
import { uploadPickupKtp } from '../middleware/upload.js'

const router = Router()

router.get('/stnk-bpkb/check', checkStnkBpkb)
// FASE 2: permintaan ambil dokumen dari konsumen (token dari /check).
// Foto KTP wajib dilampirkan (multipart/form-data, field `ktp_photo`).
router.post('/stnk-bpkb/request-pickup', uploadPickupKtp.single('ktp_photo'), requestPickup)
// Cek ketersediaan unit (publik, agregat non-sensitif) — untuk sales di lapangan.
router.get('/stock-units', checkStockUnits)
// Booking unit tanpa login -- nomor HP jadi bukti kepemilikan untuk cancel sendiri.
router.post('/stock-units/:engineNumber/booking', createUnitBooking)
router.delete('/stock-units/:engineNumber/booking', cancelUnitBookingSelf)

export default router
