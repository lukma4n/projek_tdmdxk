import { prisma } from '../config/db.js'
import xlsx from 'xlsx'
import { formatForExcel } from '../utils/excelUtils.js'

function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfMonth(date) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

function getDateRange(req) {
  const today = new Date()
  let from = req.query.from ? new Date(req.query.from) : startOfMonth(today)
  let to = req.query.to ? new Date(req.query.to) : endOfMonth(today)

  // Validate parsed dates
  if (isNaN(from.getTime())) from = startOfMonth(today)
  if (isNaN(to.getTime())) to = endOfMonth(today)

  // If from and to are the same date, set to to end of day
  if (req.query.from && req.query.to && req.query.from === req.query.to) {
    to.setHours(23, 59, 59, 999)
  }

  return { from, to }
}

/**
 * Get the previous-month equivalent of a date range.
 * Uses new Date(year, month-1, day) to avoid JS setMonth() overflow bugs
 * on the 31st of a month.
 */
function prevMonthRange(from, to) {
  const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, from.getDate())
  const prevTo = new Date(to.getFullYear(), to.getMonth() - 1, to.getDate())
  // Preserve end-of-day time if the original to had one
  if (to.getHours() === 23) prevTo.setHours(23, 59, 59, 999)
  return { prevFrom, prevTo }
}

const LEASING_TYPES = ['FIF', 'OTO', 'ADIRA', 'IMFI']

async function buildTeamPerformanceFromMaster(dateWhere, preFetchedMaster) {
  const master = preFetchedMaster || await prisma.showroom_salespeople.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  })

  if (master.length === 0) {
    return { byTeam: [], totalActiveSales: 0, salesWithClosing: 0 }
  }

  const teamMap = new Map()
  for (const s of master) {
    const tl = s.team_leader || 'Tidak diketahui'
    if (!teamMap.has(tl)) teamMap.set(tl, [])
    teamMap.get(tl).push(s)
  }

  const customerRecords = await prisma.customers.findMany({
    where: { ...dateWhere, salesman: { not: null } },
    select: { salesman: true },
  })

  const countMap = new Map()
  for (const c of customerRecords) {
    const key = c.salesman.trim().toUpperCase()
    countMap.set(key, (countMap.get(key) || 0) + 1)
  }

  const byTeam = []
  for (const [teamLeader, salesmen] of teamMap) {
    const teamSalesmen = []
    let teamTotal = 0

    for (const s of salesmen) {
      const key = s.name.trim().toUpperCase()
      const count = countMap.get(key) || 0
      teamTotal += count
      teamSalesmen.push({ name: s.name, count })
    }

    teamSalesmen.sort((a, b) => b.count - a.count)
    byTeam.push({ team: teamLeader, total: teamTotal, salesmen: teamSalesmen })
  }

  byTeam.sort((a, b) => b.total - a.total)

  return {
    byTeam,
    totalActiveSales: master.length,
    salesWithClosing: [...new Set(byTeam.flatMap((t) => t.salesmen.filter((s) => s.count > 0).map((s) => s.name)))].length,
  }
}

