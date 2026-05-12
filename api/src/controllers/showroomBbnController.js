import fs from 'fs'
import path from 'path'
import xlsx from 'xlsx'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value) {
  const normalized = cleanText(value).replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function upper(value = '') { return cleanText(value).toUpperCase() }

function importValue(value, fallback = 0) {
  const parsed = parseNumber(value)
  return parsed > 0 ? parsed : fallback
}

function calculateTotal(row) {
  return row.notice + row.pnbp_stck + row.jasa + row.jasa_area + row.fee_pusat
}

function parseCity(value) {
  const text = cleanText(value)
  const match = text.match(/^\[(\d+)\]\s*(.+)$/)
  return { city_code: match?.[1] || null, city_name: match?.[2] || text }
}

export function parseBbnHtml(html, sourceFile = null) {
  const rows = []
  const rowMatches = String(html).match(/<tr[\s\S]*?<\/tr>/gi) || []
  for (const row of rowMatches) {
    const fields = {}
    const cellMatches = row.match(/<td[^>]*data-field="[^"]+"[\s\S]*?<\/td>/gi) || []
    for (const cell of cellMatches) {
      const field = cell.match(/data-field="([^"]+)"/)?.[1]
      if (!field) continue
      fields[field] = cleanText(cell)
    }
    if (!fields.product_template_id || !fields.city_id) continue
    const city = parseCity(fields.city_id)
    const total = parseNumber(fields.total)
    rows.push({
      product_code: cleanText(fields.product_template_id).toUpperCase(),
      city_code: city.city_code,
      city_name: city.city_name,
      notice: parseNumber(fields.notice),
      pnbp_stck: parseNumber(fields.proses),
      jasa: parseNumber(fields.jasa),
      jasa_area: parseNumber(fields.jasa_area),
      fee_pusat: parseNumber(fields.fee_pusat),
      total,
      source_file: sourceFile,
    })
  }
  return rows.filter((row) => row.product_code && row.city_name)
}

function normalizeBbnRow(row, sourceFile) {
  const product = cleanText(row.Product || row.product || row['Kode Unit'] || row.product_code).toUpperCase()
  const cityRaw = cleanText(row.City || row.city || row.Area || row.area || row.city_name)
  if (!product || !cityRaw) return null
  const city = parseCity(cityRaw)
  const notice = parseNumber(row.Notice ?? row.notice)
  const pnbp = parseNumber(row['PNBP dan STCK'] ?? row.PNBP ?? row.proses ?? row.pnbp_stck)
  const jasa = parseNumber(row.Jasa ?? row.jasa)
  const jasaArea = parseNumber(row['Jasa Area'] ?? row.jasa_area)
  const feePusat = parseNumber(row['Fee Pusat'] ?? row.fee_pusat)
  const total = parseNumber(row.Total ?? row.total) || notice + pnbp + jasa + jasaArea + feePusat
  return { product_code: product, city_code: city.city_code, city_name: city.city_name, notice, pnbp_stck: pnbp, jasa, jasa_area: jasaArea, fee_pusat: feePusat, total, source_file: sourceFile }
}

function dedupeBbnRows(rows) {
  const byKey = new Map()
  for (const row of rows) {
    byKey.set(`${row.product_code}|${row.city_name}`, row)
  }
  return Array.from(byKey.values())
}

export function parseBbnWorkbook(filePath, sourceFile = null) {
  const wb = xlsx.readFile(filePath)
  const sheetName = wb.SheetNames.find((name) => name.toLowerCase() === 'notice') || wb.SheetNames[0]
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
  return rows.map((row) => normalizeBbnRow(row, sourceFile)).filter(Boolean)
}

function parseBbnFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return dedupeBbnRows(parseBbnWorkbook(file.path, file.originalname))
  const html = fs.readFileSync(file.path, 'utf8')
  return dedupeBbnRows(parseBbnHtml(html, file.originalname))
}

export async function getBbnPrices(req, res, next) {
  try {
    const { page = 1, limit = 100, search, city } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = {}
    if (city) where.city_name = { contains: String(city) }
    if (search) {
      where.OR = [
        { product_code: { contains: String(search).toUpperCase() } },
        { city_name: { contains: String(search) } },
        { city_code: { contains: String(search) } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.showroom_bbn_prices.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: [{ product_code: 'asc' }, { city_name: 'asc' }] }),
      prisma.showroom_bbn_prices.count({ where }),
    ])
    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) { next(error) }
}

export async function getBbnPriceSummary(req, res, next) {
  try {
    const [total, latest, cities] = await Promise.all([
      prisma.showroom_bbn_prices.count(),
      prisma.showroom_bbn_prices.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
      prisma.showroom_bbn_prices.groupBy({ by: ['city_name'] }),
    ])
    res.json({ total, cityCount: cities.length, latestSyncedAt: latest?.synced_at || null, sourceFile: latest?.source_file || null })
  } catch (error) { next(error) }
}

export async function previewBbnPrices(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const rows = parseBbnFile(req.file)
    fs.unlinkSync(req.file.path)
    res.json({ total: rows.length, sample: rows.slice(0, 10) })
  } catch (error) { next(error) }
}

