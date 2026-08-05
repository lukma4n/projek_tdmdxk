import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { clampLimit } from '../utils/pagination.js'
import { prisma } from '../config/db.js'
import { DOCUMENT_FOLLOWUP_STATUSES, applyCustomerTypeFilter, getCustomerType, getFinanceCompanyShort } from './showroomUtils.js'
import { formatForExcel } from '../utils/excelUtils.js'
import { muatPerenderMassal } from '../services/templateService.js'
import { getDailyUsage } from '../services/whatsappLimitService.js'
import { waMeUrl } from '../utils/phone.js'

function documentFollowupStatusLabel(status) {
  const labels = {
    belum_dihubungi: 'Belum Dihubungi',
    sudah_dihubungi: 'Sudah Dihubungi',
    diambil: 'Diambil',
    pending: 'Pending',
    batal: 'Batal',
  }
  return labels[status] || 'Belum Dihubungi'
}

// Rentang umur dokumen — berapa lama sudah jadi tapi belum diambil konsumen.
// Ini penentu utama urutan kerja: dokumen yang menunggu 6 bulan punya risiko
// berbeda dari yang baru 2 minggu, dan sebelumnya STNK sama sekali tidak punya
// filter ini sementara BPKB hanya punya dua ambang kasar (>=180, >=365).
export const AGING_BUCKETS = [
  { value: '1-30', label: '1-30 hari', min: 0, max: 30 },
  { value: '31-60', label: '31-60 hari', min: 31, max: 60 },
  { value: '61-90', label: '61-90 hari', min: 61, max: 90 },
  { value: '91-180', label: '91-180 hari', min: 91, max: 180 },
  { value: '181-365', label: '181-365 hari', min: 181, max: 365 },
  { value: '365+', label: '> 1 tahun', min: 366, max: Infinity },
]

function bucketUntuk(hari) {
  return AGING_BUCKETS.find((b) => hari >= b.min && hari <= b.max)?.value || null
}

function buildDocumentTrackWhere(documentType, query) {
  const where = { branch_code: 'DXK' }
  if (documentType === 'STNK') {
    // STNK follow-up: hanya yang sudah jadi TAPI belum diserahkan ke konsumen.
    // SUDAH_DIAMBIL sengaja dikecualikan — dokumennya sudah dibawa pulang, tidak
    // ada yang perlu ditagih, dan template WhatsApp-nya menyuruh konsumen datang
    // mengambil. Sejalan dengan slaAnalysis.js yang juga memakai != SUDAH_DIAMBIL.
    where.stnk_status = 'BELUM_DIAMBIL'
    where.lokasi_stnk = { not: null }
  } else {
    // BPKB follow-up: BPKB yang sudah jadi (BELUM_DIAMBIL) — finance_company kosong = cash customer
    where.bpkb_status = 'BELUM_DIAMBIL'
    where.finance_company = null
  }
  if (query.search) {
    const q = String(query.search).trim()
    where.OR = [
      { engine_number: { contains: q } },
      { no_polisi: { contains: q } },
      { no_bpkb: { contains: q } },
      { stnk_name: { contains: q } },
      { no_so: { contains: q } },
    ]
  }
  if (query.location && query.location !== 'all') {
    if (documentType === 'STNK') where.lokasi_stnk = String(query.location)
    else where.lokasi_bpkb = String(query.location)
  }
  // BPKB followup sudah otomatis cash (finance_company IS NULL) via where clause di atas.
  // STNK followup bisa semua customer type, tapi filter cash/kredit tetap dihormati.
  if (documentType === 'STNK') {
    applyCustomerTypeFilter(where, query.customer_type)
  }
  return where
}

async function getLatestDocumentFollowups(documentType, engineNumbers) {
  if (engineNumbers.length === 0) return new Map()
  const followups = await prisma.showroom_document_followups.findMany({
    where: { document_type: documentType, engine_number: { in: engineNumbers } },
    orderBy: { followup_at: 'desc' },
    include: { creator: { select: { id: true, username: true, name: true, role: true } } },
  })

  const latest = new Map()
  for (const followup of followups) {
    if (!latest.has(followup.engine_number)) latest.set(followup.engine_number, followup)
  }
  return latest
}

