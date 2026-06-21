import { Router } from 'express'
import { checkStnkBpkb } from '../controllers/publicController.js'

const router = Router()

router.get('/stnk-bpkb/check', checkStnkBpkb)

export default router
