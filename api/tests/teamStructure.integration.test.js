import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, request, app } from './helpers.js'
import {
  computeTargetSummary,
  computeTeamPerformance,
  ensureMonthStructure,
  getEffectiveStructure,
  addSalesToCurrentMonth,
  UNMAPPED_GROUP,
  INDEPENDENT_GROUP,
} from '../src/services/teamStructureService.js'
import { seedHistoricalStructure, seedStructureFromMaster } from '../src/services/teamStructureSeed.js'

// Tahun uji jauh di depan agar tidak bertabrakan dengan data lain di test.db.
const Y = 2031
const SO_PREFIX = 'UJI-TIM-'
const SALES_NAMES = ['UJI SALES A', 'UJI SALES B', 'UJI SALES C', 'UJI TL SATU', 'UJI TL DUA', 'UJI KAPOS', 'UJI INDIE']

async function cleanup() {
  await prismaTest.showroom_team_assignments.deleteMany({ where: { period_year: { gte: Y - 1, lte: Y + 1 } } })
  await prismaTest.showroom_marketing_targets.deleteMany({ where: { period_year: { gte: Y - 1, lte: Y + 1 } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { startsWith: SO_PREFIX } } })
  await prismaTest.showroom_salespeople.deleteMany({ where: { name: { in: SALES_NAMES } } })
}

let soSeq = 0
async function sale(salesman, date, coord = null) {
  soSeq += 1
  await prismaTest.customers.create({
    data: {
      so_number: `${SO_PREFIX}${soSeq}`,
      so_date: date,
      customer_name: 'KONSUMEN UJI',
      salesman,
      sales_coord_name: coord,
      branch_code: 'DXK',
    },
  })
}

async function assign(month, person_name, role, parent_name = null, title = null) {
  await prismaTest.showroom_team_assignments.create({
    data: { period_year: Y, period_month: month, person_name, role, parent_name, title },
  })
}

// Bulan 3: Kapos -> TL SATU (A, B); TL DUA tanpa Kapos (C); INDIE independen.
async function seedMarch() {
  await assign(3, 'UJI KAPOS', 'KAPOS')
  await assign(3, 'UJI TL SATU', 'TL', 'UJI KAPOS')
  await assign(3, 'UJI TL DUA', 'TL')
  await assign(3, 'UJI SALES A', 'SALES', 'UJI TL SATU')
  await assign(3, 'UJI SALES B', 'SALES', 'UJI TL SATU')
  await assign(3, 'UJI SALES C', 'SALES', 'UJI TL DUA')
  await assign(3, 'UJI INDIE', 'INDEPENDEN', null, 'Sales Counter')
}

const d = (month, day) => new Date(Y, month - 1, day, 10, 0, 0)
const range = (month) => ({ from: new Date(Y, month - 1, 1), to: new Date(Y, month, 0, 23, 59, 59, 999) })

before(async () => {
  await seedKnownUsers()
})

beforeEach(cleanup)

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('susunan efektif memakai bulan terakhir sebelumnya bila bulan itu kosong', async () => {
  await seedMarch()
  const exact = await getEffectiveStructure(prismaTest, Y, 3)
  assert.equal(exact.exact, true)

  const inherited = await getEffectiveStructure(prismaTest, Y, 5)
  assert.equal(inherited.exact, false)
  assert.deepEqual(inherited.source, { year: Y, month: 3 })
  assert.equal(inherited.rows.length, 7)

  const none = await getEffectiveStructure(prismaTest, Y - 1, 12)
  assert.equal(none.rows.length, 0)
})

test('ensureMonthStructure menyalin susunan efektif sekali saja', async () => {
  await seedMarch()
  const first = await ensureMonthStructure(prismaTest, Y, 4)
  assert.deepEqual(first.copiedFrom, { year: Y, month: 3 })
  const second = await ensureMonthStructure(prismaTest, Y, 4)
  assert.equal(second.copiedFrom, null)
  assert.equal(await prismaTest.showroom_team_assignments.count({ where: { period_year: Y, period_month: 4 } }), 7)
})

