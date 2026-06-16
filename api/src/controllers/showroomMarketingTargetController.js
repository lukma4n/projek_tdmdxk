import { prisma } from '../config/db.js'
import { countActualForSalesmen } from '../utils/salesPerformance.js'

const MIN_YEAR = 2025
const MAX_YEAR = 2099
const MIN_MONTH = 1
const MAX_MONTH = 12

function startOfMonth(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0)
}

function endOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

function parseIntOrZero(value) {
  const n = parseInt(value)
  return Number.isFinite(n) ? n : 0
}

function cleanString(value) {
  return String(value || '').trim()
}

function upper(value) {
  return cleanString(value).toUpperCase()
}

async function assertTeamLeaderExists(name) {
  const tl = await prisma.showroom_team_leaders.findFirst({
    where: { name, is_active: true },
    select: { name: true },
  })
  return !!tl
}

export async function listMarketingTargets(req, res, next) {
  try {
    const { year, month, team_leader } = req.query
    const where = { is_active: true }
    if (year) where.period_year = parseIntOrZero(year)
    if (month) where.period_month = parseIntOrZero(month)
    if (team_leader) where.team_leader = upper(team_leader)

    const rows = await prisma.showroom_marketing_targets.findMany({
      where,
      orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }, { team_leader: 'asc' }],
    })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
}

export async function getMarketingTargetSummary(req, res, next) {
  try {
    const year = parseIntOrZero(req.query.year) || new Date().getFullYear()
    const monthParam = req.query.month
    const month = monthParam ? parseIntOrZero(monthParam) : null

    if (year < MIN_YEAR || year > MAX_YEAR) {
      return res.status(400).json({ error: `Tahun harus antara ${MIN_YEAR} - ${MAX_YEAR}` })
    }
    if (month !== null && (month < MIN_MONTH || month > MAX_MONTH)) {
      return res.status(400).json({ error: `Bulan harus antara ${MIN_MONTH} - ${MAX_MONTH}` })
    }

    const where = { is_active: true, period_year: year }
    if (month !== null) where.period_month = month

    const targets = await prisma.showroom_marketing_targets.findMany({
      where,
      orderBy: [{ team_leader: 'asc' }],
    })

    const teamLeaders = await prisma.showroom_team_leaders.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    })

    const salesmenByTl = new Map()
    // Defensive: hanya sales aktif yang dihitung per-TL.
    // Sales non-aktif di master (mis. dinonaktifkan via UI) tidak ikut
    // group by TL, sehingga tidak double-count di actual.
    const allSalesmen = await prisma.showroom_salespeople.findMany({
      where: { is_active: true },
      select: { name: true, team_leader: true },
    })
    for (const s of allSalesmen) {
      const tl = upper(s.team_leader) || 'TIDAK DIKETAHUI'
      if (!salesmenByTl.has(tl)) salesmenByTl.set(tl, [])
      salesmenByTl.get(tl).push(s.name)
    }

    const enriched = await Promise.all(
      teamLeaders.map(async (tl) => {
        const tlName = tl.name
        const periodFilter = (row) =>
          row.team_leader === tlName
          && row.period_year === year
          && (month === null || row.period_month === month)

        const tlTargets = targets.filter(periodFilter)
        const targetUnit = tlTargets.reduce((sum, r) => sum + (r.target_unit || 0), 0)

        let from = null
        let to = null
        if (month !== null) {
          from = startOfMonth(year, month)
          to = endOfMonth(year, month)
        } else {
          from = startOfMonth(year, 1)
          to = endOfMonth(year, 12)
        }

        const salesmen = salesmenByTl.get(tlName) || []
        const actualUnit = await countActualForSalesmen(prisma, {
          salesmen,
          from,
          to,
        })

        const achievementPercent = targetUnit > 0
          ? Math.round((actualUnit / targetUnit) * 100)
          : 0
        const gap = targetUnit - actualUnit
        let status = 'no_target'
        if (targetUnit > 0) {
          if (achievementPercent >= 90) status = 'aman'
          else if (achievementPercent >= 70) status = 'waspada'
          else status = 'kritis'
        }

        return {
          team_leader: tlName,
          sales_count: salesmen.length,
          target_unit: targetUnit,
          actual_unit: actualUnit,
          achievement_percent: achievementPercent,
          gap,
          status,
          targets: tlTargets.map((r) => ({
            id: r.id,
            period_year: r.period_year,
            period_month: r.period_month,
            target_unit: r.target_unit,
            notes: r.notes,
          })),
        }
      }),
    )

    const totalTarget = enriched.reduce((sum, r) => sum + r.target_unit, 0)
    const totalActual = enriched.reduce((sum, r) => sum + r.actual_unit, 0)
    const totalAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0

    res.json({
      period: { year, month: month ?? null },
      summary: {
        team_count: enriched.length,
        total_target: totalTarget,
        total_actual: totalActual,
        total_achievement_percent: totalAchievement,
        total_gap: totalTarget - totalActual,
      },
      data: enriched,
    })
  } catch (error) {
    next(error)
  }
}

export async function upsertMarketingTarget(req, res, next) {
  try {
    const teamLeader = upper(req.body.team_leader)
    const periodYear = parseIntOrZero(req.body.period_year)
    const periodMonth = parseIntOrZero(req.body.period_month)
    const targetUnit = Math.max(0, parseIntOrZero(req.body.target_unit))
    const notes = cleanString(req.body.notes) || null

    if (!teamLeader) return res.status(400).json({ error: 'Team Leader wajib diisi' })
    if (!periodYear || periodYear < MIN_YEAR || periodYear > MAX_YEAR) {
      return res.status(400).json({ error: `Tahun harus antara ${MIN_YEAR} - ${MAX_YEAR}` })
    }
    if (!periodMonth || periodMonth < MIN_MONTH || periodMonth > MAX_MONTH) {
      return res.status(400).json({ error: `Bulan harus antara ${MIN_MONTH} - ${MAX_MONTH}` })
    }

    const exists = await assertTeamLeaderExists(teamLeader)
    if (!exists) {
      return res.status(400).json({ error: `Team Leader "${teamLeader}" tidak ditemukan di master` })
    }

    const row = await prisma.showroom_marketing_targets.upsert({
      where: {
        period_year_period_month_team_leader: {
          period_year: periodYear,
          period_month: periodMonth,
          team_leader: teamLeader,
        },
      },
      create: {
        period_year: periodYear,
        period_month: periodMonth,
        team_leader: teamLeader,
        target_unit: targetUnit,
        notes,
        is_active: true,
        created_by: req.user?.userId || null,
        updated_at: new Date(),
      },
      update: {
        target_unit: targetUnit,
        notes,
        is_active: true,
        updated_at: new Date(),
      },
    })
    res.json({ message: 'Target marketing tersimpan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function deleteMarketingTarget(req, res, next) {
  try {
    const id = parseIntOrZero(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    await prisma.showroom_marketing_targets.delete({ where: { id } })
    res.json({ message: 'Target marketing berhasil dihapus' })
  } catch (error) {
    next(error)
  }
}
