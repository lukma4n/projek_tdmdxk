import xlsx from 'xlsx'
import fs from 'fs/promises'
import { rmSync } from 'fs'
import { clampLimit } from '../utils/pagination.js'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { delCache } from '../config/redis.js'
import { createDatabaseBackup } from '../services/backupService.js'
import { parseSalesFile } from '../services/importParsers.js'
import { createAuditLog } from '../services/auditService.js'
import { withImportLock } from '../services/importLockService.js'
import { bulkUpsert } from '../services/bulkUpsertService.js'
import { excelDateToJSDate, formatForExcel } from '../utils/excelUtils.js'
import { muatPerenderMassal } from '../services/templateService.js'
import { getDailyUsage } from '../services/whatsappLimitService.js'
import { waMeUrl } from '../utils/phone.js'

// ─── KPB Configuration ────────────────────────────────────────────────────
export const KPB_LEVELS = [
  { key: 'kpb1', label: 'KPB1', months: 2 },
  { key: 'kpb2', label: 'KPB2', months: 4 },
  { key: 'kpb3', label: 'KPB3', months: 6 },
  { key: 'kpb4', label: 'KPB4', months: 8 },
]

// Rentang alert: jatuh tempo terlewat maksimal 90 hari masih ditagih.
const OVERDUE_WINDOW_DAYS = 90

// Tambah bulan tanpa overflow. `setMonth` polos melempar SO tanggal 29-31 ke
// bulan berikutnya (SO 2022-01-31 + 8 bulan jadi 2022-10-01, bukan 2022-09-30),
// sehingga due date masuk kolom bulan yang salah saat difilter.
export function addMonths(date, months) {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDayOfMonth))
  return d
}

function getKpbDueDate(soDate, months) {
  if (!soDate) return null
  return addMonths(soDate, months)
}

function getOverallKpbStatus(customerWos, soDate) {
  const today = new Date()
  for (const level of KPB_LEVELS) {
    const due = getKpbDueDate(soDate, level.months)
    if (due && today >= due) {
      const wo = customerWos?.[level.label]
      if (!wo) return level.key + '_due'
    }
  }
  return 'belum'
}

async function getAllKpbWos() {
  const wos = await prisma.work_orders.findMany({
    where: {
      type: 'KPB',
      workshop_category: 'Service',
      state: 'done',
      category_name: { in: ['KPB1', 'KPB2', 'KPB3', 'KPB4'] },
    },
    select: {
      engine_number: true,
      category_name: true,
      date_confirm: true,
      wo_number: true,
    },
    orderBy: { date_confirm: 'asc' },
  })
  const map = {}
  for (const wo of wos) {
    if (!wo.engine_number) continue
    if (!map[wo.engine_number]) map[wo.engine_number] = {}
    if (!map[wo.engine_number][wo.category_name]) {
      map[wo.engine_number][wo.category_name] = wo
    }
  }
  return map
}

function enrichWithKpb(c, woMap) {
  const wos = woMap[c.no_engine] || {}
  const kpbData = {}
  for (const level of KPB_LEVELS) {
    const due = getKpbDueDate(c.so_date, level.months)
    const wo = wos[level.label]
    kpbData[`${level.key}_due`] = due
    kpbData[`${level.key}_status`] = wo ? 'done' : (due && new Date() >= due) ? 'pending' : 'not_due'
    kpbData[`${level.key}_wo`] = wo?.wo_number || null
    kpbData[`${level.key}_date`] = wo?.date_confirm || null
  }
  return {
    ...c,
    kpb_status: getOverallKpbStatus(wos, c.so_date),
    ...kpbData,
  }
}

function currentKpbLevel(kpbStatus) {
  if (!kpbStatus || kpbStatus === 'belum') return null
  return kpbStatus.replace('_due', '').toUpperCase()
}

