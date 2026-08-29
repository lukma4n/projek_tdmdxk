import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import bcrypt from 'bcryptjs'
import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  callAuthenticated,
  request,
  app,
} from './helpers.js'

const ENG_A = 'DHTEST-EKSP-0001'
const ENG_B = 'DHTEST-EKSP-0002'
const ALL_ENGINES = [ENG_A, ENG_B]
const HANDOVER_PHOTO = Buffer.from('fake-jpg-content-for-handover-proof-test')
const SIGNATURE_PNG = Buffer.from('89504e470d0a1a0a-tanda-tangan-ekspedisi-uji')

let adminCookie
let partmanCookie
let courierACookie
let courierBId
let salesmanDhCookie

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
  await prismaTest.showroom_pickup_requests.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
  await prismaTest.users.deleteMany({ where: { username: { in: ['test_courier_a', 'test_courier_b', 'test_salesman_dh'] } } })
}

async function createUser(username, role) {
  const password_hash = await bcrypt.hash('password123', 10)
  return prismaTest.users.upsert({
    where: { username },
    update: {},
    create: { username, password_hash, name: username, role },
  })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  await createUser('test_courier_a', 'Ekspedisi')
  const courierB = await createUser('test_courier_b', 'Ekspedisi')
  courierBId = courierB.id
  await createUser('test_salesman_dh', 'Salesman')

  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'DXK',
      engine_number: ENG_A,
      stnk_name: 'KONSUMEN EKSPEDISI A',
      mobile: '081200000001',
      chassis_number: 'EKSPFRAME0001',
      tgl_terima_stnk: new Date(),
    },
  })

  adminCookie = (await loginAs('test_admin', 'password123')).cookie
  partmanCookie = (await loginAs('test_partman', 'password123')).cookie
  courierACookie = (await loginAs('test_courier_a', 'password123')).cookie
  salesmanDhCookie = (await loginAs('test_salesman_dh', 'password123')).cookie
})

after(cleanup)

test('transisi admin_ke_ekspedisi TIDAK butuh nomor resi, ekspedisi_ke_konsumen menyelesaikan', async () => {
  // Resi umumnya belum ada saat admin baru menyerahkan paket secara fisik --
  // diisi belakangan oleh pihak ekspedisi lewat endpoint tracking-number.
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'tersedia',
      shipping_address: 'Jl. Test No. 1',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const step1 = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, adminCookie, {
    step_type: 'admin_ke_ekspedisi',
    received_by_name: 'test_courier_a',
  })
  assert.equal(step1.status, 201, 'admin_ke_ekspedisi harus berhasil tanpa tracking_number')

  let updated = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(updated.status, 'dikirim_ekspedisi')
  assert.equal(updated.tracking_number, null, 'resi belum terisi sampai ekspedisi mengisinya sendiri')
  assert.equal(updated.handover_mode, 'ekspedisi')

  const step2 = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', courierACookie)
    .attach('photo_handover', HANDOVER_PHOTO, 'bukti-terima.jpg')
    .attach('signature_giver', SIGNATURE_PNG, 'ttd-kurir.png')
    .attach('signature_receiver', SIGNATURE_PNG, 'ttd-konsumen.png')
    .field('step_type', 'ekspedisi_ke_konsumen')
    .field('received_by_name', 'KONSUMEN EKSPEDISI A')
  assert.equal(step2.status, 201)

  updated = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(updated.status, 'selesai')
})