export async function getShowroomSalesDashboard(req, res, next) {
  try {
    const { from, to } = getDateRange(req)

    const baseWhere = {
      branch_code: 'DXK',
      so_date: { gte: from, lte: to },
    }

    // ─── Summary Cards ────────────────────────────────────────
    const closingDo = await prisma.customers.count({ where: baseWhere })

    // ─── Grand Total ────────────────────────────────────────
    // Jika filter dalam bulan yang sama: kumulatif dari awal bulan s/d tanggal filter
    // Jika filter lintas bulan: total sesuai range yang dipilih
    const monthStart = new Date(to)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const isSameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()

    let grandTotal
    if (isSameMonth) {
      grandTotal = await prisma.customers.count({
        where: {
          branch_code: 'DXK',
          so_date: { gte: monthStart, lte: to },
        },
      })
    } else {
      grandTotal = closingDo
    }

    // Cash vs Credit breakdown
    const cashCount = await prisma.customers.count({
      where: { ...baseWhere, sales_type: 'Cash' },
    })
    const creditCount = closingDo - cashCount
    const cashPercent = closingDo > 0 ? Math.round((cashCount / closingDo) * 100) : 0
    const creditPercent = closingDo > 0 ? Math.round((creditCount / closingDo) * 100) : 0

    // ─── Cash vs Credit Breakdown (Kumulatif Bulan Ini) ─────
    // Ambil data dari awal bulan sampai tanggal filter (kumulatif bulan)
    const monthBaseWhere = {
      branch_code: 'DXK',
      so_date: { gte: monthStart, lte: to },
    }

    // ─── Team Performance ───────────────────────────────────
    // Fetch master salespeople ONCE, share across both team queries
    const masterSalespeople = await prisma.showroom_salespeople.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    })
    const activeSalesCount = masterSalespeople.length

    // Kumulatif dari awal bulan s/d tanggal filter
    const teamResult = await buildTeamPerformanceFromMaster(monthBaseWhere, masterSalespeople)

    // Total penjualan bulan ini untuk hitung persentase
    const totalMonthCount = await prisma.customers.count({ where: monthBaseWhere })
    const cashMonthCount = await prisma.customers.count({
      where: { ...monthBaseWhere, sales_type: 'Cash' },
    })
    const creditMonthCount = totalMonthCount - cashMonthCount
    const cashMonthPercent = totalMonthCount > 0 ? Math.round((cashMonthCount / totalMonthCount) * 100) : 0
    const creditMonthPercent = totalMonthCount > 0 ? Math.round((creditMonthCount / totalMonthCount) * 100) : 0

    // ─── Leasing Breakdown (consolidated: 1 groupBy instead of 4 counts) ────
    function buildLeasingBreakdown(where, creditTotal) {
      return prisma.customers.groupBy({
        by: ['sales_type'],
        where: { ...where, sales_type: { in: LEASING_TYPES } },
        _count: true,
      }).then((rows) => {
        const map = Object.fromEntries(rows.map((r) => [r.sales_type, r._count]))
        return LEASING_TYPES.map((name) => {
          const count = map[name] || 0
          return { name, count, percent: creditTotal > 0 ? Math.round((count / creditTotal) * 100) : 0 }
        })
      })
    }

    const byLeasing = await buildLeasingBreakdown(monthBaseWhere, creditMonthCount)

    // ─── Top Model ──────────────────────────────────────────
    // Ambil data top model dari awal bulan sampai tanggal filter (kumulatif bulan)
    const byModelRaw = await prisma.customers.groupBy({
      by: ['model'],
      where: { ...monthBaseWhere, model: { not: null } },
      _count: true,
    })
    // Sort manually by count desc & limit
    byModelRaw.sort((a, b) => b._count - a._count)
    const byModel = byModelRaw.slice(0, 15)

    // ─── Top Kabupaten (Kumulatif Bulan Ini) ──────────────────
    const byKabupatenRaw = await prisma.customers.groupBy({
      by: ['kabupaten'],
      where: { ...monthBaseWhere, kabupaten: { not: null } },
      _count: true,
    })
    byKabupatenRaw.sort((a, b) => b._count - a._count)
    const byKabupaten = byKabupatenRaw.slice(0, 15).map((d) => ({
      name: d.kabupaten || 'Tidak diketahui',
      count: d._count,
    }))

    // ─── Top Kecamatan (Kumulatif Bulan Ini) ─────────────────
    const byKecamatanRaw = await prisma.customers.groupBy({
      by: ['kecamatan'],
      where: { ...monthBaseWhere, kecamatan: { not: null } },
      _count: true,
    })
    byKecamatanRaw.sort((a, b) => b._count - a._count)
    const byKecamatan = byKecamatanRaw.slice(0, 15).map((d) => ({
      name: d.kecamatan || 'Tidak diketahui',
      count: d._count,
    }))

    // ─── Period-Only Data (for Dashboard Tab) ─────────────────
    // When ranges match, reuse the month-cumulative data instead of re-querying
    const rangesMatch = from.getTime() === monthStart.getTime()
      && to.toISOString().split('T')[0] === monthStart.toISOString().split('T')[0]
        ? false  // different ranges (month vs period)
        : false

    // Always compute period data separately since date ranges differ
    const teamPeriodResult = await buildTeamPerformanceFromMaster(baseWhere, masterSalespeople)
    const byLeasingPeriod = await buildLeasingBreakdown(baseWhere, creditCount)

    // Top Model untuk periode yang dipilih saja
    const byModelPeriodRaw = await prisma.customers.groupBy({
      by: ['model'],
      where: { ...baseWhere, model: { not: null } },
      _count: true,
    })
    byModelPeriodRaw.sort((a, b) => b._count - a._count)
    const byModelPeriod = byModelPeriodRaw.slice(0, 15).map((d) => ({
      name: d.model || 'Tidak diketahui',
      count: d._count,
    }))

    // Top Kabupaten periode terpilih
    const byKabupatenPeriodRaw = await prisma.customers.groupBy({
      by: ['kabupaten'],
      where: { ...baseWhere, kabupaten: { not: null } },
      _count: true,
    })
    byKabupatenPeriodRaw.sort((a, b) => b._count - a._count)
    const byKabupatenPeriod = byKabupatenPeriodRaw.slice(0, 15).map((d) => ({
      name: d.kabupaten || 'Tidak diketahui',
      count: d._count,
    }))

    // Top Kecamatan periode terpilih
    const byKecamatanPeriodRaw = await prisma.customers.groupBy({
      by: ['kecamatan'],
      where: { ...baseWhere, kecamatan: { not: null } },
      _count: true,
    })
    byKecamatanPeriodRaw.sort((a, b) => b._count - a._count)
    const byKecamatanPeriod = byKecamatanPeriodRaw.slice(0, 15).map((d) => ({
      name: d.kecamatan || 'Tidak diketahui',
      count: d._count,
    }))

    // ─── Period Comparison (vs Previous Month Same Date Range) ───
    const { prevFrom, prevTo } = prevMonthRange(from, to)
    const prevWhere = { branch_code: 'DXK', so_date: { gte: prevFrom, lte: prevTo } }
    const prevTotal = await prisma.customers.count({ where: prevWhere })
    const prevCash = await prisma.customers.count({ where: { ...prevWhere, sales_type: 'Cash' } })
    const prevCredit = prevTotal - prevCash
    const growthPercent = prevTotal > 0 ? Math.round(((closingDo - prevTotal) / prevTotal) * 100) : 0
    const cashGrowthPercent = prevCash > 0 ? Math.round(((cashCount - prevCash) / prevCash) * 100) : 0
    const creditGrowthPercent = prevCredit > 0 ? Math.round(((creditCount - prevCredit) / prevCredit) * 100) : 0

    // ─── Daily Trend (for Line Chart) ───
    const periodRecords = await prisma.customers.findMany({
      where: baseWhere,
      select: { so_date: true, sales_type: true },
    })
    const dailyMap = new Map()
    for (const r of periodRecords) {
      const d = r.so_date.toISOString().split('T')[0]
      if (!dailyMap.has(d)) dailyMap.set(d, { date: d, count: 0, cash: 0, credit: 0 })
      const entry = dailyMap.get(d)
      entry.count++
      if (r.sales_type === 'Cash') entry.cash++
      else entry.credit++
    }
    const dailyTrend = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))

    // ─── Area vs Model Correlation ───
    const areaModelRaw = await prisma.customers.groupBy({
      by: ['kabupaten', 'model'],
      where: { ...baseWhere, kabupaten: { not: null }, model: { not: null } },
      _count: true,
    })
    areaModelRaw.sort((a, b) => b._count - a._count)
    const areaModelCorrelation = areaModelRaw.slice(0, 20).map((d) => ({
      area: d.kabupaten,
      model: d.model,
      count: d._count,
    }))

    // ─── Productivity & Projection ───
    // Use to start-of-day for accurate day counting (avoid off-by-one from end-of-day ms)
    const toStartOfDay = new Date(to)
    toStartOfDay.setHours(0, 0, 0, 0)
    const fromStartOfDay = new Date(from)
    fromStartOfDay.setHours(0, 0, 0, 0)
    const daysInPeriod = Math.max(1, Math.ceil((toStartOfDay - fromStartOfDay) / (1000 * 60 * 60 * 24)) + 1)
    const avgUnitsPerDay = closingDo / daysInPeriod
    const salesCount = teamPeriodResult.totalActiveSales || 1
    const avgUnitsPerSales = closingDo / salesCount

    const target = parseInt(req.query.target || '0', 10)
    const monthEnd = endOfMonth(to)
    const daysRemaining = Math.max(0, Math.ceil((monthEnd - to) / (1000 * 60 * 60 * 24)))
    const projectedMonthEnd = isSameMonth ? Math.round(avgUnitsPerDay * (daysInPeriod + daysRemaining)) : closingDo
    const gap = target > 0 ? target - projectedMonthEnd : 0
    const dailyRequired = target > 0 && daysRemaining > 0 ? Math.ceil(gap / daysRemaining) : 0

    // ─── Detail Transaksi ──────────────────────────────────
    const transactions = await prisma.customers.findMany({
      where: baseWhere,
      orderBy: { so_number: 'asc' },
      select: {
        so_number: true,
        so_date: true,
        salesman: true,
        customer_name: true,
        type: true,
        color: true,
        model: true,
        sales_type: true,
        sales_coord_name: true,
      },
    })

    res.json({
      transactions,
      summary: {
        closingDo,
        grandTotal,
        cashCount,
        cashPercent,
        creditCount,
        creditPercent,
        // Kumulatif bulan ini
        cashMonthCount,
        cashMonthPercent,
        creditMonthCount,
        creditMonthPercent,
        totalMonthCount,
        // Master sales coverage (single source of truth — active salespeople count)
        totalActiveSales: activeSalesCount,
        salesWithClosing: teamPeriodResult.salesWithClosing,
      },
      byTeam: teamResult.byTeam,
      byLeasing,
      byModel: byModel.map((d) => ({
        name: d.model || 'Tidak diketahui',
        count: d._count,
      })),
      byKabupaten,
      byKecamatan,
      // Period-only data for Dashboard tab
      byTeamPeriod: teamPeriodResult.byTeam,
      byLeasingPeriod,
      byModelPeriod,
      byKabupatenPeriod,
      byKecamatanPeriod,
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
      // Analytics
      comparison: {
        prevTotal,
        prevCash,
        prevCredit,
        growthPercent,
        cashGrowthPercent,
        creditGrowthPercent,
      },
      dailyTrend,
      areaModelCorrelation,
      analysis: {
        avgUnitsPerDay: Math.round(avgUnitsPerDay * 100) / 100,
        avgUnitsPerSales: Math.round(avgUnitsPerSales * 100) / 100,
        target,
        projectedMonthEnd,
        gap,
        daysRemaining,
        dailyRequired,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function exportShowroomSalesDashboard(req, res, next) {
  try {
    const { from, to } = getDateRange(req)

    const baseWhere = {
      branch_code: 'DXK',
      so_date: { gte: from, lte: to },
    }

    const records = await prisma.customers.findMany({
      where: baseWhere,
      orderBy: { so_number: 'asc' },
      select: {
        so_number: true,
        so_date: true,
        salesman: true,
        customer_name: true,
        type: true,
        color: true,
        model: true,
        sales_type: true,
        sales_coord_name: true,
      },
    })

    // Sheet 1: Detail Transaksi
    const detailData = records.map((r, i) => ({
      No: i + 1,
      'SO Number': r.so_number,
      Date: r.so_date ? formatForExcel(r.so_date) : '',
      'Sales Coordinator': r.sales_coord_name || '',
      'Sales Name': r.salesman || '',
      'Customer Name': r.customer_name || '',
      Type: r.type || '',
      Color: r.color || '',
      Model: r.model || '',
      Leasing: r.sales_type || '',
    }))

    // Sheet 2: Ringkasan
    const closingDo = records.length
    const cashCount = records.filter((r) => r.sales_type === 'Cash').length
    const creditCount = closingDo - cashCount
    const summaryData = [
      { 'Keterangan': 'Closing DO', 'Nilai': closingDo },
      { 'Keterangan': 'Cash', 'Nilai': cashCount },
      { 'Keterangan': 'Kredit', 'Nilai': creditCount },
      { 'Keterangan': 'Cash %', 'Nilai': closingDo > 0 ? `${Math.round((cashCount / closingDo) * 100)}%` : '0%' },
      { 'Keterangan': 'Kredit %', 'Nilai': closingDo > 0 ? `${Math.round((creditCount / closingDo) * 100)}%` : '0%' },
    ]

    const ws1 = xlsx.utils.json_to_sheet(detailData)
    const ws2 = xlsx.utils.json_to_sheet(summaryData)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws1, 'Detail Transaksi')
    xlsx.utils.book_append_sheet(wb, ws2, 'Ringkasan')
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `Closing_Harian_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    next(error)
  }
}
