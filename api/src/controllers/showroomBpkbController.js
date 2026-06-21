import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { clampLimit } from '../utils/pagination.js'
import { prisma } from '../config/db.js'
import { formatForExcel } from '../utils/excelUtils.js'
import { applyCustomerTypeFilter, getCustomerType, getFinanceCompanyShort } from './showroomUtils.js'

const OVERDUE_THRESHOLD_DAYS = 365

/**
 * BPKB stock = BPKB yang sudah jadi (ada tgl_jadi_bpkb) tapi belum diserahkan
 * ke customer (tgl_penyerahan_bpkb masih kosong).
 *
 * Data source: showroom_stnk_bpkb_tracks (single source of truth dari Track Report v2)
 * Schema lama showroom_bpkbs sudah dihapus.
 */
function buildBpkbStockWhere(query) {
  const where = {
    branch_code: 'DXK',
    bpkb_status: 'BELUM_DIAMBIL',
  }
  if (query.search) {
    const q = String(query.search).trim()
    where.OR = [
      { engine_number: { contains: q } },
      { no_bpkb: { contains: q } },
      { stnk_name: { contains: q } },
      { no_so: { contains: q } },
    ]
  }
  if (query.location && query.location !== 'all') {
    where.lokasi_bpkb = String(query.location)
  }
  applyCustomerTypeFilter(where, query.customer_type)
  return where
}

function trackToBpkbStock(item) {
  const today = new Date()
  const overdueDays = item.tgl_jadi_bpkb
    ? Math.floor((today - new Date(item.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000))
    : 0
  return {
    id: item.id,
    engine_number: item.engine_number,
    stnk_name: item.stnk_name,
    applicant_name: item.stnk_name,
    requestor_name: item.stnk_name,
    customer_address: item.partner_address,
    receipt_number: item.no_bpkb,
    receipt_date: item.tgl_terima_bpkb,
    bpkb_location: item.lokasi_bpkb,
    bpkb_number: item.no_bpkb,
    bpkb_ready_date: item.tgl_jadi_bpkb,
    finance_company: item.finance_company,
    finance_company_short: getFinanceCompanyShort(item.finance_company),
    customer_type: getCustomerType(item.finance_company),
    invoice_number: null,
    customer_phone: item.mobile,
    salesman: null,
    age_raw: null,
    overdue_days: overdueDays,
    synced_at: item.synced_at,
  }
}

export async function getBpkbs(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query
    const pageInt = parseInt(page)
    const limitInt = clampLimit(limit, 50)
    const where = buildBpkbStockWhere(req.query)

    const [tracks, total] = await Promise.all([
      prisma.showroom_stnk_bpkb_tracks.findMany({
        where,
        skip: (pageInt - 1) * limitInt,
        take: limitInt,
        orderBy: { tgl_jadi_bpkb: 'asc' },
      }),
      prisma.showroom_stnk_bpkb_tracks.count({ where }),
    ])

    res.json({
      data: tracks.map(trackToBpkbStock),
      pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) },
    })
  } catch (error) {
    next(error)
  }
}

export async function exportBpkbsExcel(req, res, next) {
  try {
    const where = buildBpkbStockWhere(req.query)
    const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
      where,
      orderBy: { tgl_jadi_bpkb: 'asc' },
    })
    const exportData = tracks.map((item, idx) => {
      const overdueDays = item.tgl_jadi_bpkb
        ? Math.floor((new Date() - new Date(item.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000))
        : 0
      return {
        No: idx + 1,
        Nama_STNK: item.stnk_name || '-',
        Pemohon: item.stnk_name || '-',
        No_Mesin: item.engine_number || '-',
        No_BPKB: item.no_bpkb || '-',
        Lokasi_BPKB: item.lokasi_bpkb || '-',
        Tgl_Terima: formatForExcel(item.tgl_terima_bpkb),
        Jadi_BPKB: formatForExcel(item.tgl_jadi_bpkb),
        Overdue_Hari: overdueDays,
        No_Invoice: '-',
        No_Resi: item.no_bpkb || '-',
        No_HP: item.mobile || '-',
        Salesman: '-',
        Leasing: item.finance_company_short || '-',
      }
    })

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Stock BPKB')

    let suffix = 'Semua'
    if (req.query.location && req.query.location !== 'all') suffix = String(req.query.location).replace(/\s+/g, '_')
    const filename = `Stock_BPKB_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
    const tmpPath = path.join(os.tmpdir(), filename)
    xlsx.writeFile(wb, tmpPath)

    res.download(tmpPath, filename, (err) => {
      if (err) console.error('Download error:', err)
      try { rmSync(tmpPath) } catch (e) {}
    })
  } catch (error) {
    next(error)
  }
}

export async function getBpkbSummary(req, res, next) {
  try {
    const where = { branch_code: 'DXK', bpkb_status: 'BELUM_DIAMBIL' }
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - OVERDUE_THRESHOLD_DAYS)

    const [total, allOverdueItems, byLocation, latest, byCustomerType] = await Promise.all([
      prisma.showroom_stnk_bpkb_tracks.count({ where }),
      prisma.showroom_stnk_bpkb_tracks.findMany({
        where: { ...where, tgl_jadi_bpkb: { lt: thresholdDate } },
        select: { tgl_jadi_bpkb: true },
      }),
      prisma.showroom_stnk_bpkb_tracks.groupBy({
        by: ['lokasi_bpkb'],
        where: { ...where, lokasi_bpkb: { not: null } },
        _count: true,
        orderBy: { _count: { lokasi_bpkb: 'desc' } },
        take: 10,
      }),
      prisma.showroom_stnk_bpkb_tracks.findFirst({
        orderBy: { synced_at: 'desc' },
        select: { synced_at: true },
      }),
      // Cash vs Kredit
      prisma.showroom_stnk_bpkb_tracks.groupBy({
        by: ['finance_company'],
        where,
        _count: true,
      }),
    ])

    const mappedByLocation = byLocation.map((item) => ({
      bpkb_location: item.lokasi_bpkb,
      _count: item._count,
    }))

    let cash = 0
    let kredit = 0
    for (const item of byCustomerType) {
      if (!item.finance_company || !String(item.finance_company).trim()) cash += item._count
      else kredit += item._count
    }

    res.json({
      total,
      overdue365: allOverdueItems.length,
      byLocation: mappedByLocation,
      byCustomerType: { cash, kredit },
      latestSyncedAt: latest?.synced_at || null,
    })
  } catch (error) {
    next(error)
  }
}

export async function getBpkbFilters(req, res, next) {
  try {
    const where = { branch_code: 'DXK', bpkb_status: 'BELUM_DIAMBIL', lokasi_bpkb: { not: null } }
    const locations = await prisma.showroom_stnk_bpkb_tracks.groupBy({
      by: ['lokasi_bpkb'],
      where,
      _count: true,
      orderBy: { _count: { lokasi_bpkb: 'desc' } },
    })
    res.json({ locations: locations.map((item) => item.lokasi_bpkb) })
  } catch (error) {
    next(error)
  }
}