test('performa dikelompokkan Pos -> TL, Kapos, Independen, dan Belum terpetakan', async () => {
  await seedMarch()
  await sale('UJI SALES A', d(3, 2))
  await sale('uji sales a ', d(3, 3)) // beda huruf/spasi tetap cocok
  await sale('UJI TL SATU', d(3, 4)) // TL berjualan -> timnya sendiri
  await sale('UJI SALES C', d(3, 5))
  await sale('UJI KAPOS', d(3, 6))
  await sale('UJI INDIE', d(3, 7))
  await sale('ORANG ASING', d(3, 8))

  const perf = await computeTeamPerformance(prismaTest, range(3))
  const byKey = new Map(perf.byTeam.map((t) => [`${t.kind}:${t.team}`, t]))

  const satu = byKey.get('team:UJI TL SATU')
  assert.equal(satu.total, 3)
  assert.equal(satu.pos, 'UJI KAPOS')
  assert.equal(satu.salesmen.find((s) => s.name === 'UJI SALES B').count, 0, 'anggota tanpa penjualan tetap tampil')

  assert.equal(byKey.get('team:UJI TL DUA').pos, null)
  assert.equal(byKey.get('kapos:UJI KAPOS').total, 1)
  assert.equal(byKey.get(`independent:${INDEPENDENT_GROUP}`).total, 1)
  assert.equal(byKey.get(`unmapped:${UNMAPPED_GROUP}`).total, 1)
  assert.equal(perf.unmappedTotal, 1)

  assert.deepEqual(perf.byPos, [{ pos: 'UJI KAPOS', total: 4, direct: 1, teams: ['UJI TL SATU'] }])
  assert.equal(perf.salesWithClosing, 5)
  assert.equal(perf.totalMembers, 7)
})

test('rentang lintas bulan memetakan tiap transaksi dengan susunan bulannya', async () => {
  await seedMarch()
  // April: SALES A pindah ke TL DUA.
  await ensureMonthStructure(prismaTest, Y, 4)
  await prismaTest.showroom_team_assignments.update({
    where: { period_year_period_month_person_name: { period_year: Y, period_month: 4, person_name: 'UJI SALES A' } },
    data: { parent_name: 'UJI TL DUA' },
  })
  await sale('UJI SALES A', d(3, 10))
  await sale('UJI SALES A', d(4, 10))

  const march = await computeTeamPerformance(prismaTest, range(3))
  assert.equal(march.byTeam.find((t) => t.team === 'UJI TL SATU').total, 1, 'Maret tidak ikut berubah')

  const both = await computeTeamPerformance(prismaTest, { from: range(3).from, to: range(4).to })
  assert.equal(both.byTeam.find((t) => t.team === 'UJI TL SATU').total, 1)
  assert.equal(both.byTeam.find((t) => t.team === 'UJI TL DUA').total, 1)
})

test('ringkasan target: per TL dan independen, target Pos = jumlah target TL', async () => {
  await seedMarch()
  await assign(3, 'UJI TL TIGA', 'TL', 'UJI KAPOS')
  for (const [name, unit] of [['UJI TL SATU', 10], ['UJI TL TIGA', 5], ['UJI TL DUA', 8], ['UJI INDIE', 4]]) {
    await prismaTest.showroom_marketing_targets.create({
      data: { period_year: Y, period_month: 3, team_leader: name, target_unit: unit },
    })
  }
  await sale('UJI SALES A', d(3, 2))
  await sale('UJI KAPOS', d(3, 3))
  await sale('UJI INDIE', d(3, 4))
  await sale('UJI INDIE', d(3, 5))

  const summary = await computeTargetSummary(prismaTest, { year: Y, month: 3 })
  const row = (name) => summary.data.find((r) => r.team_leader === name)
  assert.equal(row('UJI TL SATU').target_unit, 10)
  assert.equal(row('UJI TL SATU').actual_unit, 1)
  assert.equal(row('UJI TL SATU').pos, 'UJI KAPOS')
  assert.equal(row('UJI INDIE').role, 'INDEPENDEN')
  assert.equal(row('UJI INDIE').actual_unit, 2)

  assert.equal(summary.pos.length, 1)
  assert.equal(summary.pos[0].target_unit, 15)
  assert.equal(summary.pos[0].actual_unit, 2, 'aktual Pos = tim + penjualan pribadi Kapos')
  assert.equal(summary.pos[0].direct_unit, 1)

  assert.equal(summary.summary.total_target, 27)
  assert.equal(summary.summary.total_actual, 4)
})

test('seed historis menempatkan sales di bawah koordinator DMS terbanyak', async () => {
  await sale('UJI SALES A', d(1, 2), 'UJI TL SATU')
  await sale('UJI SALES A', d(1, 3), 'UJI TL SATU')
  await sale('UJI SALES A', d(1, 4), 'UJI TL DUA')
  await sale('UJI TL DUA', d(1, 5), 'UJI TL DUA')
  await sale('UJI SALES B', d(2, 5), 'UJI TL DUA')

  const seeded = await seedHistoricalStructure(prismaTest, { before: { year: Y, month: 3 } })
  const ours = seeded.filter((s) => s.year === Y)
  assert.deepEqual(ours.map((s) => s.month), [1, 2])

  const jan = await prismaTest.showroom_team_assignments.findMany({ where: { period_year: Y, period_month: 1 } })
  const get = (name) => jan.find((r) => r.person_name === name)
  assert.equal(get('UJI SALES A').parent_name, 'UJI TL SATU')
  assert.equal(get('UJI TL DUA').role, 'TL', 'koordinator yang berjualan tetap TL, bukan SALES')
  assert.equal(jan.length, 3)

  const again = await seedHistoricalStructure(prismaTest, { before: { year: Y, month: 3 } })
  assert.equal(again.filter((s) => s.year === Y).length, 0, 'idempoten')
})

