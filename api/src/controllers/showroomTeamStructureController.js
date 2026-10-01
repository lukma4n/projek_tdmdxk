import { prisma } from '../config/db.js'
import { normalizeKey } from '../utils/salesPerformance.js'
import {
  TEAM_ROLES,
  ensureMonthStructure,
  getEffectiveStructure,
  validateAssignment,
} from '../services/teamStructureService.js'

const MIN_YEAR = 2015
const MAX_YEAR = 2099

function cleanString(value) {
  return String(value || '').trim()
}

function parsePeriod(source) {
  const year = parseInt(source.year)
  const month = parseInt(source.month)
  if (!Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR) return { error: `Tahun harus antara ${MIN_YEAR} - ${MAX_YEAR}` }
  if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'Bulan harus antara 1 - 12' }
  return { year, month }
}

export async function getTeamStructure(req, res, next) {
  try {
    const period = parsePeriod(req.query)
    if (period.error) return res.status(400).json({ error: period.error })

    const { rows, source, exact } = await getEffectiveStructure(prisma, period.year, period.month)
    res.json({
      period: { year: period.year, month: period.month },
      exact,
      source,
      data: rows.map((r) => ({
        id: exact ? r.id : null,
        person_name: r.person_name,
        role: r.role,
        parent_name: r.parent_name,
        title: r.title,
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function getTeamStructureCandidates(req, res, next) {
  try {
    const [sales, leaders] = await Promise.all([
      prisma.showroom_salespeople.findMany({ where: { is_active: true }, select: { name: true } }),
      prisma.showroom_team_leaders.findMany({ where: { is_active: true }, select: { name: true } }),
    ])
    const names = [...new Set([...sales, ...leaders].map((r) => normalizeKey(r.name)).filter(Boolean))].sort()
    res.json({ data: names })
  } catch (error) {
    next(error)
  }
}

export async function copyTeamStructure(req, res, next) {
  try {
    const period = parsePeriod(req.body)
    if (period.error) return res.status(400).json({ error: period.error })
    const { copiedFrom } = await ensureMonthStructure(prisma, period.year, period.month, req.user?.userId || null)
    res.json({ message: copiedFrom ? 'Susunan disalin' : 'Susunan bulan ini sudah ada', copied_from: copiedFrom })
  } catch (error) {
    next(error)
  }
}

// Master Pos (lokasi) — pilihan Nama Pos (Kapos) dan Lokasi Pos tim (TL).
export async function getPosList(req, res, next) {
  try {
    const rows = await prisma.showroom_pos.findMany({ orderBy: { name: 'asc' } })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
}

export async function upsertPos(req, res, next) {
  try {
    const name = normalizeKey(req.body.name)
    if (!name) return res.status(400).json({ error: 'Nama Pos wajib diisi' })
    const row = await prisma.showroom_pos.upsert({
      where: { name },
      create: { name },
      update: { is_active: true },
    })
    res.json({ message: `Pos ${name} tersimpan`, data: row })
  } catch (error) {
    next(error)
  }
}

export async function updatePosStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    const row = await prisma.showroom_pos.update({ where: { id }, data: { is_active: Boolean(req.body.is_active) } })
    res.json({ message: row.is_active ? `Pos ${row.name} diaktifkan` : `Pos ${row.name} dinonaktifkan`, data: row })
  } catch (error) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Pos tidak ditemukan' })
    next(error)
  }
}

// Ubah nama Pos sekaligus di semua susunan tim yang memakainya (semua bulan),
// agar laporan lama dan baru tetap konsisten.
export async function renamePos(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const name = normalizeKey(req.body.name)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    if (!name) return res.status(400).json({ error: 'Nama Pos wajib diisi' })

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.showroom_pos.findUnique({ where: { id } })
      if (!current) return { status: 404, error: 'Pos tidak ditemukan' }
      if (current.name === name) return { row: current, moved: 0 }
      const clash = await tx.showroom_pos.findUnique({ where: { name } })
      if (clash) return { status: 409, error: `Pos ${name} sudah ada` }

      const row = await tx.showroom_pos.update({ where: { id }, data: { name } })
      const { count } = await tx.showroom_team_assignments.updateMany({
        where: { title: current.name, role: { in: [TEAM_ROLES.KAPOS, TEAM_ROLES.TL] } },
        data: { title: name },
      })
      return { row, moved: count, oldName: current.name }
    })
    if (result.error) return res.status(result.status).json({ error: result.error })

    res.json({
      message: result.moved > 0
        ? `Pos ${result.oldName} diganti menjadi ${result.row.name} (${result.moved} baris susunan tim ikut diperbarui)`
        : `Nama Pos tersimpan: ${result.row.name}`,
      data: result.row,
    })
  } catch (error) {
    next(error)
  }
}

export async function upsertTeamAssignment(req, res, next) {
  try {
    const period = parsePeriod(req.body)
    if (period.error) return res.status(400).json({ error: period.error })

    const row = {
      person_name: normalizeKey(req.body.person_name),
      role: cleanString(req.body.role).toUpperCase(),
      parent_name: normalizeKey(req.body.parent_name) || null,
      title: cleanString(req.body.title) || null,
    }
    if (row.role === TEAM_ROLES.KAPOS || row.role === TEAM_ROLES.INDEPENDEN) row.parent_name = null

    // Untuk Kapos/TL, keterangan = nama Pos dan wajib berasal dari master Pos.
    if ((row.role === TEAM_ROLES.KAPOS || row.role === TEAM_ROLES.TL) && row.title) {
      row.title = normalizeKey(row.title)
      const pos = await prisma.showroom_pos.findUnique({ where: { name: row.title } })
      if (!pos) return res.status(400).json({ error: `Pos "${row.title}" belum ada di master Pos` })
    }

    await ensureMonthStructure(prisma, period.year, period.month, req.user?.userId || null)
    const monthRows = await prisma.showroom_team_assignments.findMany({
      where: { period_year: period.year, period_month: period.month },
    })
    const message = validateAssignment(row, monthRows)
    if (message) return res.status(400).json({ error: message })

    const saved = await prisma.showroom_team_assignments.upsert({
      where: {
        period_year_period_month_person_name: {
          period_year: period.year,
          period_month: period.month,
          person_name: row.person_name,
        },
      },
      create: { ...row, period_year: period.year, period_month: period.month, created_by: req.user?.userId || null },
      update: row,
    })
    res.json({ message: 'Susunan tim tersimpan', data: saved })
  } catch (error) {
    next(error)
  }
}

export async function deleteTeamAssignment(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    const row = await prisma.showroom_team_assignments.findUnique({ where: { id } })
    if (!row) return res.status(404).json({ error: 'Data tidak ditemukan' })

    const children = await prisma.showroom_team_assignments.count({
      where: { period_year: row.period_year, period_month: row.period_month, parent_name: row.person_name },
    })
    if (children > 0) {
      return res.status(409).json({ error: `${row.person_name} masih membawahi ${children} orang; pindahkan anggotanya dulu` })
    }
    await prisma.showroom_team_assignments.delete({ where: { id } })
    res.json({ message: 'Dihapus dari susunan tim' })
  } catch (error) {
    next(error)
  }
}