export async function uploadBbnPrices(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const rows = parseBbnFile(req.file)
    fs.unlinkSync(req.file.path)
    if (!rows.length) return res.status(400).json({ error: 'Data BBN tidak ditemukan di file' })

    const result = await withImportLock('showroom:bbn', async () => {
    let created = 0
    let updated = 0
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const existing = await tx.showroom_bbn_prices.findUnique({ where: { product_code_city_name: { product_code: row.product_code, city_name: row.city_name } } })
        const data = existing
          ? {
              ...row,
              notice: importValue(row.notice, existing.notice),
              pnbp_stck: importValue(row.pnbp_stck, existing.pnbp_stck),
              jasa: importValue(row.jasa, existing.jasa),
              jasa_area: importValue(row.jasa_area, existing.jasa_area),
              fee_pusat: importValue(row.fee_pusat, existing.fee_pusat),
              synced_at: new Date(),
            }
          : { ...row, total: calculateTotal(row) }
        data.total = calculateTotal(data)

        await tx.showroom_bbn_prices.upsert({
          where: { product_code_city_name: { product_code: row.product_code, city_name: row.city_name } },
          create: data,
          update: data,
        })
        if (existing) updated += 1
        else created += 1
      }
    }, { timeout: 60000 })
    return { message: 'Master BBN berhasil diimport', total: rows.length, created, updated }
    })
    res.json(result)
  } catch (error) { next(error) }
}

export async function updateBbnPriceAdjustment(req, res, next) {
  try {
    const productCode = upper(req.body.product_code)
    const cityName = cleanText(req.body.city_name || 'KAB. KETAPANG')
    const feePusat = parseNumber(req.body.fee_pusat)
    if (!productCode || !cityName) return res.status(400).json({ error: 'Kode unit dan area wajib diisi' })
    const existing = await prisma.showroom_bbn_prices.findFirst({ where: { product_code: productCode, city_name: { contains: cityName.replace(/^\[\d+\]\s*/, '') } } })
    if (!existing) return res.status(404).json({ error: 'Master BBN tidak ditemukan untuk kode unit dan area tersebut' })
    const total = existing.notice + existing.pnbp_stck + existing.jasa + existing.jasa_area + feePusat
    const row = await prisma.showroom_bbn_prices.update({
      where: { id: existing.id },
      data: { fee_pusat: feePusat, total, synced_at: new Date() },
    })
    res.json({ message: 'Biaya tambahan BBN tersimpan', data: row })
  } catch (error) { next(error) }
}

export async function createBbnPrice(req, res, next) {
  try {
    const productCode = upper(req.body.product_code)
    const cityName = cleanText(req.body.city_name)
    const cityCode = cleanText(req.body.city_code) || null
    const notice = parseNumber(req.body.notice)
    const pnbpStck = parseNumber(req.body.pnbp_stck)
    const jasa = parseNumber(req.body.jasa)
    const jasaArea = parseNumber(req.body.jasa_area)
    const feePusat = parseNumber(req.body.fee_pusat)

    if (!productCode || !cityName) return res.status(400).json({ error: 'Kode unit dan area wajib diisi' })
    const total = notice + pnbpStck + jasa + jasaArea + feePusat

    const row = await prisma.showroom_bbn_prices.create({
      data: {
        product_code: productCode,
        city_code: cityCode,
        city_name: cityName,
        notice,
        pnbp_stck: pnbpStck,
        jasa,
        jasa_area: jasaArea,
        fee_pusat: feePusat,
        total,
        source_file: 'MANUAL',
        synced_at: new Date(),
      },
    })

    res.status(201).json({ message: 'Master BBN berhasil ditambahkan', data: row })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Kode unit dan area sudah ada' })
    next(error)
  }
}

export async function updateBbnPrice(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID Master BBN tidak valid' })

    const productCode = upper(req.body.product_code)
    const cityName = cleanText(req.body.city_name)
    const cityCode = cleanText(req.body.city_code) || null
    const notice = parseNumber(req.body.notice)
    const pnbpStck = parseNumber(req.body.pnbp_stck)
    const jasa = parseNumber(req.body.jasa)
    const jasaArea = parseNumber(req.body.jasa_area)
    const feePusat = parseNumber(req.body.fee_pusat)

    if (!productCode || !cityName) return res.status(400).json({ error: 'Kode unit dan area wajib diisi' })
    const total = notice + pnbpStck + jasa + jasaArea + feePusat

    const row = await prisma.showroom_bbn_prices.update({
      where: { id },
      data: {
        product_code: productCode,
        city_code: cityCode,
        city_name: cityName,
        notice,
        pnbp_stck: pnbpStck,
        jasa,
        jasa_area: jasaArea,
        fee_pusat: feePusat,
        total,
        synced_at: new Date(),
      },
    })

    res.json({ message: 'Master BBN berhasil diupdate', data: row })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Master BBN tidak ditemukan' })
    if (error.code === 'P2002') return res.status(409).json({ error: 'Kode unit dan area sudah dipakai di baris lain' })
    next(error)
  }
}
