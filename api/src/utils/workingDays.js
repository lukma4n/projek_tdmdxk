/**
 * Helper hari kerja untuk proyeksi penjualan.
 * Hari kerja = Senin–Sabtu yang BUKAN libur nasional/tanggal merah.
 * (Minggu selalu libur.)
 *
 * PENTING: Daftar libur di bawah WAJIB diverifikasi & diupdate tiap tahun.
 * Tanggal hari besar Islam (Idul Fitri/Adha, Tahun Baru Islam, Maulid) bergeser
 * setiap tahun dan cuti bersama ditetapkan via SKB 3 Menteri — sesuaikan manual.
 */

// Tanggal merah. Format 'YYYY-MM-DD' (waktu lokal WIB).
// Sumber: holidays-calendar.net (Indonesia 2026).
// CATATAN: kalau showroom TETAP BUKA saat cuti bersama, hapus baris di grup
// "Cuti Bersama" agar tetap dihitung sebagai hari kerja.
export const INDONESIA_HOLIDAYS = new Set([
  // ── 2026 — Libur Nasional ──
  '2026-01-01', // Tahun Baru Masehi
  '2026-01-16', // Isra Miraj
  '2026-02-17', // Tahun Baru Imlek
  '2026-03-19', // Hari Suci Nyepi
  '2026-04-03', // Wafat Isa Almasih
  '2026-05-01', // Hari Buruh
  '2026-05-14', // Kenaikan Isa Almasih
  '2026-05-27', // Idul Adha 1447 H
  '2026-05-31', // Hari Raya Waisak
  '2026-06-01', // Hari Lahir Pancasila
  '2026-06-16', // Tahun Baru Islam 1448 H
  '2026-08-17', // Hari Kemerdekaan RI
  '2026-08-25', // Maulid Nabi Muhammad SAW
  '2026-12-25', // Hari Raya Natal

  // ── 2026 — Cuti Bersama (mengelilingi Idul Fitri/Nyepi/Idul Adha/Natal) ──
  '2026-02-16', // jelang Imlek
  '2026-03-18', // jelang Nyepi/Idul Fitri
  '2026-03-20', // Idul Fitri 1447 H
  '2026-03-23', // Idul Fitri 1447 H
  '2026-03-24', // Idul Fitri 1447 H
  '2026-05-15', // jelang Kenaikan Isa Almasih
  '2026-05-28', // Idul Adha
  '2026-12-24', // jelang Natal
])

/**
 * Format Date → 'YYYY-MM-DD' memakai komponen LOKAL (bukan toISOString()
 * yang konversi ke UTC dan bisa mundur 1 hari di TZ positif seperti WIB).
 */
function toLocalKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** True bila `date` hari kerja: bukan Minggu (getDay()===0) & bukan tanggal merah. */
export function isWorkingDay(date) {
  if (date.getDay() === 0) return false
  return !INDONESIA_HOLIDAYS.has(toLocalKey(date))
}

/**
 * Jumlah hari kerja dalam rentang [from, to] (inklusif kedua ujung).
 * Mengembalikan 0 bila from > to.
 */
export function countWorkingDays(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  let count = 0
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(d)) count++
  }
  return count
}
