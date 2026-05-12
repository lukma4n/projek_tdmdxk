import { prisma } from '../config/db.js'
import { resolveSeriesKey } from './showroomTacController.js'

function numberValue(value) {
  const parsed = decimalValue(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function decimalValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0
    const cleaned = trimmed.replace(/[^\d,.-]/g, '')
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.split('.').length > 2
        ? cleaned.replace(/\./g, '')
        : /^-?\d{1,3}\.\d{3}$/.test(cleaned)
          ? cleaned.replace(/\./g, '')
        : cleaned
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function positiveValue(value) {
  return Math.max(decimalValue(value), 0)
}

function grossUpCommission(value) {
  const commission = decimalValue(value)
  return commission > 0 ? commission / 0.975 : 0
}

function stringValue(value) {
  return String(value || '').trim()
}

function dateValue(value) {
  if (!value) return new Date()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function calculateMargin(data) {
  const isCash = stringValue(data.sale_type || data.payment_type).toUpperCase() === 'CASH'
  const otrPrice = numberValue(data.otr_price)
  const offRoadPrice = decimalValue(data.off_road_price)
  const purchasePrice = numberValue(data.purchase_price)
  const taxDivisor = decimalValue(data.tax_divisor) || 1.11
  const programDiscount = decimalValue(data.program_total_discount)
  const manualDealerDiscount = decimalValue(data.dealer_subsidy)
  const potongan = decimalValue(data.customer_discount)
  const psFinco = isCash ? 0 : decimalValue(data.leasing_subsidy)
  const hutangKomisiInput = decimalValue(data.hutang_komisi || data.sales_commission)
  const hutangKomisi = grossUpCommission(hutangKomisiInput)
  const programDealerDiscount = decimalValue(data.program_dealer_discount)
  const subsidiDealer = manualDealerDiscount + programDealerDiscount
  const diffFinco = decimalValue(data.diff_finco)
  const diffMd = decimalValue(data.diff_md)
  const totalBebanDealer = potongan + hutangKomisi + subsidiDealer + diffFinco + diffMd
  const discountTotal = potongan + psFinco
  const totalHargaJual = decimalValue(data.total_harga_jual) || (offRoadPrice > 0 ? offRoadPrice / taxDivisor : 0)
  const bbnNotice = decimalValue(data.bbn_notice)
  const bbnJasaOther = decimalValue(data.bbn_jasa_other || data.total_bbn) || Math.max(otrPrice - offRoadPrice, 0)
  const bbnInternal = decimalValue(data.bbn_internal)
  const ppnBbnMarginInput = decimalValue(data.ppn_bbn_margin)
  const ppnBbnMargin = ppnBbnMarginInput || ((bbnJasaOther - bbnInternal) > 0 ? ((bbnJasaOther - bbnInternal) * (taxDivisor - 1)) / taxDivisor : 0)
  const gpUnit = totalHargaJual - purchasePrice - totalBebanDealer
  const gpBbn = bbnJasaOther - bbnInternal - ppnBbnMargin
  const marginRemaining = gpUnit + gpBbn
  const totalTax = Math.max(offRoadPrice - totalHargaJual, 0) + ppnBbnMargin
  const dealPrice = decimalValue(data.deal_price) || offRoadPrice + bbnJasaOther - discountTotal
  const marginInitial = totalHargaJual - purchasePrice
  const totalDeduction = totalBebanDealer
  const marginPercent = dealPrice > 0 ? Number(((marginRemaining / dealPrice) * 100).toFixed(2)) : 0
  const marginStatus = marginRemaining < 0 ? 'minus' : marginRemaining <= 1500000 ? 'tipis' : 'aman'
  const odooMargin = decimalValue(data.odoo_margin)
  const marginDiff = odooMargin ? marginRemaining - odooMargin : 0
  const accuracyStatus = !odooMargin || Math.abs(marginDiff) <= 1000 ? 'akurat' : 'perlu_cek'
  const dpGross = positiveValue(data.dp_gross || data.down_payment)
  const dpNetCustomer = positiveValue(data.dp_net_customer || data.dp_net)
  const totalDiscountCustomer = potongan + psFinco + programDiscount
  const sisaPiutang = Math.max(otrPrice - dpNetCustomer - totalDiscountCustomer, 0)
  const minimumMargin = positiveValue(data.minimum_margin)
  const hasMinimumMargin = minimumMargin > 0
  const programSubsidy = positiveValue(data.program_subsidy_total)
  const dpAfterProgram = Math.max(dpGross - programSubsidy, 0)
  const additionalDiscount = dpNetCustomer > 0 ? Math.max(dpAfterProgram - dpNetCustomer, 0) : potongan
  const marginBeforeAdditionalDiscount = marginRemaining + additionalDiscount
  const maxAdditionalDiscount = hasMinimumMargin ? Math.max(marginBeforeAdditionalDiscount - minimumMargin, 0) : 0
  const minimumSafeDpNet = hasMinimumMargin ? Math.max(dpAfterProgram - maxAdditionalDiscount, 0) : 0
  const remainingDiscountRoom = hasMinimumMargin ? marginRemaining - minimumMargin : 0
  const dpShortage = hasMinimumMargin && dpNetCustomer > 0 ? Math.max(minimumSafeDpNet - dpNetCustomer, 0) : 0
  const approvalStatus = hasMinimumMargin
    ? marginRemaining < minimumMargin ? 'tidak_aman' : remainingDiscountRoom <= 100000 ? 'aman_tipis' : 'aman'
    : 'info'

  return {
    otrPrice,
    offRoadPrice: round2(offRoadPrice),
    purchasePrice,
    dealPrice: round2(dealPrice),
    totalHargaJual: round2(totalHargaJual),
    discountTotal: round2(discountTotal),
    totalDisc: round2(totalDiscountCustomer),
    totalTax: round2(totalTax),
    totalBbn: round2(bbnJasaOther),
    sisaPiutang: round2(sisaPiutang),
    totalBebanDealer: round2(totalBebanDealer),
    hutangKomisiInput: round2(hutangKomisiInput),
    hutangKomisiGross: round2(hutangKomisi),
    bbnNotice: round2(bbnNotice),
    bbnJasaOther: round2(bbnJasaOther),
    bbnInternal: round2(bbnInternal),
    ppnBbnMargin: round2(ppnBbnMargin),
    gpUnit: round2(gpUnit),
    gpBbn: round2(gpBbn),
    marginInitial: round2(marginInitial),
    totalDeduction: round2(totalDeduction),
    marginRemaining: round2(marginRemaining),
    marginPercent,
    marginStatus,
    marginDiff: round2(marginDiff),
    accuracyStatus,
    dpGross: round2(dpGross),
    dpNetCustomer: round2(dpNetCustomer),
    minimumMargin: round2(minimumMargin),
    programSubsidy: round2(programSubsidy),
    dpAfterProgram: round2(dpAfterProgram),
    additionalDiscount: round2(additionalDiscount),
    marginBeforeAdditionalDiscount: round2(marginBeforeAdditionalDiscount),
    maxAdditionalDiscount: round2(maxAdditionalDiscount),
    minimumSafeDpNet: round2(minimumSafeDpNet),
    remainingDiscountRoom: round2(remainingDiscountRoom),
    dpShortage: round2(dpShortage),
    approvalStatus,
    hasMinimumMargin,
  }
}

async function enrichFromUnit(data) {
  const engineNumber = stringValue(data.engine_number)
  const productType = stringValue(data.product_type).toUpperCase()
  const unit = engineNumber
    ? await prisma.showroom_stock_units.findUnique({ where: { engine_number: engineNumber } })
    : null
  const productCode = unit?.product_type || productType
  const price = productCode
    ? await prisma.showroom_otr_prices.findFirst({ where: { product_code: productCode } })
    : null
  const cityName = stringValue(data.city_name || data.area || 'KAB. KETAPANG')
  const saleType = stringValue(data.sale_type || data.payment_type || 'KREDIT').toUpperCase()
  const isCash = saleType === 'CASH'
  const leasing = isCash ? '' : stringValue(data.finance_company || data.leasing).toUpperCase()
  const tenor = isCash ? 0 : numberValue(data.tenor)
  const saleDate = data.transaction_date || data.so_date ? new Date(data.transaction_date || data.so_date) : new Date()
  const bbn = productCode
    ? await prisma.showroom_bbn_prices.findFirst({
        where: { product_code: productCode, city_name: { contains: cityName.replace(/^\[\d+\]\s*/, '') } },
        orderBy: { synced_at: 'desc' },
      })
    : null
  const leasingProgram = !isCash && productCode && leasing && tenor
    ? await prisma.showroom_leasing_programs.findFirst({ where: { product_code: productCode, leasing, tenor } })
    : null
  const resolvedSeriesKey = productCode ? await resolveSeriesKey(productCode, `${price?.model_name || ''} ${price?.description || ''}`) : null
  const dpGross = numberValue(data.dp_gross || data.down_payment)
  const dpPercent = numberValue(price?.otr_price) > 0 ? (dpGross / numberValue(price?.otr_price)) * 100 : 0
  const dpCategory = dpGross > 0 && dpPercent > 15 ? 'GT_15' : 'LT_15'
  const isImfiPromoScheme = leasing === 'IMFI'
  const promoScheme = isImfiPromoScheme && price?.otr_price
    ? await prisma.showroom_leasing_promo_schemes.findFirst({
        where: {
          leasing,
          otr_min: { lte: numberValue(price.otr_price) },
          otr_max: { gte: numberValue(price.otr_price) },
          tenor: { in: [0, tenor] },
          dp_min_percent: { lte: dpPercent },
          dp_max_percent: { gte: dpPercent },
          amount: { gt: 0 },
          is_active: true,
          AND: [
            { OR: [{ period_start: null }, { period_start: { lte: saleDate } }] },
            { OR: [{ period_end: null }, { period_end: { gte: saleDate } }] },
          ],
        },
        orderBy: [{ tenor: 'desc' }, { dp_min_percent: 'desc' }, { period_start: 'desc' }, { synced_at: 'desc' }],
      })
    : null
  const tacProgram = !isImfiPromoScheme && resolvedSeriesKey && leasing && tenor
    ? await prisma.showroom_leasing_tac_programs.findFirst({
        where: {
          leasing,
          series_key: resolvedSeriesKey,
          dp_category: dpCategory,
          tenor,
          amount: { gt: 0 },
          is_active: true,
          OR: [
            { period_start: null },
            { period_start: { lte: saleDate }, period_end: null },
            { period_start: { lte: saleDate }, period_end: { gte: saleDate } },
          ],
        },
        orderBy: [{ period_start: 'desc' }, { synced_at: 'desc' }],
      })
    : null
  const tacAvailableTenors = resolvedSeriesKey && leasing && !isImfiPromoScheme
    ? await prisma.showroom_leasing_tac_programs.findMany({
        where: { leasing, series_key: resolvedSeriesKey, dp_category: dpCategory, amount: { gt: 0 }, is_active: true },
        distinct: ['tenor'],
        orderBy: { tenor: 'asc' },
        select: { tenor: true },
      })
    : []
  const mdProgram = productCode
    ? await prisma.showroom_md_programs.findFirst({
        where: {
          product_code: productCode,
          sale_type: saleType,
          is_active: true,
          OR: [
            { period_start: null },
            { period_start: { lte: saleDate }, period_end: null },
            { period_start: { lte: saleDate }, period_end: { gte: saleDate } },
          ],
        },
        orderBy: [{ period_start: 'desc' }, { synced_at: 'desc' }],
      })
    : null
  const tacSubsidy = isCash ? 0 : numberValue(data.leasing_subsidy) || numberValue(promoScheme?.amount) || numberValue(tacProgram?.amount) || numberValue(leasingProgram?.finco_subsidy)
  const mdDiscount = numberValue(mdProgram?.md_discount)
  const ahmDiscount = numberValue(mdProgram?.ahm_discount)
  const programDealerDiscount = numberValue(mdProgram?.dealer_discount)
  const programTotalDiscount = numberValue(mdProgram?.total_discount)
  const programSubsidyTotal = isCash ? programTotalDiscount + numberValue(data.dealer_subsidy) : tacSubsidy + programTotalDiscount
  const dpNetCustomer = numberValue(data.dp_net_customer || data.dp_net)
  const additionalDiscount = dpNetCustomer > 0
    ? Math.max(dpGross - programSubsidyTotal - dpNetCustomer, 0)
    : numberValue(data.customer_discount)
  const bbnNotice = numberValue(data.bbn_notice) || numberValue(bbn?.notice) + numberValue(bbn?.pnbp_stck)
  const bbnInternal = numberValue(data.bbn_internal) || numberValue(bbn?.total) || numberValue(bbn?.notice) + numberValue(bbn?.pnbp_stck) + numberValue(bbn?.jasa) + numberValue(bbn?.jasa_area) + numberValue(bbn?.fee_pusat)
  return {
    ...data,
    chassis_number: data.chassis_number || unit?.chassis_number,
    product_type: productCode || data.product_type,
    series: data.series || unit?.series || price?.model_name,
    color: data.color || unit?.color,
    year: data.year || unit?.year,
    location: data.location || unit?.location,
    otr_price: numberValue(data.otr_price) || numberValue(price?.otr_price),
    off_road_price: decimalValue(data.off_road_price) || decimalValue(price?.off_road_price),
    purchase_price: numberValue(data.purchase_price) || numberValue(price?.dealer_purchase_price),
    bbn_notice: bbnNotice,
    bbn_internal: bbnInternal,
    bbn_master_total: numberValue(bbn?.total),
    bbn_city_name: bbn?.city_name || cityName,
    bbn_jasa: numberValue(bbn?.jasa),
    bbn_pnbp_stck: numberValue(bbn?.pnbp_stck),
    customer_discount: additionalDiscount,
    dp_net_customer: dpNetCustomer,
    minimum_margin: numberValue(data.minimum_margin),
    leasing_subsidy: tacSubsidy,
    leasing_program_subsidy: numberValue(leasingProgram?.finco_subsidy),
    tac_program_subsidy: numberValue(promoScheme?.amount) || numberValue(tacProgram?.amount),
    promo_scheme_subsidy: numberValue(promoScheme?.amount),
    promo_scheme_gross_amount: numberValue(promoScheme?.gross_amount),
    promo_scheme_branch_deposit_amount: numberValue(promoScheme?.branch_deposit_amount),
    promo_scheme_found: Boolean(promoScheme),
    tac_found: Boolean(tacProgram || promoScheme),
    tac_lookup_message: promoScheme
      ? `Dana Promosi Scheme IMFI ditemukan. Dana titipan cabang ${numberValue(promoScheme.branch_deposit_amount).toLocaleString('id-ID')}`
      : tacProgram
      ? 'TAC ditemukan dari master'
      : isImfiPromoScheme
        ? 'Dana Promosi Scheme IMFI tidak ditemukan untuk range OTR, tenor, DP, dan periode aktif'
      : !resolvedSeriesKey
        ? 'Series TAC belum terbaca'
        : !leasing
          ? 'Leasing belum dipilih'
          : !tenor
            ? 'Tenor belum dipilih'
            : 'TAC tidak ditemukan untuk kombinasi leasing, series, kategori DP, tenor, dan periode aktif',
    tac_available_tenors: tacAvailableTenors.map((row) => row.tenor),
    tac_series_key: resolvedSeriesKey,
    tac_dp_category: dpCategory,
    dp_percent: Number(dpPercent.toFixed(2)),
    is_cash: isCash,
    md_discount: mdDiscount,
    ahm_discount: ahmDiscount,
    program_dealer_discount: programDealerDiscount,
    program_total_discount: programTotalDiscount,
    program_subsidy_total: programSubsidyTotal,
    description: price?.description || null,
  }
}

function payload(body, userId, computed) {
  return {
    so_number: stringValue(body.so_number),
    so_date: dateValue(body.so_date),
    customer_name: stringValue(body.customer_name),
    customer_phone: stringValue(body.customer_phone) || null,
    customer_address: stringValue(body.customer_address) || null,
    salesman: stringValue(body.salesman) || null,
    payment_type: stringValue(body.payment_type) || 'cash',
    finance_company: stringValue(body.finance_company) || null,
    tenor: body.tenor ? numberValue(body.tenor) : null,
    down_payment: numberValue(body.down_payment),
    engine_number: stringValue(body.engine_number) || null,
    chassis_number: stringValue(body.chassis_number) || null,
    product_type: stringValue(body.product_type) || null,
    series: stringValue(body.series) || null,
    color: stringValue(body.color) || null,
    year: stringValue(body.year) || null,
    location: stringValue(body.location) || null,
    otr_price: numberValue(body.otr_price),
    purchase_price: numberValue(body.purchase_price),
    deal_price: numberValue(computed.dealPrice),
    customer_discount: numberValue(body.customer_discount),
    dealer_subsidy: numberValue(body.dealer_subsidy),
    leasing_subsidy: numberValue(body.leasing_subsidy),
    cashback: numberValue(body.cashback),
    sales_commission: numberValue(body.sales_commission),
    mediator_commission: numberValue(body.mediator_commission),
    accessory_cost: numberValue(body.accessory_cost),
    gift_cost: numberValue(body.gift_cost),
    other_cost: numberValue(body.other_cost),
    margin_initial: numberValue(computed.marginInitial),
    total_deduction: numberValue(computed.totalDeduction),
    margin_remaining: numberValue(computed.marginRemaining),
    margin_percent: computed.marginPercent,
    margin_status: computed.marginStatus,
    notes: stringValue(body.notes) || null,
    status: stringValue(body.status) || 'draft',
    created_by: userId,
  }
}

export async function getSalesOrderMargins(req, res, next) {
  try {
    const { search, margin_status, limit = 100 } = req.query
    const where = {}
    if (margin_status && margin_status !== 'all') where.margin_status = margin_status
    if (search) {
      where.OR = [
        { so_number: { contains: String(search) } },
        { customer_name: { contains: String(search) } },
        { engine_number: { contains: String(search) } },
        { salesman: { contains: String(search) } },
      ]
    }
    const rows = await prisma.showroom_sales_order_margins.findMany({
      where,
      include: { creator: { select: { name: true, username: true } } },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
    })
    const summary = {
      total: rows.length,
      aman: rows.filter((row) => row.margin_status === 'aman').length,
      tipis: rows.filter((row) => row.margin_status === 'tipis').length,
      minus: rows.filter((row) => row.margin_status === 'minus').length,
      total_margin: rows.reduce((sum, row) => sum + row.margin_remaining, 0),
    }
    res.json({ data: rows, summary })
  } catch (error) { next(error) }
}

export async function previewSalesOrderMargin(req, res, next) {
  try {
    const enriched = await enrichFromUnit(req.body)
    const computed = calculateMargin(enriched)
    res.json({ data: { ...enriched, ...computed } })
  } catch (error) { next(error) }
}

export async function createSalesOrderMargin(req, res, next) {
  try {
    let data = await enrichFromUnit(req.body)
    if (!stringValue(data.so_number)) return res.status(400).json({ error: 'Nomor SO wajib diisi' })
    if (!stringValue(data.customer_name)) return res.status(400).json({ error: 'Nama customer wajib diisi' })
    const computed = calculateMargin(data)
    data = payload(data, req.user.userId, computed)
    const row = await prisma.showroom_sales_order_margins.create({ data })
    res.status(201).json({ message: 'Sales order margin tersimpan', data: row })
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Nomor SO sudah ada' })
    next(error)
  }
}

export async function getSalesOrderMarginById(req, res, next) {
  try {
    const row = await prisma.showroom_sales_order_margins.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!row) return res.status(404).json({ error: 'Sales order tidak ditemukan' })
    res.json({ data: row })
  } catch (error) { next(error) }
}

export async function updateSalesOrderMargin(req, res, next) {
  try {
    const existing = await prisma.showroom_sales_order_margins.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!existing) return res.status(404).json({ error: 'Sales order tidak ditemukan' })
    const merged = { ...existing, ...req.body }
    const enriched = await enrichFromUnit(merged)
    const computed = calculateMargin(enriched)
    const data = payload(enriched, existing.created_by, computed)
    delete data.created_by
    const row = await prisma.showroom_sales_order_margins.update({ where: { id: existing.id }, data })
    res.json({ message: 'Sales order margin diperbarui', data: row })
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Nomor SO sudah ada' })
    next(error)
  }
}
