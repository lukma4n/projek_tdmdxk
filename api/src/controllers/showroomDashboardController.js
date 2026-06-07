import { prisma } from '../config/db.js'
import { getKsuSummaryData } from './showroomKsu.js'

export async function getShowroomDashboard(req, res, next) {
  try {
    const [totalUnits, aging60, aging90, byLocation, bySeries, totalStnk, totalBpkb, stnkByLocation, bpkbByLocation, latestStock, latestStnk, latestBpkb, latestPrice, ksuSummary] = await Promise.all([
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK' } }),
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK', stock_aging_days: { gte: 60 } } }),
      prisma.showroom_stock_units.count({ where: { branch_code: 'DXK', stock_aging_days: { gte: 90 } } }),
      prisma.showroom_stock_units.groupBy({ by: ['location'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { location: 'desc' } }, take: 10 }),
      prisma.showroom_stock_units.groupBy({ by: ['series'], where: { branch_code: 'DXK' }, _count: true, orderBy: { _count: { series: 'desc' } }, take: 10 }),
      prisma.showroom_stnk_bpkb_tracks.count({ where: { branch_code: 'DXK', stnk_status: 'BELUM_DIAMBIL' } }),
      prisma.showroom_stnk_bpkb_tracks.count({ where: { branch_code: 'DXK', bpkb_status: 'BELUM_DIAMBIL' } }),
      prisma.showroom_stnk_bpkb_tracks.groupBy({ by: ['lokasi_stnk'], where: { branch_code: 'DXK', stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: { not: null } }, _count: true, orderBy: { _count: { lokasi_stnk: 'desc' } }, take: 10 }),
      prisma.showroom_stnk_bpkb_tracks.groupBy({ by: ['lokasi_bpkb'], where: { branch_code: 'DXK', bpkb_status: 'BELUM_DIAMBIL', lokasi_bpkb: { not: null } }, _count: true, orderBy: { _count: { lokasi_bpkb: 'desc' } }, take: 10 }),
      prisma.showroom_stock_units.findFirst({ where: { branch_code: 'DXK' }, orderBy: { synced_at: 'desc' }, select: { synced_at: true } }),
      prisma.showroom_stnk_bpkb_tracks.findFirst({ where: { branch_code: 'DXK' }, orderBy: { synced_at: 'desc' }, select: { synced_at: true } }),
      prisma.showroom_stnk_bpkb_tracks.findFirst({ where: { branch_code: 'DXK' }, orderBy: { synced_at: 'desc' }, select: { synced_at: true } }),
      prisma.showroom_otr_prices.findFirst({ orderBy: { synced_at: 'desc' }, select: { synced_at: true, effective_date: true } }),
      getKsuSummaryData(prisma),
    ])

    res.json({
      totalUnits,
      aging60,
      aging90,
      totalStnk,
      totalBpkb,
      byLocation,
      bySeries,
      documents: {
        stnkByLocation,
        bpkbByLocation,
      },
      ksu: ksuSummary,
      freshness: {
        stockUnit: latestStock?.synced_at || null,
        stnk: latestStnk?.synced_at || null,
        bpkb: latestBpkb?.synced_at || null,
        price: latestPrice?.synced_at || null,
        priceEffectiveDate: latestPrice?.effective_date || null,
      },
    })
  } catch (error) {
    next(error)
  }
}
