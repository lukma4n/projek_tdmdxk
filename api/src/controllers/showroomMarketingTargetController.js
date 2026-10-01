import { prisma } from '../config/db.js'
import { normalizeKey } from '../utils/salesPerformance.js'
import { TEAM_ROLES, computeTargetSummary, getEffectiveStructure } from '../services/teamStructureService.js'

const MIN_YEAR = 2025
const MAX_YEAR = 2099
const MIN_MONTH = 1
const MAX_MONTH = 12

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

// Pemegang target = TL atau sales INDEPENDEN di susunan bulan itu.
async function isTargetHolder(name, year, month) {
  const { rows } = await getEffectiveStructure(prisma, year, month)
  return rows.some((r) => normalizeKey(r.person_name) === name
    && (r.role === TEAM_ROLES.TL || r.role === TEAM_ROLES.INDEPENDEN))
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

    res.json(await computeTargetSummary(prisma, { year, month }))
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

    if (!teamLeader) return res.status(400).json({ error: 'Pemegang target wajib diisi' })
    if (!periodYear || periodYear < MIN_YEAR || periodYear > MAX_YEAR) {
      return res.status(400).json({ error: `Tahun harus antara ${MIN_YEAR} - ${MAX_YEAR}` })
    }
    if (!periodMonth || periodMonth < MIN_MONTH || periodMonth > MAX_MONTH) {
      return res.status(400).json({ error: `Bulan harus antara ${MIN_MONTH} - ${MAX_MONTH}` })
    }

    if (!(await isTargetHolder(teamLeader, periodYear, periodMonth))) {
      return res.status(400).json({
        error: `"${teamLeader}" bukan Team Leader atau Sales Showroom di susunan tim ${periodMonth}/${periodYear}`,
      })
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
