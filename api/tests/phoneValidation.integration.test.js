import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'

const PREFIX = 'PHV-'
const SO_VALID = `${PREFIX}VALID`
const SO_KOSONG = `${PREFIX}KOSONG`
const SO_DOBEL = `${PREFIX}DOBEL`
const SO_BUKAN_SELULER = `${PREFIX}BUKANSEL`

let crmCookie
let partmanCookie

async function cleanup() {
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: PREFIX } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  crmCookie = (await loginAs('test_crm', 'password123')).cookie
  partmanCookie = (await loginAs('test_partman', 'password123')).cookie

  await prismaTest.customers.createMany({
    data: [
      { so_number: SO_VALID, so_date: new Date(), customer_name: 'PHV Nomor Bagus', customer_mobile: '081234567890', branch_code: 'DXK' },
      { so_number: SO_KOSONG, so_date: new Date(), customer_name: 'PHV Nomor Kosong', customer_mobile: '', branch_code: 'DXK' },
      { so_number: SO_DOBEL, so_date: new Date(), customer_name: 'PHV Nomor Dobel', customer_mobile: '0812345678900812345678', branch_code: 'DXK' },
      { so_number: SO_BUKAN_SELULER, so_date: new Date(), customer_name: 'PHV Telepon Rumah', customer_mobile: '0211234567', branch_code: 'DXK' },
    ],
  })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('nomor kosong, dobel, dan bukan seluler muncul sebagai tidak valid dengan alasan yang benar', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation?source=customers&limit=500', crmCookie)
  assert.equal(res.status, 200)

  const punyaKita = res.body.data.filter((r) => r.reference.startsWith(PREFIX))
  const byRef = Object.fromEntries(punyaKita.map((r) => [r.reference, r]))

  assert.equal(byRef[SO_KOSONG].alasan, 'kosong')
  assert.equal(byRef[SO_DOBEL].alasan, 'dobel')
  assert.equal(byRef[SO_BUKAN_SELULER].alasan, 'bukan_seluler')
  assert.equal(byRef[SO_VALID], undefined, 'nomor valid tidak boleh muncul di daftar tidak valid')
})

test('summary.by_reason menjumlah tepat ke total_invalid', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation?source=customers&limit=500', crmCookie)
  const jumlah = Object.values(res.body.summary.by_reason).reduce((a, b) => a + b, 0)
  assert.equal(jumlah, res.body.summary.total_invalid)
})

test('search menyaring berdasarkan nama', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation?source=customers&search=PHV Nomor Dobel&limit=500', crmCookie)
  const punyaKita = res.body.data.filter((r) => r.reference.startsWith(PREFIX))
  assert.deepEqual(punyaKita.map((r) => r.reference), [SO_DOBEL])
})

test('role tanpa akses VALIDASI_NOMOR_HP mendapat 403', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation?source=customers', partmanCookie)
  assert.equal(res.status, 403)
})

const ENG_PREFIX = 'PHVENG-'
const ENG_KOSONG = `${ENG_PREFIX}KOSONG`
const ENG_VALID = `${ENG_PREFIX}VALID`

async function cleanupHandovers() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { startsWith: ENG_PREFIX } } })
}

test('source=handovers menandai consumer_phone kosong sebagai tidak valid, tidak bocor ke source=customers', async () => {
  const user = await prismaTest.users.findUnique({ where: { username: 'test_crm' } })
  await cleanupHandovers()
  await prismaTest.document_handovers.createMany({
    data: [
      { engine_number: ENG_KOSONG, document_type: 'STNK', consumer_name: 'PHV Handover Kosong', consumer_phone: '', created_by: user.id },
      { engine_number: ENG_VALID, document_type: 'STNK', consumer_name: 'PHV Handover Bagus', consumer_phone: '081234567890', created_by: user.id },
    ],
  })

  const res = await callAuthenticated('get', '/api/phone-validation?source=handovers&limit=500', crmCookie)
  assert.equal(res.status, 200)
  const punyaKita = res.body.data.filter((r) => r.reference.startsWith(ENG_PREFIX))
  assert.deepEqual(punyaKita.map((r) => r.reference), [`${ENG_KOSONG} (STNK)`])
  assert.equal(punyaKita[0].alasan, 'kosong')

  const resCustomers = await callAuthenticated('get', '/api/phone-validation?source=customers&limit=500', crmCookie)
  assert.ok(
    !resCustomers.body.data.some((r) => r.reference.startsWith(ENG_PREFIX)),
    'baris handover tidak boleh muncul saat source=customers',
  )

  await cleanupHandovers()
})

test('export excel mengembalikan file xlsx dengan header yang benar', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation/export?source=customers', crmCookie)
  assert.equal(res.status, 200)
  assert.match(res.headers['content-type'], /spreadsheetml/)
  assert.match(res.headers['content-disposition'], /attachment/)
  assert.match(res.headers['content-disposition'], /Validasi_Nomor_HP_customers_/)
})

test('export tanpa akses VALIDASI_NOMOR_HP mendapat 403', async () => {
  const res = await callAuthenticated('get', '/api/phone-validation/export?source=customers', partmanCookie)
  assert.equal(res.status, 403)
})