function attachLatestFollowups(customers, followups) {
  const map = new Map()
  for (const followup of followups) {
    const key = `${followup.customer_id}:${followup.kpb_level}`
    if (!map.has(key)) map.set(key, followup)
  }

  return customers.map((customer) => {
    const level = currentKpbLevel(customer.kpb_status)
    const followup = level ? map.get(`${customer.id}:${level}`) : null
    return { ...customer, followup: followup || null }
  })
}

async function getLatestFollowupsForCustomers(customerIds) {
  if (customerIds.length === 0) return []
  const followups = await prisma.kpb_followups.findMany({
    where: { customer_id: { in: customerIds } },
    orderBy: { followup_at: 'desc' },
    include: { creator: { select: { id: true, username: true, name: true, role: true } } },
  })

  const latest = []
  const seen = new Set()
  for (const followup of followups) {
    const key = `${followup.customer_id}:${followup.kpb_level}`
    if (seen.has(key)) continue
    seen.add(key)
    latest.push(followup)
  }
  return latest
}

// Batas so_date yang mungkin menghasilkan alert, supaya tidak perlu memuat
// seluruh tabel customers. due = so_date + months, dan alert hanya untuk due di
// rentang [today - 90 hari, today + days]:
//   so_date paling tua  = today - 90 hari - bulan KPB terbesar
//   so_date paling muda = today + days    - bulan KPB terkecil
// Diberi bantalan 1 bulan di kedua sisi agar tidak ada yang terpotong di batas.
function getAlertSoDateRange(today, days) {
  const maxMonths = Math.max(...KPB_LEVELS.map((l) => l.months))
  const minMonths = Math.min(...KPB_LEVELS.map((l) => l.months))

  const oldest = new Date(today)
  oldest.setDate(oldest.getDate() - OVERDUE_WINDOW_DAYS)

  const newest = new Date(today)
  newest.setDate(newest.getDate() + days)

  return {
    gte: addMonths(oldest, -(maxMonths + 1)),
    lte: addMonths(newest, -(minMonths - 1)),
  }
}

async function buildKpbFollowupAlerts(days = 7) {
  const today = new Date()
  const customers = await prisma.customers.findMany({
    where: {
      branch_code: 'DXK',
      so_date: getAlertSoDateRange(today, parseInt(days)),
    },
    orderBy: { so_date: 'desc' },
  })

  const woMap = await getAllKpbWos()
  const alerts = []
  for (const c of customers) {
    if (!c.so_date) continue
    const wos = woMap[c.no_engine] || {}
    for (const level of KPB_LEVELS) {
      const due = getKpbDueDate(c.so_date, level.months)
      if (!due) continue
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
      if (wos[level.label]) continue

      if (diffDays < 0 && diffDays >= -OVERDUE_WINDOW_DAYS) {
        alerts.push({ ...makeAlert(c, level, due, diffDays), alert_type: 'overdue' })
      } else if (diffDays >= 0 && diffDays <= parseInt(days)) {
        alerts.push({ ...makeAlert(c, level, due, diffDays), alert_type: 'warning' })
      }
    }
  }

  alerts.sort((a, b) => a.days_remaining - b.days_remaining)
  const followups = await getLatestFollowupsForCustomers(alerts.map((a) => a.customer_id))
  const data = attachLatestFollowups(alerts, followups)

  return {
    data,
    summary: {
      overdue: alerts.filter((a) => a.alert_type === 'overdue').length,
      warning: alerts.filter((a) => a.alert_type === 'warning').length,
    },
  }
}

function followupStatusLabel(status) {
  const labels = {
    belum_dihubungi: 'Belum Dihubungi',
    sudah_dihubungi: 'Sudah Dihubungi',
    booking: 'Booking',
    datang: 'Datang',
    batal: 'Batal',
  }
  return labels[status] || status || 'Belum Dihubungi'
}

function formatDaysForExport(days) {
  if (days < 0) return `${Math.abs(days)} hari lewat`
  if (days === 0) return 'Hari ini'
  return `${days} hari lagi`
}

