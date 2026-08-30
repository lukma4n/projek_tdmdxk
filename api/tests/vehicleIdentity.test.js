import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveProductionYear,
  formatMerkType,
  formatColorName,
} from '../src/utils/vehicleIdentity.js'

// Dua nomor rangka ini diambil dari tanda terima DMS asli yang dipakai sebagai
// acuan format. Tahun harapannya sama persis dengan yang tercetak di form.
test('tahun pembuatan cocok dengan tanda terima DMS asli', () => {
  assert.equal(deriveProductionYear('KC0411SK036977'), 2025)
  assert.equal(deriveProductionYear('JMH11XTK409060'), 2026)
})

test('tahun pembuatan mendukung format 17 karakter berawalan MH1', () => {
  // Karakter ke-10 pada VIN penuh = karakter ke-7 setelah awalan MH1 dilepas.
  assert.equal(deriveProductionYear('MH1EF3114SK001246'), 2025)
  assert.equal(deriveProductionYear('MH1JBG119FK186305'), 2015)
})

test('tahun pembuatan memetakan seluruh kode VIN yang dipakai', () => {
  const harapan = {
    F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020,
    M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026,
  }
  for (const [kode, tahun] of Object.entries(harapan)) {
    // Rangka 14 karakter: kode tahun di indeks 6.
    const rangka = `ABCDEF${kode}K123456`
    assert.equal(deriveProductionYear(rangka), tahun, `kode ${kode}`)
  }
})

test('tahun pembuatan null bila tidak dikenali — tidak boleh menebak', () => {
  assert.equal(deriveProductionYear('ABCDEFIK123456'), null, 'huruf I bukan kode VIN')
  assert.equal(deriveProductionYear('ABCDEFOK123456'), null, 'huruf O bukan kode VIN')
  assert.equal(deriveProductionYear('PENDEK'), null, 'panjang tidak dikenal')
  assert.equal(deriveProductionYear(''), null)
  assert.equal(deriveProductionYear(null), null)
  assert.equal(deriveProductionYear(undefined), null)
  assert.equal(deriveProductionYear(12345), null)
})

test('tahun pembuatan menerima huruf kecil dan spasi berlebih', () => {
  assert.equal(deriveProductionYear('  jmh11xtk409060  '), 2026)
})

test('merk/type menggabungkan kode produk dan transmisi', () => {
  assert.equal(formatMerkType('ML2A', 'AT'), 'ML2A / A/T')
  assert.equal(formatMerkType('EG2', 'SPORT'), 'EG2 / M/T')
  assert.equal(formatMerkType('LP0B', 'CUB'), 'LP0B / M/T')
})

test('merk/type null bila kode produk kosong', () => {
  assert.equal(formatMerkType('', 'AT'), null)
  assert.equal(formatMerkType(null, 'AT'), null)
})

test('merk/type: EV AT dipetakan ke A/T (bukan ikut default M/T)', () => {
  assert.equal(formatMerkType('PCXE', 'EV AT'), 'PCXE / A/T')
})

test('merk/type: kategori tidak dikenal dikosongkan, tidak ditebak M/T', () => {
  // Sebelum perbaikan ini, apa pun selain 'AT' otomatis dicetak M/T --
  // 4 unit EV AT ikut salah cetak, dan kategori baru apa pun dari Honda di
  // masa depan akan ikut salah juga. Field bukti harus kosong, bukan tebakan.
  assert.equal(formatMerkType('XX99', 'HYBRID'), null)
  assert.equal(formatMerkType('XX99', ''), null)
  assert.equal(formatMerkType('XX99', null), null)
})

test('warna memakai nama lengkap bila kodenya dikenal', () => {
  const peta = new Map([['BK', 'BK-BLACK'], ['MH', 'MH-MERAH HITAM']])
  assert.equal(formatColorName('BK', peta), 'BK-BLACK')
  assert.equal(formatColorName('mh', peta), 'MH-MERAH HITAM')
})

test('warna jatuh ke kode apa adanya bila belum ada di peta', () => {
  const peta = new Map([['BK', 'BK-BLACK']])
  // Lebih baik mencetak "PH" daripada mengosongkan warna sama sekali.
  assert.equal(formatColorName('PH', peta), 'PH')
  assert.equal(formatColorName('PH', undefined), 'PH')
  assert.equal(formatColorName('', peta), null)
})
