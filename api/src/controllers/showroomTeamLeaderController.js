import xlsx from 'xlsx'
import { safeReadExcel } from '../utils/excelValidator.js'
import { prisma } from '../config/db.js'

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

export async function getTeamLeaders(req, res, next) {
  try {
    const { search, all } = req.query
    const where = {}
    if (search) {
      where.name = { contains: upper(search) }
    }
    if (!all) {
      where.is_active = true
    }
    const rows = await prisma.showroom_team_leaders.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
}

export async function getTeamLeaderSummary(req, res, next) {
  try {
    const [total, latest] = await Promise.all([
      prisma.showroom_team_leaders.count(),
      prisma.showroom_team_leaders.findFirst({
        orderBy: { synced_at: 'desc' },
        select: { synced_at: true, source_file: true },
      }),
    ])
    res.json({
      total,
      latestSyncedAt: latest?.synced_at || null,
      sourceFile: latest?.source_file || null,
    })
  } catch (error) {
    next(error)
  }
}

export async function upsertTeamLeader(req, res, next) {
  try {
    const name = upper(req.body.name)
    const no = parseInt(req.body.no) || null
    if (!name) return res.status(400).json({ error: 'Nama wajib diisi' })

    let createNo = no
    if (!createNo) {
      const maxNo = await prisma.showroom_team_leaders.aggregate({ _max: { no: true } })
      createNo = (maxNo._max.no || 0) + 1
    }

    const row = await prisma.showroom_team_leaders.upsert({
      where: { name },
      create: {
        no: createNo,
        name,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
      update: {
        ...(no ? { no } : {}),
        // is_active hanya ditimpa jika dikirim eksplisit, agar edit nama tidak
        // diam-diam meng-aktifkan-lagi team leader yang sudah dinonaktifkan.
        ...(req.body.is_active !== undefined ? { is_active: Boolean(req.body.is_active) } : {}),
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
    })
    res.json({ message: 'Data Team Leader tersimpan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function updateTeamLeaderStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    const is_active = Boolean(req.body.is_active)
    const row = await prisma.showroom_team_leaders.update({
      where: { id },
      data: { is_active },
    })
    res.json({ message: is_active ? 'Team Leader diaktifkan' : 'Team Leader dinonaktifkan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function deleteTeamLeader(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    await prisma.showroom_team_leaders.delete({ where: { id } })
    res.json({ message: 'Data Team Leader berhasil dihapus' })
  } catch (error) {
    // P2003 = foreign key constraint (masih dipakai di target marketing).
    // P2025 = record tidak ada. Beri pesan ramah, jangan lempar 500 mentah.
    if (error?.code === 'P2003') {
      return res.status(409).json({
        error: 'Team Leader ini masih dipakai di Target Marketing sehingga tidak bisa dihapus. Nonaktifkan saja, atau hapus dulu target marketing terkait.',
      })
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Data Team Leader tidak ditemukan' })
    }
    next(error)
  }
}

export async function previewTeamLeadersImport(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const wb = safeReadExcel(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return res.status(400).json({ error: 'Sheet tidak ditemukan' })
    }

    const raw = xlsx.utils.sheet_to_json(ws, { defval: '' })
    const rows = raw
      .map((row) => ({
        no: parseInt(row.No) || null,
        name: upper(row.Name || row.Nama),
      }))
      .filter((row) => row.name)

    res.json({ total: rows.length, sample: rows.slice(0, 5) })
  } catch (error) {
    next(error)
  }
}

export async function uploadTeamLeadersImport(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const wb = safeReadExcel(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return res.status(400).json({ error: 'Sheet tidak ditemukan' })
    }

    const raw = xlsx.utils.sheet_to_json(ws, { defval: '' })
    const rows = raw
      .map((row) => ({
        no: parseInt(row.No) || null,
        name: upper(row.Name || row.Nama),
      }))
      .filter((row) => row.name)

    await prisma.$transaction(async (tx) => {
      await tx.showroom_team_leaders.deleteMany({})
      for (const row of rows) {
        await tx.showroom_team_leaders.create({
          data: {
            no: row.no,
            name: row.name,
            is_active: true,
            source_file: req.file.originalname || 'IMPORT',
            synced_at: new Date(),
          },
        })
      }
    })

    res.json({
      message: 'Master Team Leader berhasil diimport',
      total: rows.length,
      imported: rows.length,
    })
  } catch (error) {
    next(error)
  }
}
