import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { withImportLock } from '../services/importLockService.js'
import { parseStnkBpkbTrackFile } from '../services/importParsers.js'
import { applyCustomerTypeFilter, cleanupUpload, getCustomerType, getFinanceCompanyShort } from './showroomUtils.js'
import { runShowroomSnapshotImport, getSnapshotPreviewMeta } from './showroomImport.js'
import { formatForExcel } from '../utils/excelUtils.js'

/**
 * Enrich tracks records with mobile numbers from customers and sales orders tables
 */
export async function enrichTracksWithMobile(records) {
  const engineNumbersWithNullMobile = records
    .filter((r) => !r.mobile)
    .map((r) => r.engine_number)
    .filter(Boolean)

  if (engineNumbersWithNullMobile.length === 0) return

  const mobileMap = {}
  const batchSize = 500

  for (let i = 0; i < engineNumbersWithNullMobile.length; i += batchSize) {
    const batch = engineNumbersWithNullMobile.slice(i, i + batchSize)

    // 1. Ambil dari tabel customers
    const matchedCustomers = await prisma.customers.findMany({
      where: {
        no_engine: { in: batch },
        customer_mobile: { not: null }
      },
      select: {
        no_engine: true,
        customer_mobile: true
      }
    })

    for (const c of matchedCustomers) {
      if (c.customer_mobile && c.customer_mobile.trim()) {
        mobileMap[c.no_engine] = c.customer_mobile.trim()
      }
    }

    // 2. Jika ada yang masih belum didapat di batch ini, cari di margins
    const batchRemaining = batch.filter((eng) => !mobileMap[eng])
    if (batchRemaining.length > 0) {
      const matchedMargins = await prisma.showroom_sales_order_margins.findMany({
        where: {
          engine_number: { in: batchRemaining },
          customer_phone: { not: null }
        },
        select: {
          engine_number: true,
          customer_phone: true
        }
      })
      for (const m of matchedMargins) {
        if (m.customer_phone && m.customer_phone.trim()) {
          mobileMap[m.engine_number] = m.customer_phone.trim()
        }
      }
    }
  }

  // 3. Update records array
  for (const record of records) {
    if (!record.mobile && mobileMap[record.engine_number]) {
      record.mobile = mobileMap[record.engine_number]
    }
  }
}

// ===== PREVIEW & IMPORT =====


