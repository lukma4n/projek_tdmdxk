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

const SO_IN_MASTER = 'LBL-TST-IN'
const SO_NO_MASTER = 'LBL-TST-NOMASTER'
const SO_OUT_RANGE = 'LBL-TST-OUTRANGE'
const SALESMAN_A = 'LBL TEST SALESMAN A'
const SALESMAN_B = 'LBL TEST SALESMAN B'
const SCO_A = 'LBL TEST SCO A'
const SCO_B = 'LBL TEST SCO B'

function atNoon(daysAgo) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const ALL_SO = [SO_IN_MASTER, SO_NO_MASTER, SO_OUT_RANGE]

let adminCookie
let partmanCookie

async function cleanup() {
  await prismaTest.customers.deleteMany({ where: { so_number: { in: ALL_SO } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  await prismaTest.customers.createMany({
    data: [
      {
        customer_name: 'KONSUMEN LABEL A',
        so_number: SO_IN_MASTER,
        so_date: atNoon(0),
        no_engine: 'LBLENG0001',
        no_frame: 'LBLFRAME0001',
        model: 'SCOOPY',
        salesman: SALESMAN_A,
        sales_coord_name: SCO_A,
        kecamatan: 'DELTA PAWAN',
        kabupaten: 'KAB. KETAPANG',
        branch_code: 'DXK',
      },
      {
        customer_name: 'KONSUMEN LABEL B',
        so_number: SO_NO_MASTER,
        so_date: atNoon(0),
        no_engine: 'LBLENG0002',
        no_frame: 'LBLFRAME0002',
        model: 'BEAT',
        salesman: SALESMAN_B,
        sales_coord_name: SCO_B,
        kecamatan: 'MUARA PAWAN',
        kabupaten: 'KAB. KETAPANG',
        branch_code: 'DXK',
      },
      {
        customer_name: 'KONSUMEN LABEL LUAR RENTANG',
        so_number: SO_OUT_RANGE,
        so_date: atNoon(30),
        no_engine: 'LBLENG0003',
        no_frame: 'LBLFRAME0003',
        model: 'VARIO',
        salesman: SALESMAN_A,
        branch_code: 'DXK',
      },
    ],
  })

  adminCookie = (await loginAs('test_admin', 'password123')).cookie
  partmanCookie = (await loginAs('test_partman', 'password123')).cookie
})

after(cleanup)

test('butuh autentikasi (401)', async () => {
  const res = await request(app).get('/api/showroom/label-buku-service')
  assert.equal(res.status, 401)
})

test('role tanpa akses showroom ditolak (403)', async () => {
  const res = await callAuthenticated('get', '/api/showroom/label-buku-service', partmanCookie)
  assert.equal(res.status, 403)
})

test('rentang tanggal memuat batas awal & akhir, menolak yang di luar', async () => {
  const from = toDateStr(atNoon(1))
  const to = toDateStr(atNoon(0))
  const res = await callAuthenticated('get', `/api/showroom/label-buku-service?date_from=${from}&date_to=${to}`, adminCookie)
  assert.equal(res.status, 200)

  const soNumbers = res.body.items.map((i) => i.so_number)
  assert.ok(soNumbers.includes(SO_IN_MASTER), 'transaksi hari ini harus ikut')
  assert.ok(soNumbers.includes(SO_NO_MASTER), 'transaksi hari ini harus ikut')
  assert.ok(!soNumbers.includes(SO_OUT_RANGE), 'transaksi 30 hari lalu tidak boleh ikut')
})

test('sales_coord_name & salesman ikut terbawa apa adanya dari report penjualan', async () => {
  const today = toDateStr(atNoon(0))
  const res = await callAuthenticated('get', `/api/showroom/label-buku-service?date_from=${today}&date_to=${today}`, adminCookie)
  assert.equal(res.status, 200)

  const rowA = res.body.items.find((i) => i.so_number === SO_IN_MASTER)
  const rowB = res.body.items.find((i) => i.so_number === SO_NO_MASTER)

  assert.equal(rowA.salesman, SALESMAN_A)
  assert.equal(rowA.sales_coord_name, SCO_A)
  assert.equal(rowB.salesman, SALESMAN_B)
  assert.equal(rowB.sales_coord_name, SCO_B)
  assert.equal(res.body.items.some((i) => 'team_leader' in i), false, 'field team_leader sudah dihapus dari response')
})

test('param date lama masih didukung', async () => {
  const today = toDateStr(atNoon(0))
  const res = await callAuthenticated('get', `/api/showroom/label-buku-service?date=${today}`, adminCookie)
  assert.equal(res.status, 200)
  assert.ok(res.body.items.some((i) => i.so_number === SO_IN_MASTER))
})

test('rentang terbalik ditolak (400)', async () => {
  const res = await callAuthenticated(
    'get',
    `/api/showroom/label-buku-service?date_from=${toDateStr(atNoon(0))}&date_to=${toDateStr(atNoon(5))}`,
    adminCookie,
  )
  assert.equal(res.status, 400)
})

test('menandai lalu membatalkan status cetak', async () => {
  const today = toDateStr(atNoon(0))

  const marked = await callAuthenticated('patch', '/api/showroom/label-buku-service/print-status', adminCookie, {
    so_numbers: [SO_IN_MASTER],
    printed: true,
  })
  assert.equal(marked.status, 200)
  assert.equal(marked.body.updated, 1)

  let res = await callAuthenticated('get', `/api/showroom/label-buku-service?date=${today}`, adminCookie)
  let row = res.body.items.find((i) => i.so_number === SO_IN_MASTER)
  assert.ok(row.printed_at, 'printed_at harus terisi')
  assert.equal(row.printed_by_name, 'Test Admin', 'harus mencatat user yang login')

  const unmarked = await callAuthenticated('patch', '/api/showroom/label-buku-service/print-status', adminCookie, {
    so_numbers: [SO_IN_MASTER],
    printed: false,
  })
  assert.equal(unmarked.status, 200)

  res = await callAuthenticated('get', `/api/showroom/label-buku-service?date=${today}`, adminCookie)
  row = res.body.items.find((i) => i.so_number === SO_IN_MASTER)
  assert.equal(row.printed_at, null)
  assert.equal(row.printed_by_name, null)
})

test('print-status menolak body tidak valid (400)', async () => {
  const kosong = await callAuthenticated('patch', '/api/showroom/label-buku-service/print-status', adminCookie, {
    so_numbers: [],
    printed: true,
  })
  assert.equal(kosong.status, 400)

  const tanpaPrinted = await callAuthenticated('patch', '/api/showroom/label-buku-service/print-status', adminCookie, {
    so_numbers: [SO_IN_MASTER],
  })
  assert.equal(tanpaPrinted.status, 400)
})
