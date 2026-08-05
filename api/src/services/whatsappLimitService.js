import { prisma } from '../config/db.js'
import { WablasError } from './wablasService.js'

// Batas jumlah konsumen yang boleh dikirimi WhatsApp per hari.
//
// Alasannya bukan teknis tapi bertahan hidup: WhatsApp membatasi nomor gateway
// dealer pada 2026-08-04 dengan alasan "pengiriman pesan otomatis atau massal",
// dan pelanggaran berulang berujung blokir permanen. 30/hari jauh di bawah pola
// yang terdeteksi sebagai blast.
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
 * Dipanggil SEBELUM mengirim. Melempar WablasError 429 kalau jatah habis,
 * supaya pengiriman batal sebelum kuota gateway terpakai.
 */
export async function pastikanJatahHarianCukup(sekarang = new Date()) {
  const usage = await getDailyUsage(sekarang)
  if (usage.sisa <= 0) {
    throw new WablasError(
      `Batas kirim WhatsApp hari ini sudah tercapai (${usage.terpakai}/${usage.limit} konsumen). ` +
      'Lanjutkan besok — batas ini melindungi nomor WhatsApp dealer dari pemblokiran.',
      { status: 429 },
    )
  }
  return usage
}

/**
 * Dipanggil SETELAH gateway mengonfirmasi terkirim. Kegagalan pencatatan tidak
 * boleh membatalkan respons ke user (pesannya sudah terlanjur terkirim), tapi
 * harus terlihat di log.
 */
export async function catatPengiriman({ module, targetKey, phone, messageId, quotaLeft, sentBy }) {
  return prisma.whatsapp_send_logs.create({
    data: {
      module,
      target_key: String(targetKey),
      phone,
      message_id: messageId || null,
      quota_left: quotaLeft ?? null,
      sent_by: sentBy,
    },
  })
}