test('seed dari master: Kapos, TL, dan grup independen', async () => {
  await prismaTest.showroom_salespeople.createMany({
    data: [
      { name: 'UJI SALES A', team_leader: 'UJI TL SATU' },
      { name: 'UJI SALES B', team_leader: 'UJI TL DUA' },
      { name: 'UJI INDIE', team_leader: 'UJI COUNTER' },
    ],
  })
  const created = await seedStructureFromMaster(prismaTest, {
    year: Y, month: 6,
    kapos: { 'UJI KAPOS': ['UJI TL SATU'] },
    independentGroup: 'UJI COUNTER',
    titles: { 'UJI INDIE': 'Sales Counter' },
  })
  const rows = await prismaTest.showroom_team_assignments.findMany({ where: { period_year: Y, period_month: 6 } })
  // Master test.db bisa berisi sales lain; cukup periksa orang uji.
  const get = (name) => rows.find((r) => r.person_name === name)
  assert.ok(created >= 6)
  assert.equal(get('UJI KAPOS').role, 'KAPOS')
  assert.equal(get('UJI TL SATU').parent_name, 'UJI KAPOS')
  assert.equal(get('UJI TL DUA').parent_name, null)
  assert.equal(get('UJI SALES A').parent_name, 'UJI TL SATU')
  assert.equal(get('UJI INDIE').role, 'INDEPENDEN')
  assert.equal(get('UJI INDIE').title, 'Sales Counter')
  assert.equal(get('UJI COUNTER'), undefined, 'grup independen bukan TL')
})

test('sales baru di master masuk susunan bulan berjalan di bawah TL-nya', async () => {
  await seedMarch()
  const now = d(3, 15)
  assert.equal(await addSalesToCurrentMonth(prismaTest, 'uji sales baru', 'UJI TL DUA', now), true)
  assert.equal(await addSalesToCurrentMonth(prismaTest, 'UJI SALES BARU', 'UJI TL DUA', now), false, 'tidak dobel')
  assert.equal(await addSalesToCurrentMonth(prismaTest, 'UJI LAIN', 'BUKAN TL', now), false)
  assert.equal(await addSalesToCurrentMonth(prismaTest, 'UJI LAIN', 'UJI TL DUA', d(7, 1)), false, 'bulan tanpa susunan')
})

test('API susunan tim: salin otomatis, validasi atasan, tolak hapus TL yang punya anggota', async () => {
  await seedMarch()
  const { cookie } = await loginAs('test_kacab', 'password123')

  const inherited = await request(app).get(`/api/showroom/team-structure?year=${Y}&month=4`).set('Cookie', cookie)
  assert.equal(inherited.status, 200)
  assert.equal(inherited.body.exact, false)
  assert.equal(inherited.body.data[0].id, null)

  const bad = await request(app).post('/api/showroom/team-structure').set('Cookie', cookie)
    .send({ year: Y, month: 4, person_name: 'UJI SALES B', role: 'SALES', parent_name: 'UJI KAPOS' })
  assert.equal(bad.status, 400)
  assert.match(bad.body.error, /bukan Team Leader/)

  const moved = await request(app).post('/api/showroom/team-structure').set('Cookie', cookie)
    .send({ year: Y, month: 4, person_name: 'uji sales b', role: 'SALES', parent_name: 'uji tl dua' })
  assert.equal(moved.status, 200)
  assert.equal(await prismaTest.showroom_team_assignments.count({ where: { period_year: Y, period_month: 4 } }), 7)

  const demote = await request(app).post('/api/showroom/team-structure').set('Cookie', cookie)
    .send({ year: Y, month: 4, person_name: 'UJI TL DUA', role: 'SALES', parent_name: 'UJI TL SATU' })
  assert.equal(demote.status, 400)
  assert.match(demote.body.error, /masih membawahi/)

  const tl = await prismaTest.showroom_team_assignments.findFirst({ where: { period_year: Y, period_month: 4, person_name: 'UJI TL DUA' } })
  const del = await request(app).delete(`/api/showroom/team-structure/${tl.id}`).set('Cookie', cookie)
  assert.equal(del.status, 409)
})

test('API target menolak pemegang yang bukan TL/independen di bulan itu', async () => {
  await seedMarch()
  const { cookie } = await loginAs('test_kacab', 'password123')
  const bad = await request(app).post('/api/showroom/marketing-targets').set('Cookie', cookie)
    .send({ team_leader: 'UJI SALES A', period_year: Y, period_month: 3, target_unit: 5 })
  assert.equal(bad.status, 400)

  const ok = await request(app).post('/api/showroom/marketing-targets').set('Cookie', cookie)
    .send({ team_leader: 'UJI INDIE', period_year: Y, period_month: 3, target_unit: 5 })
  assert.equal(ok.status, 200)
})
