import xlsx from 'xlsx'
import { prisma } from '../config/db.js'

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getDealerBurdens(req, res, next) {
  try {
    const { search } = req.query
    const where = {}
    if (search) where.series_key = { contains: upper(search) }
    const rows = await prisma.showroom_dealer_burdens.findMany({
      where,
      orderBy: { series_key: 'asc' },
    })
    res.json({ data: rows })
  } catch (error) {
    next(error)
  }
}

export async function upsertDealerBurden(req, res, next) {
  try {
    const seriesKey = upper(req.body.series_key)
    const cashAmount = num(req.body.cash_amount)
    const creditAmount = num(req.body.credit_amount)
    if (!seriesKey) return res.status(400).json({ error: 'Series wajib diisi' })

    const row = await prisma.showroom_dealer_burdens.upsert({
      where: { series_key: seriesKey },
      create: {
        series_key: seriesKey,
        cash_amount: cashAmount,
        credit_amount: creditAmount,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
      update: {
        cash_amount: cashAmount,
        credit_amount: creditAmount,
        is_active: req.body.is_active ?? true,
        source_file: clean(req.body.source_file) || 'MANUAL',
        synced_at: new Date(),
      },
    })
    res.json({ message: 'Beban Dealer tersimpan', data: row })
  } catch (error) {
    next(error)
  }
}

export async function getDealerBurdenSummary(req, res, next) {
  try {
    const [total, latest] = await Promise.all([
      prisma.showroom_dealer_burdens.count(),
      prisma.showroom_dealer_burdens.findFirst({
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

export async function previewDealerBurdenImport(req, res, next) {
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
        series_key: upper(row.SERIES),
        cash_amount: num(row['DISKON (CASH) (beban dealer+HC)']),
        credit_amount: num(row['DISKON (CREDIT) (Beban dealer +HC)']),
      }))
      .filter((row) => row.series_key)

    res.json({ total: rows.length, sample: rows.slice(0, 5) })
  } catch (error) {
    next(error)
  }
}

export async function uploadDealerBurdenImport(req, res, next) {
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
        series_key: upper(row.SERIES),
        cash_amount: num(row['DISKON (CASH) (beban dealer+HC)']),
        credit_amount: num(row['DISKON (CREDIT) (Beban dealer +HC)']),
      }))
      .filter((row) => row.series_key)

    // Replace All: delete existing, insert new
    await prisma.$transaction(async (tx) => {
      await tx.showroom_dealer_burdens.deleteMany({})
      for (const row of rows) {
        await tx.showroom_dealer_burdens.create({
          data: {
            series_key: row.series_key,
            cash_amount: row.cash_amount,
            credit_amount: row.credit_amount,
            is_active: true,
            source_file: req.file.originalname || 'IMPORT',
            synced_at: new Date(),
          },
        })
      }
    })

    res.json({
      message: 'Beban Dealer berhasil diimport',
      total: rows.length,
      imported: rows.length,
    })
  } catch (error) {
    next(error)
  }
}
