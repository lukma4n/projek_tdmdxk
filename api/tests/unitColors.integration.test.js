import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, request, app } from './helpers.js'
import { harvestColorNames } from '../src/controllers/showroomImport.js'

const KODE_UJI = ['ZQ', 'ZR', 'ZS']

async function cleanup() {
  await prismaTest.unit_color_names.deleteMany({ where: { code: { in: KODE_UJI } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('memanen kode dan nama warna dari record import', async () => {
  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-1', color: 'ZQ-HITAM UJI' },
    { engine_number: 'UJI-2', color: 'ZR-PUTIH UJI' },
  ])

  const zq = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZQ' } })
  assert.equal(zq.name, 'ZQ-HITAM UJI')
  assert.equal(zq.source, 'import')
})

test('mengabaikan warna tanpa tanda hubung dan warna kosong', async () => {
  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-3', color: 'ZS' },
    { engine_number: 'UJI-4', color: '' },
    { engine_number: 'UJI-5', color: null },
    { engine_number: 'UJI-6' },
  ])

  const zs = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZS' } })
  assert.equal(zs, null, 'kode tanpa nama tidak boleh disimpan')
})

test('tidak menimpa nama yang sudah diisi manual', async () => {
  await prismaTest.unit_color_names.create({
    data: { code: 'ZQ', name: 'ZQ-DIISI MANUAL', source: 'manual' },
  }).catch(async () => {
    await prismaTest.unit_color_names.update({
      where: { code: 'ZQ' },
      data: { name: 'ZQ-DIISI MANUAL', source: 'manual' },
    })
  })

  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-7', color: 'ZQ-HITAM UJI' },
  ])

  const zq = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZQ' } })
  assert.equal(zq.name, 'ZQ-DIISI MANUAL', 'isian manual harus menang')
  assert.equal(zq.source, 'manual')
})

test('GET /unit-colors mengembalikan kode dan nama', async () => {
  await prismaTest.unit_color_names.upsert({
    where: { code: 'ZQ' },
    update: { name: 'ZQ-HITAM UJI', source: 'import' },
    create: { code: 'ZQ', name: 'ZQ-HITAM UJI', source: 'import' },
  })

  const { cookie } = await loginAs('test_admin', 'password123')
  const res = await request(app)
    .get('/api/showroom/unit-colors')
    .set('Cookie', cookie)
    .expect(200)

  const zq = res.body.find((c) => c.code === 'ZQ')
  assert.equal(zq.name, 'ZQ-HITAM UJI')
})

test('PATCH /unit-colors/:code mengisi nama manual', async () => {
  const { cookie } = await loginAs('test_admin', 'password123')
  const res = await request(app)
    .patch('/api/showroom/unit-colors/ZR')
    .set('Cookie', cookie)
    .send({ name: 'ZR-PUTIH MANUAL' })
    .expect(200)

  assert.equal(res.body.name, 'ZR-PUTIH MANUAL')
  assert.equal(res.body.source, 'manual')
})

test('PATCH /unit-colors menolak nama kosong', async () => {
  const { cookie } = await loginAs('test_admin', 'password123')
  await request(app)
    .patch('/api/showroom/unit-colors/ZS')
    .set('Cookie', cookie)
    .send({ name: '   ' })
    .expect(400)
})
