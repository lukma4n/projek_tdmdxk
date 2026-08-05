import { prisma } from '../config/db.js'

// Batas jumlah konsumen yang boleh dihubungi via WhatsApp per hari.
//
// Alasannya bukan teknis tapi bertahan hidup: nomor dealer dibatasi WhatsApp
// pada 2026-08-04 dengan alasan "pengiriman pesan otomatis atau massal", dan
// pelanggaran berulang berujung blokir permanen. 30/hari jauh di bawah pola yang
// terdeteksi sebagai blast.
//
// Batas ini TETAP BERLAKU meski pengiriman kini manual (staf menekan Kirim
// sendiri di WhatsApp Web). Membuka 60 draf lalu mengirim semuanya dalam sepuluh
// menit tetap terbaca blast oleh WhatsApp — yang hilang cuma sinyal "otomatis",
// bukan risikonya. Ini satu-satunya pengaman struktural yang tersisa.

export class BatasHarianError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BatasHarianError'
    this.status = 429
  }
}
//
// Batas ini GLOBAL lintas modul (KPB + STNK + BPKB), bukan per modul — yang
// dilindungi satu nomor pengirim, dan WhatsApp menilai perilaku nomor itu secara
// keseluruhan. Membaginya per modul berarti 90 pesan/hari dari nomor yang sama.
export const DEFAULT_DAILY_LIMIT = 30

export function getDailyLimit() {
  const raw = parseInt(process.env.WHATSAPP_DAILY_LIMIT || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT
}

// Awal & akhir hari waktu setempat. Memakai getFullYear/getMonth/getDate (bukan
// toISOString) supaya batas hari mengikuti WIB, bukan UTC — kalau pakai UTC,
// jatah harian akan ter-reset pukul 07:00 pagi, bukan tengah malam.
export function batasHariIni(sekarang = new Date()) {
  const mulai = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate(), 0, 0, 0, 0)
  const selesai = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() + 1, 0, 0, 0, 0)
  return { mulai, selesai }
}

export async function hitungTerkirimHariIni(sekarang = new Date()) {
  const { mulai, selesai } = batasHariIni(sekarang)
  return prisma.whatsapp_send_logs.count({
    where: { sent_at: { gte: mulai, lt: selesai } },
  })
}

export async function getDailyUsage(sekarang = new Date()) {
  const limit = getDailyLimit()
  const terpakai = await hitungTerkirimHariIni(sekarang)
  return { limit, terpakai, sisa: Math.max(0, limit - terpakai) }
}

/**
 * Dipanggil SEBELUM draf WhatsApp dibuka. Melempar 429 kalau jatah habis.
 */
export async function pastikanJatahHarianCukup(sekarang = new Date()) {
  const usage = await getDailyUsage(sekarang)
  if (usage.sisa <= 0) {
    throw new BatasHarianError(
      `Batas hubungi WhatsApp hari ini sudah tercapai (${usage.terpakai}/${usage.limit} konsumen). ` +
      'Lanjutkan besok — batas ini melindungi nomor WhatsApp dealer dari pemblokiran.',
    )
  }
  return usage
}

/**
 * Catat satu konsumen sebagai sudah dihubungi hari ini.
 *
 * Dicatat saat draf WhatsApp DIBUKA, bukan saat pesan benar-benar terkirim —
 * pengiriman terjadi di WhatsApp Web milik staf, dan sistem tidak punya cara
 * tahu tombol Kirim ditekan atau tidak. Konsekuensinya disengaja: lebih baik
 * menghitung lebih (draf dibuka lalu dibatalkan) daripada menghitung kurang dan
 * mengirimi konsumen yang sama dua kali.
 *
 * Kolom `message_id`/`quota_left` peninggalan era gateway — selalu null di mode
 * manual. Sengaja tidak di-drop supaya deploy tidak perlu menyentuh skema DB
 * produksi hanya demi kerapian.
 */
export async function catatPengiriman({ module, targetKey, phone, sentBy }) {
  return prisma.whatsapp_send_logs.create({
    data: {
      module,
      target_key: String(targetKey),
      phone,
      sent_by: sentBy,
    },
  })
}