function getKpbDateForFilter(customer, kpbStatus) {
  if (kpbStatus && kpbStatus !== 'all') {
    const levelKey = kpbStatus.replace('_due', '')
    return customer[`${levelKey}_due`]
  }

  for (const level of KPB_LEVELS) {
    if (customer[`${level.key}_due`]) {
      return customer[`${level.key}_due`]
    }
  }

  return null
}

function applyKpbFilters(customers, { kpb_status, kpb_year, kpb_month }) {
  let filtered = customers

  if (kpb_status && kpb_status !== 'all') {
    filtered = filtered.filter((c) => c.kpb_status === kpb_status)
  }

  const hasKpbDateFilter = (kpb_year && kpb_year !== '') || (kpb_month && kpb_month !== '')

  if (hasKpbDateFilter) {
    const targetYear = kpb_year ? parseInt(kpb_year) : null
    const targetMonth = kpb_month ? parseInt(kpb_month) : null

    filtered = filtered.filter((c) => {
      const dueDate = getKpbDateForFilter(c, kpb_status)
      if (!dueDate) return false

      const d = new Date(dueDate)
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth() + 1

      const matchYear = !targetYear || year === targetYear
      const matchMonth = !targetMonth || month === targetMonth

      return matchYear && matchMonth
    })
  }

  return filtered
}

// ─── EXPORT EXCEL (NEW) ───────────────────────────────────────────────────

export async function exportCustomersExcel(req, res, next) {
  try {
    const { search, kpb_status, model, kpb_year, kpb_month } = req.query

    const where = { branch_code: 'DXK' }

    if (search) {
      where.OR = [
        { customer_name: { contains: search } },
        { customer_mobile: { contains: search } },
        { no_ktp: { contains: search } },
        { no_frame: { contains: search } },
        { so_number: { contains: search } },
      ]
    }

    if (model) where.model = model

    const woMap = await getAllKpbWos()

    const allCustomers = await prisma.customers.findMany({
      where,
      orderBy: { so_date: 'desc' },
    })

    const enriched = allCustomers.map((c) => enrichWithKpb(c, woMap))
    const filtered = applyKpbFilters(enriched, { kpb_status, kpb_year, kpb_month })

    const statusMap = {
      done: 'Sudah Service',
      pending: 'Lewat Tenggat',
      not_due: 'Belum Waktunya',
    }

    const exportData = filtered.map((c, idx) => ({
      No: idx + 1,
      Nama_Konsumen: c.customer_name || '-',
      No_HP: c.customer_mobile || '-',
      Motor: c.model || '-',
      Warna: c.color || '-',
      No_Mesin: c.no_engine || '-',
      Tgl_Beli: formatForExcel(c.so_date),
      KPB1: statusMap[c.kpb1_status] || '-',
      KPB2: statusMap[c.kpb2_status] || '-',
      KPB3: statusMap[c.kpb3_status] || '-',
      KPB4: statusMap[c.kpb4_status] || '-',
      Status_Overall: c.kpb_status === 'belum' ? 'Belum' : c.kpb_status.replace('_due', ' Jatuh Tempo').replace('kpb', 'KPB '),
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)

    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 25 },  // Nama_Konsumen
      { wch: 15 },  // No_HP
      { wch: 15 },  // Motor
      { wch: 10 },  // Warna
      { wch: 20 },  // No_Mesin
      { wch: 12 },  // Tgl_Beli
      { wch: 15 },  // KPB1
      { wch: 15 },  // KPB2
      { wch: 15 },  // KPB3
      { wch: 15 },  // KPB4
      { wch: 18 },  // Status_Overall
    ]

    xlsx.utils.book_append_sheet(wb, ws, 'Konsumen KPB')

    let suffix = 'Semua'
    if (kpb_status && kpb_status !== 'all') {
      suffix = kpb_status.replace('_due', '_jatuh_tempo')
    }
    if (kpb_year) suffix += `_${kpb_year}`
    if (kpb_month) suffix += `_bulan${kpb_month}`
    const filename = `Konsumen_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`

    const tmpDir = os.tmpdir()
    const tmpPath = path.join(tmpDir, filename)
    xlsx.writeFile(wb, tmpPath)

    res.download(tmpPath, filename, (err) => {
      if (err) console.error('Download error:', err)
      try { rmSync(tmpPath) } catch (e) {}
    })
  } catch (error) {
    next(error)
  }
}

