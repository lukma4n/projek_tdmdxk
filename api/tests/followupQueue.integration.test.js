import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'

// Antrean terpadu menggantikan tiga daftar terpisah yang berbagi satu jatah
// kirim harian tanpa saling tahu.
const PREFIX = 'FQ-'
let cookie
let userId
let customerId

const hariLalu = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d }
const hariDepan = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d }

async function cleanup() {
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  const cs = await prismaTest.customers.findMany({ where: { so_number: { startsWith: PREFIX } }, select: { id: true } })
  if (cs.length) await prismaTest.kpb_followups.deleteMany({ where: { customer_id: { in: cs.map((c) => c.id) } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: PREFIX } } })
}

const ambilAntrean = async (query = '') => {
  const res = await callAuthenticated('get', `/api/followup/queue?limit=500${query}`, cookie)
  assert.equal(res.status, 200)
  return res.body
}
const punyaKita = (body) => body.data.filter((r) => String(r.key).startsWith(PREFIX) || String(r.so_number || '').startsWith(PREFIX) || r.customer_id === customerId)

before(async () => {
  await seedKnownUsers()
  await cleanup()
  cookie = (await loginAs('test_crm', 'password123')).cookie
  userId = (await prismaTest.users.findUnique({ where: { username: 'test_crm' } })).id

  // KPB: SO 3 bulan lalu → KPB1 (+2 bulan) sudah lewat ~1 bulan
  const c = await prismaTest.customers.create({
    data: {
      customer_name: 'Konsumen Antrean', so_number: `${PREFIX}SO-1`, so_date: hariLalu(92),
      no_engine: `${PREFIX}ENGKPB`, customer_mobile: '081234567890', model: 'BEAT',
      kecamatan: 'Delta Pawan', branch_code: 'DXK',
    },
  })
  customerId = c.id

  const dasar = { branch_code: 'DXK', branch_name: 'DXK', area_kecamatan: 'DELTA PAWAN' }
  await prismaTest.showroom_stnk_bpkb_tracks.createMany({
    data: [
      // STNK menunggu 4 bulan → prioritas tinggi
      { ...dasar, engine_number: `${PREFIX}ENGA`, stnk_name: 'Doc Lama', mobile: '081200000001',
        stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER', tgl_terima_stnk: hariLalu(120), bpkb_status: 'BELUM_JADI' },
      // STNK baru jadi 2 hari → prioritas rendah
      { ...dasar, engine_number: `${PREFIX}ENGB`, stnk_name: 'Doc Baru', mobile: '081200000002',
        stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER', tgl_terima_stnk: hariLalu(2), bpkb_status: 'BELUM_JADI' },
      // Satu unit butuh STNK DAN BPKB → harus jadi satu baris
      { ...dasar, engine_number: `${PREFIX}ENGC`, stnk_name: 'Doc Duaduanya', mobile: '081200000003',
        stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER', tgl_terima_stnk: hariLalu(60),
        bpkb_status: 'BELUM_DIAMBIL', lokasi_bpkb: 'DEALER', tgl_jadi_bpkb: hariLalu(60), finance_company: null },
      // Nomor HP tidak valid → tidak boleh masuk antrean
      { ...dasar, engine_number: `${PREFIX}ENGD`, stnk_name: 'Doc HP Rusak', mobile: '01234',
        stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER', tgl_terima_stnk: hariLalu(90), bpkb_status: 'BELUM_JADI' },
    ],
  })
})

beforeEach(async () => {
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.kpb_followups.deleteMany({ where: { customer_id: customerId } })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('antrean memuat KPB dan dokumen dalam satu daftar', async () => {
  const body = await ambilAntrean()
  const jenis = new Set(punyaKita(body).map((r) => r.kind))
  assert.ok(jenis.has('KPB'), 'KPB harus ikut')
  assert.ok(jenis.has('STNK'), 'STNK harus ikut')
})

test('dokumen yang menunggu lama diprioritaskan di atas yang baru jadi', async () => {
  const body = await ambilAntrean()
  const lama = body.data.find((r) => r.key === `${PREFIX}ENGA`)
  const baru = body.data.find((r) => r.key === `${PREFIX}ENGB`)
  assert.ok(lama && baru)
  assert.ok(lama.skor > baru.skor, `menunggu 4 bulan (${lama.skor}) harus di atas baru jadi (${baru.skor})`)
  assert.ok(body.data.indexOf(lama) < body.data.indexOf(baru))
})

test('nomor HP tidak valid disaring keluar dan dilaporkan', async () => {
  const body = await ambilAntrean()
  assert.equal(body.data.find((r) => r.key === `${PREFIX}ENGD`), undefined)
  assert.ok(body.tersaring.nomor_tidak_valid >= 1)

  const semua = await ambilAntrean('&include_invalid_phone=true')
  assert.ok(semua.data.find((r) => r.key === `${PREFIX}ENGD`), 'harus muncul kalau diminta')
})

test('STNK dan BPKB pada unit sama digabung jadi satu baris', async () => {
  const body = await ambilAntrean()
  const baris = body.data.filter((r) => r.key === `${PREFIX}ENGC`)
  assert.equal(baris.length, 1, 'tidak boleh dua baris untuk satu unit')
  assert.deepEqual([...baris[0].kebutuhan].sort(), ['BPKB', 'STNK'])
})

test('baru dihubungi <7 hari disembunyikan dari antrean', async () => {
  await prismaTest.showroom_document_followups.create({
    data: { document_type: 'STNK', engine_number: `${PREFIX}ENGA`, status: 'sudah_dihubungi', created_by: userId, followup_at: hariLalu(2) },
  })
  const body = await ambilAntrean()
  assert.equal(body.data.find((r) => r.key === `${PREFIX}ENGA`), undefined)
  assert.ok(body.tersaring.baru_dihubungi >= 1)
})

test('dijadwalkan hubungi ulang di masa depan disembunyikan sampai tanggalnya', async () => {
  const res = await callAuthenticated('post', `/api/followup/schedule/STNK/${PREFIX}ENGA`, cookie, {
    next_followup_at: hariDepan(5).toISOString(),
    status: 'pending',
    note: 'Konsumen minta ditelepon Sabtu',
  })
  assert.equal(res.status, 201)

  const body = await ambilAntrean()
  assert.equal(body.data.find((r) => r.key === `${PREFIX}ENGA`), undefined)
  assert.ok(body.tersaring.dijadwalkan_nanti >= 1)
})

test('jadwal yang tiba mengalahkan jeda 7 hari', async () => {
  // Kasus paling lazim: Rabu konsumen bilang "hubungi saya Sabtu". Jeda 7 hari
  // dihitung dari kontak Rabu, jadi tanpa pengecualian ini target justru hilang
  // dari antrean tepat pada hari yang dijanjikan dan baru muncul hari ke-7.
  await prismaTest.showroom_document_followups.create({
    data: {
      document_type: 'STNK', engine_number: `${PREFIX}ENGA`, status: 'pending',
      note: 'Konsumen janji datang Sabtu', created_by: userId,
      followup_at: hariLalu(3), next_followup_at: hariLalu(0),
    },
  })
  const body = await ambilAntrean()
  assert.ok(body.data.find((r) => r.key === `${PREFIX}ENGA`), 'hari janji sudah tiba, target harus muncul')
})

test('jeda 7 hari tetap berlaku untuk kontak tanpa jadwal', async () => {
  await prismaTest.showroom_document_followups.create({
    data: {
      document_type: 'STNK', engine_number: `${PREFIX}ENGA`, status: 'sudah_dihubungi',
      created_by: userId, followup_at: hariLalu(3),
    },
  })
  const body = await ambilAntrean()
  assert.equal(body.data.find((r) => r.key === `${PREFIX}ENGA`), undefined, 'tanpa jadwal, jeda 7 hari tetap menyembunyikan')
})

test('jadwal yang sudah lewat membuat target kembali muncul', async () => {
  await prismaTest.showroom_document_followups.create({
    data: {
      document_type: 'STNK', engine_number: `${PREFIX}ENGA`, status: 'pending',
      created_by: userId, followup_at: hariLalu(20), next_followup_at: hariLalu(3),
    },
  })
  const body = await ambilAntrean()
  assert.ok(body.data.find((r) => r.key === `${PREFIX}ENGA`), 'tanggal janji sudah lewat, harus muncul lagi')
})

test('filter area tidak peka huruf besar/kecil', async () => {
  // Dua sumber menulis kecamatan yang sama dengan kapitalisasi berbeda.
  const besar = await ambilAntrean('&area=DELTA%20PAWAN')
  const kecil = await ambilAntrean('&area=delta%20pawan')
  assert.equal(besar.pagination.total, kecil.pagination.total)
  assert.ok(besar.pagination.total >= 4)
})

test('setiap baris membawa alasan prioritas dan sisa jatah harian', async () => {
  const body = await ambilAntrean()
  const baris = punyaKita(body)[0]
  assert.ok(baris.alasan_prioritas, 'alasan wajib ada supaya antrean tidak jadi kotak hitam')
  assert.equal(typeof body.daily.sisa, 'number')
  assert.equal(typeof body.daily.limit, 'number')
})

test('riwayat kontak bisa ditelusuri per target', async () => {
  await prismaTest.showroom_document_followups.create({
    data: { document_type: 'STNK', engine_number: `${PREFIX}ENGA`, status: 'sudah_dihubungi', note: 'telepon pertama', created_by: userId, followup_at: hariLalu(40) },
  })
  const res = await callAuthenticated('get', `/api/followup/history/STNK/${PREFIX}ENGA`, cookie)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.length, 1)
  assert.equal(res.body.data[0].note, 'telepon pertama')
  assert.ok(Array.isArray(res.body.pengiriman))
})

test('nomor bermasalah bisa dibuka beserta alasannya', async () => {
  // Sebelumnya nomor tak layak hilang diam-diam dan admin tak tahu ada apa —
  // baru ketahuan saat WhatsApp menolaknya, setelah waktu staf terbuang.
  const body = await ambilAntrean('&nomor=bermasalah')
  const rusak = body.data.find((r) => r.key === `${PREFIX}ENGD`)
  assert.ok(rusak, 'baris ber-nomor rusak harus muncul di filter ini')
  assert.equal(rusak.phone_valid, false)
  // '01234' → '621234': gagal di awalan seluler (628) sebelum sampai cek panjang.
  assert.equal(rusak.alasan_nomor, 'bukan_seluler')
  assert.equal(rusak.nomor_tersimpan, '01234', 'nomor apa adanya ikut supaya bisa diperbaiki')
  assert.equal(rusak.wa_url, '', 'tanpa tautan WA — memang tidak bisa dihubungi')
  assert.ok(body.data.every((r) => r.phone_valid === false), 'filter ini hanya berisi yang bermasalah')
})

test('alasan tersaring dirinci per jenis masalah', async () => {
  const body = await ambilAntrean()
  assert.ok(body.tersaring.per_alasan, 'rincian alasan wajib ada')
  assert.equal(typeof body.alasan_nomor_label.dobel, 'string', 'kamus alasan datang dari server')
})
