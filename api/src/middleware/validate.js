import { z } from 'zod'

/**
 * Express middleware factory for Zod validation.
 * Usage: validate(z.object({ username: z.string(), password: z.string() }))
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
        return res.status(400).json({ error: 'Validasi gagal', details: messages })
      }
      next(error)
    }
  }
}

// Common reusable schemas
export const schemas = {
  login: z.object({
    username: z.string().min(1, 'Username wajib diisi').max(100),
    password: z.string().min(1, 'Password wajib diisi').max(128),
  }),

  createUser: z.object({
    username: z.string().min(3, 'Username minimal 3 karakter').max(100),
    password: z.string().min(8, 'Password minimal 8 karakter').max(128),
    name: z.string().min(1, 'Nama wajib diisi'),
    role: z.string().min(1, 'Role wajib diisi'),
    locations: z.array(z.string()).optional(),
  }),

  updateUser: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    locations: z.array(z.string()).optional(),
  }),

  createFollowup: z.object({
    kpb_level: z.enum(['KPB1', 'KPB2', 'KPB3', 'KPB4']),
    status: z.enum(['belum_dihubungi', 'sudah_dihubungi', 'booking', 'datang', 'batal']),
    note: z.string().optional(),
  }),

  cleanupBackups: z.object({
    keep_latest: z.coerce.number().int().min(1).max(200).optional(),
  }),

  createOpnameSession: z.object({
    opname_type: z.enum(['unit', 'stnk', 'bpkb']),
    notes: z.string().optional(),
  }),

  createSessionByLocation: z.object({
    target_location: z.string().min(1, 'Lokasi target wajib diisi'),
    notes: z.string().optional(),
  }),

  createBbnPrice: z.object({
    product_code: z.string().min(1, 'Kode produk wajib diisi'),
    city_name: z.string().min(1, 'Nama kota wajib diisi'),
    notice_fee: z.number().min(0, 'Notice fee tidak boleh negatif').optional(),
    pnbp_fee: z.number().min(0, 'PNBP fee tidak boleh negatif').optional(),
    service_fee: z.number().min(0, 'Service fee tidak boleh negatif').optional(),
    additional_fee: z.number().min(0, 'Biaya tambahan tidak boleh negatif').optional(),
  }),

  upsertTacMatrix: z.object({
    leasing: z.string().min(1, 'Leasing wajib diisi'),
    series_key: z.string().min(1, 'Series key wajib diisi'),
    dp_category: z.enum(['LT_15', 'GT_15']),
    tenor: z.coerce.number().int().min(1, 'Tenor minimal 1'),
    period_start: z.string().date('Tanggal periode mulai wajib format YYYY-MM-DD'),
    period_end: z.string().date('Tanggal periode akhir wajib format YYYY-MM-DD').optional(),
    tac_nominal: z.number().min(0, 'TAC tidak boleh negatif').optional(),
  }),

  upsertPromoScheme: z.object({
    leasing: z.string().min(1, 'Leasing wajib diisi'),
    otr_min: z.number().min(0, 'OTR min tidak boleh negatif'),
    otr_max: z.number().min(0, 'OTR max tidak boleh negatif'),
    dp_percent_min: z.number().min(0).max(100, 'DP percent harus 0-100').optional(),
    dp_percent_max: z.number().min(0).max(100, 'DP percent harus 0-100').optional(),
    promo_nominal: z.number().min(0, 'Promo tidak boleh negatif'),
    period_start: z.string().date('Tanggal periode mulai wajib format YYYY-MM-DD').optional(),
    period_end: z.string().date('Tanggal periode akhir wajib format YYYY-MM-DD').optional(),
  }),

  upsertSeriesAlias: z.object({
    product_code: z.string().min(1, 'Kode produk wajib diisi'),
    alias: z.string().min(1, 'Alias wajib diisi'),
  }),

  createSalesOrderMargin: z.object({
    engine_number: z.string().min(1, 'Nomor mesin wajib diisi'),
    product_code: z.string().min(1, 'Kode produk wajib diisi'),
    area_name: z.string().min(1, 'Area BBN wajib diisi'),
    leasing: z.string().optional(),
    tenor: z.coerce.number().int().min(1).optional(),
    sale_type: z.enum(['CASH', 'KREDIT']),
    dp_gross: z.number().min(0, 'DP gross tidak boleh negatif').optional(),
    dp_net: z.number().min(0, 'DP net tidak boleh negatif').optional(),
    dealer_discount: z.number().min(0, 'Diskon dealer tidak boleh negatif').optional(),
    notes: z.string().optional(),
  }),
}
