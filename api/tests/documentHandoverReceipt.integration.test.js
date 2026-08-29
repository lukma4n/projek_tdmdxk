import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'
// Serah terima lewat controller ini benar-benar menyusun PDF ke disk. Nomor
// tanda terima di DB uji selalu mulai dari 00001 -- sama seperti tanda
// terima pertama bulan itu di produksi -- jadi tanpa ini tes akan menimpa
// arsip produksi (lihat receiptPdfService.js). Diarahkan ke subfolder
// sementara (bukan folder arsip produksi), dibersihkan di after().
//
// Sengaja BUKAN di bawah os.tmpdir(): GET .../receipt/:stepId menyajikan
// berkas lewat res.sendFile(receipt_pdf_url, {root: process.cwd()}), jadi
// lokasi tulis harus tetap berupa path relatif terhadap cwd supaya alur
// unduh lewat HTTP di tes ini benar-benar bisa dites end-to-end. Nama folder
// juga sengaja TANPA titik di depan -- modul `send` yang dipakai
// res.sendFile() meng-ignore (404) segmen path apa pun yang diawali titik.
const RECEIPT_TMP_DIR = `uploads/test-tanda-terima-tmp-${process.pid}-${Date.now()}`
process.env.RECEIPT_PDF_DIR = RECEIPT_TMP_DIR

import fs from 'fs/promises'
import bcrypt from 'bcryptjs'
import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  request,
  app,
} from './helpers.js'

const ENG_STNK = 'RCPT-FLOW-STNK1'
const ENG_BPKB = 'RCPT-FLOW-BPKB1'
const ENG_OWN = 'RCPT-FLOW-OWN01'
const ENGINES = [ENG_STNK, ENG_BPKB, ENG_OWN]
const SO_STNK = 'SO/DXK/26/08/RFS1'
const SO_BPKB = 'SO/DXK/26/08/RFB1'
const SO_OWN = 'SO/DXK/26/08/RFO1'

const PNG = Buffer.from('89504e470d0a1a0a-tanda-tangan-uji')
const FOTO = Buffer.from('isi-foto-uji')

let adminCookie
let adminId
let handoverStnkId
let handoverBpkbId
let salesmanOwnerCookie
let salesmanOtherCookie

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { in: [SO_STNK, SO_BPKB, SO_OWN] } } })
  await prismaTest.users.deleteMany({ where: { username: { in: ['test_salesman_rcpt_owner', 'test_salesman_rcpt_other'] } } })
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

  for (const [eng, so, nama] of [[ENG_STNK, SO_STNK, 'HEPRI FAHRIANSYAH'], [ENG_BPKB, SO_BPKB, 'DARWIN'], [ENG_OWN, SO_OWN, 'BUDI SANTOSO']]) {
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

  await createUser('test_salesman_rcpt_owner', 'Salesman')
  await createUser('test_salesman_rcpt_other', 'Salesman')
  salesmanOwnerCookie = (await loginAs('test_salesman_rcpt_owner', 'password123')).cookie
  salesmanOtherCookie = (await loginAs('test_salesman_rcpt_other', 'password123')).cookie
})

