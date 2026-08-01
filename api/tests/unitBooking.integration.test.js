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

const ENG_READY = 'BKGTEST-READY-0001'
const ENG_NOT_READY = 'BKGTEST-NOTREADY-0001'
const ALL_ENGINES = [ENG_READY, ENG_NOT_READY]

let adminCookie
let partmanCookie

async function cleanup() {
  await prismaTest.showroom_unit_bookings.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
  await prismaTest.showroom_stock_units.deleteMany({ where: { engine_number: { in: ALL_ENGINES } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  await prismaTest.showroom_stock_units.createMany({
    data: [
      {
        branch_code: 'DXK',
        branch_name: 'DXK',
        engine_number: ENG_READY,
        chassis_number: 'BKGFRAME0001',
        engine_state: 'Stock RFS',
        series: 'BEAT',
      },
      {
        branch_code: 'DXK',
        branch_name: 'DXK',
        engine_number: ENG_NOT_READY,
        chassis_number: 'BKGFRAME0002',
        engine_state: 'Stock NRFS',
        series: 'BEAT',
      },
    ],
  })

  adminCookie = (await loginAs('test_admin', 'password123')).cookie
  partmanCookie = (await loginAs('test_partman', 'password123')).cookie
})

after(cleanup)

test('POST booking berhasil untuk unit ready tanpa booking aktif', async () => {
  const res = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'SITI', salesman_phone: '081234567890', duration_days: 1 })

  assert.equal(res.status, 201)
  assert.equal(res.body.salesman_name, 'SITI')
  assert.ok(res.body.expires_at)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY },
    data: { cancelled_at: new Date() },
  })
})

test('POST booking ditolak (400) untuk unit selain ready', async () => {
  const res = await request(app)
    .post(`/api/public/stock-units/${ENG_NOT_READY}/booking`)
    .send({ salesman_name: 'BUDI', salesman_phone: '081234567891', duration_days: 1 })

  assert.equal(res.status, 400)
})

test('POST booking ditolak (409) kalau unit sudah dibooking sales lain', async () => {
  const first = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'ANI', salesman_phone: '081111111111', duration_days: 1 })
  assert.equal(first.status, 201)

  const second = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'CANDRA', salesman_phone: '082222222222', duration_days: 1 })
  assert.equal(second.status, 409)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('POST booking berhasil lagi setelah booking sebelumnya dibatalkan', async () => {
  const booked = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'DEWI', salesman_phone: '083333333333', duration_days: 1 })
  assert.equal(booked.status, 201)

  const cancelled = await request(app)
    .delete(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_phone: '083333333333' })
  assert.equal(cancelled.status, 200)
  assert.equal(cancelled.body.cancelled, true)

  const rebooked = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'EKO', salesman_phone: '084444444444', duration_days: 1 })
  assert.equal(rebooked.status, 201)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('POST booking berhasil lagi setelah booking sebelumnya kedaluwarsa', async () => {
  await prismaTest.showroom_unit_bookings.create({
    data: {
      engine_number: ENG_READY,
      salesman_name: 'KEDALUWARSA',
      salesman_phone: '085555555555',
      expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 jam lalu
    },
  })

  const res = await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'FIRDA', salesman_phone: '086666666666', duration_days: 1 })
  assert.equal(res.status, 201, 'booking kedaluwarsa tidak boleh menghalangi booking baru')

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('DELETE booking ditolak (403) kalau nomor HP tidak cocok', async () => {
  await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'GITA', salesman_phone: '087777777777', duration_days: 1 })

  const res = await request(app)
    .delete(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_phone: '080000000000' })
  assert.equal(res.status, 403)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('PATCH .../booking/cancel (internal) butuh autentikasi (401) dan ditolak role lain (403)', async () => {
  await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'HENDRA', salesman_phone: '088888888888', duration_days: 1 })

  const noAuth = await request(app).patch(`/api/showroom/stock-units/${ENG_READY}/booking/cancel`)
  assert.equal(noAuth.status, 401)

  const wrongRole = await callAuthenticated('patch', `/api/showroom/stock-units/${ENG_READY}/booking/cancel`, partmanCookie)
  assert.equal(wrongRole.status, 403)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('PATCH .../booking/cancel (internal) berhasil dengan role Admin', async () => {
  await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'INDRA', salesman_phone: '089999999999', duration_days: 1 })

  const res = await callAuthenticated('patch', `/api/showroom/stock-units/${ENG_READY}/booking/cancel`, adminCookie)
  assert.equal(res.status, 200)
  assert.equal(res.body.cancelled, true)

  const active = await prismaTest.showroom_unit_bookings.findFirst({
    where: { engine_number: ENG_READY, cancelled_at: null, expires_at: { gt: new Date() } },
  })
  assert.equal(active, null)
})

test('GET /public/stock-units menampilkan booking aktif (nama+expires_at, tanpa nomor HP) dan null saat tidak ada', async () => {
  await request(app)
    .post(`/api/public/stock-units/${ENG_READY}/booking`)
    .send({ salesman_name: 'JOKO', salesman_phone: '081010101010', duration_days: 1 })

  const res = await request(app).get('/api/public/stock-units')
  assert.equal(res.status, 200)

  let readyUnit = null
  let notReadyUnit = null
  for (const model of res.body.models) {
    for (const unit of model.units) {
      if (unit.engine_number === ENG_READY) readyUnit = unit
      if (unit.engine_number === ENG_NOT_READY) notReadyUnit = unit
    }
  }

  assert.ok(readyUnit, 'unit ready harus muncul di hasil publik')
  assert.deepEqual(Object.keys(readyUnit.booking).sort(), ['expires_at', 'salesman_name'].sort())
  assert.equal(readyUnit.booking.salesman_name, 'JOKO')
  assert.equal(JSON.stringify(readyUnit).includes('081010101010'), false, 'nomor HP tidak boleh bocor ke response publik')

  assert.ok(notReadyUnit, 'unit not_ready harus tetap muncul (tanpa booking)')
  assert.equal(notReadyUnit.booking, null)

  await prismaTest.showroom_unit_bookings.updateMany({
    where: { engine_number: ENG_READY, cancelled_at: null },
    data: { cancelled_at: new Date() },
  })
})

test('GET /public/stock-units mengembalikan booking null untuk booking yang sudah kedaluwarsa', async () => {
  await prismaTest.showroom_unit_bookings.create({
    data: {
      engine_number: ENG_READY,
      salesman_name: 'KEDALUWARSA LAGI',
      salesman_phone: '081212121212',
      expires_at: new Date(Date.now() - 60 * 60 * 1000),
    },
  })

  const res = await request(app).get('/api/public/stock-units')
  const readyUnit = res.body.models.flatMap((m) => m.units).find((u) => u.engine_number === ENG_READY)
  assert.equal(readyUnit.booking, null)
})
