import { prisma } from '../config/db.js'
import xlsx from 'xlsx'
import { formatForExcel } from '../utils/excelUtils.js'
import { normalizeKey } from '../utils/salesPerformance.js'
import { computeTeamPerformance } from '../services/teamStructureService.js'
import { countWorkingDays } from '../utils/workingDays.js'

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
    // Dikelompokkan memakai susunan tim bulan transaksi (showroom_team_assignments),
    // bukan master hari ini — mutasi tim tidak menulis ulang laporan lama.
    // Master sales hanya dipakai untuk nama tampilan leaderboard.
    const masterSalespeople = await prisma.showroom_salespeople.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    })

    // Kumulatif dari awal bulan s/d tanggal filter
    const teamResult = await computeTeamPerformance(prisma, { from: monthStart, to })

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

    // ─── Detail per Wilayah (dipakai untuk kabupaten & kecamatan) ───
    // Per wilayah: total, cash, breakdown leasing — masing-masing dengan count bln ini
    // & bln lalu (untuk komposisi% + pembanding MoM per tipe di frontend).
    // `field` = 'kabupaten' | 'kecamatan'.
    // limit <= 0 berarti tampilkan semua wilayah (tanpa batas).
    async function buildAreaDetail(field, curWhere, priorWhere, limit = 15) {
      const [curRows, prevRows] = await Promise.all([
        prisma.customers.groupBy({
          by: [field, 'sales_type'],
          where: { ...curWhere, [field]: { not: null } },
          _count: true,
        }),
        prisma.customers.groupBy({
          by: [field, 'sales_type'],
          where: { ...priorWhere, [field]: { not: null } },
          _count: true,
        }),
      ])

      // Rakit per wilayah: { count, cash, leasing:{type:count} }
      function assemble(rows) {
        const m = new Map()
        for (const r of rows) {
          const name = r[field] || 'Tidak diketahui'
          if (!m.has(name)) m.set(name, { count: 0, cash: 0, leasing: {} })
          const e = m.get(name)
          const c = r._count
          e.count += c
          if (r.sales_type === 'Cash') e.cash += c
          else if (LEASING_TYPES.includes(r.sales_type)) e.leasing[r.sales_type] = (e.leasing[r.sales_type] || 0) + c
        }
        return m
      }
      const curMap = assemble(curRows)
      const prevMap = assemble(prevRows)
      const empty = { count: 0, cash: 0, leasing: {} }

      const mapped = [...curMap.entries()]
        .map(([name, e]) => {
          const p = prevMap.get(name) || empty
          return {
            name,
            count: e.count,
            cash: e.cash,
            prev: p.count,
            prevCash: p.cash,
            growth: p.count > 0 ? Math.round(((e.count - p.count) / p.count) * 100) : 0,
            // tiap leasing: { name, count (bln ini), prev (bln lalu) }
            leasingArr: LEASING_TYPES
              .map((n) => ({ name: n, count: e.leasing[n] || 0, prev: p.leasing[n] || 0 }))
              .filter((l) => l.count > 0 || l.prev > 0),
          }
        })
        .sort((a, b) => b.count - a.count)
      return limit > 0 ? mapped.slice(0, limit) : mapped
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
    const teamPeriodResult = await computeTeamPerformance(prisma, { from, to })
    const activeSalesCount = teamPeriodResult.totalMembers
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

    // Kabupaten & Kecamatan dengan detail (cash/kredit/leasing + MoM) dihitung
    // di bawah, setelah prevWhere tersedia — lihat buildAreaDetail().

    // ─── Period Comparison (vs Previous Month Same Date Range) ───
    const { prevFrom, prevTo } = prevMonthRange(from, to)
    const prevWhere = { branch_code: 'DXK', so_date: { gte: prevFrom, lte: prevTo } }
    const prevTotal = await prisma.customers.count({ where: prevWhere })
    const prevCash = await prisma.customers.count({ where: { ...prevWhere, sales_type: 'Cash' } })
    const prevCredit = prevTotal - prevCash
    const growthPercent = prevTotal > 0 ? Math.round(((closingDo - prevTotal) / prevTotal) * 100) : 0
    const cashGrowthPercent = prevCash > 0 ? Math.round(((cashCount - prevCash) / prevCash) * 100) : 0
    const creditGrowthPercent = prevCredit > 0 ? Math.round(((creditCount - prevCredit) / prevCredit) * 100) : 0

    // ─── Leasing Comparison (vs Previous Month) ───
    const prevLeasingRaw = await prisma.customers.groupBy({
      by: ['sales_type'],
      where: { ...prevWhere, sales_type: { in: LEASING_TYPES } },
      _count: true,
    })
    const prevLeasingMap = Object.fromEntries(prevLeasingRaw.map((r) => [r.sales_type, r._count]))
    const leasingComparison = LEASING_TYPES.map((name) => {
      const current = byLeasingPeriod.find((l) => l.name === name)?.count || 0
      const prev = prevLeasingMap[name] || 0
      const growth = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0
      return { name, current, prev, growth }
    })

    // Total periode sebenarnya untuk baris TOTAL tabel wilayah.
    // Mewakili SEMUA wilayah (termasuk di luar top-15 & record tanpa kecamatan/kabupaten),
    // sehingga TOTAL rekonsiliasi dengan Closing DO — bukan sekadar jumlah baris yang tampil.
    const areaTotals = {
      count: closingDo,
      prev: prevTotal,
      cash: cashCount,
      prevCash,
      leasing: Object.fromEntries(LEASING_TYPES.map((t) => [t, {
        count: byLeasingPeriod.find((l) => l.name === t)?.count || 0,
        prev: prevLeasingMap[t] || 0,
      }])),
    }

    // ─── Team Comparison (vs Previous Month) ───
    const teamPeriodResultPrev = await computeTeamPerformance(prisma, { from: prevFrom, to: prevTo })
    const prevTeamMap = Object.fromEntries(teamPeriodResultPrev.byTeam.map((t) => [`${t.kind}:${t.team}`, t.total]))
    const teamComparison = teamPeriodResult.byTeam.map((t) => {
      const prev = prevTeamMap[`${t.kind}:${t.team}`] || 0
      const growth = prev > 0 ? Math.round(((t.total - prev) / prev) * 100) : 0
      return { team: t.team, kind: t.kind, pos: t.pos, location: t.location, current: t.total, prev, growth }
    })

    // Enrich byTeamPeriod: tambah prev count per salesman (untuk MoM per-sales di TeamCard).
    // Komparasi tingkat-tim sudah ditampilkan di section "Komparasi Performa Tim".
    const prevSalesCountMap = new Map()
    for (const t of teamPeriodResultPrev.byTeam) {
      for (const s of t.salesmen) prevSalesCountMap.set(normalizeKey(s.name), s.count)
    }
    const byTeamPeriod = teamPeriodResult.byTeam.map((t) => ({
      ...t,
      salesmen: t.salesmen.map((s) => ({ ...s, prev: prevSalesCountMap.get(normalizeKey(s.name)) || 0 })),
    }))

    // ─── Top Salespeople Leaderboard ───
    // Normalisasi nama (trim+uppercase) agar "Gunawan" & "GUNAWAN" tidak dobel.
    // Pakai nama master sebagai display bila ada; fallback ke nama mentah.
    const salesmenRecords = await prisma.customers.findMany({
      where: { ...baseWhere, AND: [{ salesman: { not: null } }, { salesman: { not: '' } }] },
      select: { salesman: true },
    })
    const masterNameByKey = new Map(masterSalespeople.map((s) => [normalizeKey(s.name), s.name]))
    const salesCountMap = new Map()
    for (const r of salesmenRecords) {
      const key = normalizeKey(r.salesman)
      if (!key) continue
      const display = masterNameByKey.get(key) || r.salesman.trim()
      if (!salesCountMap.has(key)) salesCountMap.set(key, { name: display, count: 0 })
      salesCountMap.get(key).count++
    }
    const salesRanked = [...salesCountMap.values()].sort((a, b) => b.count - a.count)
    const topSalespeople = salesRanked.slice(0, 5).map((s) => ({
      name: s.name,
      count: s.count,
    }))
    // Konsentrasi Pareto: kontribusi 20% sales teratas (untuk catatan di bawah leaderboard)
    const totalSalesUnits = salesRanked.reduce((sum, s) => sum + s.count, 0)
    const top20Count = Math.max(1, Math.ceil(salesRanked.length * 0.2))
    const top20Units = salesRanked.slice(0, top20Count).reduce((sum, s) => sum + s.count, 0)
    const paretoTopPct = salesRanked.length > 0 ? Math.round((top20Count / salesRanked.length) * 100) : 0
    const paretoShare = totalSalesUnits > 0 ? Math.round((top20Units / totalSalesUnits) * 100) : 0

    // ─── Detail Kabupaten & Kecamatan (cash/kredit/leasing + MoM) ───
    const byKabupatenPeriod = await buildAreaDetail('kabupaten', baseWhere, prevWhere)
    const byKecamatanPeriod = await buildAreaDetail('kecamatan', baseWhere, prevWhere, 0) // 0 = semua kecamatan

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
    const salesCount = teamPeriodResult.totalMembers || 1
    const avgUnitsPerSales = closingDo / salesCount

    // Proyeksi berbasis HARI KERJA (Senin–Sabtu, exclude tanggal merah).
    // Showroom tidak operasi Minggu & libur nasional, jadi proyeksi pakai pace
    // per hari kerja agar tidak meleset.
    const monthEnd = endOfMonth(to)
    const dayAfterTo = new Date(toStartOfDay)
    dayAfterTo.setDate(dayAfterTo.getDate() + 1)
    const workingDaysInPeriod = Math.max(1, countWorkingDays(fromStartOfDay, toStartOfDay))
    const workingDaysRemaining = countWorkingDays(dayAfterTo, monthEnd)
    const avgUnitsPerWorkingDay = closingDo / workingDaysInPeriod

    const target = parseInt(req.query.target || '0', 10)
    const daysRemaining = workingDaysRemaining // makna: sisa HARI KERJA s/d akhir bulan
    const projectedMonthEnd = isSameMonth
      ? Math.round(avgUnitsPerWorkingDay * (workingDaysInPeriod + workingDaysRemaining))
      : closingDo
    const gap = target > 0 ? target - projectedMonthEnd : 0
    const dailyRequired = target > 0 && workingDaysRemaining > 0 ? Math.ceil(gap / workingDaysRemaining) : 0
    const attainmentRate = target > 0 ? Math.round((closingDo / target) * 1000) / 10 : 0
    // targetPace tetap berbasis hari kalender (garis referensi di chart tren harian)
    const totalDaysInMonth = monthEnd.getDate()
    const targetPace = target > 0 ? Math.round((target / totalDaysInMonth) * 100) / 100 : 0

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
        productiveRate: activeSalesCount > 0 ? Math.round((teamPeriodResult.salesWithClosing / activeSalesCount) * 100) : 0,
        // Konsentrasi Pareto sales
        paretoTopPct,
        paretoShare,
      },
      byTeam: teamResult.byTeam,
      byPos: teamResult.byPos,
      byLeasing,
      byModel: byModel.map((d) => ({
        name: d.model || 'Tidak diketahui',
        count: d._count,
      })),
      byKabupaten,
      byKecamatan,
      // Period-only data for Dashboard tab
      byTeamPeriod,
      byPosPeriod: teamPeriodResult.byPos,
      byLeasingPeriod,
      byModelPeriod,
      byKabupatenPeriod,
      byKecamatanPeriod,
      areaTotals,
      topSalespeople,
      leasingComparison,
      teamComparison,
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
        attainmentRate,
        targetPace,
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
