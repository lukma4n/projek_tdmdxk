import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReceiptPrefix,
  issueReceiptNumber,
} from '../src/services/receiptNumberService.js'

// Stub minimal: hanya menyediakan findFirst yang dipakai issueReceiptNumber.
function stubTx(lastReceiptNumber) {
  const calls = []
  return {
    calls,
    document_handover_steps: {
      findFirst: async (args) => {
        calls.push(args)
        return lastReceiptNumber ? { receipt_number: lastReceiptNumber } : null
      },
    },
  }
}

test('awalan memakai TT- agar tidak tertukar dengan nomor DMS', () => {
  const agustus = new Date(2026, 7, 29)
  assert.equal(buildReceiptPrefix('STNK', 'DXK', agustus), 'TT-STNK/DXK/26/08/')
  assert.equal(buildReceiptPrefix('BPKB', 'DXK', agustus), 'TT-BPKB/DXK/26/08/')
})

test('awalan memakai tanggal lokal, bukan UTC', () => {
  // 1 Januari 2026 pukul 01.00 WIB masih 31 Desember 2025 di UTC.
  // toISOString akan menghasilkan bulan 12 tahun 25 — salah.
  const awalTahun = new Date(2026, 0, 1, 1, 0, 0)
  assert.equal(buildReceiptPrefix('STNK', 'DXK', awalTahun), 'TT-STNK/DXK/26/01/')
})

test('awalan menolak jenis dokumen selain STNK dan BPKB', () => {
  assert.throws(() => buildReceiptPrefix('BUKU_SERVICE'), /hanya untuk STNK dan BPKB/)
  assert.throws(() => buildReceiptPrefix('PLAT'), /hanya untuk STNK dan BPKB/)
})

test('nomor pertama di bulan itu mulai dari 00001', async () => {
  const tx = stubTx(null)
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00001')
})

test('nomor berikutnya melanjutkan urutan terakhir', async () => {
  const tx = stubTx('TT-STNK/DXK/26/08/00041')
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00042')
})

test('urutan STNK dan BPKB terpisah', async () => {
  const tx = stubTx(null)
  await issueReceiptNumber(tx, 'BPKB', { now: new Date(2026, 7, 29) })
  assert.equal(tx.calls[0].where.receipt_number.startsWith, 'TT-BPKB/DXK/26/08/')
})

test('urutan kembali ke 00001 saat bulan berganti', async () => {
  // Pencarian dibatasi awalan bulan berjalan, jadi nomor bulan lalu tak terlihat.
  const tx = stubTx(null)
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 8, 1) })
  assert.equal(nomor, 'TT-STNK/DXK/26/09/00001')
  assert.equal(tx.calls[0].where.receipt_number.startsWith, 'TT-STNK/DXK/26/09/')
})

test('nomor di-pad 5 digit agar urutan leksikografis sama dengan numerik', async () => {
  const tx = stubTx('TT-STNK/DXK/26/08/00009')
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00010')
  assert.equal(tx.calls[0].orderBy.receipt_number, 'desc')
})
