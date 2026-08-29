/**
 * Turunan identitas kendaraan untuk tanda terima penyerahan dokumen.
 *
 * Dua field di form tanda terima tidak tersedia langsung di data mana pun dan
 * harus diturunkan:
 *
 * 1. Tahun pembuatan — kolom `tahun` di showroom_stnk_bpkb_tracks TERNYATA
 *    tahun SO, bukan tahun pembuatan (baris dengan Tgl SO 2024-07-20 punya
 *    tahun=2024). Tahun pembuatan sebenarnya ada di kode tahun VIN pada nomor
 *    rangka.
 *
 * 2. Merk/Type — form menulis "ML2A / A/T": kode produk digabung transmisi.
 */

// Kode tahun VIN. Huruf I, O, Q, U, Z tidak dipakai standar VIN supaya tidak
// tertukar dengan angka 1/0/2 — karena itu tidak ada di peta ini.
const VIN_YEAR_CODES = {
  F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020,
  M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026,
}

/**
 * Tahun pembuatan dari nomor rangka.
 *
 * Posisi kode tahun berbeda menurut panjang nomor rangka, tapi sebenarnya sama
 * saja: format 14 karakter adalah VIN tanpa awalan WMI "MH1" (3 karakter), jadi
 * karakter ke-10 pada format panjang = karakter ke-7 pada format pendek.
 *
 *   JMH11XTK409060 (14) -> indeks 6 = 'T' -> 2026
 *   MH1EF3114SK001246 (17) -> indeks 9 = 'S' -> 2025
 *
 * Diuji ke 19.995 baris track dan konsisten dengan tahun SO, serta cocok dengan
 * dua tanda terima asli dari DMS.
 *
 * @returns {number|null} null bila nomor rangka tidak dikenali. Sengaja null,
 *   bukan tebakan — tanda terima adalah dokumen bukti, field yang tidak
 *   diketahui harus dikosongkan.
 */
export function deriveProductionYear(chassisNumber) {
  if (typeof chassisNumber !== 'string') return null

  const chassis = chassisNumber.trim().toUpperCase()

  let index
  if (chassis.length === 17) index = 9
  else if (chassis.length === 14) index = 6
  else return null

  return VIN_YEAR_CODES[chassis[index]] ?? null
}

/**
 * Merk/Type untuk tanda terima, mis. "ML2A / A/T".
 *
 * @param productCode customers.product_code — kolom "Type" di Report Penjualan
 * @param parentCategory customers.type — kolom "Parent Category Name" di Report
 *   Penjualan, isinya AT / SPORT / CUB. JANGAN pakai customers.category
 *   ("AT LOW END") — itu segmen harga, bukan transmisi.
 */
export function formatMerkType(productCode, parentCategory) {
  const code = (productCode || '').trim()
  if (!code) return null

  const transmission = (parentCategory || '').trim().toUpperCase() === 'AT' ? 'A/T' : 'M/T'
  return `${code} / ${transmission}`
}

/**
 * Nama warna lengkap untuk tanda terima, mis. "BK-BLACK".
 *
 * @param code customers.color, kode 2 huruf
 * @param colorMap Map kode -> nama, dari tabel unit_color_names
 * @returns nama lengkap bila kodenya dikenal, selain itu kode apa adanya —
 *   lebih baik mencetak "BK" daripada mengosongkan warna sama sekali.
 */
export function formatColorName(code, colorMap) {
  const key = (code || '').trim().toUpperCase()
  if (!key) return null
  return colorMap?.get(key) || key
}