export async function previewStnkBpkbTrack(req, res, next) {
  try {
    const { records, errors } = parseStnkBpkbTrackFile(req.file.path)
    await enrichTracksWithMobile(records)
    const snapshot = await getSnapshotPreviewMeta('showroom_stnk_bpkb_tracks', records)
    await cleanupUpload(req)
    res.json({
      message: 'Preview Track STNK & BPKB berhasil',
      module: 'showroom_stnk_bpkb_track',
      ...snapshot,
      validRows: records.length,
      errorRows: errors.length,
      sample: records.slice(0, 5),
      errorDetails: errors.slice(0, 10),
    })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

export async function uploadStnkBpkbTrack(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('showroom:stnk-bpkb-track', async () => {
      const { records, errors } = parseStnkBpkbTrackFile(req.file.path)
      await enrichTracksWithMobile(records)
      if (records.length === 0) {
        await cleanupUpload(req)
        return res.status(400).json({ error: 'File Track STNK/BPKB tidak berisi data DXK yang valid' })
      }

      const result = await runShowroomSnapshotImport({
        req,
        records,
        errors,
        model: 'showroom_stnk_bpkb_tracks',
        module: 'showroom_stnk_bpkb_track',
        recordId: 'showroom_stnk_bpkb_track',
        backupReason: 'pre_import_stnk_bpkb_track',
      })

      await cleanupUpload(req)
      res.json({
        message: 'Import Track STNK & BPKB selesai',
        success: records.length,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        backup: result.backup,
      })
    }, { module: 'showroom_stnk_bpkb_track', reason: 'active_snapshot' })
  } catch (error) {
    await cleanupUpload(req)
    next(error)
  }
}

// ===== MONITORING =====

const BPKB_OVERDUE_DAYS = 180

function buildTrackWhere(query) {
  const where = { branch_code: 'DXK' }
  if (query.series) where.series = String(query.series)
  if (query.finance_company) where.finance_company = String(query.finance_company)
  if (query.birojasa) where.birojasa = String(query.birojasa)
  if (query.tahun) where.tahun = parseInt(query.tahun)
  if (query.status_stnk) where.stnk_status = String(query.status_stnk)
  if (query.status_bpkb) where.bpkb_status = String(query.status_bpkb)
  applyCustomerTypeFilter(where, query.customer_type)

  if (query.search) {
    const s = String(query.search).trim()
    where.OR = [
      { engine_number: { contains: s } },
      { chassis_number: { contains: s } },
      { stnk_name: { contains: s } },
      { no_so: { contains: s } },
      { partner_name: { contains: s } },
    ]
  }

  return where
}

function groupCountBy(rows, key, fallbackLabel = 'TIDAK_DIKETAHUI') {
  const map = new Map()
  for (const row of rows) {
    const k = row[key] || fallbackLabel
    map.set(k, (map.get(k) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getStnkBpkbTrackMonitoring(req, res, next) {
  try {
    const where = buildTrackWhere(req.query)
    const agingMin = parseInt(req.query.aging_min) || 0
    const agingMax = parseInt(req.query.aging_max) || 0

    const allTracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
      where,
      orderBy: { synced_at: 'desc' },
    })

    // Apply aging filter (days since tgl_mohon_faktur or tgl_terima_stnk)
    const today = new Date()
    const filtered = allTracks.filter((t) => {
      if (!agingMin && !agingMax) return true
      const baseDate = t.tgl_mohon_faktur || t.tgl_proses_stnk || t.tgl_terima_stnk
      if (!baseDate) return agingMin === 0
      const days = Math.floor((today - new Date(baseDate)) / (24 * 60 * 60 * 1000))
      if (agingMin && days < agingMin) return false
      if (agingMax && days > agingMax) return false
      return true
    })

    const engineList = filtered.map((t) => t.engine_number).filter(Boolean)

    // Parallel: cross-reference ke followups (sumber: showroom_stnk_bpkb_tracks sudah single source of truth)
    const [stnkFollowups, bpkbFollowups] = await Promise.all([
      engineList.length
        ? prisma.showroom_document_followups.findMany({
            where: { document_type: 'STNK', engine_number: { in: engineList } },
            orderBy: { followup_at: 'desc' },
            include: { creator: { select: { id: true, username: true, name: true, role: true } } },
          })
        : Promise.resolve([]),
      engineList.length
        ? prisma.showroom_document_followups.findMany({
            where: { document_type: 'BPKB', engine_number: { in: engineList } },
            orderBy: { followup_at: 'desc' },
            include: { creator: { select: { id: true, username: true, name: true, role: true } } },
          })
        : Promise.resolve([]),
    ])

    const stnkFollowupMap = new Map()
    for (const f of stnkFollowups) if (!stnkFollowupMap.has(f.engine_number)) stnkFollowupMap.set(f.engine_number, f)
    const bpkbFollowupMap = new Map()
    for (const f of bpkbFollowups) if (!bpkbFollowupMap.has(f.engine_number)) bpkbFollowupMap.set(f.engine_number, f)

    // Summary counts
    const stnkCount = { BELUM_JADI: 0, BELUM_DIAMBIL: 0, SUDAH_DIAMBIL: 0 }
    const bpkbCount = { BELUM_JADI: 0, BELUM_DIAMBIL: 0, SUDAH_DIAMBIL: 0 }
    let platPending = 0
    let fakturPending = 0
    let bpkbOverdue = 0

    for (const t of filtered) {
      if (t.stnk_status) stnkCount[t.stnk_status] = (stnkCount[t.stnk_status] || 0) + 1
      if (t.bpkb_status) bpkbCount[t.bpkb_status] = (bpkbCount[t.bpkb_status] || 0) + 1
      if (!t.tgl_terima_plat) platPending++
      if (!t.tgl_mohon_faktur) fakturPending++
      if (
        t.bpkb_status === 'BELUM_DIAMBIL' &&
        t.tgl_jadi_bpkb &&
        (today - new Date(t.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000) > BPKB_OVERDUE_DAYS
      ) {
        bpkbOverdue++
      }
    }

    // Breakdowns
    const bySeries = groupCountBy(
      filtered.filter((t) => t.stnk_status === 'BELUM_JADI' || t.bpkb_status === 'BELUM_JADI'),
      'series'
    ).slice(0, 10)
    const byFinance = groupCountBy(
      filtered.filter((t) => t.bpkb_status === 'BELUM_JADI'),
      'finance_company',
      'Cash'
    ).slice(0, 10)
    const byTahun = groupCountBy(
      filtered.filter((t) => t.stnk_status === 'BELUM_JADI' || t.bpkb_status === 'BELUM_JADI'),
      'tahun',
      'Tanpa Tahun'
    )

    // Per-birojasa breakdown (4 metrics: STNK belum jadi, BPKB belum jadi, Plat belum jadi, BPKB overdue)
    const birojasaPending = filtered.filter(
      (t) => t.stnk_status === 'BELUM_JADI' || t.bpkb_status === 'BELUM_JADI' || !t.tgl_terima_plat
    )
    const birojasaMap = new Map()
    for (const t of birojasaPending) {
      const key = t.birojasa || 'TIDAK_DIKETAHUI'
      if (!birojasaMap.has(key)) birojasaMap.set(key, { name: key, stnk_belum_jadi: 0, bpkb_belum_jadi: 0, plat_belum_jadi: 0, bpkb_overdue: 0 })
      const entry = birojasaMap.get(key)
      if (t.stnk_status === 'BELUM_JADI') entry.stnk_belum_jadi++
      if (t.bpkb_status === 'BELUM_JADI') entry.bpkb_belum_jadi++
      if (!t.tgl_terima_plat) entry.plat_belum_jadi++
      if (
        t.bpkb_status === 'BELUM_DIAMBIL' &&
        t.tgl_jadi_bpkb &&
        (today - new Date(t.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000) > BPKB_OVERDUE_DAYS
      ) {
        entry.bpkb_overdue++
      }
    }
    const byBirojasa = Array.from(birojasaMap.values()).sort((a, b) => {
      const aTotal = a.stnk_belum_jadi + a.bpkb_belum_jadi
      const bTotal = b.stnk_belum_jadi + b.bpkb_belum_jadi
      return bTotal - aTotal
    })

    // Cash vs Kredit breakdown (semua row difilter, bukan hanya pending)
    let cashCount = 0
    let kreditCount = 0
    for (const t of filtered) {
      if (!t.finance_company || !String(t.finance_company).trim()) cashCount++
      else kreditCount++
    }

    // Anomalies
    const stnkBelumJadiBelumFollowup = filtered
      .filter((t) => t.stnk_status === 'BELUM_JADI' && !stnkFollowupMap.has(t.engine_number))
      .slice(0, 50)
      .map((t) => ({
        engine_number: t.engine_number,
        stnk_name: t.stnk_name,
        mobile: t.mobile,
        series: t.series,
        finance_company: t.finance_company,
        finance_company_short: getFinanceCompanyShort(t.finance_company),
        customer_type: getCustomerType(t.finance_company),
        tgl_mohon_faktur: t.tgl_mohon_faktur,
        tgl_proses_stnk: t.tgl_proses_stnk,
        birojasa: t.birojasa,
        no_so: t.no_so,
      }))

    const stnkSudahJadiBelumDiambil = filtered
      .filter((t) => t.stnk_status === 'BELUM_DIAMBIL' && (!stnkFollowupMap.has(t.engine_number) || stnkFollowupMap.get(t.engine_number).status !== 'diambil'))
      .slice(0, 50)
      .map((t) => ({
        engine_number: t.engine_number,
        stnk_name: t.stnk_name,
        mobile: t.mobile,
        series: t.series,
        finance_company: t.finance_company,
        finance_company_short: getFinanceCompanyShort(t.finance_company),
        customer_type: getCustomerType(t.finance_company),
        no_stnk: t.no_stnk,
        tgl_terima_stnk: t.tgl_terima_stnk,
        no_so: t.no_so,
        followup: stnkFollowupMap.get(t.engine_number) || null,
      }))

    const bpkbOverdueList = filtered
      .filter(
        (t) =>
          t.bpkb_status === 'BELUM_DIAMBIL' &&
          t.tgl_jadi_bpkb &&
          (today - new Date(t.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000) > BPKB_OVERDUE_DAYS
      )
      .sort((a, b) => new Date(a.tgl_jadi_bpkb) - new Date(b.tgl_jadi_bpkb))
      .slice(0, 50)
      .map((t) => ({
        engine_number: t.engine_number,
        stnk_name: t.stnk_name,
        mobile: t.mobile,
        series: t.series,
        finance_company: t.finance_company,
        finance_company_short: getFinanceCompanyShort(t.finance_company),
        customer_type: getCustomerType(t.finance_company),
        tgl_jadi_bpkb: t.tgl_jadi_bpkb,
        no_bpkb: t.no_bpkb,
        days_overdue: Math.floor((today - new Date(t.tgl_jadi_bpkb)) / (24 * 60 * 60 * 1000)),
        no_so: t.no_so,
        followup: bpkbFollowupMap.get(t.engine_number) || null,
      }))

    // Top pending BPKB (oldest tgl_mohon_faktur)
    const topPendingBpkb = filtered
      .filter((t) => t.bpkb_status === 'BELUM_JADI' && t.tgl_mohon_faktur)
      .sort((a, b) => new Date(a.tgl_mohon_faktur) - new Date(b.tgl_mohon_faktur))
      .slice(0, 50)
      .map((t) => ({
        engine_number: t.engine_number,
        stnk_name: t.stnk_name,
        mobile: t.mobile,
        series: t.series,
        finance_company: t.finance_company,
        finance_company_short: getFinanceCompanyShort(t.finance_company),
        customer_type: getCustomerType(t.finance_company),
        birojasa: t.birojasa,
        tgl_mohon_faktur: t.tgl_mohon_faktur,
        lt_mohon_faktur: t.lt_mohon_faktur,
        days_pending: Math.floor((today - new Date(t.tgl_mohon_faktur)) / (24 * 60 * 60 * 1000)),
        no_so: t.no_so,
      }))

    // Filter facets (for UI dropdowns)
    const facets = {
      series: Array.from(new Set(allTracks.map((t) => t.series).filter(Boolean))).sort(),
      financeCompanies: Array.from(new Set(allTracks.map((t) => t.finance_company).filter(Boolean))).sort(),
      birojasas: Array.from(new Set(allTracks.map((t) => t.birojasa).filter(Boolean))).sort(),
      tahun: Array.from(new Set(allTracks.map((t) => t.tahun).filter(Boolean))).sort((a, b) => b - a),
    }

    res.json({
      filters: req.query,
      totalRows: filtered.length,
      summary: {
        stnk: stnkCount,
        bpkb: bpkbCount,
        platPending,
        fakturPending,
        bpkbOverdue,
        cashCount,
        kreditCount,
        total: filtered.length,
      },
      bySeries,
      byFinance,
      byBirojasa,
      byTahun,
      anomalies: {
        stnkBelumJadiBelumFollowup: { count: filtered.filter((t) => t.stnk_status === 'BELUM_JADI' && !stnkFollowupMap.has(t.engine_number)).length, rows: stnkBelumJadiBelumFollowup },
        stnkSudahJadiBelumDiambil: { count: filtered.filter((t) => t.stnk_status === 'BELUM_DIAMBIL' && (!stnkFollowupMap.has(t.engine_number) || stnkFollowupMap.get(t.engine_number).status !== 'diambil')).length, rows: stnkSudahJadiBelumDiambil },
        bpkbOverdue: { count: bpkbOverdueList.length, rows: bpkbOverdueList },
      },
      topPendingBpkb: { count: filtered.filter((t) => t.bpkb_status === 'BELUM_JADI' && t.tgl_mohon_faktur).length, rows: topPendingBpkb },
      facets,
      syncedAt: allTracks[0]?.synced_at || null,
    })
  } catch (error) {
    next(error)
  }
}

// ===== EXPORT =====

function buildExportWhere(query) {
  const where = { branch_code: 'DXK' }
  if (query.series) where.series = String(query.series)
  if (query.finance_company) where.finance_company = String(query.finance_company)
  if (query.birojasa) where.birojasa = String(query.birojasa)
  if (query.tahun) where.tahun = parseInt(query.tahun)
  if (query.status_stnk) where.stnk_status = String(query.status_stnk)
  if (query.status_bpkb) where.bpkb_status = String(query.status_bpkb)
  applyCustomerTypeFilter(where, query.customer_type)

  if (query.search) {
    const s = String(query.search).trim()
    where.OR = [
      { engine_number: { contains: s } },
      { chassis_number: { contains: s } },
      { stnk_name: { contains: s } },
      { no_so: { contains: s } },
      { partner_name: { contains: s } },
    ]
  }

  return where
}

export async function exportStnkBpkbTrackExcel(req, res, next) {
  try {
    const where = buildExportWhere(req.query)
    const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
      where,
      orderBy: [{ stnk_status: 'asc' }, { bpkb_status: 'asc' }, { tgl_mohon_faktur: 'asc' }],
    })

    const exportData = tracks.map((t, idx) => ({
      No: idx + 1,
      Engine_No: t.engine_number || '-',
      Chassis_No: t.chassis_number || '-',
      Nama_STNK: t.stnk_name || '-',
      Series: t.series || '-',
      Finance_Company: getFinanceCompanyShort(t.finance_company) || '-',
      Customer_Type: getCustomerType(t.finance_company),
      Tgl_Mohon_Faktur: formatForExcel(t.tgl_mohon_faktur),
      L_T_Mohon: t.lt_mohon_faktur || 0,
      Tgl_Terima_Faktur: formatForExcel(t.tgl_terima_faktur),
      Tgl_Proses_STNK: formatForExcel(t.tgl_proses_stnk),
      Birojasa: t.birojasa || '-',
      Tgl_Terima_STNK: formatForExcel(t.tgl_terima_stnk),
      No_STNK: t.no_stnk || '-',
      Tgl_Terima_Plat: formatForExcel(t.tgl_terima_plat),
      No_Plat: t.no_plat || '-',
      Tgl_Jadi_BPKB: formatForExcel(t.tgl_jadi_bpkb),
      No_BPKB: t.no_bpkb || '-',
      Tgl_Penyerahan_STNK: formatForExcel(t.tgl_penyerahan_stnk),
      Nama_Penerima_BPKB: t.nama_penerima_bpkb || '-',
      Tgl_Penyerahan_BPKB: formatForExcel(t.tgl_penyerahan_bpkb),
      Tgl_Penyerahan_Plat: formatForExcel(t.tgl_penyerahan_plat),
      STNK_Status: t.stnk_status || '-',
      BPKB_Status: t.bpkb_status || '-',
      No_SO: t.no_so || '-',
      Mobile: t.mobile || '-',
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 28 }, { wch: 18 },
      { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Track STNK BPKB')

    const filename = `Track_STNK_BPKB_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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