// ─── API Endpoints ──────────────────────────────────────────────────────────

export async function getCustomers(req, res, next) {
  try {
    const { page = 1, limit = 50, search, kpb_status, model, from, to, kpb_year, kpb_month } = req.query
    const pageInt = parseInt(page)
    const limitInt = clampLimit(limit, 50)

    const where = { branch_code: 'DXK' }

    if (search) {
      where.OR = [
        { customer_name: { contains: search } },
        { customer_mobile: { contains: search } },
        { no_ktp: { contains: search } },
        { no_frame: { contains: search } },
        { so_number: { contains: search } },
      ]
    }

    if (model) where.model = model

    if (from || to) {
      where.so_date = {}
      if (from) where.so_date.gte = new Date(from)
      if (to) where.so_date.lte = new Date(to)
    }

    const woMap = await getAllKpbWos()

    const isKpbFilter = kpb_status && kpb_status !== 'all'
    const isKpbDateFilter = (kpb_year && kpb_year !== '') || (kpb_month && kpb_month !== '')

    if (isKpbFilter || isKpbDateFilter) {
      // Narrow so_date window to reduce memory load: KPB due = so_date + 2..8 months.
      // When filtering by due year/month, so_date is at most 8 months earlier.
      if (isKpbDateFilter) {
        const targetYear = kpb_year ? parseInt(kpb_year) : new Date().getFullYear()
        const targetMonth = kpb_month ? parseInt(kpb_month) : 12
        const dueMax = new Date(targetYear, targetMonth, 1)
        const dueMin = new Date(targetYear, targetMonth - 2, 1)
        const soMax = new Date(dueMax)
        soMax.setMonth(soMax.getMonth() - 1) // earliest KPB (KPB1 = +2mo)
        const soMin = new Date(dueMin)
        soMin.setMonth(soMin.getMonth() - 8) // latest KPB (KPB4 = +8mo)
        where.so_date = {
          ...(where.so_date || {}),
          gte: soMin,
          lte: soMax,
        }
      }

      const allCustomers = await prisma.customers.findMany({
        where,
        orderBy: { so_date: 'desc' },
      })

      const enriched = allCustomers.map((c) => enrichWithKpb(c, woMap))
      const filtered = applyKpbFilters(enriched, { kpb_status, kpb_year, kpb_month })

      const skip = (pageInt - 1) * limitInt
      const paginated = filtered.slice(skip, skip + limitInt)
      const followups = await getLatestFollowupsForCustomers(paginated.map((c) => c.id))

      res.json({
        data: attachLatestFollowups(paginated, followups),
        pagination: {
          page: pageInt,
          limit: limitInt,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limitInt),
        },
      })
      return
    }

    const skip = (pageInt - 1) * limitInt

    const [customersRaw, total] = await Promise.all([
      prisma.customers.findMany({
        where,
        skip,
        take: limitInt,
        orderBy: { so_date: 'desc' },
      }),
      prisma.customers.count({ where }),
    ])

    const enriched = customersRaw.map((c) => enrichWithKpb(c, woMap))
    const followups = await getLatestFollowupsForCustomers(enriched.map((c) => c.id))

    res.json({
      data: attachLatestFollowups(enriched, followups),
      pagination: { page: pageInt, limit: limitInt, total, totalPages: Math.ceil(total / limitInt) },
    })
  } catch (error) {
    next(error)
  }
}

