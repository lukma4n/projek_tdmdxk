import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'
import { addMonths } from '../src/controllers/customerController.js'

// Regresi temuan audit: /customers/alerts dulu memakai `take: 500` dengan
// orderBy so_date desc, sehingga hanya konsumen TERBARU yang dilihat — justru
// yang KPB-nya belum jatuh tempo. Di produksi endpoint ini selalu balas 0 alert
// padahal ada 2.179 yang jatuh tempo.
const PREFIX = 'KPBALERT-'
const SO_TARGET = `${PREFIX}TARGET-001`
const JML_PENGGANGGU = 600 // harus > 500 supaya cap lama pasti menutupi target

let crmCookie
let soDateTarget

function tengahHariLalu(hari) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - hari)
  return d
}

async function cleanup() {
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: PREFIX } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  crmCookie = (await loginAs('test_crm', 'password123')).cookie

  // Target: KPB1 jatuh tempo 85 hari lalu (masih dalam window overdue 90 hari),
  // dan sengaja dibuat paling tua supaya paling overdue.
  soDateTarget = addMonths(tengahHariLalu(85), -2)
  await prismaTest.customers.create({
    data: {
      customer_name: 'Konsumen Target KPB',
      so_number: SO_TARGET,
      so_date: soDateTarget,
      no_engine: `${PREFIX}ENG-001`,
      branch_code: 'DXK',
    },
  })

  // Pengganggu: SO 1-30 hari LEBIH BARU dari target, jadi sama-sama jatuh tempo
  // dan sama-sama masuk window. Jumlahnya melebihi cap lama, sehingga urutan
  // `so_date desc` + `take: 500` pasti menendang target keluar.
  await prismaTest.customers.createMany({
    data: Array.from({ length: JML_PENGGANGGU }, (_, i) => {
      const so = new Date(soDateTarget)
      so.setDate(so.getDate() + (i % 30) + 1)
      return {
        customer_name: `Konsumen Pengganggu ${i}`,
        so_number: `${PREFIX}NOISE-${String(i).padStart(4, '0')}`,
        so_date: so,
        no_engine: `${PREFIX}ENGNOISE-${String(i).padStart(4, '0')}`,
        branch_code: 'DXK',
      }
    }),
  })

  // Konsumen sangat baru: belum ada KPB yang jatuh tempo, tidak boleh jadi alert.
  await prismaTest.customers.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({
      customer_name: `Konsumen Baru ${i}`,
      so_number: `${PREFIX}NEW-${String(i).padStart(4, '0')}`,
      so_date: tengahHariLalu(10),
      no_engine: `${PREFIX}ENGNEW-${String(i).padStart(4, '0')}`,
      branch_code: 'DXK',
    })),
  })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('alert KPB tetap memunculkan konsumen lama walau ada >500 SO yang lebih baru', async () => {
  const res = await callAuthenticated('get', '/api/customers/alerts', crmCookie)
  assert.equal(res.status, 200)

  const target = res.body.data.find((a) => a.so_number === SO_TARGET && a.kpb_label === 'KPB1')
  assert.ok(target, 'alert KPB1 untuk konsumen target harus ada (dulu hilang karena take: 500)')
  assert.equal(target.alert_type, 'overdue')
  assert.ok(
    target.days_remaining <= -80 && target.days_remaining >= -90,
    `days_remaining harus sekitar -85, dapat ${target.days_remaining}`,
  )
  assert.ok(res.body.summary.overdue >= 1)
})

test('konsumen yang KPB-nya belum jatuh tempo tidak ikut jadi alert', async () => {
  const res = await callAuthenticated('get', '/api/customers/alerts', crmCookie)
  assert.equal(res.status, 200)

  const pengganggu = res.body.data.filter((a) => String(a.so_number || '').startsWith(`${PREFIX}NEW-`))
  assert.equal(pengganggu.length, 0)
})

test('addMonths tidak melompati bulan untuk SO tanggal 29-31', () => {
  const kasus = [
    // [so_date, tambah bulan, harapan] — sebelumnya setMonth() polos meleset
    ['2022-01-31', 8, '2022-09-30'],
    ['2022-03-31', 6, '2022-09-30'],
    ['2023-12-31', 2, '2024-02-29'], // tahun kabisat
    ['2022-12-31', 2, '2023-02-28'], // bukan kabisat
    ['2024-01-30', 2, '2024-03-30'],
  ]

  for (const [so, bulan, harapan] of kasus) {
    const hasil = addMonths(new Date(`${so}T00:00:00`), bulan)
    const ymd = [
      hasil.getFullYear(),
      String(hasil.getMonth() + 1).padStart(2, '0'),
      String(hasil.getDate()).padStart(2, '0'),
    ].join('-')
    assert.equal(ymd, harapan, `${so} + ${bulan} bulan`)
  }
})

test('addMonths tidak mengubah tanggal yang aman', () => {
  const hasil = addMonths(new Date('2022-06-15T00:00:00'), 4)
  assert.equal(hasil.getMonth(), 9) // Oktober
  assert.equal(hasil.getDate(), 15)
})
