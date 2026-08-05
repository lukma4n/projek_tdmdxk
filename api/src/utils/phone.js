// Normalisasi nomor HP konsumen ke bentuk yang bisa dipakai tautan WhatsApp.
//
// Sebelumnya tinggal di services/wablasService.js. Dipindah ke sini saat gateway
// dihapus: normalisasi nomor tetap dibutuhkan mode manual, gateway-nya tidak.

// 08xx / +62xx / 62xx / spasi & strip → 62xx. Mengembalikan '' kalau tidak layak
// dihubungi, supaya nomor sampah tidak memenuhi antrean.
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''

  let msisdn = digits
  if (msisdn.startsWith('0')) msisdn = `62${msisdn.slice(1)}`
  else if (!msisdn.startsWith('62')) msisdn = `62${msisdn}`

  // Nomor Indonesia: 62 + 9..13 digit. Di luar itu hampir pasti salah input.
  if (msisdn.length < 11 || msisdn.length > 15) return ''
  return msisdn
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