export async function getCustomerSummary(req, res, next) {
  try {
    const all = await prisma.customers.findMany({
      where: { branch_code: 'DXK' },
      select: { so_date: true, no_engine: true },
    })

    const woMap = await getAllKpbWos()

    let kpb1 = 0, kpb2 = 0, kpb3 = 0, kpb4 = 0, belum = 0
    for (const c of all) {
      const status = getOverallKpbStatus(woMap[c.no_engine], c.so_date)
      if (status === 'kpb1_due') kpb1++
      else if (status === 'kpb2_due') kpb2++
      else if (status === 'kpb3_due') kpb3++
      else if (status === 'kpb4_due') kpb4++
      else belum++
    }

    res.json({
      total: all.length,
      belum,
      kpb1_due: kpb1,
      kpb2_due: kpb2,
      kpb3_due: kpb3,
      kpb4_due: kpb4,
    })
  } catch (error) {
    next(error)
  }
}

export async function getCustomerAlerts(req, res, next) {
  try {
    const { days = 7 } = req.query
    const { data, summary } = await buildKpbFollowupAlerts(days)
    // Draf disiapkan di server supaya isinya mengikuti template aktif yang bisa
    // diubah dari UI — halaman tidak lagi menyusun teksnya sendiri.
    const halaman = data.slice(0, 100)
    const render = await muatPerenderMassal()
    const denganDraf = halaman.map((a) => {
      const pesan = render.kpb({
        customerName: a.customer, model: a.model, kpbLabel: a.kpb_label,
        dueDate: a.kpb_due_date, daysRemaining: a.days_remaining,
      })
      return { ...a, draft_message: pesan, wa_url: waMeUrl(a.customer_mobile, pesan) }
    })

    res.json({
      data: denganDraf,
      summary,
      daily: await getDailyUsage(),
    })
  } catch (error) {
    next(error)
  }
}