after(async () => {
  await cleanup()
  await fs.rm(RECEIPT_TMP_DIR, { recursive: true, force: true })
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

test('GET receipt: mengembalikan PDF asli untuk langkah yang punya tanda terima', async () => {
  const step = await prismaTest.document_handover_steps.findFirst({
    where: { receipt_number: { startsWith: 'TT-STNK/' } },
    orderBy: { id: 'asc' },
  })
  assert.ok(step, 'perlu langkah STNK dengan tanda terima dari test sebelumnya')

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${step.id}`)
    .set('Cookie', adminCookie)
    .buffer()
    .parse((response, callback) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    .expect(200)

  assert.ok(Buffer.isBuffer(res.body))
  assert.equal(res.body.subarray(0, 4).toString(), '%PDF')

  const isiAsli = await fs.readFile(`.${step.receipt_pdf_url}`)
  assert.ok(res.body.equals(isiAsli), 'isi PDF yang dikirim harus sama persis dengan file di disk')
})

test('GET receipt: 404 untuk langkah yang tidak menerbitkan tanda terima (PLAT)', async () => {
  const step = await prismaTest.document_handover_steps.findFirst({
    where: { receipt_number: null, step_type: 'serah_ke_konsumen' },
    orderBy: { id: 'desc' },
  })
  assert.ok(step, 'perlu langkah PLAT tanpa tanda terima dari test sebelumnya')
  assert.equal(step.receipt_pdf_url, null)

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${step.id}`)
    .set('Cookie', adminCookie)
    .expect(404)

  assert.match(res.body.error, /belum diterbitkan/i)
})

test('GET receipt: 404 untuk stepId yang tidak ada', async () => {
  const res = await request(app)
    .get('/api/showroom/document-handovers/receipt/999999999')
    .set('Cookie', adminCookie)
    .expect(404)

  assert.match(res.body.error, /tidak ditemukan/i)
})

test('GET receipt: tanpa cookie sesi ditolak (401)', async () => {
  const step = await prismaTest.document_handover_steps.findFirst({
    where: { receipt_number: { startsWith: 'TT-STNK/' } },
    orderBy: { id: 'asc' },
  })
  assert.ok(step)

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${step.id}`)
    .expect(401)

  assert.match(res.body.error, /token/i)
})

test('GET receipt: Salesman yang ditugaskan bisa mengunduh tanda terima miliknya sendiri', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_OWN,
      document_type: 'STNK',
      handover_mode: 'via_sales',
      status: 'diterima_sales',
      salesman_name: 'test_salesman_rcpt_owner',
      created_by: adminId,
    },
  })

  const stepRes = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', salesmanOwnerCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'BUDI SANTOSO')
    .field('receiver_is_customer', 'true')
    .field('receipt_items', JSON.stringify(['STNK', 'Plat']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'ttd-petugas.png')
    .attach('signature_receiver', PNG, 'ttd-penerima.png')
    .expect(201)

  assert.ok(stepRes.body.receipt_number, 'tanda terima harus terbit untuk tes ini')

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${stepRes.body.id}`)
    .set('Cookie', salesmanOwnerCookie)
    .buffer()
    .parse((response, callback) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    .expect(200)

  assert.equal(res.body.subarray(0, 4).toString(), '%PDF')
})

test('GET receipt: Salesman lain (bukan yang ditugaskan) ditolak (403)', async () => {
  const step = await prismaTest.document_handover_steps.findFirst({
    where: { receipt_number: { startsWith: 'TT-STNK/' }, handover: { engine_number: ENG_OWN } },
    orderBy: { id: 'desc' },
  })
  assert.ok(step, 'perlu tanda terima STNK milik salesman pemilik dari test sebelumnya')

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${step.id}`)
    .set('Cookie', salesmanOtherCookie)
    .expect(403)

  assert.match(res.body.error, /akses ditolak/i)
})

test('GET receipt: Admin tetap bisa mengunduh tanda terima milik salesman manapun', async () => {
  const step = await prismaTest.document_handover_steps.findFirst({
    where: { receipt_number: { startsWith: 'TT-STNK/' }, handover: { engine_number: ENG_OWN } },
    orderBy: { id: 'desc' },
  })
  assert.ok(step)

  const res = await request(app)
    .get(`/api/showroom/document-handovers/receipt/${step.id}`)
    .set('Cookie', adminCookie)
    .buffer()
    .parse((response, callback) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    .expect(200)

  assert.equal(res.body.subarray(0, 4).toString(), '%PDF')
})

test('nomor terbit tapi data pemilik tidak ada: tidak ada PDF, tapi kejadiannya dicatat log (bukan diam-diam)', async () => {
  const engineTanpaTrack = 'RCPT-NO-TRACK-1'
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: engineTanpaTrack } })
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: engineTanpaTrack,
      document_type: 'STNK',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: adminId,
    },
  })

  const originalWarn = console.warn
  const logged = []
  console.warn = (line) => logged.push(line)
  let res
  try {
    res = await request(app)
      .post(`/api/showroom/document-handovers/${handover.id}/steps`)
      .set('Cookie', adminCookie)
      .field('step_type', 'serah_ke_konsumen')
      .field('received_by_name', 'TANPA TRACK')
      .field('receiver_is_customer', 'true')
      .field('receipt_items', JSON.stringify(['STNK', 'Plat']))
      .attach('photo_handover', FOTO, 'serah.jpg')
      .attach('signature_giver', PNG, 'ttd-petugas.png')
      .attach('signature_receiver', PNG, 'ttd-penerima.png')
      .expect(201)
  } finally {
    console.warn = originalWarn
  }

  assert.ok(res.body.receipt_number, 'nomor tanda terima tetap terbit walau data pemilik tidak ada')
  assert.equal(res.body.receipt_pdf_url, null, 'PDF tidak boleh terbentuk tanpa data pemilik')

  const baris = logged.find((l) => l.includes('data pemilik dokumen tidak ditemukan'))
  assert.ok(baris, 'kejadian PDF tidak terbentuk harus tercatat di log, bukan lolos diam-diam')
  const entry = JSON.parse(baris)
  assert.equal(entry.level, 'warn')
  assert.equal(entry.step_id, res.body.id)
  assert.equal(entry.receipt_number, res.body.receipt_number)
  assert.equal(entry.engine_number, engineTanpaTrack)

  await prismaTest.document_handovers.deleteMany({ where: { engine_number: engineTanpaTrack } })
})
