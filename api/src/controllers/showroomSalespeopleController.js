import xlsx from 'xlsx'
import { prisma } from '../config/db.js'

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

export async function getSalespeople(req, res, next) {
  try {
    const { search } = req.query
    const where = {}
    if (search) {
      where.OR = [
        { name: { contains: upper(search) } },
        { team_leader: { contains: upper(search) } }
      ]
    }
    const rows = await prisma.showroom_salespeople.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
}

export async function upsertSalesperson(req, res, next) {
  try {
    const name = upper(req.body.name)
    const teamLeader = upper(req.body.team_leader)
    const no = parseInt(req.body.no) || null
    if (!name) return res.status(400).json({ error: 'Nama wajib diisi' })

    const row = await prisma.showroom_salespeople.upsert({
      where: { name: name },
      create: {
        no,
        name,
        team_leader: teamLeader,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
      update: {
        no,
        team_leader: teamLeader,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
    })
    res.json({ message: 'Data Sales tersimpan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function deleteSalesperson(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    await prisma.showroom_salespeople.delete({ where: { id } })
    res.json({ message: 'Data Sales berhasil dihapus' })
  } catch (error) {
    next(error)
  }
}

export async function getSalespersonSummary(req, res, next) {
  try {
    const [total, latest] = await Promise.all([
      prisma.showroom_salespeople.count(),
      prisma.showroom_salespeople.findFirst({
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

export async function previewSalespeopleImport(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const wb = xlsx.readFile(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return res.status(400).json({ error: 'Sheet tidak ditemukan' })
    }

    const raw = xlsx.utils.sheet_to_json(ws, { defval: '' })
    const rows = raw
      .map((row) => ({
        no: parseInt(row.No) || null,
        name: upper(row.Name),
        team_leader: upper(row['TEAM LEADER'] || row['Team Leader'] || row['TEAM_LEADER']),
      }))
      .filter((row) => row.name)

    res.json({ total: rows.length, sample: rows.slice(0, 5) })
  } catch (error) {
    next(error)
  }
}

export async function uploadSalespeopleImport(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const wb = xlsx.readFile(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return res.status(400).json({ error: 'Sheet tidak ditemukan' })
    }

    const raw = xlsx.utils.sheet_to_json(ws, { defval: '' })
    const rows = raw
      .map((row) => ({
        no: parseInt(row.No) || null,
        name: upper(row.Name),
        team_leader: upper(row['TEAM LEADER'] || row['Team Leader'] || row['TEAM_LEADER']),
      }))
      .filter((row) => row.name)

    // Replace All: delete existing, insert new
    await prisma.$transaction(async (tx) => {
      await tx.showroom_salespeople.deleteMany({})
      for (const row of rows) {
        await tx.showroom_salespeople.create({
          data: {
            no: row.no,
            name: row.name,
            team_leader: row.team_leader,
            is_active: true,
            source_file: req.file.originalname || 'IMPORT',
            synced_at: new Date(),
          },
        })
      }
    })

    res.json({
      message: 'Master Sales berhasil diimport',
      total: rows.length,
      imported: rows.length,
    })
  } catch (error) {
    next(error)
  }
}
