import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./prisma/test.db'

import { request, app, prismaTest, seedKnownUsers } from './helpers.js'
import { enrichTracksWithMobile } from '../src/controllers/showroomStnkBpkbTrackController.js'


test.before(async () => {
  await seedKnownUsers()
  
  // Clear any existing test records if they conflict
  try {
    await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({
      where: {
        engine_number: {
          in: ['MH1JM1111TEST1234', 'MH1JM2222TEST5678']
        }
      }
    })
    await prismaTest.customers.deleteMany({
      where: {
        no_engine: { in: ['ENRICH1111', 'ENRICH2222'] }
      }
    })
    await prismaTest.showroom_sales_order_margins.deleteMany({
      where: {
        engine_number: { in: ['ENRICH1111', 'ENRICH2222'] }
      }
    })
  } catch (err) {
    // Ignore
  }

  // Find a valid user to associate with created_by in margins table
  const testUser = await prismaTest.users.findFirst()
  const userId = testUser ? testUser.id : 1

  // Seed customer record
  await prismaTest.customers.create({
    data: {
      customer_name: 'Test Cust Enrich',
      so_number: 'SO-ENRICH-1111',
      so_date: new Date(),
      no_engine: 'ENRICH1111',
      customer_mobile: '089999999999'
    }
  })

  // Seed sales order margin record
  await prismaTest.showroom_sales_order_margins.create({
    data: {
      so_number: 'SO-ENRICH-2222',
      so_date: new Date(),
      customer_name: 'Test Margin Enrich',
      engine_number: 'ENRICH2222',
      customer_phone: '088888888888',
      created_by: userId
    }
  })


  // Create mock track records
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'TDM KETAPANG',
      engine_number: 'MH1JM1111TEST1234',
      chassis_number: 'MHR12345678901234',
      mobile: '081234567890',
      stnk_name: 'BUDI SANTOSO',
      no_polisi: 'KB 1234 XX',
      series: 'Vario 160',
      tgl_mohon_faktur: new Date('2026-06-01T00:00:00Z'),
      tgl_terima_faktur: new Date('2026-06-03T00:00:00Z'),
      no_faktur: 'FAK-1234567',
      tgl_proses_stnk: new Date('2026-06-04T00:00:00Z'),
      tgl_terima_stnk: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_stnk: new Date('2026-06-10T00:00:00Z'),
      no_stnk: 'STNK-7654321',
      lokasi_stnk: 'RACK-STNK-A',
      stnk_status: 'SELESAI',
      tgl_terima_plat: new Date('2026-06-08T00:00:00Z'),
      tgl_penyerahan_plat: new Date('2026-06-10T00:00:00Z'),
      no_plat: 'KB 1234 XX',
      tgl_terima_bpkb: new Date('2026-06-15T00:00:00Z'),
      no_bpkb: 'BPKB-888888',
      bpkb_status: 'SELESAI',
      nama_penerima_bpkb: 'BUDI SANTOSO',
      lokasi_bpkb: 'RACK-BPKB-B'
    }
  })
})

test.after(async () => {
  try {
    await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({
      where: {
        engine_number: {
          in: ['MH1JM1111TEST1234', 'MH1JM2222TEST5678']
        }
      }
    })
    await prismaTest.customers.deleteMany({
      where: {
        no_engine: { in: ['ENRICH1111', 'ENRICH2222'] }
      }
    })
    await prismaTest.showroom_sales_order_margins.deleteMany({
      where: {
        engine_number: { in: ['ENRICH1111', 'ENRICH2222'] }
      }
    })
  } catch (err) {
    // Ignore
  }
  await prismaTest.$disconnect()
})

test('Public Check: Success check with correct engine_number and phone', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234',
      phone: '081234567890'
    })

  assert.equal(res.status, 200)
  assert.equal(res.body.engine_number, 'MH1JM1111TEST1234')
  assert.equal(res.body.stnk_name, 'BUDI SANTOSO') // full (tanpa masking)
  assert.equal(res.body.chassis_number, 'MHR12345678901234') // full
  assert.equal(res.body.faktur.no_faktur, 'FAK-1234567') // full
  assert.equal(res.body.faktur.is_done, true)
  assert.equal(res.body.stnk.no_stnk, 'STNK-7654321') // full
  assert.equal(res.body.stnk.is_done, true)
  assert.equal(res.body.stnk.is_delivered, true)
  assert.equal(res.body.bpkb.is_done, true)
  assert.equal(res.body.bpkb.is_delivered, false)
  assert.equal(res.body.bpkb.penerima, 'BUDI SANTOSO') // full
})

test('Public Check: Success via 4 digit terakhir Nomor Rangka (fallback HP)', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234',
      chassis: '1234' // 4 digit terakhir dari MHR12345678901234, tanpa phone
    })

  assert.equal(res.status, 200)
  assert.equal(res.body.engine_number, 'MH1JM1111TEST1234')
  assert.equal(res.body.stnk_name, 'BUDI SANTOSO')
})

test('Public Check: 404 untuk 4 digit Nomor Rangka salah', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({ engine_number: 'MH1JM1111TEST1234', chassis: '9999' })
  assert.equal(res.status, 404)
})

test('Public Check: Success check with matching suffix only (flexible formatting)', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234',
      phone: '+62 812-3456-7890' // different format but same last 6 digits: 567890
    })

  assert.equal(res.status, 200)
  assert.equal(res.body.engine_number, 'MH1JM1111TEST1234')
})

test('Public Check: Return 404 for incorrect phone number suffix', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234',
      phone: '081234567999' // Suffix mismatch
    })

  assert.equal(res.status, 404)
  assert.ok(res.body.error.includes('Data tidak ditemukan'))
})

test('Public Check: Return 404 for non-existent engine number', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'NONEXISTENT123456',
      phone: '081234567890'
    })

  assert.equal(res.status, 404)
  assert.ok(res.body.error.includes('Data tidak ditemukan'))
})

test('Public Check: Return 400 for missing query parameters', async () => {
  const res1 = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234'
    })
  assert.equal(res1.status, 400)
  assert.ok(res1.body.error.includes('wajib diisi'))

  const res2 = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      phone: '081234567890'
    })
  assert.equal(res2.status, 400)
  assert.ok(res2.body.error.includes('wajib diisi'))
})

test('Public Check: 404 untuk HP terlalu pendek tanpa rangka (tidak terverifikasi)', async () => {
  const res = await request(app)
    .get('/api/public/stnk-bpkb/check')
    .query({
      engine_number: 'MH1JM1111TEST1234',
      phone: '123'
    })
  assert.equal(res.status, 404)
  assert.ok(res.body.error.includes('Data tidak ditemukan'))
})

test('Auto-Enrichment: enrichTracksWithMobile correctly populates mobile numbers from database', async () => {
  const records = [
    { engine_number: 'ENRICH1111', mobile: null, branch_code: 'DXK', branch_name: 'Cabang Ketapang' },
    { engine_number: 'ENRICH2222', mobile: null, branch_code: 'DXK', branch_name: 'Cabang Ketapang' },
    { engine_number: 'ENRICH_UNKNOWN', mobile: null, branch_code: 'DXK', branch_name: 'Cabang Ketapang' }
  ]

  await enrichTracksWithMobile(records)

  assert.equal(records[0].mobile, '089999999999') // From customers table
  assert.equal(records[1].mobile, '088888888888') // From margins table
  assert.equal(records[2].mobile, null) // Not found
})

