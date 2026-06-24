import { prisma } from '../config/db.js'
import { getCache, setCache } from '../config/redis.js'

// Modul import yang dipantau kesegaran datanya (urutan = urutan tampil).
// Tanggal diambil dari sync_logs (ditulis tiap import). Tambah entri di sini
// bila modul lain mulai mencatat ke sync_logs.
const FRESHNESS_MODULES = [
  ['hotline', 'Hotline'],
  ['stock', 'Stock Sparepart'],
  ['workshop', 'Workshop'],
  ['sales', 'Data Konsumen'],
  ['showroom_stock_unit', 'Stok Unit Showroom'],
  ['showroom_otr_price', 'Harga OTR'],
  ['showroom_off_purchase_price', 'Harga Beli (Off-road)'],
  ['showroom_stnk_bpkb_track', 'STNK/BPKB Track'],
]

// Bangun ringkasan kesegaran data import per modul (last import + jumlah baris).
async function buildFreshness() {
  const [counts, logs] = await Promise.all([
    Promise.all([
      prisma.hotlines.count(),
      prisma.stock_parts.count(),
      prisma.work_orders.count(),
      prisma.customers.count({ where: { branch_code: 'DXK' } }),
      prisma.showroom_stock_units.count(),
      prisma.showroom_otr_prices.count(),
      prisma.showroom_stnk_bpkb_tracks.count(),
    ]),
    prisma.sync_logs.findMany({ orderBy: { synced_at: 'desc' }, take: 500 }),
  ])
  const countMap = {
    hotline: counts[0], stock: counts[1], workshop: counts[2], sales: counts[3],
    showroom_stock_unit: counts[4], showroom_otr_price: counts[5],
    showroom_off_purchase_price: counts[5], // off-road tersimpan di tabel OTR
    showroom_stnk_bpkb_track: counts[6],
  }
  const latestByModule = new Map()
  for (const log of logs) {
    if (!latestByModule.has(log.module)) latestByModule.set(log.module, log)
  }
  return FRESHNESS_MODULES.map(([module, label]) => {
    const log = latestByModule.get(module)
    return {
      module,
      label,
      last_import_at: log?.synced_at || null,
      filename: log?.filename || null,
      rows_success: log?.rows_success || 0,
      rows_error: log?.rows_error || 0,
      total_rows: countMap[module] ?? 0,
    }
  })
}

// Endpoint khusus halaman "Kesegaran Data" (lebih ringan dari summary penuh).
export async function getFreshness(req, res, next) {
  try {
    res.json({ freshness: await buildFreshness() })
  } catch (error) {
    next(error)
  }
}

export async function getSummary(req, res, next) {
  try {
    const cacheKey = 'dashboard:summary'
    const cached = await getCache(cacheKey)
    
    if (cached) {
      return res.json(JSON.parse(cached))
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const [totalWO, totalHotline, criticalStock, openWO, attentionStock] = await Promise.all([
      prisma.work_orders.count({
        where: {
          date_confirm: { gte: today },
          state: 'done',
        },
      }),
      prisma.hotlines.count({
        where: {
          state: { in: ['Approved', 'Waiting_For_Approval'] },
        },
      }),
      prisma.stock_parts.count({
        where: { aging_days: { gt: 365 } },
      }),
      prisma.work_orders.count({
        where: { state: 'open' },
      }),
      prisma.stock_parts.count({
        where: {
          aging_days: { gte: 180, lte: 365 },
        },
      }),
    ])

    const [revenue, yesterdayRevenueAgg, yesterdayWO] = await Promise.all([
      prisma.work_orders.aggregate({
        where: {
          date_confirm: { gte: today },
          state: 'done',
        },
        _sum: { total: true },
      }),
      prisma.work_orders.aggregate({
        where: {
          date_confirm: { gte: yesterday, lt: today },
          state: 'done',
        },
        _sum: { total: true },
      }),
      prisma.work_orders.count({
        where: {
          date_confirm: { gte: yesterday, lt: today },
          state: 'done',
        },
      }),
    ])

    const freshness = await buildFreshness()

    const result = {
      totalWO,
      totalHotline,
      criticalStock,
      openWO,
      attentionStock,
      revenue: revenue._sum.total || 0,
      trend: {
        totalWO: {
          current: totalWO,
          previous: yesterdayWO,
          delta: totalWO - yesterdayWO,
        },
        revenue: {
          current: revenue._sum.total || 0,
          previous: yesterdayRevenueAgg._sum.total || 0,
          delta: (revenue._sum.total || 0) - (yesterdayRevenueAgg._sum.total || 0),
        },
      },
      alerts: {
        critical: [
          ...(criticalStock > 0 ? [{ type: 'stock', message: `${criticalStock} part aging > 365 hari`, path: '/stock' }] : []),
        ],
        attention: [
          ...(attentionStock > 0 ? [{ type: 'stock', message: `${attentionStock} part aging 180-365 hari`, path: '/stock' }] : []),
          ...(openWO > 0 ? [{ type: 'workshop', message: `${openWO} WO masih open`, path: '/workshop' }] : []),
        ],
      },
      freshness,
    }

    await setCache(cacheKey, JSON.stringify(result), 300)
    res.json(result)
  } catch (error) {
    next(error)
  }
}
