import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { PDFParse } from 'pdf-parse'

import { generateReceiptPdf } from '../src/services/receiptPdfService.js'

// Teks pada PDF dikompresi di dalam stream, jadi tidak bisa dicek dari byte
// mentah -- pakai pdf-parse (sudah dipakai di controller lain) untuk membaca
// teks yang benar-benar dirender.
async function bacaTeksPdf(absolutePath) {
  const buffer = await fs.readFile(absolutePath)
  const parser = new PDFParse({ data: buffer })
  const { text } = await parser.getText()
  await parser.destroy()
  return text
}

const dibuat = []

// Nomor tanda terima di bawah ini deterministik (00001, 00042, ...) --
// sama persis dengan pola nomor produksi bulan itu. Tulis ke direktori
// sementara, bukan arsip produksi, atau tes ini bisa menimpa tanda terima
// asli yang sudah diserahkan ke konsumen.
let tmpDir

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tanda-terima-test-'))
})

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const DATA = {
  document_type: 'BPKB',
  owner_name: 'DARWIN',
  owner_address: 'Jl Pasir Mayang',
  owner_province: 'KALIMANTAN BARAT',
  owner_ktp: '6104160811960005',
  merk_type: 'KG0 / M/T',
  model_name: 'CB150 VERZA CW',
  production_year: 2025,
  color_name: 'BK-BLACK',
  chassis_number: 'KC0411SK036977',
  engine_number: 'KC04E1037046',
  no_polisi: 'KB4223GAQ',
  no_plat: 'KB4223GAQ',
  document_number: 'W06560023',
}

after(async () => {
  for (const p of dibuat) await fs.unlink(p).catch(() => {})
})

test('menyusun PDF dan mengembalikan hash isinya', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-BPKB/DXK/26/08/00001',
    data: DATA,
    giverName: 'MUHAMMAD HARIS SAPUTRA',
    receiverName: 'DARWIN',
    items: ['BPKB', 'Copy Faktur', 'NIK'],
    issuedAt: new Date(2026, 7, 29, 12, 29),
    outputDir: tmpDir,
  })
  dibuat.push(hasil.absolutePath)

  const isi = await fs.readFile(hasil.absolutePath)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF', 'berkas harus PDF sungguhan')

  const hashSebenarnya = crypto.createHash('sha256').update(isi).digest('hex')
  assert.equal(hasil.sha256, hashSebenarnya, 'hash harus cocok dengan isi berkas')
  assert.equal(hasil.sha256.length, 64)

  assert.match(hasil.urlPath, /^\/uploads\/tanda-terima\//)
})

test('nama berkas memuat nomor tanda terima yang aman untuk path', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-STNK/DXK/26/08/00042',
    data: { ...DATA, document_type: 'STNK', document_number: '22012900I' },
    giverName: 'LUKMAN',
    receiverName: 'RINALDI AKBAR HASZ',
    items: ['STNK', 'Plat'],
    issuedAt: new Date(2026, 7, 29, 12, 27),
    outputDir: tmpDir,
  })
  dibuat.push(hasil.absolutePath)

  // Garis miring di nomor tidak boleh jadi sub-folder.
  assert.ok(!hasil.urlPath.includes('TT-STNK/DXK'), 'garis miring harus diganti')
  assert.match(hasil.urlPath, /TT-STNK-DXK-26-08-00042/)
})

test('tetap menyusun PDF walau tahun dan KTP kosong', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-STNK/DXK/26/08/00043',
    data: { ...DATA, production_year: null, owner_ktp: null, merk_type: null },
    giverName: 'LUKMAN',
    receiverName: 'SESEORANG',
    items: ['STNK'],
    issuedAt: new Date(2026, 7, 29),
    outputDir: tmpDir,
  })
  dibuat.push(hasil.absolutePath)

  const isi = await fs.readFile(hasil.absolutePath)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF')

  const teks = await bacaTeksPdf(hasil.absolutePath)
  assert.match(teks, /Tahun Pembuatan\s*:\s*-/, 'field kosong harus dirender sebagai "-"')
  assert.match(teks, /No\.KTP Pemilik\s*:\s*-/, 'field kosong harus dirender sebagai "-"')
  assert.match(teks, /Merk\/Type\s*:\s*-/, 'field kosong harus dirender sebagai "-"')
  assert.doesNotMatch(teks, /null/i, 'nilai null tidak boleh muncul sebagai teks literal')
  assert.doesNotMatch(teks, /undefined/i, 'nilai undefined tidak boleh muncul sebagai teks literal')
})

test('tanda tangan yang berkasnya sudah tidak ada di disk tetap menghasilkan PDF valid', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-STNK/DXK/26/08/00044',
    data: { ...DATA, document_type: 'STNK' },
    giverName: 'LUKMAN',
    receiverName: 'SESEORANG',
    items: ['STNK'],
    issuedAt: new Date(2026, 7, 29),
    signatureGiverPath: '/tidak/ada/berkas-tanda-tangan-ini.png',
    signatureReceiverPath: '/tidak/ada/berkas-lainnya.png',
    outputDir: tmpDir,
  })
  dibuat.push(hasil.absolutePath)

  const isi = await fs.readFile(hasil.absolutePath)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF', 'berkas harus tetap PDF sungguhan walau gambar tanda tangan hilang')

  const hashSebenarnya = crypto.createHash('sha256').update(isi).digest('hex')
  assert.equal(hasil.sha256, hashSebenarnya, 'hash harus tetap cocok dengan isi berkas')
  assert.equal(hasil.sha256.length, 64)
})
