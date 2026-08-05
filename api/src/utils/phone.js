// Pemeriksaan nomor HP konsumen untuk tautan WhatsApp.
//
// Sebelumnya tinggal di services/wablasService.js. Dipindah ke sini saat gateway
// dihapus: normalisasi nomor tetap dibutuhkan mode manual, gateway-nya tidak.
//
// Aturannya dikencangkan berdasarkan 39.996 nomor di data produksi (2026-08-05):
// 400 baris berisi dua nomor yang tersalin jadi satu, 1.036 terlalu panjang, dan
// 102 tidak berawalan 628 sama sekali. Yang lolos aturan lama tapi bukan nomor
// sungguhan baru ketahuan saat WhatsApp menolaknya — itu memboroskan waktu staf
// dan satu jatah harian.

export const ALASAN_NOMOR = {
  kosong: 'Nomor HP kosong',
  dobel: 'Dua nomor tertulis jadi satu',
  bukan_seluler: 'Bukan nomor seluler (telepon rumah atau salah ketik)',
  terlalu_pendek: 'Terlalu pendek untuk nomor Indonesia',
  terlalu_panjang: 'Terlalu panjang untuk nomor Indonesia',
}

// Nomor seluler Indonesia selalu 08xx → 628xx setelah normalisasi, dengan
// panjang 11-14 karakter (628 + 8..11 digit). Di luar itu bukan nomor yang bisa
// dihubungi lewat WhatsApp.
const PANJANG_MIN = 11
const PANJANG_MAKS = 14

/**
 * Periksa satu nomor. Mengembalikan nomor ternormalisasi bila layak dihubungi,
 * atau alasan kenapa tidak — alasannya ikut ditampilkan di UI supaya admin tahu
 * apa yang harus diperbaiki, bukan sekadar "nomor tidak valid".
 */
export function periksaNomor(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return { phone: '', valid: false, alasan: 'kosong' }

  // Dua nomor tersalin jadi satu — pola paling sering di data ini. Dikenali dari
  // panjang mentah yang tak mungkin untuk satu nomor Indonesia mana pun.
  if (digits.length > 15) return { phone: '', valid: false, alasan: 'dobel' }

  let msisdn = digits
  if (msisdn.startsWith('0')) msisdn = `62${msisdn.slice(1)}`
  else if (!msisdn.startsWith('62')) msisdn = `62${msisdn}`

  if (!msisdn.startsWith('628')) return { phone: '', valid: false, alasan: 'bukan_seluler' }
  if (msisdn.length < PANJANG_MIN) return { phone: '', valid: false, alasan: 'terlalu_pendek' }
  if (msisdn.length > PANJANG_MAKS) return { phone: '', valid: false, alasan: 'terlalu_panjang' }

  return { phone: msisdn, valid: true, alasan: null }
}

// 08xx / +62xx / 62xx / spasi & strip → 62xx. Mengembalikan '' kalau tidak layak
// dihubungi, supaya nomor sampah tidak memenuhi antrean.
export function normalizePhone(phone) {
  return periksaNomor(phone).phone
}

/**
 * Tautan yang membuka jendela chat WhatsApp dengan teks pesan sudah terisi.
 *
 * Dibuka dari PC yang sudah login WhatsApp Web/Desktop, staf tinggal menekan
 * Kirim. Yang mengirim adalah WhatsApp milik staf — bukan API pihak ketiga —
 * jadi tidak ada yang bisa dibaca sebagai pengiriman otomatis.
 */
export function waMeUrl(phone, message) {
  const msisdn = normalizePhone(phone)
  if (!msisdn) return ''
  return `https://wa.me/${msisdn}?text=${encodeURIComponent(String(message || ''))}`
}
