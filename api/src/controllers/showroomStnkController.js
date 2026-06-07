import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { formatForExcel } from '../utils/excelUtils.js'

/**
 * STNK stock = STNK yang sudah jadi (ada tgl_terima_stnk) tapi belum diserahkan
 * ke customer (tgl_penyerahan_stnk masih kosong).
 *
 * Data source: showroom_stnk_bpkb_tracks (single source of truth dari Track Report v2)
 * Schema lama showroom_stnks sudah dihapus.
 */
function buildStnkStockWhere(query) {
  const where = {
    branch_code: 'DXK',
    stnk_status: 'BELUM_DIAMBIL', // STNK sudah jadi, belum diserahkan
  }
  if (query.search) {
    const q = String(query.search).trim()
    where.OR = [
      { engine_number: { contains: q } },
      { no_polisi: { contains: q } },
      { stnk_name: { contains: q } },
      { no_so: { contains: q } },
    ]
  }
  if (query.location && query.location !== 'all') {
    where.lokasi_stnk = String(query.location)
  }
  return where
}

function trackToStnkStock(item) {
  return {
    id: item.id,
    engine_number: item.engine_number,
    stnk_name: item.stnk_name,
    customer_code: item.partner_code,
    customer_address: item.partner_address,
    sale_order_number: item.no_so,
    receipt_number: item.no_stnk,
    receipt_date: item.tgl_terima_stnk,
    stnk_location: item.lokasi_stnk,
    stnk_ready_date: item.tgl_terima_stnk,
    stnk_expired_date: item.tgl_jtp_stnk,
    police_number: item.no_polisi,
    mobile: item.mobile,
    applicant_name: item.stnk_name,
    salesman: null, // tidak tersedia di Track
    finance_company: item.finance_company,
    age_raw: null,
    synced_at: item.synced_at,
  }
}

export async function getStnks(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const where = buildStnkStockWhere(req.query)

    const [data, total] = await Promise.all([
      prisma.showroom_stnk_bpkb_tracks.findMany({
        where,
        skip: (pageInt - 1) * limitInt,
        take: limitInt,
        orderBy: { tgl_terima_stnk: 'desc' },
      }),
      prisma.showroom_stnk_bpkb_tracks.count({ where }),
    ])

    res.json({
      data: data.map(trackToStnkStock),
      pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) },
    })
  } catch (error) {
    next(error)
  }
}

export async function exportStnksExcel(req, res, next) {
  try {
    const where = buildStnkStockWhere(req.query)
    const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
      where,
      orderBy: { tgl_terima_stnk: 'desc' },
    })
    const exportData = tracks.map((item, idx) => ({
      No: idx + 1,
      Nama_STNK: item.stnk_name || '-',
      Pemohon: item.stnk_name || '-',
      No_Mesin: item.engine_number || '-',
      No_Polisi: item.no_polisi || '-',
      Lokasi_STNK: item.lokasi_stnk || '-',
      Tgl_Terima: formatForExcel(item.tgl_terima_stnk),
      Jadi_STNK: formatForExcel(item.tgl_terima_stnk),
      Expired_STNK: formatForExcel(item.tgl_jtp_stnk),
      No_SO: item.no_so || '-',
      No_Resi: item.no_stnk || '-',
      No_HP: item.mobile || '-',
      Salesman: '-',
      Leasing: item.finance_company || '-',
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Stock STNK')

    let suffix = 'Semua'
    if (req.query.location && req.query.location !== 'all') suffix = String(req.query.location).replace(/\s+/g, '_')
    const filename = `Stock_STNK_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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

export async function getStnkSummary(req, res, next) {
  try {
    const where = { branch_code: 'DXK', stnk_status: 'BELUM_DIAMBIL' }
    const [total, byLocation, latest] = await Promise.all([
      prisma.showroom_stnk_bpkb_tracks.count({ where }),
      prisma.showroom_stnk_bpkb_tracks.groupBy({
        by: ['lokasi_stnk'],
        where: { ...where, lokasi_stnk: { not: null } },
        _count: true,
        orderBy: { _count: { lokasi_stnk: 'desc' } },
        take: 10,
      }),
      prisma.showroom_stnk_bpkb_tracks.findFirst({
        orderBy: { synced_at: 'desc' },
        select: { synced_at: true },
      }),
    ])

    // Map lokasi_stnk → stnk_location format untuk kompatibilitas UI
    const mappedByLocation = byLocation.map((item) => ({
      stnk_location: item.lokasi_stnk,
      _count: item._count,
    }))

    res.json({
      total,
      byLocation: mappedByLocation,
      latestSyncedAt: latest?.synced_at || null,
    })
  } catch (error) {
    next(error)
  }
}

export async function getStnkFilters(req, res, next) {
  try {
    const where = { branch_code: 'DXK', stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: { not: null } }
    const locations = await prisma.showroom_stnk_bpkb_tracks.groupBy({
      by: ['lokasi_stnk'],
      where,
      _count: true,
      orderBy: { _count: { lokasi_stnk: 'desc' } },
    })
    res.json({ locations: locations.map((item) => item.lokasi_stnk) })
  } catch (error) {
    next(error)
  }
}
