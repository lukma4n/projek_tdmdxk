import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { request, app } from './helpers.js'
import { prismaTest, seedKnownUsers } from './helpers.js'

const ELIGIBLE_ENGINE = 'MH1PICKUPTEST001'
const NONE_ENGINE = 'MH1PICKUPTEST002'
const PHONE = '081234567890'
const CHASSIS = 'MHR12345678901234'

// Buffer KTP palsu untuk upload multipart. Isi tidak diperiksa server — multer
// hanya memvalidasi ekstensi/mime (image/jpeg) via imageFileFilter.
const KTP_PHOTO = Buffer.from('fake-jpg-content-for-pickup-ktp-test')

async function loginAs(agent, username, password = 'password123') {
  const res = await agent.post('/api/auth/login').send({ username, password })
  assert.equal(res.status, 200, `Login failed for ${username}`)
  return agent
}

test.before(async () => {
  await seedKnownUsers()

  // Bersihkan sisa data tes sebelumnya
  await prismaTest.showroom_pickup_requests.deleteMany({
    where: { engine_number: { in: [ELIGIBLE_ENGINE, NONE_ENGINE] } },
  })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({
    where: { engine_number: { in: [ELIGIBLE_ENGINE, NONE_ENGINE] } },
  })

  // Unit eligible: BPKB cash sudah jadi & belum diserahkan → dokumen siap diambil.
  // STNK & Plat sudah diserahkan (tidak masuk eligible).
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'TDM KETAPANG',
      engine_number: ELIGIBLE_ENGINE,
      chassis_number: CHASSIS,
      mobile: PHONE,
      stnk_name: 'PICKUP TEST CONSUMER',
      tgl_terima_stnk: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_stnk: new Date('2026-06-10T00:00:00Z'),
      tgl_terima_plat: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_plat: new Date('2026-06-10T00:00:00Z'),
      tgl_terima_bpkb: new Date('2026-06-15T00:00:00Z'),
      // Data asli selalu mengisi tgl_terima_bpkb & tgl_jadi_bpkb bersamaan
      // (19.078 baris, nol selisih). tgl_jadi_bpkb yang menandai BPKB siap
      // diserahkan -- dipakai eligiblePickupDocs & getAvailableDocuments.
      tgl_jadi_bpkb: new Date('2026-06-15T00:00:00Z'),
      no_bpkb: 'BPKB-PICKUP-001',
      bpkb_status: 'SELESAI',
    },
  })

  // Unit non-eligible: seluruh dokumen sudah diserahkan → tidak ada yang siap diambil.
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'TDM KETAPANG',
      engine_number: NONE_ENGINE,
      chassis_number: 'MHR99999999999999',
      mobile: PHONE,
      stnk_name: 'PICKUP TEST NONE',
      tgl_terima_stnk: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_stnk: new Date('2026-06-10T00:00:00Z'),
      tgl_terima_plat: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_plat: new Date('2026-06-10T00:00:00Z'),
      tgl_terima_bpkb: new Date('2026-06-15T00:00:00Z'),
      tgl_jadi_bpkb: new Date('2026-06-15T00:00:00Z'),
      tgl_penyerahan_bpkb: new Date('2026-06-16T00:00:00Z'),
      no_bpkb: 'BPKB-PICKUP-002',
      bpkb_status: 'SELESAI',
    },
  })
})

test.after(async () => {
  await prismaTest.showroom_pickup_requests.deleteMany({
    where: { engine_number: { in: [ELIGIBLE_ENGINE, NONE_ENGINE] } },
  })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({
    where: { engine_number: { in: [ELIGIBLE_ENGINE, NONE_ENGINE] } },
  })
  await prismaTest.$disconnect()
})

async function checkEligible() {
  return request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({ engine_number: ELIGIBLE_ENGINE, phone: PHONE })
}

