import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  callAuthenticated,
  request,
  app,
} from './helpers.js'

const ENG_A = 'DHTEST-BUKU-0001'
const ENG_B = 'DHTEST-BUKU-0002'
const ENG_C = 'DHTEST-BUKU-0003'
const ALL_ENGINES = [ENG_A, ENG_B, ENG_C]

let adminCookie

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  // STNK & BPKB dua-duanya "siap" (diterima, belum diserahkan) untuk ENG_A --
  // dipakai menguji field buku_service_exists di getAvailableDocuments.
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'DXK',
      engine_number: ENG_A,
      stnk_name: 'KONSUMEN A',
      tgl_terima_stnk: new Date(),
      tgl_jadi_bpkb: new Date(),
    },
  })

  // ENG_C: STNK siap diserahkan, TAPI Buku Service-nya sudah pernah dibuat
  // duluan (mis. via BPKB minggu lalu) -- buku_service_exists harus true.
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'DXK',
      engine_number: ENG_C,
      stnk_name: 'KONSUMEN C',
      tgl_terima_stnk: new Date(),
    },
  })

  const admin = await prismaTest.users.findUnique({ where: { username: 'test_admin' } })
  await prismaTest.document_handovers.create({
    data: { engine_number: ENG_C, document_type: 'BUKU_SERVICE', created_by: admin.id },
  })

  adminCookie = (await loginAs('test_admin', 'password123')).cookie
})

after(cleanup)

test('POST document-handovers butuh autentikasi (401)', async () => {
  const res = await request(app)
    .post('/api/showroom/document-handovers')
    .send({ engine_number: ENG_A, document_type: 'STNK' })
  assert.equal(res.status, 401)
})

test('include_buku_service=true membuat handover STNK + BUKU_SERVICE sekaligus', async () => {
  const res = await callAuthenticated('post', '/api/showroom/document-handovers', adminCookie, {
    engine_number: ENG_A,
    document_type: 'STNK',
    include_buku_service: true,
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.document_type, 'STNK')
  assert.ok(res.body.buku_service_handover, 'respons harus menyertakan handover Buku Service yang ikut dibuat')
  assert.equal(res.body.buku_service_handover.document_type, 'BUKU_SERVICE')
  assert.equal(res.body.buku_service_handover.status, 'tersedia')

  const rows = await prismaTest.document_handovers.findMany({ where: { engine_number: ENG_A } })
  assert.equal(rows.length, 2, 'harus ada tepat 2 baris: STNK dan BUKU_SERVICE')
  assert.ok(rows.some((r) => r.document_type === 'STNK'))
  assert.ok(rows.some((r) => r.document_type === 'BUKU_SERVICE'))
})

test('bundling tidak membuat BUKU_SERVICE dobel, dan tidak menggagalkan dokumen utama', async () => {
  // ENG_A sudah punya BUKU_SERVICE dari test sebelumnya. Tambah BPKB dengan
  // include_buku_service=true lagi -- BPKB harus tetap berhasil dibuat,
  // tapi tidak boleh ada baris BUKU_SERVICE kedua.
  const res = await callAuthenticated('post', '/api/showroom/document-handovers', adminCookie, {
    engine_number: ENG_A,
    document_type: 'BPKB',
    include_buku_service: true,
  })
  assert.equal(res.status, 201, 'BPKB harus tetap berhasil dibuat meski Buku Service sudah ada')
  assert.equal(res.body.buku_service_handover, null, 'tidak boleh membuat Buku Service kedua')

  const bukuServiceRows = await prismaTest.document_handovers.findMany({
    where: { engine_number: ENG_A, document_type: 'BUKU_SERVICE' },
  })
  assert.equal(bukuServiceRows.length, 1, 'harus tetap cuma 1 baris Buku Service untuk unit ini')
})

test('tanpa include_buku_service, tidak ada Buku Service yang ikut terbuat', async () => {
  const res = await callAuthenticated('post', '/api/showroom/document-handovers', adminCookie, {
    engine_number: ENG_B,
    document_type: 'STNK',
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.buku_service_handover, null)

  const bukuServiceRows = await prismaTest.document_handovers.findMany({
    where: { engine_number: ENG_B, document_type: 'BUKU_SERVICE' },
  })
  assert.equal(bukuServiceRows.length, 0)
})

test('getAvailableDocuments menandai buku_service_exists sesuai riwayat unit', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-handovers/available', adminCookie)
  assert.equal(res.status, 200)

  const stnkForC = res.body.find((d) => d.engine_number === ENG_C && d.document_type === 'STNK')
  assert.ok(stnkForC, 'STNK ENG_C harus muncul sebagai available (belum pernah dibuat handovernya)')
  assert.equal(stnkForC.buku_service_exists, true, 'Buku Service ENG_C sudah pernah dibuat duluan')

  // ENG_B belum punya track STNK/BPKB/Plat siap sama sekali, tidak boleh muncul.
  const rowsForB = res.body.filter((d) => d.engine_number === ENG_B)
  assert.equal(rowsForB.length, 0)
})
