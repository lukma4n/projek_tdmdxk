import { prisma } from '../config/db.js'

function clean(value = '') { return String(value || '').trim() }
function upper(value = '') { return clean(value).toUpperCase() }
function num(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function dateOrNull(value) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date }
const OPEN_OTR_MAX = 999999999999

export async function resolveSeriesKey(productCode, fallbackText = '') {
  const text = `${productCode || ''} ${fallbackText || ''}`.toUpperCase()
  const aliases = await prisma.showroom_series_aliases.findMany({ where: { is_active: true }, orderBy: [{ priority: 'asc' }, { keyword: 'desc' }] })
  return aliases.find((alias) => text.includes(alias.keyword))?.series_key || upper(fallbackText || productCode)
}

export async function getSeriesAliases(req, res, next) {
  try {
    const rows = await prisma.showroom_series_aliases.findMany({ orderBy: [{ priority: 'asc' }, { keyword: 'asc' }] })
    res.json({ data: rows })
  } catch (error) { next(error) }
}

export async function upsertSeriesAlias(req, res, next) {
  try {
    const keyword = upper(req.body.keyword)
    const seriesKey = upper(req.body.series_key)
    if (!keyword || !seriesKey) return res.status(400).json({ error: 'Keyword dan series wajib diisi' })
    const row = await prisma.showroom_series_aliases.upsert({
      where: { keyword },
      create: { keyword, series_key: seriesKey, priority: num(req.body.priority) || 100, is_active: req.body.is_active ?? true },
      update: { series_key: seriesKey, priority: num(req.body.priority) || 100, is_active: req.body.is_active ?? true },
    })
    res.json({ message: 'Alias series tersimpan', data: row })
  } catch (error) { next(error) }
}

export async function getTacPrograms(req, res, next) {
  try {
    const { search, leasing, series_key } = req.query
    const where = {}
    if (leasing) where.leasing = upper(leasing)
    if (series_key) where.series_key = upper(series_key)
    if (search) where.OR = [{ leasing: { contains: upper(search) } }, { series_key: { contains: upper(search) } }]
    const rows = await prisma.showroom_leasing_tac_programs.findMany({ where, orderBy: [{ leasing: 'asc' }, { series_key: 'asc' }, { dp_category: 'asc' }, { tenor: 'asc' }] })
    res.json({ data: rows })
  } catch (error) { next(error) }
}

export async function getPromoSchemes(req, res, next) {
  try {
    const { leasing, search } = req.query
    const where = {}
    if (leasing) where.leasing = upper(leasing)
    if (search) where.OR = [{ leasing: { contains: upper(search) } }, { scheme_name: { contains: clean(search) } }]
    const rows = await prisma.showroom_leasing_promo_schemes.findMany({ where, orderBy: [{ leasing: 'asc' }, { otr_min: 'asc' }, { tenor: 'asc' }, { dp_min_percent: 'asc' }] })
    res.json({ data: rows })
  } catch (error) { next(error) }
}

export async function upsertPromoScheme(req, res, next) {
  try {
    const leasing = upper(req.body.leasing)
    const otrMin = num(req.body.otr_min)
    const otrMax = req.body.otr_max === '' || req.body.otr_max === null || req.body.otr_max === undefined ? OPEN_OTR_MAX : num(req.body.otr_max)
    const tenor = num(req.body.tenor)
    const dpMin = num(req.body.dp_min_percent)
    const dpMax = req.body.dp_max_percent === '' || req.body.dp_max_percent === null || req.body.dp_max_percent === undefined ? 100 : num(req.body.dp_max_percent)
    const grossAmount = num(req.body.gross_amount)
    const branchDepositAmount = num(req.body.branch_deposit_amount)
    const periodStart = dateOrNull(req.body.period_start)
    const periodEnd = dateOrNull(req.body.period_end)
    if (!leasing || grossAmount <= 0 || otrMax !== null && otrMax <= otrMin || dpMax < dpMin) return res.status(400).json({ error: 'Leasing, range OTR, DP, dan nominal wajib valid' })
    const row = {
      leasing,
      scheme_name: clean(req.body.scheme_name) || 'Dana Promosi Scheme',
      otr_min: otrMin,
      otr_max: otrMax,
      tenor,
      dp_min_percent: dpMin,
      dp_max_percent: dpMax,
      gross_amount: grossAmount,
      branch_deposit_amount: branchDepositAmount,
      amount: Math.max(grossAmount - branchDepositAmount, 0),
      period_start: periodStart,
      period_end: periodEnd,
      is_active: req.body.is_active ?? true,
      source_file: clean(req.body.source_file) || 'MANUAL PROMO SCHEME',
      synced_at: new Date(),
    }
    const where = { leasing_otr_min_otr_max_tenor_dp_min_percent_dp_max_percent_period_start: { leasing: row.leasing, otr_min: row.otr_min, otr_max: row.otr_max, tenor: row.tenor, dp_min_percent: row.dp_min_percent, dp_max_percent: row.dp_max_percent, period_start: row.period_start } }
    const existing = await prisma.showroom_leasing_promo_schemes.findUnique({ where })
    const data = await prisma.showroom_leasing_promo_schemes.upsert({ where, create: row, update: row })
    res.json({ message: existing ? 'Dana Promosi Scheme diperbarui' : 'Dana Promosi Scheme tersimpan', data, created: existing ? 0 : 1, updated: existing ? 1 : 0 })
  } catch (error) { next(error) }
}

export async function upsertTacMatrix(req, res, next) {
  try {
    const leasing = upper(req.body.leasing)
    const seriesKey = upper(req.body.series_key)
    const periodStart = dateOrNull(req.body.period_start)
    const periodEnd = dateOrNull(req.body.period_end)
    const sourceFile = clean(req.body.source_file) || 'MANUAL'
    const rows = Array.isArray(req.body.rows) ? req.body.rows : []
    if (!leasing || !seriesKey || rows.length === 0) return res.status(400).json({ error: 'Leasing, series, dan matrix wajib diisi' })
    let created = 0
    let updated = 0
    await prisma.$transaction(async (tx) => {
      for (const item of rows) {
        const row = { leasing, series_key: seriesKey, dp_category: upper(item.dp_category), tenor: num(item.tenor), amount: num(item.amount), period_start: periodStart, period_end: periodEnd, is_active: true, source_file: sourceFile, synced_at: new Date() }
        if (!row.dp_category || !row.tenor) continue
        const where = { leasing_series_key_dp_category_tenor_period_start: { leasing: row.leasing, series_key: row.series_key, dp_category: row.dp_category, tenor: row.tenor, period_start: row.period_start } }
        const existing = await tx.showroom_leasing_tac_programs.findUnique({ where })
        await tx.showroom_leasing_tac_programs.upsert({ where, create: row, update: row })
        if (existing) updated += 1
        else created += 1
      }
    })
    res.json({ message: 'Master TAC Leasing tersimpan', created, updated })
  } catch (error) { next(error) }
}

export async function getTacSummary(req, res, next) {
  try {
    const [total, series, latest, promoTotal] = await Promise.all([
      prisma.showroom_leasing_tac_programs.count(),
      prisma.showroom_leasing_tac_programs.groupBy({ by: ['series_key'] }),
      prisma.showroom_leasing_tac_programs.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, source_file: true } }),
      prisma.showroom_leasing_promo_schemes.count(),
    ])
    res.json({ total, seriesCount: series.length, promoSchemeTotal: promoTotal, latestSyncedAt: latest?.synced_at || null, sourceFile: latest?.source_file || null })
  } catch (error) { next(error) }
}
