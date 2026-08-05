import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'

import { buildKpbMessage, buildStnkMessage, buildBpkbMessage, buildDocumentMessage } from '../src/services/followupMessages.js'

// Teks di bawah ini disalin dari hasil render template LAMA (frontend, sebelum
// pengiriman pindah ke server) dan sudah diverifikasi identik byte-per-byte.
// Kalau tes ini gagal, artinya isi pesan yang diterima konsumen berubah — pastikan
// itu memang disengaja. Perbedaan spasi "Jam buka" antara STNK dan KPB/BPKB ada
// sejak template lama dan sengaja dipertahankan.
const PUBLIC_URL_ASLI = process.env.PUBLIC_URL
const FRONTEND_URL_ASLI = process.env.FRONTEND_URL

before(() => {
  delete process.env.PUBLIC_URL
  process.env.FRONTEND_URL = 'https://tdmketapang.net'
})

after(() => {
  if (PUBLIC_URL_ASLI === undefined) delete process.env.PUBLIC_URL
  else process.env.PUBLIC_URL = PUBLIC_URL_ASLI
  if (FRONTEND_URL_ASLI === undefined) delete process.env.FRONTEND_URL
  else process.env.FRONTEND_URL = FRONTEND_URL_ASLI
})

const KPB_HARAPAN = [
  'Salam Satu Hati Pelanggan Setia Honda',
  '',
  'Kami Mau menginformasikan Bahwa motor Honda Bapak/Ibu YUSUF dengan tipe VARIO125 sudah waktunya melakukan KPB1 di AHASS Honda TDM Motor.',
  'Diharapkan untuk segera melakukan service agar kondisi motor tetap prima dan garansi service tetap terjaga.',
  '',
  'ALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan',
  '',
  'DENGAN PERSYARATAN :',
  '# Membawa buku service/KPB',
  '# Membawa STNK kendaraan',
  '# Membawa motor yang akan diservice',
  '',
  'Tenggat: 6 Mei 2026 (90 hari lewat).',
  '',
  'Jam buka',
  'Senin-Jumat : 09.00-16.00',
  'Sabtu                : 09.00-14.00',
  'Istirahat          : 12.00-13.30',
  '',
  'Terimakasih',
].join('\n')

const STNK_HARAPAN = [
  'Salam Satu Hati Pelanggan Setia Honda',
  '',
  'Bapak/Ibu MAT JUNI, kami menginformasikan bahwa STNK motor Honda REVO dengan nomor polisi KB5080IR SUDAH JADI.',
  'Diharapkan untuk segera mengambil STNK di Dealer Honda TDM Motor.',
  'ALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan',
  '',
  'DENGAN PERSYARATAN :',
  '# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)',
  'konsumen wajib membawa STNK Sementara dan KTP asli',
  '',
  'Jam buka',
  'Senin-Jumat   : 09.00-16.00',
  'Sabtu               : 09.00-14.00',
  'Istirahat          : 12.00-13.30',
  '',
  'Cek status dokumen Anda kapan saja:',
  'https://tdmketapang.net/cek?engine_number=JBK1E2146575',
  '',
  'Terimakasih',
].join('\n')

const BPKB_HARAPAN = [
  'Salam Satu Hati Pelanggan Setia Honda',
  '',
  'Bapak/Ibu MAT JUNI, kami menginformasikan bahwa BPKB motor Honda REVO dengan nomor polisi KB5080IR SUDAH JADI.',
  'Diharapkan untuk segera mengambil BPKB di Dealer Honda TDM Motor.',
  'ALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan',
  '',
  'DENGAN PERSYARATAN :',
  '# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)',
  'konsumen wajib membawa STNK dan KTP asli',
  '',
  '# Jika Pengambilan BPKB diwakili',
  'konsumen wajib : membawa surat kuasa dr pemilik kendaraan yg bertanda tangan diatas materai 10.000',
  'dan ktp Asli pembeli dan yg mewakili 1 lembar STNK dan KTP Asli',
  '',
  'Jam buka',
  'Senin-Jumat : 09.00-16.00',
  'Sabtu                : 09.00-14.00',
  'Istirahat          : 12.00-13.30',
  '',
  'Cek status dokumen Anda kapan saja:',
  'https://tdmketapang.net/cek?engine_number=EF32E1000330',
  '',
  'Terimakasih',
].join('\n')

test('pesan KPB persis sama dengan template lama', () => {
  const hasil = buildKpbMessage({
    customerName: 'YUSUF',
    model: 'VARIO125',
    kpbLabel: 'KPB1',
    dueDate: new Date('2026-05-06T00:00:00'),
    daysRemaining: -90,
  })
  assert.equal(hasil, KPB_HARAPAN)
})

test('pesan STNK menyebut nama, tipe motor, dan nomor polisi', () => {
  assert.equal(buildStnkMessage({ engineNumber: 'JBK1E2146575', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }), STNK_HARAPAN)
})

test('pesan BPKB menyebut nama, tipe motor, dan nomor polisi', () => {
  assert.equal(buildBpkbMessage({ engineNumber: 'EF32E1000330', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }), BPKB_HARAPAN)
})

test('semua pesan di bawah batas 1024 karakter Wablas', () => {
  // Nama konsumen terpanjang di data produksi (instansi, 103 karakter).
  const namaTerpanjang = 'BADAN PEMBERDAYAAN MASYARAKAT, PEMERINTAHAN DESA, PEREMPUAN DAN KELUARGA BERENCANA KABUPATEN KETAPANG'
  const kpb = buildKpbMessage({
    customerName: namaTerpanjang,
    model: 'VARIO125',
    kpbLabel: 'KPB1',
    dueDate: new Date('2026-05-06T00:00:00'),
    daysRemaining: -90,
  })
  assert.ok(kpb.length < 1024, `KPB ${kpb.length} karakter`)
  assert.ok(buildStnkMessage({ engineNumber: 'JBK1E2146575', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }).length < 1024)
  assert.ok(buildBpkbMessage({ engineNumber: 'EF32E1000330', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }).length < 1024)
})

test('buildDocumentMessage memilih template sesuai tipe', () => {
  assert.equal(buildDocumentMessage('STNK', { engineNumber: 'JBK1E2146575', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }), STNK_HARAPAN)
  assert.equal(buildDocumentMessage('BPKB', { engineNumber: 'EF32E1000330', customerName: 'MAT JUNI', model: 'REVO', noPolisi: 'KB5080IR' }), BPKB_HARAPAN)
})