function trackToFollowupRow(documentType, item) {
  const today = new Date()
  const hariSejak = (tanggal) =>
    tanggal ? Math.max(0, Math.floor((today - new Date(tanggal)) / (24 * 60 * 60 * 1000))) : 0
  const overdueDays = hariSejak(item.tgl_jadi_bpkb)
  // Umur dihitung dari tanggal dokumen JADI, bukan tanggal SO — yang relevan
  // adalah sudah berapa lama menganggur di dealer menunggu diambil.
  const waitingDays = documentType === 'STNK' ? hariSejak(item.tgl_terima_stnk) : overdueDays

  if (documentType === 'STNK') {
    return {
      waiting_days: waitingDays,
      aging_bucket: bucketUntuk(waitingDays),
      engine_number: item.engine_number,
      stnk_name: item.stnk_name,
      applicant_name: item.stnk_name,
      stnk_location: item.lokasi_stnk,
      stnk_ready_date: item.tgl_terima_stnk,
      stnk_expired_date: item.tgl_jtp_stnk,
      police_number: item.no_polisi,
      mobile: item.mobile,
      salesman: null,
      finance_company: item.finance_company,
      finance_company_short: getFinanceCompanyShort(item.finance_company),
      customer_type: getCustomerType(item.finance_company),
    }
  }
  return {
    waiting_days: waitingDays,
    aging_bucket: bucketUntuk(waitingDays),
    engine_number: item.engine_number,
    stnk_name: item.stnk_name,
    applicant_name: item.stnk_name,
    requestor_name: item.stnk_name,
    bpkb_location: item.lokasi_bpkb,
    bpkb_number: item.no_bpkb,
    bpkb_ready_date: item.tgl_jadi_bpkb,
    overdue_days: overdueDays,
    customer_phone: item.mobile,
    salesman: null,
    finance_company: item.finance_company,
    finance_company_short: getFinanceCompanyShort(item.finance_company),
    customer_type: getCustomerType(item.finance_company),
  }
}

function attachDocumentFollowups(documentType, rows, followups) {
  return rows.map((item) => ({
    ...item,
    document_type: documentType,
    followup: followups.get(item.engine_number) || null,
  }))
}

async function buildDocumentFollowupData(documentType, query) {
  const where = buildDocumentTrackWhere(documentType, query)
  const orderField = documentType === 'STNK' ? 'tgl_terima_stnk' : 'tgl_jadi_bpkb'
  const orderDir = documentType === 'STNK' ? 'desc' : 'asc'

  const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
    where,
    orderBy: { [orderField]: orderDir },
  })
  const rows = tracks.map((t) => trackToFollowupRow(documentType, t))
  const latest = await getLatestDocumentFollowups(documentType, rows.map((item) => item.engine_number))
  const data = attachDocumentFollowups(documentType, rows, latest)

  const setelahStatus = data.filter((item) => {
    const currentStatus = item.followup?.status || 'belum_dihubungi'
    if (query.status && query.status !== 'all' && currentStatus !== query.status) return false
    // Ambang lama BPKB (>=180 / >=365) tetap dihormati agar tautan/bookmark
    // yang sudah beredar tidak mendadak berubah artinya.
    if (documentType === 'BPKB' && query.overdue_min && query.overdue_min !== 'all' && (item.overdue_days || 0) < parseInt(query.overdue_min)) return false
    return true
  })

  // Hitungan per rentang umur SENGAJA dihitung sebelum filter umur diterapkan.
  // Kalau dihitung sesudah, angka di setiap chip akan runtuh jadi 0 begitu satu
  // rentang dipilih, sehingga admin tidak bisa berpindah rentang.
  const byAging = Object.fromEntries(AGING_BUCKETS.map((b) => [b.value, 0]))
  for (const item of setelahStatus) {
    if (item.aging_bucket) byAging[item.aging_bucket] = (byAging[item.aging_bucket] || 0) + 1
  }

  const aging = query.aging && query.aging !== 'all' ? String(query.aging) : null
  const hasil = aging ? setelahStatus.filter((item) => item.aging_bucket === aging) : setelahStatus

  return { data: hasil, byAging }
}

function summarizeDocumentFollowups(data, byAging) {
  const byStatus = Object.fromEntries(DOCUMENT_FOLLOWUP_STATUSES.map((status) => [status, 0]))
  for (const item of data) {
    const status = item.followup?.status || 'belum_dihubungi'
    byStatus[status] = (byStatus[status] || 0) + 1
  }
  return { total: data.length, byStatus, byAging }
}

