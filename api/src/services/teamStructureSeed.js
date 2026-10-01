/**
 * Pengisian awal showroom_team_assignments. Dipakai scripts/seed-team-structure.js.
 * Kedua fungsi idempoten: bulan yang sudah punya susunan dilewati.
 */
import { normalizeKey } from '../utils/salesPerformance.js'
import { TEAM_ROLES } from './teamStructureService.js'

async function monthHasStructure(prisma, year, month) {
  const count = await prisma.showroom_team_assignments.count({ where: { period_year: year, period_month: month } })
  return count > 0
}

/**
 * Susunan historis dari kolom koordinator DMS (customers.sales_coord_name):
 * tiap koordinator = TL; tiap salesman ditempatkan di bawah koordinator yang
 * paling sering muncul untuknya pada bulan itu. Tanpa Kapos.
 *
 * @param {{ before: {year:number, month:number}, branchCode?: string }} options
 *   Hanya bulan sebelum `before` yang diisi.
 * @returns {Promise<Array<{year:number, month:number, rows:number}>>} bulan yang diisi
 */
export async function seedHistoricalStructure(prisma, { before, branchCode = 'DXK' }) {
  const records = await prisma.customers.findMany({
    where: {
      branch_code: branchCode,
      so_date: { lt: new Date(before.year, before.month - 1, 1) },
      AND: [
        { salesman: { not: null } }, { salesman: { not: '' } },
        { sales_coord_name: { not: null } }, { sales_coord_name: { not: '' } },
      ],
    },
    select: { salesman: true, sales_coord_name: true, so_date: true },
  })

  // periode -> salesman -> koordinator -> jumlah
  const byMonth = new Map()
  for (const r of records) {
    const d = new Date(r.so_date)
    const period = `${d.getFullYear()}-${d.getMonth() + 1}`
    const salesman = normalizeKey(r.salesman)
    const coord = normalizeKey(r.sales_coord_name)
    if (!byMonth.has(period)) byMonth.set(period, new Map())
    const perSales = byMonth.get(period)
    if (!perSales.has(salesman)) perSales.set(salesman, new Map())
    const counts = perSales.get(salesman)
    counts.set(coord, (counts.get(coord) || 0) + 1)
  }

  const seeded = []
  for (const [period, perSales] of byMonth) {
    const [year, month] = period.split('-').map(Number)
    if (await monthHasStructure(prisma, year, month)) continue

    const leaders = new Set()
    const members = []
    for (const [salesman, counts] of perSales) {
      const [coord] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      leaders.add(coord)
      members.push({ salesman, coord })
    }

    const data = [...leaders].map((name) => ({
      period_year: year, period_month: month, person_name: name, role: TEAM_ROLES.TL, parent_name: null,
    }))
    for (const { salesman, coord } of members) {
      if (leaders.has(salesman)) continue // TL yang berjualan sudah tercatat sebagai TL
      data.push({ period_year: year, period_month: month, person_name: salesman, role: TEAM_ROLES.SALES, parent_name: coord })
    }
    await prisma.showroom_team_assignments.createMany({ data })
    seeded.push({ year, month, rows: data.length })
  }
  return seeded.sort((a, b) => a.year - b.year || a.month - b.month)
}

/**
 * Susunan satu bulan dari master sales aktif (showroom_salespeople.team_leader).
 *
 * @param {object} options
 * @param {number} options.year
 * @param {number} options.month
 * @param {Record<string, string[]>} [options.kapos] Kapos -> daftar TL di bawahnya
 * @param {string} [options.independentGroup] nilai team_leader di master yang
 *   anggotanya dijadikan INDEPENDEN (bukan tim)
 * @param {Record<string, string>} [options.titles] judul per nama
 * @returns {Promise<number>} jumlah baris dibuat (0 bila bulan sudah terisi)
 */
export async function seedStructureFromMaster(prisma, { year, month, kapos = {}, independentGroup = null, titles = {} }) {
  if (await monthHasStructure(prisma, year, month)) return 0

  const independentKey = independentGroup ? normalizeKey(independentGroup) : null
  const kaposOfTl = new Map()
  for (const [kaposName, tls] of Object.entries(kapos)) {
    for (const tl of tls) kaposOfTl.set(normalizeKey(tl), normalizeKey(kaposName))
  }
  const titleOf = (name) => titles[name] || null

  const sales = await prisma.showroom_salespeople.findMany({
    where: { is_active: true },
    select: { name: true, team_leader: true },
  })

  const rows = new Map()
  for (const kaposName of Object.keys(kapos)) {
    const name = normalizeKey(kaposName)
    rows.set(name, { person_name: name, role: TEAM_ROLES.KAPOS, parent_name: null })
  }
  const addTl = (name) => {
    if (rows.has(name)) return
    rows.set(name, { person_name: name, role: TEAM_ROLES.TL, parent_name: kaposOfTl.get(name) || null })
  }
  for (const tl of kaposOfTl.keys()) addTl(tl)

  for (const s of sales) {
    const tl = normalizeKey(s.team_leader)
    if (!tl || tl === independentKey) continue
    addTl(tl)
  }
  for (const s of sales) {
    const name = normalizeKey(s.name)
    const tl = normalizeKey(s.team_leader)
    if (!name || rows.has(name)) continue
    if (independentKey && tl === independentKey) {
      rows.set(name, { person_name: name, role: TEAM_ROLES.INDEPENDEN, parent_name: null })
    } else if (tl) {
      rows.set(name, { person_name: name, role: TEAM_ROLES.SALES, parent_name: tl })
    }
  }

  const data = [...rows.values()].map((r) => ({
    ...r, title: titleOf(r.person_name), period_year: year, period_month: month,
  }))
  await prisma.showroom_team_assignments.createMany({ data })
  return data.length
}
