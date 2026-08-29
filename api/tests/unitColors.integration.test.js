import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers } from './helpers.js'
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
