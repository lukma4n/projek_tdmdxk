import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'

// Endpoint catat-kontak terpadu: satu pintu untuk KPB, STNK, BPKB, dan
// kombinasi STNK+BPKB. Tidak mengirim apa pun — pengiriman manual oleh staf
// lewat WhatsApp Web; endpoint ini memotong jatah harian dan mencatat kontak.
const PREFIX = 'FSEND-'
let cookie
let customerId

async function cleanup() {
  await prismaTest.whatsapp_send_logs.deleteMany({ where: { target_key: { startsWith: PREFIX } } })
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  const cs = await prismaTest.customers.findMany({ where: { so_number: { startsWith: PREFIX } }, select: { id: true } })
  if (cs.length) {
    await prismaTest.kpb_followups.deleteMany({ where: { customer_id: { in: cs.map((c) => c.id) } } })
    await prismaTest.whatsapp_send_logs.deleteMany({ where: { target_key: { in: cs.map((c) => String(c.id)) } } })
  }
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: PREFIX } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  cookie = (await loginAs('test_crm', 'password123')).cookie

  const so = new Date()
  so.setMonth(so.getMonth() - 3)
  const c = await prismaTest.customers.create({
    data: {
      customer_name: 'Konsumen Kirim', so_number: `${PREFIX}SO-1`, so_date: so,
      // Nomor sengaja unik lintas file tes — antrean menyatukan target
      // ber-nomor sama jadi satu baris, dan itu bisa menyembunyikan data tes lain.
      no_engine: `${PREFIX}ENGKPB`, customer_mobile: '081277700011', model: 'BEAT', branch_code: 'DXK',
    },
  })
  customerId = c.id

  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK', branch_name: 'DXK', engine_number: `${PREFIX}ENGDUA`,
      stnk_name: 'Konsumen Dua Dokumen', mobile: '081200000009',
      stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER',
      bpkb_status: 'BELUM_DIAMBIL', lokasi_bpkb: 'DEALER', finance_company: null,
    },
  })
})

beforeEach(async () => {
  await prismaTest.whatsapp_send_logs.deleteMany({})
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.kpb_followups.deleteMany({ where: { customer_id: customerId } })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('catat kontak KPB menyimpan follow-up dan memotong jatah', async () => {
  const res = await callAuthenticated('post', `/api/followup/contact/KPB/${customerId}`, cookie, { kpb_level: 'KPB1' })
  assert.equal(res.status, 201)
  assert.match(res.body.message, /6281277700011/)
  assert.equal(res.body.daily.terpakai, 1)

  const followups = await prismaTest.kpb_followups.findMany({ where: { customer_id: customerId } })
  assert.equal(followups.length, 1)
  assert.equal(followups[0].status, 'sudah_dihubungi')

  const log = await prismaTest.whatsapp_send_logs.findMany({ where: { target_key: String(customerId) } })
  assert.equal(log.length, 1)
  assert.equal(log[0].module, 'KPB')
})

test('STNK+BPKB satu unit memakai SATU jatah, bukan dua', async () => {
  // 80 konsumen di data produksi butuh keduanya. Dihitung terpisah berarti 2
  // jatah, dan konsumen disuruh datang dua kali untuk perjalanan yang sama.
  const res = await callAuthenticated('post', `/api/followup/contact/STNK/${PREFIX}ENGDUA`, cookie, {
    kebutuhan: ['STNK', 'BPKB'],
  })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body.kebutuhan, ['STNK', 'BPKB'])

  const log = await prismaTest.whatsapp_send_logs.findMany({ where: { target_key: `${PREFIX}ENGDUA` } })
  assert.equal(log.length, 1, 'hanya satu jatah harian yang terpakai')
  assert.equal(log[0].module, 'STNK_BPKB')

  // Tapi tiap dokumen tetap dicatat sendiri supaya riwayat per dokumen akurat.
  const followups = await prismaTest.showroom_document_followups.findMany({ where: { engine_number: `${PREFIX}ENGDUA` } })
  assert.equal(followups.length, 2)
  assert.deepEqual(followups.map((f) => f.document_type).sort(), ['BPKB', 'STNK'])
})

test('riwayat STNK maupun BPKB memuat kiriman gabungan', async () => {
  // Satu pesan gabungan tercatat sebagai SATU baris log. Kalau riwayat per
  // dokumen mencocokkan module secara persis, panel akan berkata "belum ada
  // pesan terkirim" untuk pesan yang sudah sampai ke konsumen.
  await callAuthenticated('post', `/api/followup/contact/STNK/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['STNK', 'BPKB'] })

  for (const jenis of ['STNK', 'BPKB']) {
    const res = await callAuthenticated('get', `/api/followup/history/${jenis}/${PREFIX}ENGDUA`, cookie)
    assert.equal(res.status, 200)
    assert.equal(res.body.pengiriman.length, 1, `riwayat ${jenis} harus memuat kiriman gabungan`)
    assert.equal(res.body.pengiriman[0].module, 'STNK_BPKB')
  }
})

test('urutan kebutuhan terbalik menghasilkan module yang sama', async () => {
  // Urutan datang dari request, jadi tanpa pembakuan pengiriman yang sama bisa
  // tercatat dua nilai berbeda dan salah satunya luput dari penelusuran.
  await callAuthenticated('post', `/api/followup/contact/BPKB/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['BPKB', 'STNK'] })
  const log = await prismaTest.whatsapp_send_logs.findMany({ where: { target_key: `${PREFIX}ENGDUA` } })
  assert.equal(log[0].module, 'STNK_BPKB')
})

