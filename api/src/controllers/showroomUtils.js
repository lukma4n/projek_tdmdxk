/**
 * Shared utilities for showroom controllers.
 */

import fs from 'fs/promises'
import { execFileSync } from 'child_process'

export const PRODUCT_CODE_ALIASES = {
  MV0: 'MV1',
}

export const DEFAULT_BATTERY_BY_SERIES = {
  'BEAT SPORTY': 'GTZ5S',
  'BEAT STREET': 'GTZ5S',
  GENIO: 'GTZ4V',
  REVO: 'GTZ4V',
  SCOOPY: 'GTZ5S',
  VARIO125: 'GTZ5S',
  'SUPRA X': 'GTZ5S',
  VERZA: 'GTZ6V',
  CRF150: 'GTZ6V',
  CBR150: 'GTZ6V',
  'SUPRA GTR150': 'GTZ6V',
  'VARIO160 CBS': 'GTZ6V',
  'VARIO160 ABS': 'GTZ6V',
  'ADV160 CBS': 'GTZ6V',
  'ADV160 ABS': 'GTZ6V',
  'PCX160 CBS': 'GTZ6V',
  'PCX160 ABS': 'GTZ6V',
  'PCX160 ROADSYNC': 'GTZ6V',
  CUV: 'GTZ4V',
}

export const NO_BATTERY_SERIES = new Set(['ICON'])
export const KSU_STATUSES = ['belum_dicek', 'belum_lengkap', 'lengkap', 'sudah_diserahkan']
export const BATTERY_TYPES = ['GTZ4V', 'GTZ5S', 'GTZ6V']

export function parseOtrEffectiveDate(text) {
  const match = text.match(/Berlaku sejak\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!match) return null
  const months = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  }
  const month = months[match[2].toLowerCase()]
  if (month === undefined) return null
  return new Date(Date.UTC(parseInt(match[3]), month, parseInt(match[1])))
}

export function normalizeLocation(value) {
  const location = value ? String(value).trim() : null
  const stockPrefix = 'Physical Locations / DXK / Stock / '
  const locationMap = {
    'Physical Locations / DXK / Stock': 'Showroom',
    'Physical Locations / DXK / Stock / DXK-POS002 POS Melano': 'Pos Melano',
    'Physical Locations / DXK / Stock / DXK-WHU005 Gudang Sepakat': 'Gudang',
    'Physical Locations / DXK / Stock / DXK-POS004 POS Kendawangan': 'Pos Kendawangan',
    'Physical Locations / DXK / Stock / DXK-POS003 POS Sandai': 'Pos Sandai',
  }

  if (location?.startsWith(stockPrefix)) {
    return locationMap[location] || location.slice(stockPrefix.length).replace(/^DXK-[A-Z0-9]+\s+/, '')
  }
  return locationMap[location] || location
}

export function normalizeDocumentLocation(value) {
  const location = value ? String(value).trim() : null
  const locationMap = {
    'DXKN-1': 'Cabang',
    'HHO - PASAR MINGGU': 'Ho Pasar Minggu',
  }
  return locationMap[location] || location
}

export function isPosOrPameranLocation(value) {
  const location = String(value || '').toLowerCase()
  return location.includes('pos') || location.includes('pameran')
}

export function calculateIncomingAgingDays(value) {
  if (!value) return 0
  const date = new Date(value)
  if (isNaN(date.getTime())) return 0
  const today = new Date()
  const diff = today.getTime() - date.getTime()
  if (diff <= 0) return 0
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

export function getAgingTagByIncomingDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (isNaN(date.getTime())) return '-'
  return String.fromCharCode(65 + date.getMonth())
}

export function getAgingFifoDays(unit) {
  if (isPosOrPameranLocation(unit.location)) return unit.movement_aging_days || 0
  return calculateIncomingAgingDays(unit.incoming_date)
}

