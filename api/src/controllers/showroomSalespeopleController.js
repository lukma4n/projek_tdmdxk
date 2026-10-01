import xlsx from 'xlsx'
import { safeReadExcel } from '../utils/excelValidator.js'
import { prisma } from '../config/db.js'
import { addSalesToCurrentMonth } from '../services/teamStructureService.js'

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

export async function getSalespeople(req, res, next) {
  try {
    const { search, is_active } = req.query
    const where = {}
    if (search) {
      where.OR = [
        { name: { contains: upper(search) } },
        { team_leader: { contains: upper(search) } }
      ]
    }
    if (is_active !== undefined) {
      where.is_active = String(is_active) === 'true'
    }
    const rows = await prisma.showroom_salespeople.findMany({
      where,
      orderBy: { no: 'asc' },
    })

    const items = rows.map((row) => ({
      id: row.id,
      no: row.no,
      name: row.name,
      team_leader: row.team_leader,
      is_active: row.is_active,
    }))

    res.json({ data: items, items })
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

    // Auto-assign no untuk record baru jika tidak diberikan
    let createNo = no
    if (!createNo) {
      const maxNo = await prisma.showroom_salespeople.aggregate({ _max: { no: true } })
      createNo = (maxNo._max.no || 0) + 1
    }

    const row = await prisma.showroom_salespeople.upsert({
      where: { name: name },
      create: {
        no: createNo,
        name,
        team_leader: teamLeader,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
      update: {
        // hanya update no jika dikirim eksplisit (agar tidak menimpa no existing)
        ...(no ? { no } : {}),
        team_leader: teamLeader,
        // is_active hanya ditimpa jika dikirim eksplisit, agar edit nama tidak
        // diam-diam meng-aktifkan-lagi sales yang sudah dinonaktifkan.
        ...(req.body.is_active !== undefined ? { is_active: Boolean(req.body.is_active) } : {}),
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
    })
    // Mutasi sales lama dilakukan di halaman Susunan Tim; di sini hanya
    // memastikan sales baru tidak jatuh ke "Belum terpetakan".
    await addSalesToCurrentMonth(prisma, name, teamLeader)
    res.json({ message: 'Data Sales tersimpan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function updateSalespersonStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID tidak valid' })
    const is_active = Boolean(req.body.is_active)
    const row = await prisma.showroom_salespeople.update({
      where: { id },
      data: { is_active },
    })
    res.json({ message: is_active ? 'Sales diaktifkan' : 'Sales dinonaktifkan', data: row })
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
    // P2003 = foreign key constraint; P2025 = record tidak ada. Pesan ramah.
    if (error?.code === 'P2003') {
      return res.status(409).json({
        error: 'Sales ini masih terkait data lain sehingga tidak bisa dihapus. Nonaktifkan saja untuk menyimpan riwayat.',
      })
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Data Sales tidak ditemukan' })
    }
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
    const wb = safeReadExcel(req.file.path)
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
    const wb = safeReadExcel(req.file.path)
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