test('Pickup: /check mengeluarkan pickup_token + pickup_docs bila ada dokumen eligible', async () => {
  const res = await checkEligible()
  assert.equal(res.status, 200)
  assert.equal(res.body.pickup_eligible, true)
  assert.ok(res.body.pickup_docs.includes('BPKB'))
  assert.ok(res.body.pickup_token, 'pickup_token should be present')
})

test('Pickup: /check pickup_eligible=false bila tak ada dokumen siap diambil', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({ engine_number: NONE_ENGINE, phone: PHONE })
  assert.equal(res.status, 200)
  assert.equal(res.body.pickup_eligible, false)
  assert.equal(res.body.pickup_docs.length, 0)
  assert.ok(!res.body.pickup_token, 'no token when not eligible')
})

test('Pickup: POST request-pickup dengan token valid + KTP → 201 + status PENDING', async () => {
  const check = await checkEligible()
  const token = check.body.pickup_token

  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', token)
    .field('consumer_phone', '081234567890')
    .field('preferred_time', 'Senin pagi')
    .field('notes', 'diwakilkan keluarga')

  assert.equal(res.status, 201)
  assert.equal(res.body.status, 'PENDING')
  assert.ok(res.body.requested_docs.includes('BPKB'))
  assert.ok(res.body.id > 0)
})

test('Pickup: token one-time-use — pemakaian kedua ditolak 409 (anti-replay)', async () => {
  const check = await checkEligible()
  const token = check.body.pickup_token

  const first = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', token)
    .field('consumer_phone', PHONE)
  assert.equal(first.status, 201)

  const replay = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', token)
    .field('consumer_phone', PHONE)
  assert.equal(replay.status, 409)
})

test('Pickup: POST request-pickup tanpa token → 400', async () => {
  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .send({ engine_number: ELIGIBLE_ENGINE, consumer_phone: PHONE })
  assert.equal(res.status, 400)
})

test('Pickup: POST request-pickup dengan token salah → 401', async () => {
  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .send({ engine_number: ELIGIBLE_ENGINE, pickup_token: 'bogus.token.value', consumer_phone: PHONE })
  assert.equal(res.status, 401)
})

test('Pickup: POST request-pickup dengan token untuk engine lain → 401', async () => {
  const check = await checkEligible()
  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .send({ engine_number: NONE_ENGINE, pickup_token: check.body.pickup_token, consumer_phone: PHONE })
  assert.equal(res.status, 401)
  assert.ok(res.body.error.includes('tidak sesuai'))
})

test('Pickup: POST request-pickup token valid TANPA foto KTP → 400', async () => {
  const check = await checkEligible()
  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', check.body.pickup_token)
    .field('consumer_phone', PHONE)
  assert.equal(res.status, 400)
  assert.ok(res.body.error.includes('KTP'), 'pesan error menyebut KTP')
})

test('Pickup: 409 bila dokumen sudah tak eligible lagi saat request (status berubah)', async () => {
  const check = await checkEligible()
  const token = check.body.pickup_token

  // Simulasikan BPKB sudah diserahkan setelah token dikeluarkan
  await prismaTest.showroom_stnk_bpkb_tracks.update({
    where: { engine_number: ELIGIBLE_ENGINE },
    data: { tgl_penyerahan_bpkb: new Date('2026-06-17T00:00:00Z') },
  })

  const res = await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', token)
    .field('consumer_phone', PHONE)
  assert.equal(res.status, 409)

  // Kembalikan ke kondisi eligible untuk tes berikutnya
  await prismaTest.showroom_stnk_bpkb_tracks.update({
    where: { engine_number: ELIGIBLE_ENGINE },
    data: { tgl_penyerahan_bpkb: null },
  })
})