export function getMonthByAgingTag(tag) {
  if (!tag) return null
  const normalized = String(tag).trim().toUpperCase()
  if (!/^[A-L]$/.test(normalized)) return null
  return normalized.charCodeAt(0) - 64
}

export function matchesAgingTag(unit, tag) {
  const month = getMonthByAgingTag(tag)
  if (!month) return true
  if (!unit?.incoming_date) return false
  const date = new Date(unit.incoming_date)
  if (isNaN(date.getTime())) return false
  return date.getMonth() + 1 === month
}

export async function cleanupUpload(req) {
  if (req.file?.path) await fs.unlink(req.file.path).catch(() => {})
}

export function parseOtrPriceFile(filePath, originalName, parsePriceFn) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path')
  }
  const text = execFileSync('textutil', ['-convert', 'txt', '-stdout', '--', filePath], { encoding: 'utf8' })
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const effectiveDate = parseOtrEffectiveDate(text)
  const records = []
  const errors = []
  const seen = new Set()

  for (let i = 0; i < lines.length - 4; i++) {
    if (!/^\d+$/.test(lines[i])) continue
    const description = lines[i + 1]
    const productCode = lines[i + 2]
    const modelName = lines[i + 3]
    const price = lines[i + 4]

    if (!/^[A-Z0-9]{2,8}$/.test(productCode) || !/^\d{1,3}(,\d{3})+$/.test(price)) continue
    if (seen.has(productCode)) continue
    seen.add(productCode)

    records.push({
      product_code: productCode,
      description,
      model_name: modelName,
      otr_price: parsePriceFn(price),
      effective_date: effectiveDate,
      source_file: originalName || null,
      synced_at: new Date(),
    })
  }

  return { records, errors }
}

export function parsePriceRows(text, originalName, priceField, parsePriceFn) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const effectiveDate = parseOtrEffectiveDate(text)
  const records = []
  const seen = new Set()

  for (let i = 0; i < lines.length - 4; i++) {
    if (!/^\d+$/.test(lines[i])) continue
    const description = lines[i + 1]
    const productCode = lines[i + 2]
    const modelName = lines[i + 3]
    const price = lines[i + 4]

    if (!/^[A-Z0-9]{2,8}$/.test(productCode) || !/^\d{1,3}(,\d{3})+$/.test(price)) continue
    if (seen.has(productCode)) continue
    seen.add(productCode)

    records.push({
      product_code: productCode,
      description,
      model_name: modelName,
      [priceField]: parsePriceFn(price),
      effective_date: effectiveDate,
      source_file_off_purchase: originalName || null,
      synced_at: new Date(),
    })
  }

  return records
}

export function parseOffPurchasePriceFile(filePath, originalName, parsePriceFn) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path')
  }
  const text = execFileSync('textutil', ['-convert', 'txt', '-stdout', '--', filePath], { encoding: 'utf8' })
  const offRoadMarker = 'Perihal : SK Harga Off The Road'
  const offRoadIndex = text.indexOf(offRoadMarker)
  const errors = []

  if (offRoadIndex === -1) {
    return { records: [], purchaseRows: 0, offRoadRows: 0, errors: [{ row: 0, error: 'Section Harga Off The Road tidak ditemukan' }] }
  }

  const purchaseText = text.slice(0, offRoadIndex)
  const offRoadText = text.slice(offRoadIndex)
  const purchaseRecords = parsePriceRows(purchaseText, originalName, 'dealer_purchase_price', parsePriceFn)
  const offRoadRecords = parsePriceRows(offRoadText, originalName, 'off_road_price', parsePriceFn)
  const recordByCode = new Map()

  for (const record of purchaseRecords) {
    recordByCode.set(record.product_code, record)
  }
  for (const record of offRoadRecords) {
    const existing = recordByCode.get(record.product_code) || { product_code: record.product_code }
    recordByCode.set(record.product_code, { ...existing, ...record })
  }

  return { records: [...recordByCode.values()], purchaseRows: purchaseRecords.length, offRoadRows: offRoadRecords.length, errors }
}

