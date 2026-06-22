import jwt from 'jsonwebtoken'
import { prisma } from '../config/db.js'

// Umur token permintaan ambil dokumen yang dikeluarkan /check setelah verifikasi.
// Konsumen sudah terverifikasi identitasnya saat /check — token ini hanya
// membuktikan bahwa permintaan pickup datang dari sesi verifikasi yang valid,
// tanpa perlu OTP/gateway WhatsApp terpisah.
const PICKUP_TOKEN_TTL = '15m'

/**
 * Daftar dokumen yang siap diambil konsumen (sudah jadi, belum diserahkan,
 * dan untuk konsumen — BPKB leasing dikeluarkan). Konsisten dengan logika
 * banner "Dokumen Siap Diambil" di halaman /cek (frontend).
 */
function eligiblePickupDocs(track) {
  const docs = []
  if (track.tgl_terima_stnk && !track.tgl_penyerahan_stnk) docs.push('STNK')
  if (track.tgl_terima_plat && !track.tgl_penyerahan_plat) docs.push('Plat Nomor')
  const forConsumer = !(track.finance_company && String(track.finance_company).trim())
  if (forConsumer && track.tgl_terima_bpkb && !track.tgl_penyerahan_bpkb) docs.push('BPKB')
  return docs
}

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

    // FASE 2: keluarkan token pickup + daftar dokumen yang siap diambil.
    // Hanya bila ada dokumen eligible (sudah jadi, belum diserahkan, untuk
    // konsumen). Frontend menampilkan form permintaan ambil dokumen bila
    // pickup_eligible true. Token berumur pendek, signed JWT_SECRET.
    const pickupDocs = eligiblePickupDocs(track)
    if (pickupDocs.length) {
      responseData.pickup_eligible = true
      responseData.pickup_docs = pickupDocs
      responseData.pickup_token = jwt.sign(
        { engine_number: track.engine_number, purpose: 'pickup' },
        process.env.JWT_SECRET,
        { expiresIn: PICKUP_TOKEN_TTL }
      )
    } else {
      responseData.pickup_eligible = false
      responseData.pickup_docs = []
    }

    res.json(responseData)
  } catch (err) {
    next(err)
  }
}

/**
 * FASE 2: permintaan ambil dokumen yang diajukan konsumen dari /cek.
 * Body: { engine_number, pickup_token, consumer_phone, preferred_time?, notes?, requested_docs? }
 * Token harus valid (dikeluarkan /check untuk engine_number yang sama, belum kedaluwarsa).
 * Membuat baris showroom_pickup_requests berstatus PENDING — masuk feed notifikasi staf.
 */
export async function requestPickup(req, res, next) {
  try {
    const { engine_number, pickup_token, consumer_phone, preferred_time, notes, requested_docs } = req.body || {}

    if (!engine_number || !pickup_token) {
      return res.status(400).json({ error: 'Nomor Mesin dan token permintaan wajib diisi' })
    }

    // Verifikasi token — pastikan dikeluarkan /check untuk engine yang sama.
    let payload
    try {
      payload = jwt.verify(pickup_token, process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Token permintaan tidak valid atau kedaluwarsa. Silakan periksa ulang status dokumen Anda.' })
    }

    if (payload.purpose !== 'pickup' || payload.engine_number !== String(engine_number).trim().toUpperCase()) {
      return res.status(401).json({ error: 'Token permintaan tidak sesuai dengan Nomor Mesin.' })
    }

    const cleanEngine = String(engine_number).trim().toUpperCase()
    const cleanPhone = normalizePhone(consumer_phone)

    // Ambil data track untuk nama konsumen + cabang + dokumen eligible saat ini
    // (status bisa berubah sejak token dikeluarkan). Jika tidak ada dokumen
    // eligible lagi, tolak — tidak ada yang bisa diambil.
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: cleanEngine }
    })
    if (!track) {
      return res.status(404).json({ error: 'Data unit tidak ditemukan.' })
    }

    const eligibleDocs = eligiblePickupDocs(track)
    if (!eligibleDocs.length) {
      return res.status(409).json({ error: 'Saat ini tidak ada dokumen yang siap diambil. Status dokumen mungkin sudah berubah — silakan periksa ulang.' })
    }

    // Gunakan daftar dokumen dari server (eligibleDocs) sebagai sumber kebenaran;
    // abaikan requested_docs dari klien untuk mencegah permintaan dokumen yang
    // belum siap / di luar eligible.
    const request = await prisma.showroom_pickup_requests.create({
      data: {
        engine_number: cleanEngine,
        branch_code: track.branch_code || null,
        branch_name: track.branch_name || null,
        consumer_name: track.stnk_name || null,
        consumer_phone: cleanPhone || track.mobile || null,
        requested_docs: eligibleDocs.join(', '),
        preferred_time: preferred_time ? String(preferred_time).slice(0, 120) : null,
        notes: notes ? String(notes).slice(0, 1000) : null,
        status: 'PENDING',
      }
    })

    res.status(201).json({
      id: request.id,
      status: request.status,
      requested_docs: request.requested_docs,
      message: 'Permintaan ambil dokumen berhasil dikirim. Staf kami akan menghubungi Anda untuk penjadwalan pengambilan.'
    })
  } catch (err) {
    next(err)
  }
}
