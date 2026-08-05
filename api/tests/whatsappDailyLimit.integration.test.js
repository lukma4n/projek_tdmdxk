import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'
import { batasHariIni, getDailyLimit, DEFAULT_DAILY_LIMIT } from '../src/services/whatsappLimitService.js'

// Batas 30 konsumen/hari melindungi nomor WhatsApp dealer: nomor dealer
// dibatasi WhatsApp pada 2026-08-04 karena terdeteksi "pengiriman pesan otomatis
// atau massal". Batas berlaku GLOBAL lintas KPB/STNK/BPKB, bukan per modul, dan
// TETAP berlaku di mode manual — 60 draf yang dikirim beruntun tetap blast.
const PREFIX = 'WALIMIT-'
let kabengCookie
let userId
let customerId

async function cleanup() {
  await prismaTest.whatsapp_send_logs.deleteMany({ where: { target_key: { startsWith: PREFIX } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: PREFIX } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  kabengCookie = (await loginAs('test_kabeng', 'password123')).cookie
  const user = await prismaTest.users.findUnique({ where: { username: 'test_kabeng' } })
  userId = user.id

  const so = new Date()
  so.setMonth(so.getMonth() - 3)
  const c = await prismaTest.customers.create({
    data: {
      customer_name: 'Konsumen Batas Harian',
      so_number: `${PREFIX}SO-001`,
      so_date: so,
      no_engine: `${PREFIX}ENG-001`,
      customer_mobile: '081234567890',
      branch_code: 'DXK',
    },
  })
  customerId = c.id
})

beforeEach(async () => {
  await prismaTest.whatsapp_send_logs.deleteMany({ where: { target_key: { startsWith: PREFIX } } })
  delete process.env.WHATSAPP_DAILY_LIMIT
})

after(async () => {
  await cleanup()
  delete process.env.WHATSAPP_DAILY_LIMIT
  await prismaTest.$disconnect()
})

const isiLog = (jumlah, sentAt = new Date()) =>
  prismaTest.whatsapp_send_logs.createMany({
    data: Array.from({ length: jumlah }, (_, i) => ({
      module: 'KPB',
      target_key: `${PREFIX}${i}`,
      phone: '6281234567890',
      sent_by: userId,
      sent_at: sentAt,
    })),
  })

test('batas default 30 konsumen per hari', () => {
  assert.equal(getDailyLimit(), 30)
  assert.equal(DEFAULT_DAILY_LIMIT, 30)
})

test('batas bisa diatur lewat env, nilai ngawur diabaikan', () => {
  process.env.WHATSAPP_DAILY_LIMIT = '50'
  assert.equal(getDailyLimit(), 50)
  process.env.WHATSAPP_DAILY_LIMIT = '0'
  assert.equal(getDailyLimit(), 30)
  process.env.WHATSAPP_DAILY_LIMIT = 'banyak'
  assert.equal(getDailyLimit(), 30)
})

test('batas hari mengikuti tengah malam waktu setempat, bukan UTC', () => {
  // Kalau memakai toISOString, jatah harian ter-reset pukul 07:00 WIB.
  const siang = new Date(2026, 7, 4, 12, 30, 0)
  const { mulai, selesai } = batasHariIni(siang)
  assert.equal(mulai.getHours(), 0)
  assert.equal(mulai.getDate(), 4)
  assert.equal(selesai.getDate(), 5)
  assert.equal(selesai.getHours(), 0)

  // Pukul 00:30 masih hari yang sama, bukan hari sebelumnya.
  const dinihari = new Date(2026, 7, 4, 0, 30, 0)
  assert.equal(batasHariIni(dinihari).mulai.getDate(), 4)
})

test('menolak hubungi setelah 30 konsumen hari ini', async () => {
  await isiLog(30)
  const res = await callAuthenticated('post', `/api/followup/contact/KPB/${customerId}`, kabengCookie, { kpb_level: 'KPB1' })
  assert.equal(res.status, 429)
  assert.match(res.body.error, /Batas hubungi WhatsApp hari ini sudah tercapai \(30\/30/)
})

test('pengiriman kemarin tidak memakan jatah hari ini', async () => {
  const kemarin = new Date()
  kemarin.setDate(kemarin.getDate() - 1)
  await isiLog(30, kemarin)

  const res = await callAuthenticated('get', '/api/customers/alerts', kabengCookie)
  assert.equal(res.status, 200)
  assert.equal(res.body.daily.terpakai, 0)
  assert.equal(res.body.daily.sisa, 30)
})

test('jatah dihitung global lintas modul, bukan per modul', async () => {
  // 20 KPB + 10 STNK = 30, jatah harus habis walau tidak ada modul yang mencapai 30.
  await prismaTest.whatsapp_send_logs.createMany({
    data: [
      ...Array.from({ length: 20 }, (_, i) => ({ module: 'KPB', target_key: `${PREFIX}k${i}`, phone: '628', sent_by: userId })),
      ...Array.from({ length: 10 }, (_, i) => ({ module: 'STNK', target_key: `${PREFIX}s${i}`, phone: '628', sent_by: userId })),
    ],
  })

  const res = await callAuthenticated('get', '/api/customers/alerts', kabengCookie)
  assert.equal(res.body.daily.terpakai, 30)
  assert.equal(res.body.daily.sisa, 0)

  const kirim = await callAuthenticated('post', `/api/followup/contact/KPB/${customerId}`, kabengCookie, { kpb_level: 'KPB1' })
  assert.equal(kirim.status, 429)
})

test('sisa jatah ikut di respons daftar alert', async () => {
  await isiLog(7)
  const res = await callAuthenticated('get', '/api/customers/alerts', kabengCookie)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.daily, { limit: 30, terpakai: 7, sisa: 23 })
})

test('batas tercapai tidak meninggalkan catatan follow-up palsu', async () => {
  await isiLog(30)
  const sebelum = await prismaTest.kpb_followups.count({ where: { customer_id: customerId } })
  await callAuthenticated('post', `/api/followup/contact/KPB/${customerId}`, kabengCookie, { kpb_level: 'KPB1' })
  const sesudah = await prismaTest.kpb_followups.count({ where: { customer_id: customerId } })
  assert.equal(sebelum, sesudah)
})
