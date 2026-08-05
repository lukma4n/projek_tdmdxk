import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'
import { resetDeviceCache } from '../src/services/wablasService.js'

// Endpoint kirim terpadu: satu pintu untuk KPB, STNK, BPKB, dan kombinasi
// STNK+BPKB. Layar antrean tidak perlu tahu endpoint mana untuk jenis apa.
const PREFIX = 'FSEND-'
let cookie
let customerId

const fetchAsli = globalThis.fetch
const terkirim = []

// Gateway tiruan: device/info menjawab connected, send-message mencatat payload.
function pasangGatewayPalsu() {
  globalThis.fetch = async (url, opsi) => {
    if (String(url).includes('/api/device/info')) {
      return { ok: true, status: 200, json: async () => ({ status: true, data: { status: 'connected', active: true, quota: 500 } }) }
    }
    terkirim.push(JSON.parse(opsi.body))
    return {
      ok: true, status: 200,
      json: async () => ({ status: true, data: { quota: 499, messages: [{ id: 'msg-uji', status: 'pending' }] } }),
    }
  }
}

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

  process.env.WABLAS_HOST = 'https://texas.wablas.com'
  process.env.WABLAS_TOKEN = 'tok'
  process.env.WABLAS_SECRET = 'sec'

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
  terkirim.length = 0
  resetDeviceCache()
  pasangGatewayPalsu()
  await prismaTest.whatsapp_send_logs.deleteMany({})
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.kpb_followups.deleteMany({ where: { customer_id: customerId } })
})

after(async () => {
  globalThis.fetch = fetchAsli
  await cleanup()
  await prismaTest.$disconnect()
})

test('kirim KPB lewat endpoint terpadu mencatat follow-up dan log pengiriman', async () => {
  const res = await callAuthenticated('post', `/api/followup/send/KPB/${customerId}`, cookie, { kpb_level: 'KPB1' })
  assert.equal(res.status, 201)
  assert.match(res.body.message, /6281277700011/)

  assert.equal(terkirim.length, 1)
  assert.equal(terkirim[0].phone, '6281277700011')
  assert.match(terkirim[0].message, /KPB1/)

  const followups = await prismaTest.kpb_followups.findMany({ where: { customer_id: customerId } })
  assert.equal(followups.length, 1)
  assert.equal(followups[0].status, 'sudah_dihubungi')

  const log = await prismaTest.whatsapp_send_logs.findMany({ where: { target_key: String(customerId) } })
  assert.equal(log.length, 1)
  assert.equal(log[0].module, 'KPB')
})

test('STNK+BPKB satu unit dikirim sebagai SATU pesan dan SATU jatah', async () => {
  // 80 konsumen di data produksi butuh keduanya. Dikirim terpisah berarti 2
  // pesan, 2 jatah, dan konsumen disuruh datang dua kali untuk perjalanan sama.
  const res = await callAuthenticated('post', `/api/followup/send/STNK/${PREFIX}ENGDUA`, cookie, {
    kebutuhan: ['STNK', 'BPKB'],
  })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body.kebutuhan, ['STNK', 'BPKB'])

  assert.equal(terkirim.length, 1, 'gateway hanya boleh menerima satu pesan')
  assert.match(terkirim[0].message, /STNK dan BPKB motor Honda anda Sudah Jadi/)

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
  await callAuthenticated('post', `/api/followup/send/STNK/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['STNK', 'BPKB'] })

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
  await callAuthenticated('post', `/api/followup/send/BPKB/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['BPKB', 'STNK'] })
  const log = await prismaTest.whatsapp_send_logs.findMany({ where: { target_key: `${PREFIX}ENGDUA` } })
  assert.equal(log[0].module, 'STNK_BPKB')
})

test('kirim satu jenis saja tetap memakai template jenis itu', async () => {
  await callAuthenticated('post', `/api/followup/send/STNK/${PREFIX}ENGDUA`, cookie, { kebutuhan: ['STNK'] })
  assert.match(terkirim[0].message, /STNK motor Honda anda Sudah Jadi/)
  assert.doesNotMatch(terkirim[0].message, /STNK dan BPKB/)

  const followups = await prismaTest.showroom_document_followups.findMany({ where: { engine_number: `${PREFIX}ENGDUA` } })
  assert.equal(followups.length, 1)
  assert.equal(followups[0].document_type, 'STNK')
})

test('jenis tidak valid ditolak', async () => {
  const res = await callAuthenticated('post', `/api/followup/send/SIM/${customerId}`, cookie, {})
  assert.equal(res.status, 400)
})

test('target tidak ditemukan ditolak tanpa mengirim apa pun', async () => {
  const res = await callAuthenticated('post', `/api/followup/send/STNK/${PREFIX}TIDAKADA`, cookie, {})
  assert.equal(res.status, 404)
  assert.equal(terkirim.length, 0)
})

test('batas harian dihormati oleh endpoint terpadu', async () => {
  const user = await prismaTest.users.findUnique({ where: { username: 'test_crm' } })
  await prismaTest.whatsapp_send_logs.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      module: 'KPB', target_key: `${PREFIX}pad${i}`, phone: '628', sent_by: user.id,
    })),
  })

  const res = await callAuthenticated('post', `/api/followup/send/KPB/${customerId}`, cookie, { kpb_level: 'KPB1' })
  assert.equal(res.status, 429)
  assert.equal(terkirim.length, 0, 'tidak boleh menyentuh gateway saat jatah habis')
})
