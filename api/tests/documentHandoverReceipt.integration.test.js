import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import fs from 'fs/promises'
import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  request,
  app,
} from './helpers.js'

const ENG_STNK = 'RCPT-FLOW-STNK1'
const ENG_BPKB = 'RCPT-FLOW-BPKB1'
const ENGINES = [ENG_STNK, ENG_BPKB]
const SO_STNK = 'SO/DXK/26/08/RFS1'
const SO_BPKB = 'SO/DXK/26/08/RFB1'

const PNG = Buffer.from('89504e470d0a1a0a-tanda-tangan-uji')
const FOTO = Buffer.from('isi-foto-uji')

let adminCookie
let adminId
let handoverStnkId
let handoverBpkbId

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { in: [SO_STNK, SO_BPKB] } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  for (const [eng, so, nama] of [[ENG_STNK, SO_STNK, 'HEPRI FAHRIANSYAH'], [ENG_BPKB, SO_BPKB, 'DARWIN']]) {
    await prismaTest.showroom_stnk_bpkb_tracks.create({
      data: {
        branch_code: 'DXK',
        branch_name: 'Cabang Ketapang',
        engine_number: eng,
        chassis_number: 'JMH11XTK409060',
        stnk_name: nama,
        partner_address: 'Jl Uji Coba',
        no_polisi: 'KB1234XX',
        no_stnk: '22012900I',
        no_bpkb: 'W06560023',
      },
    })
    await prismaTest.customers.create({
      data: {
        customer_name: nama,
        so_number: so,
        so_date: new Date(2026, 0, 15),
        no_engine: eng,
        no_ktp: '6104160501060003',
        product_code: 'ML2A',
        type: 'AT',
        model: 'SCOOPY',
        color: 'BK',
      },
    })
  }

  const login = await loginAs('test_admin', 'password123')
  adminCookie = login.cookie
  adminId = login.body.user.id

  const buat = async (engine, documentType) => {
    const res = await request(app)
      .post('/api/showroom/document-handovers')
      .set('Cookie', adminCookie)
      .send({ engine_number: engine, document_type: documentType, handover_mode: 'langsung' })
      .expect(201)
    return res.body.id
  }

  handoverStnkId = await buat(ENG_STNK, 'STNK')
  handoverBpkbId = await buat(ENG_BPKB, 'BPKB')
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('serah terima STNK menerbitkan nomor, PDF, dan hash', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverStnkId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'HEPRI FAHRIANSYAH')
    .field('receiver_is_customer', 'true')
    .field('receipt_items', JSON.stringify(['STNK', 'Plat']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'ttd-petugas.png')
    .attach('signature_receiver', PNG, 'ttd-penerima.png')
    .expect(201)

  assert.match(res.body.receipt_number, /^TT-STNK\/DXK\/\d{2}\/\d{2}\/\d{5}$/)
  assert.ok(res.body.signature_giver_url, 'tanda tangan petugas harus tersimpan')
  assert.ok(res.body.signature_receiver_url, 'tanda tangan penerima harus tersimpan')

  const step = await prismaTest.document_handover_steps.findUnique({ where: { id: res.body.id } })
  assert.ok(step.receipt_pdf_url, 'PDF harus terbentuk')
  assert.equal(step.receipt_pdf_sha256.length, 64)

  const isi = await fs.readFile(`.${step.receipt_pdf_url}`)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF')
})

test('PLAT tidak menerbitkan tanda terima dan tidak minta tanda tangan', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_STNK,
      document_type: 'PLAT',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: adminId,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'SIAPA SAJA')
    .attach('photo_handover', FOTO, 'serah.jpg')
    .expect(201)

  // PLAT bukan jenis yang menerbitkan tanda terima, jadi tetap boleh lewat
  // tanpa tanda tangan.
  assert.equal(res.body.receipt_number, null)
})

test('BPKB dengan penerima berbeda WAJIB melampirkan surat kuasa', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverBpkbId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'ORANG LAIN')
    .field('receiver_is_customer', 'false')
    .field('receipt_items', JSON.stringify(['BPKB']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'a.png')
    .attach('signature_receiver', PNG, 'b.png')
    .expect(400)

  assert.match(res.body.error, /surat kuasa/i)
})

test('BPKB dengan penerima berbeda diterima bila surat kuasa dilampirkan', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverBpkbId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'ORANG LAIN')
    .field('receiver_is_customer', 'false')
    .field('receipt_items', JSON.stringify(['BPKB', 'Copy Faktur', 'NIK']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'a.png')
    .attach('signature_receiver', PNG, 'b.png')
    .attach('photo_power_of_attorney', FOTO, 'kuasa.jpg')
    .expect(201)

  assert.match(res.body.receipt_number, /^TT-BPKB\//)
  assert.ok(res.body.photo_power_of_attorney_url)
  assert.equal(res.body.receiver_is_customer, false)
})

test('STNK tanpa tanda tangan ditolak', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_STNK,
      document_type: 'BPKB',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: adminId,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'TANPA TTD')
    .attach('photo_handover', FOTO, 'serah.jpg')
    .expect(400)

  assert.match(res.body.error, /tanda tangan/i)
})

test('nomor urut naik untuk penyerahan berikutnya di bulan yang sama', async () => {
  // Dua tanda terima STNK sudah terbit di test-test di atas untuk cabang dan
  // bulan yang sama; nomornya harus berbeda dan berurutan.
  const steps = await prismaTest.document_handover_steps.findMany({
    where: { receipt_number: { startsWith: 'TT-' } },
    select: { receipt_number: true },
    orderBy: { id: 'asc' },
  })

  assert.ok(steps.length >= 2, 'perlu minimal dua tanda terima untuk diuji')

  const perAwalan = new Map()
  for (const { receipt_number } of steps) {
    const pisah = receipt_number.lastIndexOf('/')
    const awalan = receipt_number.slice(0, pisah + 1)
    const urut = parseInt(receipt_number.slice(pisah + 1), 10)
    if (!perAwalan.has(awalan)) perAwalan.set(awalan, [])
    perAwalan.get(awalan).push(urut)
  }

  for (const [awalan, urutan] of perAwalan) {
    const unik = new Set(urutan)
    assert.equal(unik.size, urutan.length, `nomor kembar pada ${awalan}`)
    assert.deepEqual([...urutan].sort((a, b) => a - b), urutan, `urutan tidak naik pada ${awalan}`)
  }
})
