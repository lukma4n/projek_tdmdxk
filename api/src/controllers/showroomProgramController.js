import fs from 'fs'
import path from 'path'
import xlsx from 'xlsx'
import { PDFParse } from 'pdf-parse'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
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

  // If old parser found nothing, try coordinate-based V2 parser
  // for PDFs with multi-column table layouts
  if (rows.length === 0) {
    const v2Rows = await parseMdProgramPdfV2(filePath, sourceFile)
    return v2Rows
  }

  const seen = new Set()
  return rows.filter((row) => {
    const key = [row.product_code, row.sale_type, row.document_number, row.period_start?.toISOString()].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Coordinate-based PDF parser for LMC PDFs with table layouts
 * that break the simple text stream extraction.
 */
export async function parseMdProgramPdfV2(filePath, sourceFile = null) {
  const buffer = fs.readFileSync(filePath)

  // Extract metadata using pdf-parse (reads all pages for headers)
  const parser = new PDFParse({ data: buffer })
  const metaResult = await parser.getText()
  await parser.destroy()
  const metaText = metaResult.text
  const documentNumber = metaText.match(/LMC\.[A-Z/]+\/\d+\/[IVXLCDM]+\/20\d{2}/)?.[0] || sourceFile || 'PDF'
  const { period_start, period_end } = parsePeriod(metaText)
  const programName = metaText.match(/Perihal\s*:\s*([^\n]+)/i)?.[1]?.trim() || 'Sales Discount Reguler'

  // Extract table data using pdfjs-dist (page 1 for the table)
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const page = await pdf.getPage(1)
  const textContent = await page.getTextContent()
  await pdf.destroy()

  // Group text items by Y-coordinate (table row)
  // First, sort all items by Y so items at the same row are consecutive
  const validItems = textContent.items.filter((it) => it.str.trim() !== '')
  validItems.sort((a, b) => b.transform[5] - a.transform[5]) // Sort top-to-bottom

  const threshold = 5
  const yGroups = []
  let currentGroup = []
  let currentY = null

  for (const item of validItems) {
    const y = item.transform[5]
    if (currentY === null || Math.abs(y - currentY) > threshold) {
      if (currentGroup.length > 0) yGroups.push({ y: currentY, items: currentGroup })
      currentGroup = [item]
      currentY = y
    } else {
      currentGroup.push(item)
    }
  }
  if (currentGroup.length > 0) yGroups.push({ y: currentY, items: currentGroup })

  // Identify product name rows and data rows
  const productNameRows = []
  const dataRows = []
  const codeRows = []

  for (const group of yGroups) {
    // Sort items within row by X
    group.items.sort((a, b) => a.transform[4] - b.transform[4])
    const texts = group.items.map((it) => it.str.trim()).join(' ')
    const xPositions = group.items.map((it) => it.transform[4])

    // Check if this is a product name row (contains series names at x≈62)
    const hasProductName = group.items.some((it) => it.transform[4] < 150 && /Series|Rakitan/.test(it.str))
    if (hasProductName) {
      productNameRows.push({ y: group.y, items: group.items, texts })
      continue
    }

    // Check if this is a product code row (items at x≈62 that look like codes)
    const codeItems = group.items.filter((it) => it.transform[4] < 150 && /^[A-Z0-9,\s]+$/.test(it.str))
    if (codeItems.length > 0 && extractCodes(codeItems.map((it) => it.str).join(' ')).length > 0) {
      codeRows.push({ y: group.y, items: group.items, texts })
      continue
    }

    // Check if this is a data row (has numbers at x>300)
    const hasNumbers = group.items.some((it) => it.transform[4] > 300 && /\d{1,3}(\.\d{3})+/.test(it.str))
    const hasSaleType = group.items.some((it) => /Cash|Credit/.test(it.str))
    if (hasNumbers || hasSaleType) {
      dataRows.push({ y: group.y, items: group.items, texts })
      continue
    }
  }

  // Build final rows by matching product names with data rows
  const finalRows = []

  for (const dataRow of dataRows) {
    // Find closest product name row above this data row
    let productNameRow = null
    let minDiff = Infinity
    for (const pnRow of productNameRows) {
      const diff = pnRow.y - dataRow.y
      if (diff > 0 && diff < minDiff && diff < 25) {
        minDiff = diff
        productNameRow = pnRow
      }
    }

    // Find closest code row below this data row
    let codeRow = null
    let minCodeDiff = Infinity
    for (const cRow of codeRows) {
      const diff = dataRow.y - cRow.y
      if (diff > 0 && diff < minCodeDiff && diff < 25) {
        minCodeDiff = diff
        codeRow = cRow
      }
    }

    if (!productNameRow || !codeRow) continue

    // Extract product codes
    const codeTexts = codeRow.items.filter((it) => it.transform[4] < 150).map((it) => it.str)
    const codes = extractCodes(codeTexts.join(' '))
    if (codes.length === 0) continue

    // Extract data from the data row
    const items = dataRow.items
    const noItem = items.find((it) => it.transform[4] < 60 && /^\d+$/.test(it.str))
    const saleTypeItem = items.find((it) => it.transform[4] > 260 && it.transform[4] < 310 && /Cash|Credit/.test(it.str))
    // Find all number items in the row sorted by x
    const numberItems = items
      .filter((it) => /\d{1,3}(\.\d{3})+/.test(it.str))
      .sort((a, b) => a.transform[4] - b.transform[4])
    
    // Assign by x position: AHM < MD < D < Total
    const ahmItem = numberItems.find((it) => it.transform[4] > 320 && it.transform[4] < 360)
    const mdItem = numberItems.find((it) => it.transform[4] > 370 && it.transform[4] < 410)
    const dItem = numberItems.find((it) => it.transform[4] > 410 && it.transform[4] < 450)
    const totalItem = numberItems.find((it) => it.transform[4] > 450 && it.transform[4] < 490)
    const areaItem = items.find((it) => it.transform[4] > 500 && /All Area/.test(it.str))

    const ahmDiscount = ahmItem ? numberValue(ahmItem.str) : 0
    const mdDiscount = mdItem ? numberValue(mdItem.str) : 0
    const dealerDiscount = dItem ? numberValue(dItem.str) : 0
    const totalDiscount = totalItem ? numberValue(totalItem.str) : (ahmDiscount + mdDiscount + dealerDiscount)
    const saleType = saleTypeItem ? programSaleTypes(saleTypeItem.str) : ['CASH']

    for (const productCode of codes) {
      for (const st of saleType) {
        finalRows.push({
          product_code: productCode,
          sale_type: st,
          ahm_discount: ahmDiscount,
          md_discount: mdDiscount,
          dealer_discount: dealerDiscount,
          total_discount: totalDiscount,
          area: areaItem ? areaItem.str : 'All Area',
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

  // Deduplicate
  const seen = new Set()
  return finalRows.filter((row) => {
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
    const where = { is_active: true }
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
      prisma.showroom_leasing_tac_programs.count(),
      prisma.showroom_md_programs.count({ where: { is_active: true } }),
      prisma.showroom_leasing_tac_programs.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
      prisma.showroom_md_programs.findFirst({ where: { is_active: true }, orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
    ])
    const latest = [latestLeasing, latestMd]
      .filter(Boolean)
      .sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at))[0]
    res.json({ leasingTotal, mdTotal, latestSyncedAt: latest?.synced_at || null, sourceFile: latest?.source_file || null })
  } catch (error) { next(error) }
}

async function resolveSeriesKey(productCode, fallbackText = '') {
  const text = `${productCode || ''} ${fallbackText || ''}`.toUpperCase()
  const aliases = await prisma.showroom_series_aliases.findMany({ where: { is_active: true }, orderBy: [{ priority: 'asc' }, { keyword: 'desc' }] })
  return aliases.find((alias) => text.includes(alias.keyword))?.series_key || upper(fallbackText || productCode)
}

export async function getDiscountTable(req, res, next) {
  try {
    const { series_key, leasing, tenor, sale_type } = req.query
    const today = new Date()

    const periodFilter = {
      OR: [
        { period_start: null },
        { period_start: { lte: today }, period_end: null },
        { period_start: { lte: today }, period_end: { gte: today } },
      ],
    }

    const [mdPrograms, tacPrograms, dealerBurdens, otrPrices] = await Promise.all([
      prisma.showroom_md_programs.findMany({
        where: { is_active: true, ...periodFilter },
        orderBy: [{ product_code: 'asc' }, { sale_type: 'asc' }, { period_start: 'desc' }],
      }),
      prisma.showroom_leasing_tac_programs.findMany({
        where: { is_active: true, amount: { gt: 0 }, ...periodFilter, ...(leasing && { leasing: upper(leasing) }), ...(tenor && { tenor: parseInt(tenor) }) },
        orderBy: [{ amount: 'desc' }, { leasing: 'asc' }, { series_key: 'asc' }, { dp_category: 'asc' }, { tenor: 'asc' }],
      }),
      prisma.showroom_dealer_burdens.findMany({ where: { is_active: true }, orderBy: { series_key: 'asc' } }),
      prisma.showroom_otr_prices.findMany({ select: { product_code: true, model_name: true, description: true } }),
    ])

    const seriesMatch = (a, b) =>
      a === b ||
      a?.toUpperCase().includes(b?.toUpperCase()) ||
      b?.toUpperCase().includes(a?.toUpperCase())

    const findBestBurden = (resolved) => {
      const matched = dealerBurdens.filter((b) => seriesMatch(b.series_key, resolved))
      if (matched.length === 0) return null
      if (matched.length === 1) return matched[0]
      return matched.sort((a, b) => {
        const aExact = a.series_key === resolved ? 1 : 0
        const bExact = b.series_key === resolved ? 1 : 0
        if (bExact !== aExact) return bExact - aExact
        return (b.cash_amount + b.credit_amount) - (a.cash_amount + a.credit_amount)
      })[0]
    }

    const findTac = (resolved, targetLeasing) => {
      const allTac = tacPrograms.filter((t) => seriesMatch(t.series_key, resolved))
      const leasingSet = new Set(allTac.map((t) => t.leasing))
      const leasingAvailable = Array.from(leasingSet)
      const pick = targetLeasing ? upper(targetLeasing) : leasingAvailable[0]
      if (!pick) return { tacLt15: null, tacGt15: null, leasingAvailable }
      const tacLt15 = allTac.find((t) => t.leasing === pick && t.dp_category === 'LT_15') || null
      const tacGt15 = allTac.find((t) => t.leasing === pick && t.dp_category === 'GT_15') || null
      return { tacLt15, tacGt15, leasingAvailable }
    }

    // Resolve all OTR prices to series, deduplicate by series
    const seriesMap = new Map()
    for (const otr of otrPrices) {
      const resolved = await resolveSeriesKey(otr.product_code, `${otr.model_name || ''} ${otr.description || ''}`)
      if (series_key && !resolved?.toUpperCase().includes(upper(series_key)) && !otr.product_code?.toUpperCase().includes(upper(series_key))) continue
      if (!seriesMap.has(resolved)) {
        seriesMap.set(resolved, otr.product_code)
      }
    }

    // Build rows: for each unique series, generate CASH and/or KREDIT rows
    const rows = []
    const saleTypes = sale_type ? [upper(sale_type)] : ['CASH', 'KREDIT']

    for (const [resolved, productCode] of seriesMap) {
      const burden = findBestBurden(resolved)

      for (const st of saleTypes) {
        const md = mdPrograms.find((m) => m.product_code === productCode && m.sale_type === st) || null
        const mdPeriod = md || mdPrograms.find((m) => m.sale_type === st)

        let tacLt15 = null
        let tacGt15 = null
        let leasingAvailable = []

        if (st === 'KREDIT') {
          const tac = findTac(resolved, leasing)
          tacLt15 = tac.tacLt15
          tacGt15 = tac.tacGt15
          leasingAvailable = tac.leasingAvailable
        }

        const tacAmount = tacLt15?.amount || tacGt15?.amount || 0
        const burdenAmount = st === 'CASH' ? (burden?.cash_amount || 0) : (burden?.credit_amount || 0)
        const mdTotal = md?.total_discount || 0

        rows.push({
          product_code: productCode,
          series_key: resolved,
          sale_type: st,
          program_name: md?.program_name || '-',
          document_number: md?.document_number || '-',
          period_start: mdPeriod?.period_start || null,
          period_end: mdPeriod?.period_end || null,
          ahm_discount: md?.ahm_discount || 0,
          md_discount: md?.md_discount || 0,
          dealer_discount: md?.dealer_discount || 0,
          total_program_discount: mdTotal,
          dealer_burden_cash: burden?.cash_amount || 0,
          dealer_burden_credit: burden?.credit_amount || 0,
          leasing_available: st === 'KREDIT' ? leasingAvailable : [],
          tac_lt15: tacLt15 ? { leasing: tacLt15.leasing, tenor: tacLt15.tenor, amount: tacLt15.amount, dp_category: 'LT_15' } : null,
          tac_gt15: tacGt15 ? { leasing: tacGt15.leasing, tenor: tacGt15.tenor, amount: tacGt15.amount, dp_category: 'GT_15' } : null,
          total_discount: mdTotal + tacAmount + burdenAmount,
        })
      }
    }

    // Sort by series then sale_type
    rows.sort((a, b) => a.series_key.localeCompare(b.series_key) || a.sale_type.localeCompare(b.sale_type))

    const mdPeriod = mdPrograms.find((m) => m.period_start)
    res.json({
      data: rows,
      total: rows.length,
      period: mdPeriod ? {
        start: mdPeriod.period_start,
        end: mdPeriod.period_end,
        document_number: mdPeriod.document_number,
        source_file: mdPeriod.source_file,
      } : null,
      filters: { series_key, leasing, tenor, sale_type },
    })
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
      // Deactivate all existing MD programs before importing new ones
      // This ensures only the latest imported program is active
      if (rows.md.length > 0) {
        await tx.showroom_md_programs.updateMany({
          where: { is_active: true },
          data: { is_active: false },
        })
      }
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
