import test from 'node:test'
import assert from 'node:assert/strict'

import { hitungSkor, terlaluBaruDihubungi, JEDA_MINIMAL_KONTAK_HARI } from '../src/services/followupPriority.js'

const skorKpb = (daysRemaining, lastContactDays = null) =>
  hitungSkor({ kind: 'KPB', daysRemaining, waitingDays: Math.max(0, -daysRemaining), lastContactDays }).skor

const skorDok = (waitingDays, lastContactDays = null) =>
  hitungSkor({ kind: 'STNK', daysRemaining: null, waitingDays, lastContactDays }).skor

// KPB dan dokumen sengaja memakai kurva berbeda. Tes ini mengunci arah kurvanya,
// bukan angka pastinya — kalau bobot disetel ulang, tes tetap harus lolos selama
// arah prioritasnya tidak terbalik.
test('KPB: puncak di sekitar jatuh tempo, menurun kalau makin lama terlewat', () => {
  const baruLewat = skorKpb(-2)
  const sebulanLewat = skorKpb(-45)
  const tigaBulanLewat = skorKpb(-85)

  assert.ok(baruLewat > sebulanLewat, 'baru lewat harus di atas lewat 1,5 bulan')
  assert.ok(sebulanLewat > tigaBulanLewat, 'lewat 1,5 bulan harus di atas lewat ~3 bulan')
})

test('KPB: yang belum jatuh tempo tidak boleh mengalahkan yang baru lewat', () => {
  assert.ok(skorKpb(-2) > skorKpb(5), 'sudah lewat lebih mendesak daripada 5 hari lagi')
})

test('dokumen: makin lama menunggu makin tinggi — konsumen terbukti tidak datang sendiri', () => {
  const baruJadi = skorDok(3)
  const duaMinggu = skorDok(14)
  const duaBulan = skorDok(60)
  const empatBulan = skorDok(120)

  assert.ok(baruJadi < duaMinggu, 'dokumen baru jadi justru ditekan, beri waktu konsumen datang sendiri')
  assert.ok(duaMinggu < duaBulan)
  assert.ok(duaBulan < empatBulan, 'menunggu 4 bulan lebih mendesak daripada 2 bulan')
})

test('dokumen: skor tidak seri walau lama tunggu berdekatan', () => {
  // 1.062 STNK di data produksi hanya punya 32 tanggal terima berbeda, jadi
  // tanpa pemecah seri ratusan baris berskor identik dan urutannya acak.
  assert.notEqual(skorDok(100), skorDok(140))
  assert.ok(skorDok(140) > skorDok(100))
})

test('belum pernah dihubungi diprioritaskan di atas yang sudah', () => {
  assert.ok(skorDok(60, null) > skorDok(60, 20))
})

test('lama tidak dihubungi dapat dorongan kecil', () => {
  assert.ok(skorDok(60, 45) > skorDok(60, 20))
})

test('baru dihubungi <7 hari disembunyikan dari antrean', () => {
  assert.equal(terlaluBaruDihubungi(0), true)
  assert.equal(terlaluBaruDihubungi(6), true)
  assert.equal(terlaluBaruDihubungi(JEDA_MINIMAL_KONTAK_HARI), false)
  assert.equal(terlaluBaruDihubungi(30), false)
  assert.equal(terlaluBaruDihubungi(null), false, 'belum pernah dihubungi bukan berarti baru dihubungi')
})

test('alasan prioritas ikut dikembalikan supaya antrean bisa dijelaskan', () => {
  const { alasan } = hitungSkor({ kind: 'STNK', waitingDays: 120, lastContactDays: null })
  assert.match(alasan, /menunggu 3-6 bulan/)
  assert.match(alasan, /belum pernah dihubungi/)
})
