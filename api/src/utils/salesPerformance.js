/**
 * Helper untuk hitung performa per tim / per Team Leader.
 * Dipakai oleh sales dashboard & modul Target Marketing agar konsisten.
 */

function normalizeKey(value = '') {
  return String(value || '').trim().toUpperCase()
}

/**
 * Group salespeople by team_leader dan hitung total actual
 * (closing DO) untuk masing-masing tim pada rentang tanggal tertentu.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Object} options
 * @param {Object} options.dateWhere - Where clause Prisma untuk filter so_date + branch_code
 * @param {Array} [options.preFetchedMaster] - Optional master salespeople yang sudah di-fetch
 * @param {Array} [options.preFetchedRecords] - Optional pre-fetched customers records
 * @returns {Promise<{byTeam: Array, totalActiveSales: number, salesWithClosing: number}>}
 */
export async function buildTeamPerformanceFromMaster(prisma, options = {}) {
  const { dateWhere = {}, preFetchedMaster, preFetchedRecords } = options

  const master = preFetchedMaster || await prisma.showroom_salespeople.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  })

  if (master.length === 0) {
    return { byTeam: [], totalActiveSales: 0, salesWithClosing: 0 }
  }

  const teamMap = new Map()
  for (const s of master) {
    const tl = s.team_leader || 'Tidak diketahui'
    if (!teamMap.has(tl)) teamMap.set(tl, [])
    teamMap.get(tl).push(s)
  }

  const customerRecords = preFetchedRecords || await prisma.customers.findMany({
    where: { ...dateWhere, salesman: { not: null } },
    select: { salesman: true },
  })

  const countMap = new Map()
  for (const c of customerRecords) {
    const key = normalizeKey(c.salesman)
    countMap.set(key, (countMap.get(key) || 0) + 1)
  }

  const byTeam = []
  for (const [teamLeader, salesmen] of teamMap) {
    const teamSalesmen = []
    let teamTotal = 0

    for (const s of salesmen) {
      const key = normalizeKey(s.name)
      const count = countMap.get(key) || 0
      teamTotal += count
      teamSalesmen.push({ name: s.name, count })
    }

    teamSalesmen.sort((a, b) => b.count - a.count)
    byTeam.push({ team: teamLeader, total: teamTotal, salesmen: teamSalesmen })
  }

  byTeam.sort((a, b) => b.total - a.total)

  return {
    byTeam,
    totalActiveSales: master.length,
    salesWithClosing: [...new Set(byTeam.flatMap((t) => t.salesmen.filter((s) => s.count > 0).map((s) => s.name)))].length,
  }
}

/**
 * Hitung actual closing DO untuk daftar salesman tertentu.
 * Dipakai modul Target Marketing untuk mengukur pencapaian per TL.
 *
 * Penting: SQLite + Prisma tidak support `mode: 'insensitive'`, jadi query
 * `salesman: { in: [...] }` bersifat case-sensitive. Beberapa baris di
 * tabel `customers` punya salesman dengan case / whitespace yang tidak
 * persis sama dengan `showroom_salespeople.name` (mis. "Gunawan" vs
 * "GUNAWAN", atau "WAWAN SETIAWAN " vs "WAWAN SETIAWAN"). Untuk akurasi,
 * kita load records di periode + branch, lalu cocokkan dengan normalize
 * (trim + uppercase) di memory. Dataset per-bulan cabang kecil (< 500 row),
 * jadi pendekatan ini aman secara performa.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Object} options
 * @param {string[]} options.salesmen - daftar nama sales (case-insensitive)
 * @param {Date} options.from
 * @param {Date} options.to
 * @param {string} [options.branchCode] - default 'DXK'
 * @returns {Promise<number>}
 */
export async function countActualForSalesmen(prisma, { salesmen, from, to, branchCode = 'DXK' }) {
  if (!salesmen || salesmen.length === 0) return 0
  const keys = new Set(
    salesmen
      .map((s) => normalizeKey(s))
      .filter(Boolean),
  )
  if (keys.size === 0) return 0

  const records = await prisma.customers.findMany({
    where: {
      branch_code: branchCode,
      so_date: { gte: from, lte: to },
      salesman: { not: null },
    },
    select: { salesman: true },
  })

  let count = 0
  for (const r of records) {
    if (keys.has(normalizeKey(r.salesman))) count += 1
  }
  return count
}