test('catat satu jenis saja hanya mencatat jenis itu', async () => {
  await callAuthenticated('post', `/api/followup/contact/STNK/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['STNK'] })

  const followups = await prismaTest.showroom_document_followups.findMany({ where: { engine_number: `${PREFIX}ENGDUA` } })
  assert.equal(followups.length, 1)
  assert.equal(followups[0].document_type, 'STNK')
})

test('jenis tidak valid ditolak', async () => {
  const res = await callAuthenticated('post', `/api/followup/contact/SIM/${customerId}`, cookie, {})
  assert.equal(res.status, 400)
})

test('target tidak ditemukan ditolak tanpa mencatat apa pun', async () => {
  const res = await callAuthenticated('post', `/api/followup/contact/STNK/${PREFIX}TIDAKADA`, cookie, {})
  assert.equal(res.status, 404)
  assert.equal(await prismaTest.whatsapp_send_logs.count(), 0)
})

test('batas harian dihormati oleh endpoint terpadu', async () => {
  const user = await prismaTest.users.findUnique({ where: { username: 'test_crm' } })
  await prismaTest.whatsapp_send_logs.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      module: 'KPB', target_key: `${PREFIX}pad${i}`, phone: '628', sent_by: user.id,
    })),
  })

  const sebelum = await prismaTest.kpb_followups.count({ where: { customer_id: customerId } })
  const res = await callAuthenticated('post', `/api/followup/contact/KPB/${customerId}`, cookie, { kpb_level: 'KPB1' })
  assert.equal(res.status, 429)
  assert.equal(
    await prismaTest.kpb_followups.count({ where: { customer_id: customerId } }), sebelum,
    'jatah habis tidak boleh meninggalkan catatan follow-up palsu',
  )
})

test('draf pesan + tautan wa.me ikut dalam antrean', async () => {
  // Teks disusun server supaya mengikuti template aktif, dan ikut dalam respons
  // antrean supaya window.open bisa dipanggil langsung di handler klik —
  // menunggu request dulu membuat browser memblokirnya sebagai popup.
  const res = await callAuthenticated('get', `/api/followup/queue?limit=500&search=${PREFIX}ENGDUA`, cookie)
  assert.equal(res.status, 200)
  const baris = res.body.data.find((r) => r.key === `${PREFIX}ENGDUA`)
  assert.ok(baris, 'baris uji harus ada di antrean')
  assert.match(baris.draft_message, /STNK dan BPKB motor Honda anda Sudah Jadi/)
  assert.match(baris.wa_url, /^https:\/\/wa\.me\/6281200000009\?text=/)
  assert.ok(decodeURIComponent(baris.wa_url.split('text=')[1]).includes('Sudah Jadi'))
})
