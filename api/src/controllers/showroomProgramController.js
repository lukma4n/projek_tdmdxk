import fs from 'fs'
import path from 'path'
import xlsx from 'xlsx'
import { PDFParse } from 'pdf-parse'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

function numberValue(value) {
  const parsed = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function programSaleTypes(value) {
  const normalized = upper(value)
  if (normalized.includes('CASH') && normalized.includes('CREDIT')) return ['CASH', 'KREDIT']
  if (normalized.includes('CREDIT')) return ['KREDIT']
  return ['CASH']
}

function monthNumber(value) {
  const months = { JANUARI: 0, FEBRUARI: 1, MARET: 2, APRIL: 3, MEI: 4, JUNI: 5, JULI: 6, AGUSTUS: 7, SEPTEMBER: 8, OKTOBER: 9, NOVEMBER: 10, DESEMBER: 11 }
  return months[upper(value)] ?? null
}

function parsePeriod(text) {
  const match = text.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i)
  if (!match) return { period_start: new Date('1970-01-01'), period_end: null }
  const month = monthNumber(match[3])
  if (month === null) return { period_start: new Date('1970-01-01'), period_end: null }
  return {
    period_start: new Date(Date.UTC(Number(match[4]), month, Number(match[1]))),
    period_end: new Date(Date.UTC(Number(match[4]), month, Number(match[2]))),
  }
}

function extractCodes(prefix) {
  const blacklist = new Set(['ALL', 'RAKITAN', 'SERIES', 'DELUXE', 'SMART', 'KEY', 'STREET', 'VARIO', 'BEAT', 'SUPRA', 'GTR', 'ADV'])
  return prefix
    .split(/[\s,;]+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter((token) => /[A-Z]/.test(token) && token.length >= 2 && token.length <= 6 && !blacklist.has(token))
}

function parseLeasingPrograms(filePath, sourceFile) {
  const wb = xlsx.readFile(filePath)
  const ws = wb.Sheets.TAC
  if (!ws) return []
  return xlsx.utils.sheet_to_json(ws, { defval: '' })
    .map((row) => ({
      product_code: upper(row.Product),
      series: clean(row.Series) || null,
      tenor: parseInt(row.TENOR),
      leasing: upper(row.LEASING),
      finco_subsidy: numberValue(row['Diskon Finco']),
      source_file: sourceFile,
    }))
    .filter((row) => row.product_code && row.leasing && Number.isFinite(row.tenor))
}

function parseMdPrograms(filePath, sourceFile) {
  const wb = xlsx.readFile(filePath)
  const ws = wb.Sheets.SCP
  if (!ws) return []
  return xlsx.utils.sheet_to_json(ws, { defval: '' })
    .map((row) => ({
      product_code: upper(row.Product),
      sale_type: upper(row['Tipe Jualan']),
      ahm_discount: numberValue(row['Diskon AHM']),
      md_discount: numberValue(row['Diskon MD']),
      dealer_discount: numberValue(row['Diskon Dealer']),
      total_discount: numberValue(row['Total Diskon']),
      area: 'All Area',
      program_name: 'SCP Workbook',
      document_number: 'WORKBOOK',
      period_start: new Date('1970-01-01'),
      period_end: null,
      is_active: true,
      source_file: sourceFile,
    }))
    .filter((row) => row.product_code && row.sale_type)
}

export async function parseMdProgramPdf(filePath, sourceFile = null) {
  const buffer = fs.readFileSync(filePath)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()
  const { text } = result
  const documentNumber = text.match(/LMC\.[A-Z/]+\/\d+\/[IVXLCDM]+\/20\d{2}/)?.[0] || sourceFile || 'PDF'
  const { period_start, period_end } = parsePeriod(text)
  const programName = text.match(/Perihal\s*:\s*([^\n]+)/i)?.[1]?.trim() || 'Sales Discount Reguler'
  const normalized = text.replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ')
  const rows = []
  const rowRegex = /([A-Z0-9,;\s]+?)\s+(Cash\s*&\s*Credit|Cash|Credit)\s+((?:\d{1,3}(?:\.\d{3})+\s+){2,3}\d{1,3}(?:\.\d{3})+)\s+All Area/gi
  let match
  while ((match = rowRegex.exec(normalized))) {
    const codes = extractCodes(match[1])
    const saleTypes = programSaleTypes(match[2])
    const amounts = match[3].trim().split(/\s+/).map(numberValue)
    const values = amounts.length === 3
      ? { ahm_discount: 0, md_discount: amounts[0], dealer_discount: amounts[1], total_discount: amounts[2] }
      : { ahm_discount: amounts[0], md_discount: amounts[1], dealer_discount: amounts[2], total_discount: amounts[3] }
    for (const productCode of codes) {
      for (const saleType of saleTypes) {
        rows.push({
          product_code: productCode,
          sale_type: saleType,
          ...values,
          area: 'All Area',
          program_name: programName,
          document_number: documentNumber,
          period_start,
          period_end,
          is_active: true,
          source_file: sourceFile,
        })
      }
    }
  }
  const seen = new Set()
  return rows.filter((row) => {
    const key = [row.product_code, row.sale_type, row.document_number, row.period_start?.toISOString()].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseProgramWorkbook(filePath, sourceFile = null) {
  return { leasing: parseLeasingPrograms(filePath, sourceFile), md: parseMdPrograms(filePath, sourceFile) }
}

async function parseProgramFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (ext === '.pdf') return { leasing: [], md: await parseMdProgramPdf(file.path, file.originalname) }
  return parseProgramWorkbook(file.path, file.originalname)
}

export async function getLeasingPrograms(req, res, next) {
  try {
    const { page = 1, limit = 100, search, leasing, tenor } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = {}
    if (leasing) where.leasing = upper(leasing)
    if (tenor) where.tenor = parseInt(tenor)
    if (search) {
      where.OR = [
        { product_code: { contains: upper(search) } },
        { series: { contains: String(search) } },
        { leasing: { contains: upper(search) } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.showroom_leasing_programs.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: [{ product_code: 'asc' }, { leasing: 'asc' }, { tenor: 'asc' }] }),
      prisma.showroom_leasing_programs.count({ where }),
    ])
    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) { next(error) }
}

export async function getMdPrograms(req, res, next) {
  try {
    const { page = 1, limit = 100, search, sale_type } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = {}
    if (sale_type) where.sale_type = upper(sale_type)
    if (search) where.product_code = { contains: upper(search) }
    const [data, total] = await Promise.all([
      prisma.showroom_md_programs.findMany({ where, skip: (pageInt - 1) * limitInt, take: limitInt, orderBy: [{ product_code: 'asc' }, { period_start: 'desc' }, { sale_type: 'asc' }] }),
      prisma.showroom_md_programs.count({ where }),
    ])
    res.json({ data, pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) } })
  } catch (error) { next(error) }
}