test('ekspedisi_ke_konsumen ditolak (400) tanpa tanda tangan -- kurir wajib TTD sama seperti serah counter', async () => {
  // Kurir adalah titik paling rawan sengketa: tidak ada pengawasan kantor,
  // dan sebelumnya cuma dibuktikan foto. Sejak keputusan ini, STNK/BPKB yang
  // dikirim ekspedisi wajib dua tanda tangan sama seperti serah_ke_konsumen.
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'STNK' } })
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', courierACookie)
    .attach('photo_handover', HANDOVER_PHOTO, 'bukti-terima.jpg')
    .field('step_type', 'ekspedisi_ke_konsumen')
    .field('received_by_name', 'KONSUMEN EKSPEDISI B')
  assert.equal(res.status, 400)
  assert.match(res.body.error, /tanda tangan/i)

  const unchanged = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(unchanged.status, 'dikirim_ekspedisi', 'status tidak boleh berubah kalau ditolak karena tanda tangan kosong')
})

test('ekspedisi_ke_konsumen ditolak (400) tanpa foto penyerahan fisik', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'STNK' } })
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, courierACookie, {
    step_type: 'ekspedisi_ke_konsumen',
    received_by_name: 'KONSUMEN EKSPEDISI B',
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /foto/i)

  const unchanged = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(unchanged.status, 'dikirim_ekspedisi', 'status tidak boleh berubah kalau ditolak karena foto kosong')
})

test('admin_ke_ekspedisi ditolak (400) pada dokumen non-ekspedisi -- cegah status buntu', async () => {
  // Kalau lolos, dokumen jadi status dikirim_ekspedisi tanpa kurir: akun
  // Ekspedisi ditolak (bukan miliknya) dan serah_ke_konsumen tidak menerima
  // status itu -- buntu permanen, cuma bisa dibereskan lewat bedah database.
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'PLAT' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'PLAT',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, adminCookie, {
    step_type: 'admin_ke_ekspedisi',
    received_by_name: 'Pos Indonesia',
  })
  assert.equal(res.status, 400)

  const unchanged = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(unchanged.status, 'tersedia')
  assert.equal(unchanged.handover_mode, 'langsung')
})

test('admin_ke_ekspedisi ditolak (400) kalau mode ekspedisi tapi kurir belum ditugaskan', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'BPKB' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'BPKB',
      handover_mode: 'ekspedisi',
      status: 'tersedia',
      assigned_courier_id: null,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, adminCookie, {
    step_type: 'admin_ke_ekspedisi',
    received_by_name: 'Pos Indonesia',
  })
  assert.equal(res.status, 400)

  const unchanged = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(unchanged.status, 'tersedia', 'status tidak boleh berubah tanpa kurir yang ditugaskan')
})

test('serah_ke_konsumen oleh Salesman ditolak (400) tanpa foto penyerahan fisik', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'BPKB' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'BPKB',
      handover_mode: 'via_sales',
      status: 'diterima_sales',
      salesman_name: 'test_salesman_dh',
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, salesmanDhCookie, {
    step_type: 'serah_ke_konsumen',
    received_by_name: 'KONSUMEN B',
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /foto/i)

  const unchanged = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(unchanged.status, 'diterima_sales', 'status tidak boleh berubah kalau ditolak karena foto kosong')
})

test('serah_ke_konsumen oleh Salesman berhasil dengan foto penyerahan fisik', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'BUKU_SERVICE',
      handover_mode: 'via_sales',
      status: 'diterima_sales',
      salesman_name: 'test_salesman_dh',
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', salesmanDhCookie)
    .attach('photo_handover', HANDOVER_PHOTO, 'bukti-terima.jpg')
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'KONSUMEN B')
  assert.equal(res.status, 201)

  const updated = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(updated.status, 'selesai')
})

test('serah_ke_konsumen oleh Admin langsung TIDAK wajib foto (serah terima di counter)', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B, document_type: 'PLAT' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'PLAT',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, adminCookie, {
    step_type: 'serah_ke_konsumen',
    received_by_name: 'KONSUMEN B',
  })
  assert.equal(res.status, 201)

  const updated = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(updated.status, 'selesai')
})