export async function getDocumentFollowups(req, res, next) {
  try {
    const documentType = String(req.params.type || '').toUpperCase()
    if (!['STNK', 'BPKB'].includes(documentType)) return res.status(400).json({ error: 'Tipe dokumen tidak valid' })

    const { page = 1, limit = 100 } = req.query
    const pageInt = parseInt(page)
    const limitInt = clampLimit(limit, 100)
    const { data, byAging } = await buildDocumentFollowupData(documentType, req.query)
    const skip = (pageInt - 1) * limitInt
    const paginated = data.slice(skip, skip + limitInt)

    // Draf disiapkan di server supaya isinya mengikuti template aktif yang bisa
    // diubah dari UI — halaman tidak lagi menyusun teksnya sendiri.
    const render = await muatPerenderMassal()
    const denganDraf = paginated.map((item) => {
      const pesan = render.dokumen([documentType], { engineNumber: item.engine_number })
      return { ...item, draft_message: pesan, wa_url: waMeUrl(item.mobile || item.customer_phone, pesan) }
    })

    res.json({
      data: denganDraf,
      summary: summarizeDocumentFollowups(data, byAging),
      agingBuckets: AGING_BUCKETS.map(({ value, label }) => ({ value, label })),
      pagination: { page: pageInt, limit: limitInt, total: data.length, totalPages: Math.ceil(data.length / limitInt) },
      daily: await getDailyUsage(),
    })
  } catch (error) {
    next(error)
  }
}

export async function createDocumentFollowup(req, res, next) {
  try {
    const documentType = String(req.params.type || '').toUpperCase()
    if (!['STNK', 'BPKB'].includes(documentType)) return res.status(400).json({ error: 'Tipe dokumen tidak valid' })

    const engineNumber = String(req.params.engineNumber || '').trim()
    const { status, note } = req.body
    if (!engineNumber) return res.status(400).json({ error: 'Nomor mesin wajib diisi' })
    if (!DOCUMENT_FOLLOWUP_STATUSES.includes(status)) return res.status(400).json({ error: 'Status follow-up tidak valid' })

    // Validasi engine_number ada di Track
    const exists = await prisma.showroom_stnk_bpkb_tracks.findUnique({ where: { engine_number: engineNumber } })
    if (!exists) return res.status(404).json({ error: 'Dokumen tidak ditemukan' })

    // Endpoint ini hanya mengubah status manual — tidak mengirim WhatsApp, jadi
    // tidak memotong jatah harian dan tidak dicatat di whatsapp_send_logs.
    const followup = await prisma.showroom_document_followups.create({
      data: {
        document_type: documentType,
        engine_number: engineNumber,
        status,
        note: note || null,
        created_by: req.user.userId,
      },
      include: { creator: { select: { id: true, username: true, name: true, role: true } } },
    })

    res.status(201).json({ data: followup })
  } catch (error) {
    next(error)
  }
}

export async function exportDocumentFollowupsExcel(req, res, next) {
  try {
    const documentType = String(req.params.type || '').toUpperCase()
    if (!['STNK', 'BPKB'].includes(documentType)) return res.status(400).json({ error: 'Tipe dokumen tidak valid' })

    const { data } = await buildDocumentFollowupData(documentType, req.query)
    const exportData = data.map((item, index) => {
      const followup = item.followup
      const base = {
        No: index + 1,
        Nama: item.stnk_name || '-',
        Pemohon: item.applicant_name || item.requestor_name || '-',
        No_Mesin: item.engine_number || '-',
        Lokasi: documentType === 'STNK' ? item.stnk_location || '-' : item.bpkb_location || '-',
        Status_Followup: documentFollowupStatusLabel(followup?.status || 'belum_dihubungi'),
        Catatan_Terakhir: followup?.note || '',
        Petugas: followup?.creator?.name || followup?.creator?.username || '',
        Waktu_Followup: formatForExcel(followup?.followup_at),
        No_HP: item.mobile || item.customer_phone || '-',
        Salesman: item.salesman || '-',
      }

      if (documentType === 'STNK') {
        return { ...base, No_Polisi: item.police_number || '-', Jadi_STNK: formatForExcel(item.stnk_ready_date), Expired_STNK: formatForExcel(item.stnk_expired_date) }
      }
      return { ...base, No_BPKB: item.bpkb_number || '-', Jadi_BPKB: formatForExcel(item.bpkb_ready_date), Overdue_Hari: item.overdue_days || 0 }
    })

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
      { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, `Follow-up ${documentType}`)

    const suffix = `${req.query.status || 'all'}_${req.query.location || 'semua'}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Followup_${documentType}_DXK_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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
