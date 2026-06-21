import { prisma } from '../config/db.js'

export async function getTargets(req, res, next) {
  try {
    const { year, month } = req.query
    const where = {}
    if (year) where.period_year = parseInt(year)
    if (month) where.period_month = parseInt(month)

    const targets = await prisma.workshop_marketing_targets.findMany({
      where,
      orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }, { mechanic: 'asc' }]
    })
    res.json(targets)
  } catch (err) {
    next(err)
  }
}

export async function createTarget(req, res, next) {
  try {
    const { period_year, period_month, mechanic, target_unit, target_revenue, target_jasa, target_part, target_oli, target_lcr, notes } = req.body
    const target = await prisma.workshop_marketing_targets.create({
      data: {
        period_year,
        period_month,
        mechanic: mechanic || 'ALL',
        target_unit: target_unit || 0,
        target_revenue: target_revenue || 0,
        target_jasa: target_jasa || 0,
        target_part: target_part || 0,
        target_oli: target_oli || 0,
        target_lcr: target_lcr || 0,
        notes,
        created_by: req.user?.userId
      }
    })
    res.json(target)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Target untuk mekanik dan periode ini sudah ada' })
    next(err)
  }
}

export async function updateTarget(req, res, next) {
  try {
    const { id } = req.params
    const { target_unit, target_revenue, target_jasa, target_part, target_oli, target_lcr, notes, is_active } = req.body
    const target = await prisma.workshop_marketing_targets.update({
      where: { id: parseInt(id) },
      data: { target_unit, target_revenue, target_jasa, target_part, target_oli, target_lcr, notes, is_active }
    })
    res.json(target)
  } catch (err) {
    next(err)
  }
}

export async function deleteTarget(req, res, next) {
  try {
    const { id } = req.params
    await prisma.workshop_marketing_targets.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Target berhasil dihapus' })
  } catch (err) {
    next(err)
  }
}

export async function getSalesAnalysis(req, res, next) {
  try {
    const { from, to } = req.query
    const dateQuery = {}
    if (from && to) {
      dateQuery.date_confirm = { gte: new Date(from), lte: new Date(to + 'T23:59:59.999Z') }
    }

    const where = { state: 'done', ...dateQuery }

    const byTypeRaw = await prisma.work_orders.groupBy({
      by: ['type'],
      where,
      _sum: { total: true },
      _count: { wo_number: true }
    })

    const byMechanicRaw = await prisma.work_orders.groupBy({
      by: ['mechanic'],
      where,
      _sum: { total: true },
      _count: { wo_number: true }
    })

    const totalRevenue = byTypeRaw.reduce((acc, curr) => acc + (curr._sum.total || 0), 0)
    const totalWO = byTypeRaw.reduce((acc, curr) => acc + curr._count.wo_number, 0)

    res.json({
      period: { from, to },
      summary: { totalRevenue, totalWO },
      byType: byTypeRaw.map(x => ({ type: x.type || 'Lainnya', revenue: x._sum.total || 0, count: x._count.wo_number })).sort((a,b) => b.revenue - a.revenue),
      byMechanic: byMechanicRaw.map(x => ({ mechanic: x.mechanic || 'Tanpa Mekanik', revenue: x._sum.total || 0, count: x._count.wo_number })).sort((a,b) => b.revenue - a.revenue)
    })
  } catch(err) {
    next(err)
  }
}

export async function getClosingDaily(req, res, next) {
  try {
    const { date } = req.query
    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0,0,0,0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23,59,59,999)

    const where = {
      state: 'done',
      date_confirm: { gte: targetDate, lte: endOfDay }
    }

    const wos = await prisma.work_orders.findMany({
      where,
      orderBy: { date_confirm: 'desc' }
    })

    const totalRevenue = wos.reduce((acc, curr) => acc + curr.total, 0)
    const totalDiscount = wos.reduce((acc, curr) => acc + curr.discount_amount, 0)
    const totalWO = wos.length

    const byMechanicMap = {}
    for (const wo of wos) {
      const mech = wo.mechanic || 'Tanpa Mekanik'
      if (!byMechanicMap[mech]) byMechanicMap[mech] = { mechanic: mech, count: 0, revenue: 0 }
      byMechanicMap[mech].count++
      byMechanicMap[mech].revenue += wo.total
    }

    res.json({
      period: date || targetDate.toISOString().split('T')[0],
      summary: { totalRevenue, totalDiscount, totalWO },
      byMechanic: Object.values(byMechanicMap).sort((a,b) => b.revenue - a.revenue),
      transactions: wos.map(x => ({
        wo_number: x.wo_number,
        date: x.date_confirm,
        mechanic: x.mechanic,
        type: x.type,
        customer_name: x.customer_name,
        total: x.total
      }))
    })
  } catch (err) {
    next(err)
  }
}
