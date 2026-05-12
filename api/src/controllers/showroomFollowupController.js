import xlsx from 'xlsx'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '../config/db.js'
import { buildStnkWhere, buildBpkbWhere, DOCUMENT_FOLLOWUP_STATUSES, cleanupUpload } from './showroomUtils.js'
import { formatForExcel } from '../utils/excelUtils.js'

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

function buildDocumentWhere(documentType, query) {
  return documentType === 'STNK' ? buildStnkWhere(query) : buildBpkbWhere(query)
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

function attachDocumentFollowups(documentType, rows, followups) {
  return rows.map((item) => ({
    ...item,
    document_type: documentType,
    followup: followups.get(item.engine_number) || null,
  }))
}

async function buildDocumentFollowupData(documentType, query) {
  const where = buildDocumentWhere(documentType, query)
  if (documentType === 'BPKB') {
    const searchOr = where.OR
    delete where.OR
    where.AND = [
      ...(searchOr ? [{ OR: searchOr }] : []),
      { OR: [{ finance_company: null }, { finance_company: '' }] },
    ]
  }
  const rows = documentType === 'STNK'
    ? await prisma.showroom_stnks.findMany({ where, orderBy: { receipt_date: 'desc' } })
    : await prisma.showroom_bpkbs.findMany({ where, orderBy: { overdue_days: 'desc' } })
  const latest = await getLatestDocumentFollowups(documentType, rows.map((item) => item.engine_number))
  const data = attachDocumentFollowups(documentType, rows, latest)

  return data.filter((item) => {
    const currentStatus = item.followup?.status || 'belum_dihubungi'
    if (query.status && query.status !== 'all' && currentStatus !== query.status) return false
    if (documentType === 'BPKB' && query.overdue_min && query.overdue_min !== 'all' && (item.overdue_days || 0) < parseInt(query.overdue_min)) return false
    return true
  })
}

function summarizeDocumentFollowups(data) {
  const byStatus = Object.fromEntries(DOCUMENT_FOLLOWUP_STATUSES.map((status) => [status, 0]))
  for (const item of data) {
    const status = item.followup?.status || 'belum_dihubungi'
    byStatus[status] = (byStatus[status] || 0) + 1
  }
  return { total: data.length, byStatus }
}

export async function getDocumentFollowups(req, res, next) {
  try {
    const documentType = String(req.params.type || '').toUpperCase()
    if (!['STNK', 'BPKB'].includes(documentType)) return res.status(400).json({ error: 'Tipe dokumen tidak valid' })

    const { page = 1, limit = 100 } = req.query
    const pageInt = parseInt(page)
    const limitInt = parseInt(limit)
    const data = await buildDocumentFollowupData(documentType, req.query)
    const skip = (pageInt - 1) * limitInt
    const paginated = data.slice(skip, skip + limitInt)

    res.json({
      data: paginated,
      summary: summarizeDocumentFollowups(data),
      pagination: { page: pageInt, limit: limitInt, total: data.length, totalPages: Math.ceil(data.length / limitInt) },
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

    const exists = documentType === 'STNK'
      ? await prisma.showroom_stnks.findUnique({ where: { engine_number: engineNumber } })
      : await prisma.showroom_bpkbs.findUnique({ where: { engine_number: engineNumber } })
    if (!exists) return res.status(404).json({ error: 'Dokumen tidak ditemukan' })

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

    const data = await buildDocumentFollowupData(documentType, req.query)
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