test('Pickup: staff GET /showroom/pickup-requests (Admin) → 200 berisi request', async () => {
  // Buat satu request dahulu
  const check = await checkEligible()
  await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', check.body.pickup_token)
    .field('consumer_phone', PHONE)

  const agent = request.agent(app)
  await loginAs(agent, 'test_admin')
  const res = await agent.get('/api/showroom/pickup-requests').query({ status: 'PENDING' })
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body))
  assert.ok(res.body.some((r) => r.engine_number === ELIGIBLE_ENGINE && r.status === 'PENDING'))
})

test('Pickup: staff PATCH status → 200 + status berubah + handled_by terisi', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_admin')
  const list = await agent.get('/api/showroom/pickup-requests').query({ status: 'PENDING' })
  const target = list.body.find((r) => r.engine_number === ELIGIBLE_ENGINE)
  assert.ok(target, 'ada baris PENDING untuk di-update')

  const res = await agent
    .patch(`/api/showroom/pickup-requests/${target.id}`)
    .send({ status: 'DONE' })
  assert.equal(res.status, 200)
  assert.equal(res.body.status, 'DONE')
  assert.ok(res.body.handled_by, 'handled_by terisi')
  assert.ok(res.body.handled_at, 'handled_at terisi')
})

test('Pickup: RBAC — staff GET ditolak untuk role di luar Admin/CRM/Kepala Cabang', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_partman')
  const res = await agent.get('/api/showroom/pickup-requests')
  assert.equal(res.status, 403)
})

test('Pickup: PATCH status invalid → 400', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_admin')
  const list = await agent.get('/api/showroom/pickup-requests')
  const target = list.body[0]
  if (!target) return // skip bila tak ada baris
  const res = await agent
    .patch(`/api/showroom/pickup-requests/${target.id}`)
    .send({ status: 'BOGUS' })
  assert.equal(res.status, 400)
})

test('Pickup: staff GET /pickup-requests/:id/ktp → 200 (serve foto KTP)', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_admin')
  const list = await agent.get('/api/showroom/pickup-requests').query({ status: 'PENDING' })
  const target = list.body.find((r) => r.engine_number === ELIGIBLE_ENGINE)
  if (!target) return // skip bila tak ada baris
  const res = await agent.get(`/api/showroom/pickup-requests/${target.id}/ktp`)
  assert.equal(res.status, 200)
  assert.ok(res.headers['content-type'] && res.headers['content-type'].startsWith('image/'), 'content-type image/*')
})

test('Pickup: GET /pickup-requests/:id/ktp ditolak untuk role tanpa akses', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_partman')
  const res = await agent.get('/api/showroom/pickup-requests/1/ktp')
  assert.equal(res.status, 403)
})

test('Pickup: feed notifikasi memuat tugas pickup PENDING untuk Admin', async () => {
  // Pastikan ada setidaknya satu PENDING
  const check = await checkEligible()
  await request(app)
    .post('/api/public/stnk-bpkb/request-pickup')
    .attach('ktp_photo', KTP_PHOTO, 'ktp.jpg')
    .field('engine_number', ELIGIBLE_ENGINE)
    .field('pickup_token', check.body.pickup_token)
    .field('consumer_phone', PHONE)

  const agent = request.agent(app)
  await loginAs(agent, 'test_admin')
  const res = await agent.get('/api/notifications/approvals')
  assert.equal(res.status, 200)
  const tasks = res.body.data || []
  const pickupTasks = tasks.filter((t) => t.area === 'pickup' && t.path === '/showroom/pickup-requests')
  assert.ok(pickupTasks.length > 0, 'feed berisi tugas pickup untuk Admin')
})

test('Pickup: feed notifikasi juga tampil untuk IT Master (superadmin)', async () => {
  const agent = request.agent(app)
  await loginAs(agent, 'test_itmaster')
  const res = await agent.get('/api/notifications/approvals')
  assert.equal(res.status, 200)
  const tasks = res.body.data || []
  const pickupTasks = tasks.filter((t) => t.area === 'pickup' && t.path === '/showroom/pickup-requests')
  assert.ok(pickupTasks.length > 0, 'feed berisi tugas pickup untuk IT Master')
})