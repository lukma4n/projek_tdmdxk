import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  callAuthenticated,
  request,
  app,
} from './helpers.js'

// Engine number unik untuk test agar tidak bentrok dengan data lain
const ENG_TODAY = 'STCKTESTENG0001'
const ENG_YDAY = 'STCKTESTENG0002'
const SO_TODAY = 'STCK-TST-TODAY'
const SO_YDAY = 'STCK-TST-YDAY'

function atNoon(daysAgo) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

let adminCookie
let partmanCookie

before(async () => {
  await seedKnownUsers()

  // Bersihkan sisa data test sebelumnya
  await prismaTest.customers.deleteMany({ where: { so_number: { in: [SO_TODAY, SO_YDAY] } } })

  await prismaTest.customers.createMany({
    data: [
      {
        customer_name: 'KONSUMEN STCK HARI INI',
        alamat_konsumen: 'Jl. Test Hari Ini, KAB. KETAPANG',
        so_number: SO_TODAY,
        so_date: atNoon(0),
        no_engine: ENG_TODAY,
        no_frame: 'STCKFRAME0001',
        type: 'AT',
        model: 'SCOOPY',
        branch_code: 'DXK',
      },
      {
        customer_name: 'KONSUMEN STCK KEMARIN',
        alamat_konsumen: 'Jl. Test Kemarin, KAB. KETAPANG',
        so_number: SO_YDAY,
        so_date: atNoon(1),
        no_engine: ENG_YDAY,
        no_frame: 'STCKFRAME0002',
        type: 'AT',
        model: 'BEAT',
        branch_code: 'DXK',
      },
    ],
  })

  adminCookie = (await loginAs('test_admin', 'password123')).cookie
  partmanCookie = (await loginAs('test_partman', 'password123')).cookie
})

after(async () => {
  await prismaTest.customers.deleteMany({ where: { so_number: { in: [SO_TODAY, SO_YDAY] } } })
})

test('GET /showroom/stck/sales-lookup butuh autentikasi (401)', async () => {
  const res = await request(app).get('/api/showroom/stck/sales-lookup?period=all')
  assert.equal(res.status, 401)
})

test('role tidak berwenang ditolak (403)', async () => {
  const res = await callAuthenticated('get', '/api/showroom/stck/sales-lookup?period=all', partmanCookie)
  assert.equal(res.status, 403)
})

test('search no mesin mengembalikan baris yang tepat + alamat konsumen', async () => {
  const res = await callAuthenticated(
    'get',
    `/api/showroom/stck/sales-lookup?period=all&search=${ENG_TODAY}`,
    adminCookie,
  )
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.items))
  const found = res.body.items.find((r) => r.no_engine === ENG_TODAY)
  assert.ok(found, 'baris dengan no mesin test harus ada')
  assert.equal(found.customer_name, 'KONSUMEN STCK HARI INI')
  assert.equal(found.alamat_konsumen, 'Jl. Test Hari Ini, KAB. KETAPANG')
})

test('period=today hanya memuat penjualan hari ini', async () => {
  const res = await callAuthenticated('get', '/api/showroom/stck/sales-lookup?period=today', adminCookie)
  assert.equal(res.status, 200)
  const engines = res.body.items.map((r) => r.no_engine)
  assert.ok(engines.includes(ENG_TODAY), 'penjualan hari ini harus muncul')
  assert.ok(!engines.includes(ENG_YDAY), 'penjualan kemarin tidak boleh muncul di period=today')
})

test('period=yesterday hanya memuat penjualan kemarin', async () => {
  const res = await callAuthenticated('get', '/api/showroom/stck/sales-lookup?period=yesterday', adminCookie)
  assert.equal(res.status, 200)
  const engines = res.body.items.map((r) => r.no_engine)
  assert.ok(engines.includes(ENG_YDAY), 'penjualan kemarin harus muncul')
  assert.ok(!engines.includes(ENG_TODAY), 'penjualan hari ini tidak boleh muncul di period=yesterday')
})
