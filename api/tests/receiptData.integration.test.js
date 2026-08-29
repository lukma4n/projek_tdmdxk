import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers } from './helpers.js'
import { collectReceiptData } from '../src/services/receiptDataService.js'

const ENG = 'RCPT-DATA-0001'
const SO = 'SO/DXK/26/08/RCPT1'

async function cleanup() {
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: ENG } })
  await prismaTest.customers.deleteMany({ where: { so_number: SO } })
  await prismaTest.unit_color_names.deleteMany({ where: { code: 'BK' } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'Cabang Ketapang',
      engine_number: ENG,
      chassis_number: 'JMH11XTK409060',
      stnk_name: 'HEPRI FAHRIANSYAH',
      partner_address: 'Jl Pematang Teratai',
      no_polisi: 'KB6912GAR',
      no_stnk: '22012900I',
      no_bpkb: 'W06560023',
      no_plat: 'KB6912GAR',
    },
  })

  await prismaTest.customers.create({
    data: {
      customer_name: 'HEPRI FAHRIANSYAH',
      so_number: SO,
      so_date: new Date(2026, 0, 15),
      no_engine: ENG,
      no_ktp: '6104160501060003',
      product_code: 'ML2A',
      type: 'AT',
      model: 'SCOOPY',
      color: 'BK',
      alamat_konsumen: 'TUMBANG TITI, KAB. KETAPANG',
    },
  })

  await prismaTest.unit_color_names.create({
    data: { code: 'BK', name: 'BK-BLACK', source: 'import' },
  })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('mengumpulkan seluruh field tanda terima STNK', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: ENG, documentType: 'STNK' })

  assert.equal(data.owner_name, 'HEPRI FAHRIANSYAH')
  assert.equal(data.owner_address, 'Jl Pematang Teratai')
  assert.equal(data.owner_province, 'KALIMANTAN BARAT')
  assert.equal(data.owner_ktp, '6104160501060003')
  assert.equal(data.merk_type, 'ML2A / A/T')
  assert.equal(data.model_name, 'SCOOPY')
  assert.equal(data.production_year, 2026)
  assert.equal(data.color_name, 'BK-BLACK')
  assert.equal(data.chassis_number, 'JMH11XTK409060')
  assert.equal(data.engine_number, ENG)
  assert.equal(data.no_polisi, 'KB6912GAR')
  assert.equal(data.document_number, '22012900I', 'STNK memakai no_stnk')
})

test('tanda terima BPKB memakai nomor BPKB', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: ENG, documentType: 'BPKB' })
  assert.equal(data.document_number, 'W06560023')
})

test('null bila nomor mesin tidak ada di tabel track', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: 'TIDAK-ADA', documentType: 'STNK' })
  assert.equal(data, null)
})

test('tetap jalan meski data konsumen tidak ketemu', async () => {
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'Cabang Ketapang',
      engine_number: 'RCPT-DATA-YATIM',
      chassis_number: 'JMH11XTK409061',
      stnk_name: 'TANPA SO',
      no_stnk: '999',
    },
  })

  const data = await collectReceiptData(prismaTest, {
    engineNumber: 'RCPT-DATA-YATIM',
    documentType: 'STNK',
  })

  assert.equal(data.owner_name, 'TANPA SO')
  assert.equal(data.owner_ktp, null)
  assert.equal(data.merk_type, null)
  assert.equal(data.production_year, 2026, 'tahun tetap dari nomor rangka')

  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: 'RCPT-DATA-YATIM' } })
})