export async function getProgramSummary(req, res, next) {
  try {
    const [leasingTotal, mdTotal, latestLeasing, latestMd] = await Promise.all([
      prisma.showroom_leasing_programs.count(),
      prisma.showroom_md_programs.count(),
      prisma.showroom_leasing_programs.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
      prisma.showroom_md_programs.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
    ])
    res.json({ leasingTotal, mdTotal, latestSyncedAt: latestLeasing?.synced_at || latestMd?.synced_at || null, sourceFile: latestLeasing?.source_file || latestMd?.source_file || null })
  } catch (error) { next(error) }
}

export async function previewPrograms(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const rows = await parseProgramFile(req.file)
    fs.unlinkSync(req.file.path)
    res.json({ leasingTotal: rows.leasing.length, mdTotal: rows.md.length, leasingSample: rows.leasing.slice(0, 5), mdSample: rows.md.slice(0, 5) })
  } catch (error) { next(error) }
}

export async function uploadPrograms(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File wajib diupload' })
    const rows = await parseProgramFile(req.file)
    fs.unlinkSync(req.file.path)
    const result = await withImportLock('showroom:program', async () => {
    let leasingCreated = 0
    let leasingUpdated = 0
    let mdCreated = 0
    let mdUpdated = 0
    await prisma.$transaction(async (tx) => {
      for (const row of rows.leasing) {
        const where = { product_code_tenor_leasing: { product_code: row.product_code, tenor: row.tenor, leasing: row.leasing } }
        const existing = await tx.showroom_leasing_programs.findUnique({ where })
        await tx.showroom_leasing_programs.upsert({ where, create: row, update: { ...row, synced_at: new Date() } })
        if (existing) leasingUpdated += 1
        else leasingCreated += 1
      }
      for (const row of rows.md) {
        const where = { product_code_sale_type_document_number_period_start: { product_code: row.product_code, sale_type: row.sale_type, document_number: row.document_number, period_start: row.period_start } }
        const existing = await tx.showroom_md_programs.findUnique({ where })
        await tx.showroom_md_programs.upsert({ where, create: row, update: { ...row, synced_at: new Date() } })
        if (existing) mdUpdated += 1
        else mdCreated += 1
      }
    }, { timeout: 60000 })
    return { message: 'Master program berhasil diimport', leasing: { total: rows.leasing.length, created: leasingCreated, updated: leasingUpdated }, md: { total: rows.md.length, created: mdCreated, updated: mdUpdated } }
    })
    res.json(result)
  } catch (error) { next(error) }
}
