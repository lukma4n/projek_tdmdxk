/**
 * Susunan tim per bulan (Kapos -> TL -> Sales, plus sales INDEPENDEN) dan
 * perhitungan performa per tim berdasarkan susunan bulan transaksi.
 *
 * Laporan bulan X selalu membaca susunan bulan X, jadi mutasi di bulan
 * berjalan tidak menulis ulang riwayat. Bulan tanpa susunan memakai susunan
 * bulan terakhir sebelumnya (dibaca saja, tidak ditulis).
 */
import { normalizeKey } from '../utils/salesPerformance.js'

export const TEAM_ROLES = Object.freeze({
  KAPOS: 'KAPOS',
  TL: 'TL',
  SALES: 'SALES',
  INDEPENDEN: 'INDEPENDEN',
})

export const INDEPENDENT_GROUP = 'INDEPENDEN'
export const UNMAPPED_GROUP = 'BELUM TERPETAKAN'

const KIND_ORDER = { team: 0, kapos: 0, independent: 1, unmapped: 2 }

function periodIndex(year, month) {
  return year * 12 + (month - 1)
}

function startOfMonth(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0)
}

function endOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

/**
 * Susunan yang berlaku untuk suatu bulan.
 * @returns {Promise<{rows: Array, source: {year:number, month:number}|null, exact: boolean}>}
 */
export async function getEffectiveStructure(prisma, year, month) {
  const latest = await prisma.showroom_team_assignments.findFirst({
    where: {
      OR: [
        { period_year: { lt: year } },
        { period_year: year, period_month: { lte: month } },
      ],
    },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    select: { period_year: true, period_month: true },
  })
  if (!latest) return { rows: [], source: null, exact: false }

  const rows = await prisma.showroom_team_assignments.findMany({
    where: { period_year: latest.period_year, period_month: latest.period_month },
    orderBy: [{ role: 'asc' }, { person_name: 'asc' }],
  })
  return {
    rows,
    source: { year: latest.period_year, month: latest.period_month },
    exact: latest.period_year === year && latest.period_month === month,
  }
}

/**
 * Pastikan bulan punya susunan sendiri; bila belum, salin dari susunan efektif.
 * @returns {Promise<{copiedFrom: {year:number, month:number}|null}>}
 */
export async function ensureMonthStructure(prisma, year, month, userId = null) {
  const effective = await getEffectiveStructure(prisma, year, month)
  if (effective.exact || effective.rows.length === 0) return { copiedFrom: null }

  await prisma.showroom_team_assignments.createMany({
    data: effective.rows.map((r) => ({
      period_year: year,
      period_month: month,
      person_name: r.person_name,
      role: r.role,
      parent_name: r.parent_name,
      title: r.title,
      created_by: userId,
    })),
  })
  return { copiedFrom: effective.source }
}

/**
 * Indeks nama -> posisi di susunan: kelompok (team), jenis kelompok, dan Pos.
 */
export function buildMemberIndex(rows) {
  const byName = new Map(rows.map((r) => [normalizeKey(r.person_name), r]))
  const posOfTl = (tlName) => {
    const tl = byName.get(normalizeKey(tlName))
    if (!tl || tl.role !== TEAM_ROLES.TL) return null
    return tl.parent_name ? normalizeKey(tl.parent_name) : null
  }

  const index = new Map()
  for (const r of rows) {
    const key = normalizeKey(r.person_name)
    const base = { name: key, role: r.role, title: r.title || null }
    if (r.role === TEAM_ROLES.KAPOS) {
      index.set(key, { ...base, kind: 'kapos', team: key, pos: key })
    } else if (r.role === TEAM_ROLES.TL) {
      index.set(key, { ...base, kind: 'team', team: key, pos: r.parent_name ? normalizeKey(r.parent_name) : null })
    } else if (r.role === TEAM_ROLES.SALES && r.parent_name) {
      const team = normalizeKey(r.parent_name)
      index.set(key, { ...base, kind: 'team', team, pos: posOfTl(team) })
    } else if (r.role === TEAM_ROLES.INDEPENDEN) {
      index.set(key, { ...base, kind: 'independent', team: INDEPENDENT_GROUP, pos: null })
    }
    // SALES tanpa atasan sengaja tidak diindeks -> jatuh ke "Belum terpetakan".
  }
  return index
}

