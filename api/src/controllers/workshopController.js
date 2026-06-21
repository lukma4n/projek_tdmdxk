import { prisma } from '../config/db.js'
import { clampLimit } from '../utils/pagination.js'

export async function getWorkOrders(req, res, next) {
  try {
    const { page = 1, limit = 50, state, type, mechanic, search, from, to } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}

    if (state && state !== 'all') {
      where.state = state
    }

    if (type && type !== 'all') {
      where.type = type
    }

    if (mechanic && mechanic !== 'all') {
      where.mechanic = mechanic
    }

    if (search) {
      where.OR = [
        { wo_number: { contains: search } },
        { customer_name: { contains: search } },
        { no_polisi: { contains: search } },
      ]
    }

    if (from || to) {
      where.date_confirm = {}
      if (from) where.date_confirm.gte = new Date(from)
      if (to) where.date_confirm.lte = new Date(to)
    }

    const [workOrders, total] = await Promise.all([
      prisma.work_orders.findMany({
        where,
        skip,
        take: clampLimit(limit, 50),
        orderBy: { date_confirm: 'desc' },
      }),
      prisma.work_orders.count({ where }),
    ])

    res.json({
      data: workOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getSummary(req, res, next) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalDone, totalCancel, totalOpen, totalRevenue,
      kpbTotal, kpbDone, kpbCancel, kpbOpen, kpbRevenue,
      lcrTotal, lcrDone, lcrCancel, lcrOpen, lcrRevenue] = await Promise.all([
      prisma.work_orders.count({ where: { state: 'done' } }),
      prisma.work_orders.count({ where: { state: 'cancel' } }),
      prisma.work_orders.count({ where: { state: 'open' } }),
      prisma.work_orders.aggregate({
        where: { state: 'done' },
        _sum: { total: true },
      }),
      // KPB
      prisma.work_orders.count({ where: { type: 'KPB' } }),
      prisma.work_orders.count({ where: { type: 'KPB', state: 'done' } }),
      prisma.work_orders.count({ where: { type: 'KPB', state: 'cancel' } }),
      prisma.work_orders.count({ where: { type: 'KPB', state: 'open' } }),
      prisma.work_orders.aggregate({ where: { type: 'KPB', state: 'done' }, _sum: { total: true } }),
      // LCR
      prisma.work_orders.count({ where: { type: 'LCR' } }),
      prisma.work_orders.count({ where: { type: 'LCR', state: 'done' } }),
      prisma.work_orders.count({ where: { type: 'LCR', state: 'cancel' } }),
      prisma.work_orders.count({ where: { type: 'LCR', state: 'open' } }),
      prisma.work_orders.aggregate({ where: { type: 'LCR', state: 'done' }, _sum: { total: true } }),
    ])

    const mechanics = await prisma.work_orders.groupBy({
      by: ['mechanic'],
      where: { state: 'done' },
      _count: { mechanic: true },
      orderBy: { _count: { mechanic: 'desc' } },
    })

    const cancelReasons = await prisma.work_orders.groupBy({
      by: ['alasan_batal'],
      where: {
        state: 'cancel',
        alasan_batal: { not: null },
      },
      _count: { alasan_batal: true },
      orderBy: { _count: { alasan_batal: 'desc' } },
      take: 10,
    })

    const doneCount = totalDone || 1

    res.json({
      summary: {
        total: totalDone + totalCancel + totalOpen,
        done: totalDone,
        cancel: totalCancel,
        open: totalOpen,
        revenue: totalRevenue._sum.total || 0,
        average: (totalRevenue._sum.total || 0) / doneCount,
      },
      programBreakdown: {
        kpb: {
          label: 'KPB (Servis Berkala)',
          total: kpbTotal,
          done: kpbDone,
          cancel: kpbCancel,
          open: kpbOpen,
          revenue: kpbRevenue._sum.total || 0,
        },
        lcr: {
          label: 'LCR (Layanan Cek Rangka)',
          total: lcrTotal,
          done: lcrDone,
          cancel: lcrCancel,
          open: lcrOpen,
          revenue: lcrRevenue._sum.total || 0,
        },
      },
      mechanics: mechanics.map(m => ({
        name: m.mechanic,
        count: m._count.mechanic,
      })),
      cancelReasons: cancelReasons.map(r => ({
        reason: r.alasan_batal,
        count: r._count.alasan_batal,
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function getMechanics(req, res, next) {
  try {
    const mechanics = await prisma.work_orders.groupBy({
      by: ['mechanic'],
      _count: { mechanic: true },
      orderBy: { _count: { mechanic: 'desc' } },
    })

    res.json({ data: mechanics.map(m => m.mechanic) })
  } catch (error) {
    next(error)
  }
}

export async function getMechanicPerformance(req, res, next) {
  try {
    const { from, to } = req.query

    // Default to last 90 days to avoid loading all 60K+ WO into memory
    const defaultFrom = new Date()
    defaultFrom.setDate(defaultFrom.getDate() - 90)
    const dateFrom = from ? new Date(from) : defaultFrom
    const dateTo = to ? new Date(to) : new Date()

    const where = {
      mechanic: { not: null },
      date_confirm: {
        gte: dateFrom,
        lte: dateTo,
      },
    }

    // Use Prisma aggregation for counts and revenue — no JS grouping needed
    const [doneStats, cancelStats, openStats, revenueStats] = await Promise.all([
      prisma.work_orders.groupBy({
        by: ['mechanic'],
        where: { ...where, state: 'done' },
        _count: { mechanic: true },
      }),
      prisma.work_orders.groupBy({
        by: ['mechanic'],
        where: { ...where, state: 'cancel' },
        _count: { mechanic: true },
      }),
      prisma.work_orders.groupBy({
        by: ['mechanic'],
        where: { ...where, state: 'open' },
        _count: { mechanic: true },
      }),
      prisma.work_orders.groupBy({
        by: ['mechanic'],
        where: { ...where, state: 'done' },
        _sum: { total: true },
      }),
    ])

    const map = new Map()
    for (const s of doneStats) {
      const m = s.mechanic?.trim()
      if (!m) continue
      map.set(m, { mechanic: m, done: s._count.mechanic, cancel: 0, open: 0, revenue: 0, latest: [] })
    }
    for (const s of cancelStats) {
      const m = s.mechanic?.trim()
      if (!m || !map.has(m)) continue
      map.get(m).cancel = s._count.mechanic
    }
    for (const s of openStats) {
      const m = s.mechanic?.trim()
      if (!m || !map.has(m)) continue
      map.get(m).open = s._count.mechanic
    }
    for (const s of revenueStats) {
      const m = s.mechanic?.trim()
      if (!m || !map.has(m)) continue
      map.get(m).revenue = Math.round(s._sum.total || 0)
    }

    // Fetch latest 5 done WOs per mechanic (top 20 mechanics by revenue to limit query)
    const topMechanics = Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)
      .map((m) => m.mechanic)

    if (topMechanics.length > 0) {
      const latestWos = await prisma.work_orders.findMany({
        where: {
          mechanic: { in: topMechanics },
          state: 'done',
          date_confirm: { gte: dateFrom, lte: dateTo },
        },
        select: {
          mechanic: true,
          wo_number: true,
          date_confirm: true,
          no_polisi: true,
          customer_name: true,
          product_name: true,
          total: true,
        },
        orderBy: { date_confirm: 'desc' },
        take: topMechanics.length * 5,
      })

      for (const wo of latestWos) {
        const m = wo.mechanic?.trim()
        if (!m || !map.has(m)) continue
        const entry = map.get(m)
        if (entry.latest.length < 5) {
          entry.latest.push({
            wo_number: wo.wo_number,
            date_confirm: wo.date_confirm,
            no_polisi: wo.no_polisi,
            customer_name: wo.customer_name,
            product_name: wo.product_name,
            total: wo.total,
          })
        }
      }
    }

    const results = Array.from(map.values())
      .map((m) => ({
        ...m,
        average: m.revenue > 0 && m.done > 0 ? Math.round(m.revenue / m.done) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const topRevenue = results.slice(0, 5)
    const topDone = [...results].sort((a, b) => b.done - a.done).slice(0, 5)
    const topMechanic = results[0] || null

    res.json({
      data: results,
      summary: {
        totalMechanics: results.length,
        topRevenue,
        topDone,
        topMechanic,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getProgramSummary(req, res, next) {
  try {
    const { from, to } = req.query
    const dateFilter = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const kpbWhere = { type: 'KPB', ...(Object.keys(dateFilter).length > 0 && { date_confirm: dateFilter }) }
    const lcrWhere = { type: 'LCR', ...(Object.keys(dateFilter).length > 0 && { date_confirm: dateFilter }) }

    const [kpbTotal, kpbDone, kpbCancel, kpbOpen, kpbRevenue,
      lcrTotal, lcrDone, lcrCancel, lcrOpen, lcrRevenue] = await Promise.all([
      prisma.work_orders.count({ where: kpbWhere }),
      prisma.work_orders.count({ where: { ...kpbWhere, state: 'done' } }),
      prisma.work_orders.count({ where: { ...kpbWhere, state: 'cancel' } }),
      prisma.work_orders.count({ where: { ...kpbWhere, state: 'open' } }),
      prisma.work_orders.aggregate({ where: { ...kpbWhere, state: 'done' }, _sum: { total: true } }),
      prisma.work_orders.count({ where: lcrWhere }),
      prisma.work_orders.count({ where: { ...lcrWhere, state: 'done' } }),
      prisma.work_orders.count({ where: { ...lcrWhere, state: 'cancel' } }),
      prisma.work_orders.count({ where: { ...lcrWhere, state: 'open' } }),
      prisma.work_orders.aggregate({ where: { ...lcrWhere, state: 'done' }, _sum: { total: true } }),
    ])

    res.json({
      kpb: {
        label: 'Kartu Perawatan Berkala (KPB)',
        total: kpbTotal,
        done: kpbDone,
        cancel: kpbCancel,
        open: kpbOpen,
        revenue: kpbRevenue._sum.total || 0,
      },
      lcr: {
        label: 'Layanan Cek Rangka (LCR)',
        total: lcrTotal,
        done: lcrDone,
        cancel: lcrCancel,
        open: lcrOpen,
        revenue: lcrRevenue._sum.total || 0,
      },
    })
  } catch (error) {
    next(error)
  }
}
