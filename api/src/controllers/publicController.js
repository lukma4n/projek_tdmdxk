import { prisma } from '../config/db.js'

/**
 * Mask name helper: "BUDI SANTOSO" -> "B**I S*****O"
 */
function maskName(name) {
  if (!name) return '-'
  return name
    .toUpperCase()
    .split(' ')
    .map((part) => {
      if (part.length <= 2) return part[0] + '*'.repeat(part.length - 1)
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1]
    })
    .join(' ')
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
 * Query params: engine_number, phone
 */
export async function checkStnkBpkb(req, res, next) {
  try {
    const { engine_number, phone } = req.query

    if (!engine_number || !phone) {
      return res.status(400).json({ error: 'Nomor Mesin dan Nomor HP wajib diisi' })
    }

    // Normalisasi input
    const cleanEngine = String(engine_number).trim().toUpperCase()
    const cleanPhone = normalizePhone(phone)

    if (cleanPhone.length < 6) {
      return res.status(400).json({ error: 'Nomor HP tidak valid' })
    }

    // Cari track berdasarkan nomor mesin (unique)
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: cleanEngine }
    })

    const NOT_FOUND = 'Data tidak ditemukan atau nomor HP tidak sesuai. Periksa kembali data Anda atau hubungi dealer.'

    if (!track) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Verifikasi kecocokan nomor HP
    const dbPhone = normalizePhone(track.mobile)
    if (!dbPhone) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Bandingkan akhiran nomor HP (minimal 6 digit terakhir agar fleksibel terhadap +62 / 08 / 62)
    const matchLength = Math.min(6, cleanPhone.length, dbPhone.length)
    const searchSuffix = cleanPhone.slice(-matchLength)
    const dbSuffix = dbPhone.slice(-matchLength)

    if (searchSuffix !== dbSuffix) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Persiapkan data response yang AMAN (tanpa info sensitif)
    const responseData = {
      engine_number: track.engine_number,
      chassis_number: track.chassis_number ? track.chassis_number.slice(0, 4) + '***' + track.chassis_number.slice(-4) : null,
      stnk_name: maskName(track.stnk_name),
      branch_name: track.branch_name,
      no_polisi: track.no_polisi || null,
      series: track.series || null,

      // Faktur Milestone
      faktur: {
        tgl_mohon: track.tgl_mohon_faktur,
        tgl_terima: track.tgl_terima_faktur,
        no_faktur: track.no_faktur ? '***' + track.no_faktur.slice(-4) : null,
        is_done: !!track.tgl_terima_faktur
      },

      // STNK & Plat Milestone
      stnk: {
        status: track.stnk_status || 'PROSES',
        tgl_proses: track.tgl_proses_stnk,
        tgl_selesai: track.tgl_terima_stnk,
        tgl_penyerahan: track.tgl_penyerahan_stnk,
        no_stnk: track.no_stnk ? '***' + track.no_stnk.slice(-4) : null,
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
      bpkb: {
        status: track.bpkb_status || 'PROSES',
        tgl_selesai: track.tgl_terima_bpkb,
        tgl_penyerahan: track.tgl_penyerahan_bpkb,
        no_bpkb: track.no_bpkb ? '***' + track.no_bpkb.slice(-4) : null,
        lokasi: track.lokasi_bpkb || null,
        penerima: track.nama_penerima_bpkb ? maskName(track.nama_penerima_bpkb) : null,
        is_done: !!track.tgl_terima_bpkb,
        is_delivered: !!track.tgl_penyerahan_bpkb
      }
    }

    res.json(responseData)
  } catch (err) {
    next(err)
  }
}