export async function exportFollowupKpbExcel(req, res, next) {
  try {
    const { days = 7, status = 'all', kpb_level = 'all' } = req.query
    const { data } = await buildKpbFollowupAlerts(days)
    const filtered = data.filter((item) => {
      const followupStatus = item.followup?.status || 'belum_dihubungi'
      if (status !== 'all' && followupStatus !== status) return false
      if (kpb_level !== 'all' && item.kpb_label !== kpb_level) return false
      return true
    })

    const exportData = filtered.map((item, index) => ({
      No: index + 1,
      Konsumen: item.customer,
      'No HP': item.customer_mobile || '',
      Motor: item.model || '',
      Warna: item.color || '',
      'No Rangka': item.no_frame || '',
      'SO Number': item.so_number || '',
      'Tanggal Beli': formatForExcel(item.so_date),
      KPB: item.kpb_label,
      'Jatuh Tempo': formatForExcel(item.kpb_due_date),
      Status: formatDaysForExport(item.days_remaining),
      'Status Follow-up': followupStatusLabel(item.followup?.status),
      'Catatan Terakhir': item.followup?.note || '',
      Petugas: item.followup?.creator?.name || item.followup?.creator?.username || '',
      'Waktu Follow-up': formatForExcel(item.followup?.followup_at),
      Alamat: item.alamat_konsumen || '',
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 22 },
      { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
      { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 40 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Follow-up KPB')

    const suffix = `${status}_${kpb_level}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Followup_KPB_DXK_${suffix}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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

function makeAlert(c, level, dueDate, diffDays) {
  return {
    id: c.id,
    customer_id: c.id,
    customer: c.customer_name,
    customer_mobile: c.customer_mobile,
    model: c.model,
    color: c.color,
    no_frame: c.no_frame,
    so_date: c.so_date,
    so_number: c.so_number,
    alamat_konsumen: [c.kelurahan, c.kecamatan, c.kabupaten].filter(Boolean).join(', ') || c.alamat_konsumen,
    kpb_label: level.label,
    kpb_status: level.key + '_due',
    kpb_due_date: dueDate,
    days_remaining: diffDays,
  }
}

export async function getCustomerFollowups(req, res, next) {
  try {
    const customerId = parseInt(req.params.id)
    const customer = await prisma.customers.findUnique({ where: { id: customerId } })
    if (!customer) return res.status(404).json({ error: 'Konsumen tidak ditemukan' })

    const data = await prisma.kpb_followups.findMany({
      where: { customer_id: customerId },
      orderBy: { followup_at: 'desc' },
      include: { creator: { select: { id: true, username: true, name: true, role: true } } },
    })

    res.json({ data })
  } catch (error) {
    next(error)
  }
}

export async function createCustomerFollowup(req, res, next) {
  try {
    const customerId = parseInt(req.params.id)
    const { kpb_level, status, note } = req.body
    const allowedStatuses = ['belum_dihubungi', 'sudah_dihubungi', 'booking', 'datang', 'batal']
    const allowedLevels = ['KPB1', 'KPB2', 'KPB3', 'KPB4']

    if (!allowedLevels.includes(kpb_level)) {
      return res.status(400).json({ error: 'Level KPB tidak valid' })
    }
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status follow-up tidak valid' })
    }

    const customer = await prisma.customers.findUnique({ where: { id: customerId } })
    if (!customer) return res.status(404).json({ error: 'Konsumen tidak ditemukan' })

    const data = await prisma.kpb_followups.create({
      data: {
        customer_id: customerId,
        kpb_level,
        status,
        note: note || null,
        created_by: req.user.userId,
      },
      include: { creator: { select: { id: true, username: true, name: true, role: true } } },
    })

    res.status(201).json({ message: 'Follow-up berhasil disimpan', data })
  } catch (error) {
    next(error)
  }
}

export async function getCustomerModels(req, res, next) {
  try {
    const data = await prisma.customers.groupBy({
      by: ['model'],
      where: { branch_code: 'DXK', model: { not: null } },
      _count: true,
      orderBy: { _count: { model: 'desc' } },
    })
    res.json({ data: data.map((d) => d.model) })
  } catch (error) {
    next(error)
  }
}

/**
 * Import Report Penjualan Excel
 * Mapping kolom sesuai struktur asli file Excel PT. Tunas Dwipa Matra
 */
export async function uploadSales(req, res, next) {
  try {
    if (!req.file?.path) return res.status(400).json({ error: 'File wajib diupload' })
    await withImportLock('sync:sales', async () => {
      const { records: validRecords, errors } = await parseSalesFile(req.file.path)
      const backup = await createDatabaseBackup('pre_import_sales')

    const soNumbers = validRecords.map((record) => record.so_number)
    const existingCustomers = await prisma.customers.findMany({
      where: { so_number: { in: soNumbers } },
      select: { so_number: true },
    })
    const existingSoNumbers = new Set(existingCustomers.map((customer) => customer.so_number))
    const createdCount = soNumbers.filter((soNumber) => !existingSoNumbers.has(soNumber)).length
    const updatedCount = soNumbers.length - createdCount

    // Upsert by so_number: preserve customer IDs so KPB follow-up history survives re-import.
    await prisma.$transaction(async (tx) => {
      await bulkUpsert(tx, 'customers', 'so_number', validRecords)
    }, { maxWait: 20000, timeout: 180000 })

    const success = validRecords.length

    await prisma.sync_logs.create({
      data: {
        user_id: req.user?.userId,
        module: 'sales',
        filename: req.file.originalname,
        rows_success: success,
        rows_error: errors.length,
        error_detail: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
      },
    })

    await createAuditLog({
      userId: req.user?.userId,
      tableName: 'sync_import',
      recordId: 'sales',
      fieldName: 'upsert_by_so_number',
      newValue: {
        module: 'sales',
        filename: req.file.originalname,
        rows_success: success,
        rows_error: errors.length,
        created: createdCount,
        updated: updatedCount,
        backup: backup.filename,
      },
    })

      await fs.unlink(req.file.path)
      await delCache('dashboard:summary')

      res.json({
        message: 'Import penjualan selesai',
        success,
        created: createdCount,
        updated: updatedCount,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        backup: backup.filename,
      })
    }, { module: 'sales', reason: 'upsert_so' })
  } catch (error) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {})
    next(error)
  }
}
