import { prisma } from '../config/db.js'

/**
 * Normalize phone number: strip all non-digits
 */
function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

/**
 * public check for STNK / BPKB status
 * Query params: engine_number + (phone OR chassis = 4 digit terakhir No. Rangka)
 */
export async function checkStnkBpkb(req, res, next) {
  try {
    const { engine_number, phone, chassis } = req.query

    // Verifikasi: Nomor Mesin + salah satu dari (Nomor HP) ATAU (4 digit terakhir Nomor Rangka).
    if (!engine_number || (!phone && !chassis)) {
      return res.status(400).json({ error: 'Nomor Mesin dan (Nomor HP atau 4 digit terakhir Nomor Rangka) wajib diisi' })
    }

    // Normalisasi input
    const cleanEngine = String(engine_number).trim().toUpperCase()
    const cleanPhone = normalizePhone(phone)
    const cleanChassis = String(chassis || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

    // Cari track berdasarkan nomor mesin (unique)
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: cleanEngine }
    })

    const NOT_FOUND = 'Data tidak ditemukan atau data verifikasi tidak sesuai. Periksa kembali Nomor HP / 4 digit terakhir Nomor Rangka, atau hubungi dealer.'

    if (!track) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Cocok bila 6 digit terakhir Nomor HP cocok (toleran +62/08/62) ATAU 4 digit
    // terakhir Nomor Rangka cocok (fallback bila nomor HP konsumen sudah berganti).
    let verified = false

    if (cleanPhone.length >= 6) {
      const dbPhone = normalizePhone(track.mobile)
      if (dbPhone) {
        const len = Math.min(6, cleanPhone.length, dbPhone.length)
        if (cleanPhone.slice(-len) === dbPhone.slice(-len)) verified = true
      }
    }

    if (!verified && cleanChassis.length >= 4) {
      const dbChassis = String(track.chassis_number || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (dbChassis.length >= 4 && cleanChassis.slice(-4) === dbChassis.slice(-4)) verified = true
    }

    if (!verified) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Response — data ditampilkan penuh (tanpa masking), sesuai keputusan dealer.
    const responseData = {
      engine_number: track.engine_number,
      chassis_number: track.chassis_number || null,
      stnk_name: track.stnk_name || null,
      branch_name: track.branch_name,
      no_polisi: track.no_polisi || null,
      series: track.series || null,

      // Faktur Milestone
      faktur: {
        tgl_mohon: track.tgl_mohon_faktur,
        tgl_terima: track.tgl_terima_faktur,
        no_faktur: track.no_faktur || null,
        is_done: !!track.tgl_terima_faktur
      },

      // STNK & Plat Milestone
      stnk: {
        status: track.stnk_status || 'PROSES',
        tgl_proses: track.tgl_proses_stnk,
        tgl_selesai: track.tgl_terima_stnk,
        tgl_penyerahan: track.tgl_penyerahan_stnk,
        no_stnk: track.no_stnk || null,
        lokasi: track.lokasi_stnk || null,
        is_done: !!track.tgl_terima_stnk,
        is_delivered: !!track.tgl_penyerahan_stnk
      },

      // Plat Milestone
      plat: {
        tgl_selesai: track.tgl_terima_plat,
        tgl_penyerahan: track.tgl_penyerahan_plat,
        no_plat: track.no_plat || null,
        is_done: !!track.tgl_terima_plat,
        is_delivered: !!track.tgl_penyerahan_plat
      },

      // BPKB Milestone
      // BPKB hanya untuk konsumen CASH. Bila ada finance_company (leasing/finance
      // company apa pun: FIF, Adira, IMFI, OTO, dll), BPKB diserahkan cabang ke
      // leasing → bukan untuk diambil konsumen.
      bpkb: {
        status: track.bpkb_status || 'PROSES',
        tgl_selesai: track.tgl_terima_bpkb,
        tgl_penyerahan: track.tgl_penyerahan_bpkb,
        no_bpkb: track.no_bpkb || null,
        lokasi: track.lokasi_bpkb || null,
        penerima: track.nama_penerima_bpkb || null,
        finance_company: track.finance_company || null,
        for_consumer: !(track.finance_company && String(track.finance_company).trim()),
        is_done: !!track.tgl_terima_bpkb,
        is_delivered: !!track.tgl_penyerahan_bpkb
      }
    }

    res.json(responseData)
  } catch (err) {
    next(err)
  }
}
