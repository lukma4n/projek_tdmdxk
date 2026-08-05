// Aturan prioritas antrean follow-up.
//
// Kenapa perlu skor sama sekali: ada ribuan target sedangkan jatah kirim hanya
// 30/hari — sekitar 4 bulan untuk satu putaran. Jadi pertanyaannya bukan
// "bagaimana menghubungi semua", tapi "siapa 30 orang hari ini".
//
// KPB dan dokumen sengaja memakai KURVA YANG BERBEDA, karena perilaku
// konsumennya memang berbeda:
//
//   KPB    → puncak di sekitar tanggal jatuh tempo. Yang lewat 90 hari besar
//            kemungkinan sudah servis di bengkel lain; yang baru lewat masih
//            bisa direbut. Urutan lama di menu KPB justru kebalikannya.
//
//   DOKUMEN→ puncak di 3-6 bulan menunggu. Konsumen yang dokumennya jadi 4
//            bulan lalu sudah TERBUKTI tidak datang sendiri, jadi merekalah
//            yang perlu ditagih. Yang baru jadi <7 hari sengaja ditekan: mereka
//            biasanya datang sendiri, menghubunginya memboroskan jatah harian.
//
// Skala akhir 30-95. Semua angka dikumpulkan di sini supaya bisa disetel tanpa
// menyentuh logika antrean.

export const KPB_BANDS = [
  { max: -60, score: 35, label: 'lewat >60 hari' },
  { max: -30, score: 50, label: 'lewat 31-60 hari' },
  { max: -7, score: 70, label: 'lewat 8-30 hari' },
  { max: 0, score: 80, label: 'baru lewat jatuh tempo' },
  { max: 7, score: 75, label: 'jatuh tempo ≤7 hari lagi' },
  { max: Infinity, score: 55, label: 'akan jatuh tempo' },
]

export const DOKUMEN_BANDS = [
  { max: 7, score: 30, label: 'baru jadi (<7 hari)' },
  { max: 30, score: 50, label: 'menunggu 7-30 hari' },
  { max: 90, score: 65, label: 'menunggu 1-3 bulan' },
  { max: 180, score: 80, label: 'menunggu 3-6 bulan' },
  { max: Infinity, score: 75, label: 'menunggu >6 bulan' },
]

export const BONUS_BELUM_PERNAH_DIHUBUNGI = 10
export const BONUS_LAMA_TIDAK_DIHUBUNGI = 5 // >30 hari sejak kontak terakhir
export const JEDA_MINIMAL_KONTAK_HARI = 7 // di bawah ini disembunyikan dari antrean

// Komponen halus 0-5 untuk memecah seri. Perlu karena dokumen masuk
// berkelompok: 1.062 STNK di data produksi hanya punya 32 tanggal terima
// berbeda, jadi tanpa ini ratusan baris berskor identik dan urutannya acak.
const MAKS_PEMECAH_SERI = 5

function cariBand(bands, nilai) {
  for (const band of bands) {
    if (nilai <= band.max) return band
  }
  return bands[bands.length - 1]
}

function pemecahSeri({ kind, daysRemaining, waitingDays }) {
  if (kind === 'KPB') {
    // Makin dekat ke tanggal jatuh tempo, makin tinggi.
    const jarak = Math.abs(daysRemaining ?? 0)
    return Math.max(0, MAKS_PEMECAH_SERI - Math.min(MAKS_PEMECAH_SERI, jarak / 12))
  }
  // Dokumen: makin lama menunggu, makin tinggi.
  return Math.min(MAKS_PEMECAH_SERI, (waitingDays ?? 0) / 60)
}

/**
 * Skor plus alasannya. Alasan ikut dikembalikan supaya UI bisa menjelaskan
 * kenapa sebuah baris ada di urutan atas — tanpa itu, antrean berbasis skor
 * terasa seperti kotak hitam bagi admin.
 */
export function hitungSkor({ kind, daysRemaining, waitingDays, lastContactDays }) {
  const band = kind === 'KPB'
    ? cariBand(KPB_BANDS, daysRemaining)
    : cariBand(DOKUMEN_BANDS, waitingDays)

  let skor = band.score
  const alasan = [band.label]

  if (lastContactDays === null || lastContactDays === undefined) {
    skor += BONUS_BELUM_PERNAH_DIHUBUNGI
    alasan.push('belum pernah dihubungi')
  } else if (lastContactDays > 30) {
    skor += BONUS_LAMA_TIDAK_DIHUBUNGI
    alasan.push(`terakhir dihubungi ${lastContactDays} hari lalu`)
  }

  skor += pemecahSeri({ kind, daysRemaining, waitingDays })
  return { skor: Math.round(skor * 10) / 10, alasan: alasan.join(' • ') }
}

/**
 * Baru dihubungi kurang dari seminggu lalu → jangan tampilkan lagi. Ini bukan
 * sekadar kesopanan: mengirim berulang ke nomor yang sama persis pola yang
 * membuat WhatsApp membatasi nomor gateway dealer pada 2026-08-04.
 */
export function terlaluBaruDihubungi(lastContactDays) {
  return lastContactDays !== null && lastContactDays !== undefined && lastContactDays < JEDA_MINIMAL_KONTAK_HARI
}