function monthsBetween(from, to) {
  const months = []
  let y = from.getFullYear()
  let m = from.getMonth() + 1
  const endIdx = periodIndex(to.getFullYear(), to.getMonth() + 1)
  while (periodIndex(y, m) <= endIdx) {
    months.push({ year: y, month: m })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

/**
 * Hitung performa per kelompok untuk rentang tanggal. Tiap transaksi dipetakan
 * memakai susunan bulan so_date-nya.
 *
 * @returns {Promise<{byTeam: Array, byPos: Array, totalMembers: number, salesWithClosing: number, unmappedTotal: number}>}
 */
export async function computeTeamPerformance(prisma, { from, to, branchCode = 'DXK' }) {
  const months = monthsBetween(from, to)
  const indexByMonth = new Map()
  let lastIndex = new Map()
  for (const { year, month } of months) {
    const { rows } = await getEffectiveStructure(prisma, year, month)
    lastIndex = buildMemberIndex(rows)
    indexByMonth.set(periodIndex(year, month), lastIndex)
  }

  const groups = new Map()
  const groupFor = (kind, team, pos) => {
    const id = `${kind}:${team}`
    if (!groups.has(id)) groups.set(id, { team, kind, pos, total: 0, members: new Map() })
    const g = groups.get(id)
    if (pos && !g.pos) g.pos = pos
    return g
  }
  const memberFor = (group, name, info = {}) => {
    if (!group.members.has(name)) {
      group.members.set(name, { name, count: 0, role: info.role || null, title: info.title || null })
    }
    return group.members.get(name)
  }

  // Anggota tanpa penjualan tetap tampil (0 unit) — dari semua bulan dalam rentang.
  for (const index of indexByMonth.values()) {
    for (const info of index.values()) {
      memberFor(groupFor(info.kind, info.team, info.pos), info.name, info)
    }
  }

  const records = await prisma.customers.findMany({
    where: {
      branch_code: branchCode,
      so_date: { gte: from, lte: to },
      AND: [{ salesman: { not: null } }, { salesman: { not: '' } }],
    },
    select: { salesman: true, so_date: true },
  })

  let unmappedTotal = 0
  for (const r of records) {
    const key = normalizeKey(r.salesman)
    if (!key) continue
    const d = new Date(r.so_date)
    const index = indexByMonth.get(periodIndex(d.getFullYear(), d.getMonth() + 1)) || new Map()
    const info = index.get(key)
    const group = info
      ? groupFor(info.kind, info.team, info.pos)
      : groupFor('unmapped', UNMAPPED_GROUP, null)
    memberFor(group, key, info).count += 1
    group.total += 1
    if (!info) unmappedTotal += 1
  }

  // Kapos tidak berjualan pribadi (penjualannya dititipkan ke tim), jadi kartunya
  // hanya muncul bila ternyata ada SO atas namanya — agar unit itu tidak hilang.
  const byTeam = [...groups.values()]
    .filter((g) => (g.kind !== 'unmapped' && g.kind !== 'kapos') || g.total > 0)
    .map((g) => ({
      team: g.team,
      kind: g.kind,
      pos: g.pos,
      total: g.total,
      salesmen: [...g.members.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.total - a.total || a.team.localeCompare(b.team))

  const posMap = new Map()
  for (const t of byTeam) {
    if (!t.pos) continue
    if (!posMap.has(t.pos)) posMap.set(t.pos, { pos: t.pos, total: 0, direct: 0, teams: [] })
    const p = posMap.get(t.pos)
    p.total += t.total
    if (t.kind === 'kapos') p.direct += t.total
    else p.teams.push(t.team)
  }
  const byPos = [...posMap.values()].sort((a, b) => b.total - a.total)

  const closers = new Set()
  for (const t of byTeam) {
    if (t.kind === 'unmapped') continue
    for (const s of t.salesmen) if (s.count > 0) closers.add(s.name)
  }

  return {
    byTeam,
    byPos,
    totalMembers: lastIndex.size,
    salesWithClosing: closers.size,
    unmappedTotal,
  }
}

function achievementStatus(target, actual) {
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0
  let status = 'no_target'
  if (target > 0) {
    if (percent >= 90) status = 'aman'
    else if (percent >= 70) status = 'waspada'
    else status = 'kritis'
  }
  return { achievement_percent: percent, gap: target - actual, status }
}

/**
 * Ringkasan target vs aktual per pemegang target (TL / INDEPENDEN) dan per Pos.
 * month null = setahun (jumlah 12 bulan per pemegang).
 */
export async function computeTargetSummary(prisma, { year, month = null, branchCode = 'DXK' }) {
  const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1)
  const holders = new Map()
  const posAgg = new Map()
  let unmappedActual = 0

  const holderFor = (name, init) => {
    if (!holders.has(name)) {
      holders.set(name, { team_leader: name, role: init.role, pos: null, title: null, sales_count: 0, target_unit: 0, actual_unit: 0, targets: [] })
    }
    return holders.get(name)
  }
  const posFor = (name) => {
    if (!posAgg.has(name)) posAgg.set(name, { pos: name, target_unit: 0, actual_unit: 0, direct_unit: 0, teams: new Set() })
    return posAgg.get(name)
  }

  for (const m of months) {
    const { rows } = await getEffectiveStructure(prisma, year, m)
    const perf = await computeTeamPerformance(prisma, { from: startOfMonth(year, m), to: endOfMonth(year, m), branchCode })
    unmappedActual += perf.unmappedTotal
    const teamByName = new Map(perf.byTeam.map((t) => [`${t.kind}:${t.team}`, t]))
    const independent = teamByName.get(`independent:${INDEPENDENT_GROUP}`)

    const targets = await prisma.showroom_marketing_targets.findMany({
      where: { is_active: true, period_year: year, period_month: m },
    })
    const targetByName = new Map(targets.map((t) => [normalizeKey(t.team_leader), t]))

    const index = buildMemberIndex(rows)
    const seen = new Set()
    for (const r of rows) {
      if (r.role !== TEAM_ROLES.TL && r.role !== TEAM_ROLES.INDEPENDEN) continue
      const name = normalizeKey(r.person_name)
      seen.add(name)
      const h = holderFor(name, { role: r.role })
      h.role = r.role
      h.title = r.title || h.title
      const info = index.get(name)
      if (r.role === TEAM_ROLES.TL) {
        const team = teamByName.get(`team:${name}`)
        h.actual_unit += team?.total || 0
        h.sales_count = team?.salesmen.length || 0
        h.pos = info?.pos || null
      } else {
        h.actual_unit += independent?.salesmen.find((s) => s.name === name)?.count || 0
        h.sales_count = 1
        h.pos = null
      }
      const t = targetByName.get(name)
      if (t) {
        h.target_unit += t.target_unit || 0
        h.targets.push({ id: t.id, period_year: t.period_year, period_month: t.period_month, target_unit: t.target_unit, notes: t.notes })
      }
      if (h.pos) {
        const p = posFor(h.pos)
        p.teams.add(name)
        p.target_unit += t?.target_unit || 0
        p.actual_unit += teamByName.get(`team:${name}`)?.total || 0
      }
    }

    // Target yang pemegangnya tidak ada di susunan bulan itu tetap ditampilkan
    // agar tidak hilang diam-diam (mis. tim yang dibubarkan).
    for (const [name, t] of targetByName) {
      if (seen.has(name)) continue
      const h = holderFor(name, { role: 'LAINNYA' })
      h.target_unit += t.target_unit || 0
      h.targets.push({ id: t.id, period_year: t.period_year, period_month: t.period_month, target_unit: t.target_unit, notes: t.notes })
    }

    for (const t of perf.byTeam) {
      if (t.kind !== 'kapos') continue
      const p = posFor(t.team)
      p.direct_unit += t.total
      p.actual_unit += t.total
    }
  }

  const data = [...holders.values()]
    .map((h) => ({ ...h, ...achievementStatus(h.target_unit, h.actual_unit) }))
    .sort((a, b) => (a.pos || '￿').localeCompare(b.pos || '￿') || a.team_leader.localeCompare(b.team_leader))

  const pos = [...posAgg.values()]
    .map((p) => ({ pos: p.pos, teams: [...p.teams].sort(), target_unit: p.target_unit, actual_unit: p.actual_unit, direct_unit: p.direct_unit, ...achievementStatus(p.target_unit, p.actual_unit) }))
    .sort((a, b) => a.pos.localeCompare(b.pos))

  const totalTarget = data.reduce((sum, r) => sum + r.target_unit, 0)
  const totalActual = data.reduce((sum, r) => sum + r.actual_unit, 0)
    + pos.reduce((sum, p) => sum + p.direct_unit, 0)

  return {
    period: { year, month },
    summary: {
      team_count: data.filter((r) => r.role === TEAM_ROLES.TL).length,
      total_target: totalTarget,
      total_actual: totalActual,
      total_achievement_percent: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0,
      total_gap: totalTarget - totalActual,
      unmapped_actual: unmappedActual,
    },
    pos,
    data,
  }
}

/**
 * Validasi satu baris susunan terhadap baris lain di bulan yang sama.
 * @returns {string|null} pesan galat, atau null bila valid
 */
export function validateAssignment(row, monthRows) {
  const roles = Object.values(TEAM_ROLES)
  if (!row.person_name) return 'Nama wajib diisi'
  if (!roles.includes(row.role)) return `Peran harus salah satu dari: ${roles.join(', ')}`

  const others = new Map(
    monthRows
      .filter((r) => normalizeKey(r.person_name) !== row.person_name)
      .map((r) => [normalizeKey(r.person_name), r]),
  )
  const parent = row.parent_name ? others.get(row.parent_name) : null

  if (row.role === TEAM_ROLES.SALES) {
    if (!row.parent_name) return 'Sales wajib punya Team Leader'
    if (!parent || parent.role !== TEAM_ROLES.TL) return `"${row.parent_name}" bukan Team Leader di bulan ini`
  } else if (row.role === TEAM_ROLES.TL) {
    if (row.parent_name && (!parent || parent.role !== TEAM_ROLES.KAPOS)) {
      return `"${row.parent_name}" bukan Kepala Pos di bulan ini`
    }
  } else if (row.parent_name) {
    return 'Kepala Pos dan Sales Showroom tidak punya atasan'
  }

  // Peran yang membawahi orang lain tidak boleh diganti selama masih punya anggota.
  const children = monthRows.filter((r) => normalizeKey(r.parent_name || '') === row.person_name)
  if (children.length > 0) {
    const needed = children[0].role === TEAM_ROLES.SALES ? TEAM_ROLES.TL : TEAM_ROLES.KAPOS
    if (row.role !== needed) {
      return `${row.person_name} masih membawahi ${children.length} orang; pindahkan anggotanya dulu`
    }
  }
  return null
}

/**
 * Sales baru di master ikut masuk susunan bulan berjalan, di bawah TL-nya —
 * hanya bila bulan itu sudah punya susunan sendiri, nama belum ada, dan TL
 * tersebut memang TL di bulan itu. Selain itu tidak melakukan apa-apa.
 * @returns {Promise<boolean>} true bila baris ditambahkan
 */
export async function addSalesToCurrentMonth(prisma, name, teamLeader, now = new Date()) {
  const personName = normalizeKey(name)
  const parentName = normalizeKey(teamLeader)
  if (!personName || !parentName) return false

  const period = { period_year: now.getFullYear(), period_month: now.getMonth() + 1 }
  const monthRows = await prisma.showroom_team_assignments.findMany({ where: period })
  if (monthRows.length === 0) return false
  if (monthRows.some((r) => normalizeKey(r.person_name) === personName)) return false
  if (!monthRows.some((r) => normalizeKey(r.person_name) === parentName && r.role === TEAM_ROLES.TL)) return false

  await prisma.showroom_team_assignments.create({
    data: { ...period, person_name: personName, role: TEAM_ROLES.SALES, parent_name: parentName },
  })
  return true
}

export { startOfMonth, endOfMonth }