test('PATCH tracking-number: akun Ekspedisi mengisi resi kiriman miliknya sendiri', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'BPKB',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('patch', `/api/showroom/document-handovers/${handover.id}/tracking-number`, courierACookie, {
    tracking_number: 'RESI-SELF-001',
  })
  assert.equal(res.status, 200)

  const updated = await prismaTest.document_handovers.findUnique({ where: { id: handover.id } })
  assert.equal(updated.tracking_number, 'RESI-SELF-001')
})

test('PATCH tracking-number: Admin boleh isi/ubah resi kiriman siapa pun', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'PLAT',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('patch', `/api/showroom/document-handovers/${handover.id}/tracking-number`, adminCookie, {
    tracking_number: 'RESI-ADMIN-001',
  })
  assert.equal(res.status, 200)
})

test('PATCH tracking-number ditolak (403) untuk akun Ekspedisi lain', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'BUKU_SERVICE',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierBId, // ditugaskan ke courier B
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('patch', `/api/showroom/document-handovers/${handover.id}/tracking-number`, courierACookie, {
    tracking_number: 'RESI-TIDAK-BOLEH',
  })
  assert.equal(res.status, 403)
})

test('PATCH tracking-number ditolak (400) kalau status bukan dikirim_ekspedisi', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A, document_type: 'STNK' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'tersedia', // belum diserahkan ke ekspedisi
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('patch', `/api/showroom/document-handovers/${handover.id}/tracking-number`, adminCookie, {
    tracking_number: 'RESI-TERLALU-DINI',
  })
  assert.equal(res.status, 400)
})

test('PATCH tracking-number ditolak (400) kalau kosong', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A, document_type: 'STNK' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('patch', `/api/showroom/document-handovers/${handover.id}/tracking-number`, adminCookie, {
    tracking_number: '   ',
  })
  assert.equal(res.status, 400)
})

test('akun Ekspedisi ditolak (403) mencoba step selain ekspedisi_ke_konsumen', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A, document_type: 'PLAT' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'PLAT',
      handover_mode: 'ekspedisi',
      status: 'tersedia',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, courierACookie, {
    step_type: 'admin_ke_ekspedisi',
    received_by_name: 'siapa saja',
  })
  assert.equal(res.status, 403)
})

test('akun Ekspedisi ditolak (403) untuk handover yang bukan miliknya', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A, document_type: 'BUKU_SERVICE' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'BUKU_SERVICE',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      assigned_courier_id: courierBId, // ditugaskan ke courier B, bukan A
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, courierACookie, {
    step_type: 'ekspedisi_ke_konsumen',
    received_by_name: 'konsumen',
  })
  assert.equal(res.status, 403)
})

test('role di luar Admin/Salesman/Ekspedisi ditolak (403) memakai endpoint step', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A, document_type: 'STNK' } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'STNK',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })
  const res = await callAuthenticated('post', `/api/showroom/document-handovers/${handover.id}/steps`, partmanCookie, {
    step_type: 'serah_ke_konsumen',
    received_by_name: 'konsumen',
  })
  assert.equal(res.status, 403)
})

test('getDocumentHandovers untuk role Ekspedisi cuma mengembalikan kiriman miliknya', async () => {
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: ENG_B } })

  await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'tersedia',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })
  await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_B,
      document_type: 'BPKB',
      handover_mode: 'ekspedisi',
      status: 'tersedia',
      assigned_courier_id: courierBId,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await callAuthenticated('get', '/api/showroom/document-handovers?limit=200', courierACookie)
  assert.equal(res.status, 200)
  const engBRows = res.body.data.filter((d) => d.engine_number === ENG_B)
  assert.equal(engBRows.length, 1)
  assert.equal(engBRows[0].document_type, 'STNK')
})