export function buildStockUnitWhere(query) {
  const { search, series, state, location, aging_min } = query
  const where = { branch_code: 'DXK' }

  if (search) {
    where.OR = [
      { engine_number: { contains: search } },
      { chassis_number: { contains: search } },
      { series: { contains: search } },
      { product_type: { contains: search } },
    ]
  }
  if (series && series !== 'all') where.series = series
  if (state && state !== 'all') where.engine_state = state
  if (location && location !== 'all') where.location = { contains: location }
  if (aging_min && aging_min !== 'all') where.stock_aging_days = { gte: parseInt(aging_min) }

  return where
}

export function buildStnkWhere(query) {
  // DEPRECATED: showroom_stnks sudah dihapus. Gunakan buildStnkStockWhere
  // di showroomStnkController.js atau query showroom_stnk_bpkb_tracks langsung.
  return { branch_code: 'DXK' }
}

export function buildBpkbWhere(query) {
  // DEPRECATED: showroom_bpkbs sudah dihapus. Gunakan buildBpkbStockWhere
  // di showroomBpkbController.js atau query showroom_stnk_bpkb_tracks langsung.
  return { branch_code: 'DXK' }
}

export const DOCUMENT_FOLLOWUP_STATUSES = ['belum_dihubungi', 'sudah_dihubungi', 'diambil', 'pending', 'batal']

/**
 * Mapping nama panjang finance company ke singkatan yang umum dipakai di report internal.
 * Key = nama persis dari kolom finance_company (case-insensitive matching).
 * Value = singkatan + alias pattern untuk fuzzy match.
 */
export const FINANCE_COMPANY_SHORT_MAP = {
  'PT FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'PT. FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'FIF': 'FIF',
  'PT SUMMIT OTO FINANCE': 'SOF',
  'PT. SUMMIT OTO FINANCE': 'SOF',
  'SUMMIT OTO FINANCE': 'SOF',
  'SOF': 'SOF',
  'PT CENTRAL SANTOSA FINANCE': 'CSF',
  'PT. CENTRAL SANTOSA FINANCE': 'CSF',
  'CENTRAL SANTOSA FINANCE': 'CSF',
  'CSF': 'CSF',
  'PT ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'PT. ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'ADIRA': 'ADIRA',
  'PT. BCA MULTI FINANCE': 'BCA MF',
  'PT BCA MULTI FINANCE': 'BCA MF',
  'BCA MULTI FINANCE': 'BCA MF',
  'BCA MF': 'BCA MF',
  'PT. INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'PT INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'IMFI': 'IMFI',
}

/**
 * Dapatkan singkatan finance company. Return nama asli kalau tidak ada di map.
 */
export function getFinanceCompanyShort(name) {
  if (!name) return null
  const normalized = String(name).trim().toUpperCase()
  return FINANCE_COMPANY_SHORT_MAP[normalized] || String(name).trim()
}

/**
 * Tentukan customer type berdasarkan finance_company.
 * Cash = NULL atau string kosong.
 * Kredit = ada finance_company.
 */
export function getCustomerType(financeCompany) {
  if (!financeCompany || !String(financeCompany).trim()) return 'CASH'
  return 'KREDIT'
}

/**
 * Tambah filter customer_type ke where clause Prisma.
 * customer_type=CASH → finance_company IS NULL OR finance_company = ''
 * customer_type=KREDIT → finance_company IS NOT NULL AND finance_company != ''
 */
export function applyCustomerTypeFilter(where, customerType) {
  if (!customerType || customerType === 'all') return where
  if (customerType === 'CASH') {
    where.AND = where.AND || []
    where.AND.push({ OR: [{ finance_company: null }, { finance_company: '' }] })
  } else if (customerType === 'KREDIT') {
    where.AND = where.AND || []
    where.AND.push({ AND: [{ finance_company: { not: null } }, { finance_company: { not: '' } }] })
  }
  return where
}