test('process-shipment membuat handover mode ekspedisi dengan shipping_address tersalin, pickup request jadi DONE', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B } })
  const pickup = await prismaTest.showroom_pickup_requests.create({
    data: {
      engine_number: ENG_B,
      consumer_name: 'KONSUMEN B',
      consumer_phone: '081200000002',
      requested_docs: 'STNK,PLAT',
      delivery_method: 'EKSPEDISI',
      shipping_address: 'Jl. Pengiriman No. 99',
      status: 'PENDING',
    },
  })

  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const res = await callAuthenticated('post', `/api/showroom/pickup-requests/${pickup.id}/process-shipment`, adminCookie, {
    document_types: ['STNK'],
    assigned_courier_id: courierA.id,
    include_buku_service: true,
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.created.length, 1)
  assert.equal(res.body.created[0].shipping_address, 'Jl. Pengiriman No. 99')
  assert.ok(res.body.buku_service_handover, 'Buku Service harus ikut dibundel')

  const rows = await prismaTest.document_handovers.findMany({ where: { engine_number: ENG_B } })
  assert.equal(rows.length, 2) // STNK + BUKU_SERVICE (PLAT tidak diminta di document_types)
  assert.ok(rows.every((r) => r.handover_mode === 'ekspedisi'))

  const updatedPickup = await prismaTest.showroom_pickup_requests.findUnique({ where: { id: pickup.id } })
  assert.equal(updatedPickup.status, 'DONE')
})

test('process-shipment ditolak (400) kalau delivery_method bukan EKSPEDISI', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B } })
  const pickup = await prismaTest.showroom_pickup_requests.create({
    data: {
      engine_number: ENG_B,
      requested_docs: 'STNK',
      delivery_method: 'AMBIL_SENDIRI',
      status: 'PENDING',
    },
  })
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const res = await callAuthenticated('post', `/api/showroom/pickup-requests/${pickup.id}/process-shipment`, adminCookie, {
    document_types: ['STNK'],
    assigned_courier_id: courierA.id,
  })
  assert.equal(res.status, 400)
})

test('process-shipment ditolak (400) kalau document_types di luar requested_docs', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_B } })
  const pickup = await prismaTest.showroom_pickup_requests.create({
    data: {
      engine_number: ENG_B,
      requested_docs: 'STNK',
      delivery_method: 'EKSPEDISI',
      shipping_address: 'Jl. Test',
      status: 'PENDING',
    },
  })
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  const res = await callAuthenticated('post', `/api/showroom/pickup-requests/${pickup.id}/process-shipment`, adminCookie, {
    document_types: ['BPKB'], // tidak diminta di pickup ini
    assigned_courier_id: courierA.id,
  })
  assert.equal(res.status, 400)
})

test('requestPickup mewajibkan shipping_address saat delivery_method EKSPEDISI', async () => {
  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .send({
      engine_number: ENG_A,
      pickup_token: 'token-tidak-valid-tapi-validasi-alamat-jalan-duluan',
      delivery_method: 'EKSPEDISI',
      // shipping_address sengaja kosong
    })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /[Aa]lamat/)
})

test('checkStnkBpkb mengembalikan shipments untuk unit yang punya handover mode ekspedisi', async () => {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: ENG_A } })
  const courierA = await prismaTest.users.findUnique({ where: { username: 'test_courier_a' } })
  await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_A,
      document_type: 'STNK',
      handover_mode: 'ekspedisi',
      status: 'dikirim_ekspedisi',
      tracking_number: 'RESI-CHECK-001',
      assigned_courier_id: courierA.id,
      created_by: (await prismaTest.users.findUnique({ where: { username: 'test_admin' } })).id,
    },
  })

  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({ engine_number: ENG_A, phone: '081200000001' })
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.shipments))
  const stnkShipment = res.body.shipments.find((s) => s.document_type === 'STNK')
  assert.ok(stnkShipment, 'shipment STNK harus muncul')
  assert.equal(stnkShipment.status, 'dikirim_ekspedisi')
  assert.equal(stnkShipment.tracking_number, 'RESI-CHECK-001')
  assert.equal(stnkShipment.courier_name, 'test_courier_a')
})
