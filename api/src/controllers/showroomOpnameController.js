import xlsx from 'xlsx'
import os from 'os'
import path from 'path'
import { existsSync, rmSync, renameSync } from 'fs'
import { prisma } from '../config/db.js'
import { assertImportNotLocked } from '../services/importLockService.js'

const TYPES = ['unit', 'stnk', 'bpkb']
const OPEN_IMPORT_BLOCK_STATUSES = ['draft', 'open', 'submitted', 'approved_adh', 'sent_to_kacab', 'approved_kacab', 'rejected']

function sessionCode(type) {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `SO-${type.toUpperCase()}/DXK/${dd}${mm}${yy}-${hh}${mi}`
}

function normalize(value) {
  return String(value || '').trim()
}

function normalizeScanInput(value) {
  return normalize(value)
    .replace(/^(NO\s*(MESIN|RANGKA|POLISI|BPKB|INVOICE|SO)\s*[:\-]?\s*)/i, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
    .trim()
}

function normalizeLocationCompare(value) {
  return normalize(value).toLowerCase()
}

function getLocationRiskNote(item, type) {
  if (type !== 'unit' || item.status !== 'salah_lokasi') return '-'
  return 'Beda lokasi - perlu mutasi/lokasi stock disesuaikan agar risiko asuransi terkontrol'
}

function addShowroomSignatureBlock(ws, dataLength, session) {
  const startRow = dataLength + 4
  xlsx.utils.sheet_add_aoa(ws, [
    ['Berita Acara Stock Opname Showroom'],
    [`Jenis SO: ${session.opname_type.toUpperCase()}`],
    [`Nomor SO: ${session.session_code}`],
    [`PIC Opname: ${session.pic_so_name || '-'}`],
    [],
    ['Validasi Digital'],
    [`Submitted by PIC SO: ${session.pic_so_name || '-'}${session.submitted_at ? ` / ${new Date(session.submitted_at).toLocaleString('id-ID')}` : ''}`],
    [`Approved 1 by ADH: ${session.adh_name || '-'}${session.adh_approved_at ? ` / ${new Date(session.adh_approved_at).toLocaleString('id-ID')}` : ''}`],
    [`Approved 2 by Kepala Cabang/SOH: ${session.branch_head_name || '-'}${session.kacab_approved_at ? ` / ${new Date(session.kacab_approved_at).toLocaleString('id-ID')}` : ''}`],
    [],
    ['Tanda Tangan BASO'],
    ['PIC Opname', '', 'ADH', '', 'Kepala Cabang/SOH'],
    [],
    [],
    [],
    [session.pic_so_name || '(........................)', '', session.adh_name || '(........................)', '', session.branch_head_name || '(........................)'],
  ], { origin: `A${startRow}` })
}

async function getSnapshotRows(type) {
  if (type === 'unit') {
    const rows = await prisma.showroom_stock_units.findMany({ where: { branch_code: 'DXK' } })
    return rows.map((row) => ({
      reference_key: row.engine_number,
      secondary_key: row.chassis_number,
      display_name: [row.series, row.product_type, row.color].filter(Boolean).join(' / '),
      system_location: row.location,
    }))
  }
  if (type === 'stnk') {
    const rows = await prisma.showroom_stnks.findMany({ where: { branch_code: 'DXK' } })
    return rows.map((row) => ({
      reference_key: row.engine_number,
      secondary_key: row.police_number,
      display_name: row.stnk_name || row.applicant_name,
      system_location: row.stnk_location,
    }))
  }
  const rows = await prisma.showroom_bpkbs.findMany({ where: { branch_code: 'DXK' } })
  return rows.map((row) => ({
    reference_key: row.engine_number,
    secondary_key: row.bpkb_number,
    display_name: row.stnk_name || row.applicant_name || row.requestor_name,
    system_location: row.bpkb_location,
  }))
}

async function findReference(type, input) {
  const value = normalizeScanInput(input)
  if (!value) return null
  const where = { branch_code: 'DXK', OR: [] }
  if (type === 'unit') {
    where.OR = [{ engine_number: value }, { chassis_number: value }, { series: { contains: value } }]
    const row = await prisma.showroom_stock_units.findFirst({ where })
    return row && { reference_key: row.engine_number, secondary_key: row.chassis_number, display_name: [row.series, row.product_type, row.color].filter(Boolean).join(' / '), system_location: row.location }
  }
  if (type === 'stnk') {
    where.OR = [{ engine_number: value }, { police_number: value }, { stnk_name: { contains: value } }, { applicant_name: { contains: value } }, { sale_order_number: value }]
    const row = await prisma.showroom_stnks.findFirst({ where })
    return row && { reference_key: row.engine_number, secondary_key: row.police_number, display_name: row.stnk_name || row.applicant_name, system_location: row.stnk_location }
  }
  where.OR = [{ engine_number: value }, { bpkb_number: value }, { stnk_name: { contains: value } }, { applicant_name: { contains: value } }, { invoice_number: value }]
  const row = await prisma.showroom_bpkbs.findFirst({ where })
  return row && { reference_key: row.engine_number, secondary_key: row.bpkb_number, display_name: row.stnk_name || row.applicant_name || row.requestor_name, system_location: row.bpkb_location }
}

async function findReferences(type, input) {
  const value = normalizeScanInput(input)
  if (!value) return []
  const where = { branch_code: 'DXK', OR: [] }
  if (type === 'unit') {
    where.OR = [
      { engine_number: { contains: value } },
      { chassis_number: { contains: value } },
      { series: { contains: value } },
    ]
    const rows = await prisma.showroom_stock_units.findMany({ where, take: 20, orderBy: { engine_number: 'asc' } })
    return rows.map((row) => ({ reference_key: row.engine_number, secondary_key: row.chassis_number, display_name: [row.series, row.product_type, row.color].filter(Boolean).join(' / '), system_location: row.location }))
  }
  if (type === 'stnk') {
    where.OR = [
      { engine_number: { contains: value } },
      { police_number: { contains: value } },
      { stnk_name: { contains: value } },
      { applicant_name: { contains: value } },
    ]
    const rows = await prisma.showroom_stnks.findMany({ where, take: 20, orderBy: { engine_number: 'asc' } })
    return rows.map((row) => ({ reference_key: row.engine_number, secondary_key: row.police_number, display_name: row.stnk_name || row.applicant_name, system_location: row.stnk_location }))
  }
  where.OR = [
    { engine_number: { contains: value } },
    { bpkb_number: { contains: value } },
    { stnk_name: { contains: value } },
    { applicant_name: { contains: value } },
  ]
  const rows = await prisma.showroom_bpkbs.findMany({ where, take: 20, orderBy: { engine_number: 'asc' } })
  return rows.map((row) => ({ reference_key: row.engine_number, secondary_key: row.bpkb_number, display_name: row.stnk_name || row.applicant_name || row.requestor_name, system_location: row.bpkb_location }))
}

function summarize(items) {
  return {
    total_system: items.filter((item) => item.status !== 'tidak_terdaftar').length,
    sudah_scan: items.filter((item) => ['sesuai', 'salah_lokasi'].includes(item.status)).length,
    belum_scan: items.filter((item) => item.status === 'belum_scan').length,
    salah_lokasi: items.filter((item) => item.status === 'salah_lokasi').length,
    tidak_terdaftar: items.filter((item) => item.status === 'tidak_terdaftar').length,
  }
}

function isHundredPercent(summary) {
  return summary.total_system > 0
    && summary.sudah_scan === summary.total_system
    && summary.belum_scan === 0
    && summary.salah_lokasi === 0
    && summary.tidak_terdaftar === 0
}

async function getSessionSummary(id) {
  const items = await prisma.showroom_opname_items.findMany({ where: { session_id: id } })
  return summarize(items)
}

function requireStatus(session, statuses) {
  if (!statuses.includes(session.status)) {
    const error = new Error(`Status sesi harus ${statuses.join(' atau ')}`)
    error.statusCode = 400
    throw error
  }
}

export async function ensureNoActiveShowroomOpname(type) {
  const active = await prisma.showroom_opname_sessions.findFirst({ where: { opname_type: type, status: { in: OPEN_IMPORT_BLOCK_STATUSES } } })
  if (active) {
    const labels = { unit: 'Unit', stnk: 'STNK', bpkb: 'BPKB' }
    const error = new Error(`Masih ada sesi Opname ${labels[type]} aktif: ${active.session_code}. Selesaikan atau hapus sesi sebelum import.`)
    error.statusCode = 409
    throw error
  }
}

async function getSessionWithItems(id) {
  const session = await prisma.showroom_opname_sessions.findUnique({
    where: { id: parseInt(id) },
    include: {
      items: { orderBy: [{ status: 'asc' }, { scanned_at: 'desc' }] },
      creator: { select: { name: true, username: true } },
      reviewer: { select: { name: true, username: true } },
    },
  })
  return session
}

export async function getShowroomOpnameSessions(req, res, next) {
  try {
    const type = normalize(req.query.type).toLowerCase()
    const where = TYPES.includes(type) ? { opname_type: type } : {}
    const sessions = await prisma.showroom_opname_sessions.findMany({
      where,
      include: { _count: { select: { items: true } }, creator: { select: { name: true, username: true } }, reviewer: { select: { name: true, username: true } } },
      orderBy: { created_at: 'desc' },
    })
    res.json({ data: sessions })
  } catch (error) { next(error) }
}

export async function createShowroomOpnameSession(req, res, next) {
  try {
    const type = normalize(req.body.opname_type).toLowerCase()
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Jenis opname tidak valid' })
    await assertImportNotLocked(`showroom:${type}`, `Import ${type.toUpperCase()} sedang berjalan. Coba buat sesi opname setelah import selesai.`)
    const rows = await getSnapshotRows(type)
    const session = await prisma.showroom_opname_sessions.create({
      data: {
        session_code: sessionCode(type),
        opname_type: type,
        created_by: req.user.userId,
        items: { create: rows.map((row) => ({ ...row, status: 'belum_scan' })) },
      },
      include: { _count: { select: { items: true } } },
    })
    res.status(201).json({ message: 'Generate stock berhasil. Isi nama PIC SO, ADH, dan Kepala Cabang lalu confirm.', data: session })
  } catch (error) { next(error) }
}

export async function createSessionByLocation(req, res, next) {
  try {
    const type = 'unit'
    const targetLocation = normalize(req.body.target_location)
    if (!targetLocation) return res.status(400).json({ error: 'Lokasi target wajib diisi' })
    await assertImportNotLocked(`showroom:${type}`, `Import ${type.toUpperCase()} sedang berjalan. Coba buat sesi opname setelah import selesai.`)
    const allRows = await getSnapshotRows(type)
    const rows = allRows.filter((row) => normalizeLocationCompare(row.system_location) === normalizeLocationCompare(targetLocation))
    if (rows.length === 0) {
      return res.status(400).json({ error: `Tidak ada unit di lokasi ${targetLocation}. Pastikan import stock unit sudah terkini.` })
    }
    const session = await prisma.showroom_opname_sessions.create({
      data: {
        session_code: sessionCode(type),
        opname_type: type,
        target_location: targetLocation,
        created_by: req.user.userId,
        items: { create: rows.map((row) => ({ ...row, status: 'belum_scan' })) },
      },
      include: { _count: { select: { items: true } } },
    })
    res.status(201).json({ message: `Generate stock untuk lokasi ${targetLocation} berhasil (${rows.length} unit). Isi nama PIC SO lalu confirm.`, data: session })
  } catch (error) { next(error) }
}

export async function scanWithPhoto(req, res, next) {
  try {
    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    if (session.status !== 'open') return res.status(400).json({ error: 'Scan hanya dapat dilakukan saat status Open' })

    const input = normalizeScanInput(req.body.code)
    if (!input) return res.status(400).json({ error: 'Kode scan kosong atau tidak valid' })
    const physicalLocation = normalize(req.body.physical_location) || null
    if (!physicalLocation) return res.status(400).json({ error: 'Lokasi fisik wajib diisi' })

    const ref = await findReference(session.opname_type, input)

    // PIC session-based location guard
    if (req.user.role === 'PIC Stock opname' && ref && ref.system_location) {
      const assignments = await prisma.showroom_opname_assignments.findMany({
        where: { session_id: session.id, user_id: req.user.userId },
        select: { location_name: true },
      })
      const allowedLocs = assignments.map((a) => normalizeLocationCompare(a.location_name))
      if (!allowedLocs.includes(normalizeLocationCompare(ref.system_location))) {
        if (req.file) {
          try { rmSync(req.file.path) } catch (e) {}
        }
        await prisma.showroom_notifications.create({
          data: {
            session_id: session.id,
            user_id: req.user.userId,
            type: 'wrong_location_attempt',
            message: `PIC mencoba scan unit ${ref.reference_key} (lokasi: ${ref.system_location}) di luar area tugasnya.`,
            data: JSON.stringify({ reference_key: ref.reference_key, system_location: ref.system_location, pic_user_id: req.user.userId }),
          },
        })
        return res.status(403).json({ error: 'Lokasi unit bukan lokasi anda, silahkan hubungi admin' })
      }
    }

    let photoUrl = req.file ? `/uploads/${path.basename(req.file.path)}` : null
    const geoLat = req.body.geo_lat ? parseFloat(req.body.geo_lat) : null
    const geoLng = req.body.geo_lng ? parseFloat(req.body.geo_lng) : null

    if (!ref) {
      let item = await prisma.showroom_opname_items.create({
        data: {
          session_id: session.id,
          reference_key: input,
          status: 'tidak_terdaftar',
          physical_location: physicalLocation,
          photo_url: photoUrl,
          geo_lat: geoLat,
          geo_lng: geoLng,
          scanned_at: new Date(),
          scanned_by: req.user.userId,
        },
      })

      if (req.file && item) {
        const safeSessionCode = session.session_code.replace(/[^a-zA-Z0-9_-]/g, '_')
        const safeEngine = (item.reference_key || input).replace(/[^a-zA-Z0-9_-]/g, '_')
        const ext = path.extname(req.file.originalname) || '.jpg'
        const newFilename = `${safeSessionCode}_${safeEngine}${ext}`
        const newPath = path.resolve('uploads', newFilename)
        try {
          renameSync(req.file.path, newPath)
          photoUrl = `/uploads/${newFilename}`
          item = await prisma.showroom_opname_items.update({
            where: { id: item.id },
            data: { photo_url: photoUrl },
          })
        } catch (e) {
          console.error('Gagal rename foto tidak terdaftar:', e)
        }
      }

      return res.status(201).json({ message: 'Item tidak terdaftar di sistem', data: item })
    }

    const status = ref.system_location && normalizeLocationCompare(physicalLocation) !== normalizeLocationCompare(ref.system_location) ? 'salah_lokasi' : 'sesuai'
    let item = await prisma.showroom_opname_items.upsert({
      where: { session_id_reference_key: { session_id: session.id, reference_key: ref.reference_key } },
      update: { ...ref, status, physical_location: physicalLocation, photo_url: photoUrl, geo_lat: geoLat, geo_lng: geoLng, scanned_at: new Date(), scanned_by: req.user.userId },
      create: { session_id: session.id, ...ref, status, physical_location: physicalLocation, photo_url: photoUrl, geo_lat: geoLat, geo_lng: geoLng, scanned_at: new Date(), scanned_by: req.user.userId },
    })

    if (req.file && item) {
      const safeSessionCode = session.session_code.replace(/[^a-zA-Z0-9_-]/g, '_')
      const safeEngine = item.reference_key.replace(/[^a-zA-Z0-9_-]/g, '_')
      const ext = path.extname(req.file.originalname) || '.jpg'
      const newFilename = `${safeSessionCode}_${safeEngine}${ext}`
      const newPath = path.resolve('uploads', newFilename)
      try {
        renameSync(req.file.path, newPath)
        photoUrl = `/uploads/${newFilename}`
        item = await prisma.showroom_opname_items.update({
          where: { id: item.id },
          data: { photo_url: photoUrl },
        })
      } catch (e) {
        console.error('Gagal rename foto:', e)
      }
    }

    res.json({
      message: status === 'salah_lokasi'
        ? 'Unit ditemukan beda lokasi. Perlu mutasi/lokasi stock disesuaikan agar risiko asuransi terkontrol.'
        : 'Item sesuai',
      data: item,
    })
  } catch (error) { next(error) }
}

export async function getOpnamePhoto(req, res, next) {
  try {
    const filename = normalize(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '')
    if (!filename) return res.status(400).json({ error: 'Filename tidak valid' })
    const filePath = path.resolve('uploads', filename)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File foto tidak ditemukan' })
    res.setHeader('Content-Type', 'image/jpeg')
    res.sendFile(filePath)
  } catch (error) { next(error) }
}

export async function confirmShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const picSoName = normalize(req.body.pic_so_name)
    const adhName = normalize(req.body.adh_name)
    const branchHeadName = normalize(req.body.branch_head_name)
    if (!picSoName) return res.status(400).json({ error: 'Nama PIC SO wajib diisi' })
    if (!adhName) return res.status(400).json({ error: 'Nama ADH wajib diisi' })
    if (!branchHeadName) return res.status(400).json({ error: 'Nama Kepala Cabang wajib diisi' })
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['draft'])
    const session = await prisma.showroom_opname_sessions.update({
      where: { id },
      data: { pic_so_name: picSoName, adh_name: adhName, branch_head_name: branchHeadName, status: 'open', confirmed_at: new Date() },
    })
    res.json({ message: 'Sesi SO dikonfirmasi dan berstatus Open', data: session })
  } catch (error) { next(error) }
}

export async function getShowroomOpnameItems(req, res, next) {
  try {
    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    let items = await prisma.showroom_opname_items.findMany({ where: { session_id: session.id }, orderBy: [{ status: 'asc' }, { scanned_at: 'desc' }] })

    if (req.user.role === 'PIC Stock opname') {
      const assignments = await prisma.showroom_opname_assignments.findMany({
        where: { session_id: session.id, user_id: req.user.userId },
        select: { location_name: true },
      })
      const allowedLocs = assignments.map((a) => normalizeLocationCompare(a.location_name))
      items = items.filter((item) => {
        // Always show items scanned by this user
        if (item.scanned_by === req.user.userId) return true
        // Show "tidak_terdaftar" items they created
        if (item.status === 'tidak_terdaftar' && item.scanned_by === req.user.userId) return true
        // Otherwise show only items in their assigned locations
        if (!item.system_location) return false
        return allowedLocs.includes(normalizeLocationCompare(item.system_location))
      })
    }
    // Lead PIC Stock opname: don't filter, show all so they can validate
    if (req.user.role === 'Lead PIC Stock opname') {
      // no-op: show all
    }

    res.json({ data: items, summary: summarize(items), session })
  } catch (error) { next(error) }
}

export async function getShowroomOpnameReport(req, res, next) {
  try {
    const session = await getSessionWithItems(req.params.id)
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    res.json({ data: { session, summary: summarize(session.items), items: session.items } })
  } catch (error) { next(error) }
}

export async function exportShowroomOpnameReport(req, res, next) {
  try {
    const session = await getSessionWithItems(req.params.id)
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    const data = session.items.map((item, index) => ({
      No: index + 1,
      Jenis: session.opname_type.toUpperCase(),
      Kode_Sesi: session.session_code,
      No_Mesin_Referensi: item.reference_key,
      Nomor_Lain: item.secondary_key || '-',
      Nama_Display: item.display_name || '-',
      Lokasi_Sistem: item.system_location || '-',
      Ditemukan_Di: item.physical_location || '-',
      Status: item.status,
      Keterangan_Risiko: getLocationRiskNote(item, session.opname_type),
      Waktu_Scan: item.scanned_at ? new Date(item.scanned_at).toLocaleString('id-ID') : '-',
      Catatan: item.notes || '-',
    }))
    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 48 }, { wch: 20 }, { wch: 30 }]
    addShowroomSignatureBlock(ws, data.length, session)
    xlsx.utils.book_append_sheet(wb, ws, 'Opname Showroom')
    const filename = `Opname_${session.opname_type.toUpperCase()}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
    const tmpPath = path.join(os.tmpdir(), filename)
    xlsx.writeFile(wb, tmpPath)
    res.download(tmpPath, filename, (err) => {
      if (err) console.error('Download error:', err)
      try { rmSync(tmpPath) } catch (e) {}
    })
  } catch (error) { next(error) }
}

export async function scanShowroomOpnameItem(req, res, next) {
  try {
    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    if (session.status !== 'open') return res.status(400).json({ error: 'Scan hanya dapat dilakukan saat status Open' })

    const input = normalizeScanInput(req.body.code)
    if (!input) return res.status(400).json({ error: 'Kode scan kosong atau tidak valid' })
    const physicalLocation = normalize(req.body.physical_location) || null
    if (session.opname_type === 'unit' && !physicalLocation) return res.status(400).json({ error: 'Lokasi fisik unit wajib dipilih sebelum scan' })
    const ref = await findReference(session.opname_type, input)

    if (!ref) {
      const item = await prisma.showroom_opname_items.create({
        data: { session_id: session.id, reference_key: input, status: 'tidak_terdaftar', physical_location: physicalLocation, scanned_at: new Date(), scanned_by: req.user.userId },
      })
      return res.status(201).json({ message: 'Item tidak terdaftar di sistem', data: item })
    }

    const status = physicalLocation && ref.system_location && normalizeLocationCompare(physicalLocation) !== normalizeLocationCompare(ref.system_location) ? 'salah_lokasi' : 'sesuai'
    const item = await prisma.showroom_opname_items.upsert({
      where: { session_id_reference_key: { session_id: session.id, reference_key: ref.reference_key } },
      update: { ...ref, status, physical_location: physicalLocation, scanned_at: new Date(), scanned_by: req.user.userId },
      create: { session_id: session.id, ...ref, status, physical_location: physicalLocation, scanned_at: new Date(), scanned_by: req.user.userId },
    })
    res.json({
      message: status === 'salah_lokasi'
        ? 'Unit ditemukan beda lokasi. Perlu mutasi/lokasi stock disesuaikan agar risiko asuransi terkontrol.'
        : 'Item sesuai',
      data: item,
    })
  } catch (error) { next(error) }
}

export async function updateShowroomOpnameItem(req, res, next) {
  try {
    const sessionId = parseInt(req.params.id)
    const itemId = parseInt(req.params.itemId)
    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id: sessionId } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    if (session.status !== 'open') return res.status(400).json({ error: 'Edit item hanya dapat dilakukan saat status Open' })
    const existingItem = await prisma.showroom_opname_items.findFirst({ where: { id: itemId, session_id: sessionId } })
    if (!existingItem) return res.status(404).json({ error: 'Item tidak ditemukan pada sesi ini' })
    const status = normalize(req.body.status)
    const allowed = ['sesuai', 'belum_scan', 'salah_lokasi', 'tidak_terdaftar']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Status tidak valid' })
    const item = await prisma.showroom_opname_items.update({
      where: { id: itemId },
      data: {
        status,
        physical_location: normalize(req.body.physical_location) || null,
        notes: normalize(req.body.notes) || null,
        scanned_at: status === 'belum_scan' ? null : new Date(),
        scanned_by: status === 'belum_scan' ? null : req.user.userId,
      },
    })
    res.json({ message: 'Item opname diperbarui', data: item })
  } catch (error) { next(error) }
}

export async function submitShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['open'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'submitted', submitted_at: new Date(), completed_at: new Date() } })
    res.json({ message: 'Hasil SO dikirim untuk monitoring', data: session })
  } catch (error) { next(error) }
}

export async function adhDoneShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['submitted'])
    const summary = await getSessionSummary(id)
    if (!isHundredPercent(summary)) return res.status(400).json({ error: 'Approve 1 ADH hanya dapat dilakukan jika hasil SO 100%' })
    const now = new Date()
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'approved_adh', adh_done_at: now, adh_approved_at: now, adh_approved_by: req.user.userId } })
    res.json({ message: 'Approved 1 oleh ADH', data: session })
  } catch (error) { next(error) }
}

export async function sendToKacabShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['approved_adh'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'sent_to_kacab', sent_to_kacab_at: new Date() } })
    res.json({ message: 'Hasil SO dikirim ke Kepala Cabang/SOH', data: session })
  } catch (error) { next(error) }
}

export async function approveKacabShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['sent_to_kacab'])
    const now = new Date()
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'approved_kacab', approved_at: now, kacab_approved_at: now, kacab_approved_by: req.user.userId, reviewed_by: req.user.userId } })
    res.json({ message: 'Approved 2 oleh Kepala Cabang/SOH. BASO dapat dicetak.', data: session })
  } catch (error) { next(error) }
}

export async function rfaShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const reason = normalize(req.body.reason)
    if (!reason) return res.status(400).json({ error: 'Reason wajib diisi' })
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['submitted', 'approved_adh', 'sent_to_kacab', 'rejected'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'rejected', rfa_reason: reason, rfa_at: new Date(), rejection_reason: reason, rejected_at: new Date(), reviewed_by: req.user.userId } })
    res.json({ message: 'Hasil SO direject untuk diperbaiki', data: session })
  } catch (error) { next(error) }
}

export async function approveShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['sent_to_kacab'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'approved_kacab', approved_at: new Date(), reviewed_by: req.user.userId } })
    res.json({ message: 'RFA disetujui', data: session })
  } catch (error) { next(error) }
}

export async function rejectShowroomOpnameSession(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const reason = normalize(req.body.reason)
    if (!reason) return res.status(400).json({ error: 'Alasan reject wajib diisi' })
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['submitted', 'approved_adh', 'sent_to_kacab'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'rejected', rejection_reason: reason, rejected_at: new Date(), reviewed_by: req.user.userId } })
    res.json({ message: 'RFA ditolak. Perbaiki reason lalu ajukan ulang.', data: session })
  } catch (error) { next(error) }
}

export async function markBasoPrinted(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['approved_kacab'])
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { baso_printed_at: new Date() } })
    res.json({ message: 'BASO ditandai sudah dicetak', data: session })
  } catch (error) { next(error) }
}

export async function uploadBasoSigned(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['approved_kacab'])
    if (!req.file) return res.status(400).json({ error: 'File PDF BASO wajib diupload' })
    const now = new Date()
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { baso_signed_file: req.file.path, baso_uploaded_at: now } })
    res.json({ message: 'BASO signed berhasil diupload. Verifikasi untuk menyelesaikan SO.', data: session })
  } catch (error) { next(error) }
}

export async function viewBasoSigned(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    if (!session.baso_signed_file) return res.status(404).json({ error: 'BASO signed belum diupload' })
    const filePath = path.resolve(session.baso_signed_file)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File BASO signed tidak ditemukan di server' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="BASO_${session.opname_type.toUpperCase()}_${session.session_code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`)
    res.sendFile(filePath)
  } catch (error) { next(error) }
}

export async function verifyBasoSigned(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    if (!existing.baso_signed_file) return res.status(400).json({ error: 'Upload BASO signed terlebih dahulu' })
    if (!existing.baso_uploaded_at) return res.status(400).json({ error: 'BASO belum diupload' })
    const now = new Date()
    const session = await prisma.showroom_opname_sessions.update({ where: { id }, data: { status: 'done', baso_verified_at: now, closed_at: now, reviewed_by: req.user.userId } })
    res.json({ message: 'BASO diverifikasi. SO selesai dan ditutup.', data: session })
  } catch (error) { next(error) }
}

export async function completeShowroomOpnameSession(req, res, next) {
  return submitShowroomOpnameSession(req, res, next)
}

export async function deleteShowroomOpnameSession(req, res, next) {
  try {
    await prisma.showroom_opname_sessions.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: 'Sesi opname showroom dihapus' })
  } catch (error) { next(error) }
}

// Autosuggest engine / chassis numbers for scan screen
export async function getSessionLocations(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const items = await prisma.showroom_opname_items.findMany({
      where: { session_id: id },
      select: { system_location: true },
      distinct: ['system_location'],
    })
    const locations = items.map((i) => i.system_location).filter(Boolean).sort()
    res.json({ data: locations })
  } catch (error) { next(error) }
}

export async function assignSessionLocations(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const assignments = req.body.assignments || []
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Data assignment wajib diisi' })
    }
    const existing = await prisma.showroom_opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi tidak ditemukan' })
    requireStatus(existing, ['draft', 'open'])
    await prisma.showroom_opname_assignments.deleteMany({ where: { session_id: id } })
    const created = await prisma.showroom_opname_assignments.createMany({
      data: assignments.map((a) => ({
        session_id: id,
        user_id: parseInt(a.user_id),
        location_name: normalize(a.location_name),
        is_primary: a.is_primary !== false,
      })),
    })
    res.json({ message: 'Assignment lokasi berhasil disimpan', count: created.count })
  } catch (error) { next(error) }
}

export async function searchAndValidateUnit(req, res, next) {
  try {
    const sessionId = parseInt(req.query.session_id)
    const q = normalize(req.query.q)
    if (!sessionId) return res.status(400).json({ error: 'Session ID wajib diisi' })
    if (!q || q.length < 5) return res.status(400).json({ error: 'Minimal 5 karakter untuk pencarian' })

    const session = await prisma.showroom_opname_sessions.findUnique({ where: { id: sessionId } })
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' })

    const rows = await findReferences(session.opname_type, q)
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Unit tidak ditemukan di sistem' })

    const userId = req.user.userId
    const userRole = req.user.role

    let blockedAny = false
    // Fetch session-based assignments for location guard
    let assignedLocs = []
    if (userRole === 'PIC Stock opname') {
      const assignments = await prisma.showroom_opname_assignments.findMany({
        where: { session_id: sessionId, user_id: userId },
        select: { location_name: true },
      })
      assignedLocs = assignments.map((a) => normalizeLocationCompare(a.location_name))
    }

    const data = rows.map((ref) => {
      let isAllowed = true
      if (userRole === 'PIC Stock opname' && ref.system_location) {
        isAllowed = assignedLocs.includes(normalizeLocationCompare(ref.system_location))
      }
      if (!isAllowed) blockedAny = true
      return { ...ref, is_allowed: isAllowed }
    })

    if (blockedAny && data.every((d) => !d.is_allowed)) {
      await prisma.showroom_notifications.create({
        data: {
          session_id: sessionId,
          user_id: userId,
          type: 'wrong_location_attempt',
          message: `PIC mencoba scan unit dengan query ${q}. Semua hasil di luar area tugasnya.`,
          data: JSON.stringify({ query: q, pic_user_id: userId }),
        },
      })
      return res.status(403).json({ error: 'Lokasi unit bukan lokasi anda, silahkan hubungi admin' })
    }

    res.json({ data })
  } catch (error) { next(error) }
}

export async function getNotifications(req, res, next) {
  try {
    const where = {}
    if (req.query.session_id) where.session_id = parseInt(req.query.session_id)
    if (req.query.user_id) where.user_id = parseInt(req.query.user_id)
    if (req.query.is_read === 'true') where.is_read = true
    else if (req.query.is_read === 'false') where.is_read = false

    const items = await prisma.showroom_notifications.findMany({
      where,
      include: { session: { select: { session_code: true } }, user: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    })
    res.json({ data: items })
  } catch (error) { next(error) }
}

export async function markNotificationRead(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    await prisma.showroom_notifications.update({ where: { id }, data: { is_read: true } })
    res.json({ message: 'Notifikasi ditandai sudah dibaca' })
  } catch (error) { next(error) }
}

export async function searchShowroomStockUnits(req, res, next) {
  try {
    const q = normalize(req.query.q)
    if (!q || q.length < 2) return res.json({ data: [] })
    const rows = await prisma.showroom_stock_units.findMany({
      where: {
        branch_code: 'DXK',
        OR: [
          { engine_number: { contains: q, mode: 'insensitive' } },
          { chassis_number: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        engine_number: true,
        chassis_number: true,
        series: true,
        product_type: true,
        color: true,
        location: true,
      },
      orderBy: { engine_number: 'asc' },
    })
    const data = rows.map((row) => ({
      engine_number: row.engine_number,
      chassis_number: row.chassis_number,
      display_name: [row.series, row.product_type, row.color].filter(Boolean).join(' / '),
      system_location: row.location,
    }))
    res.json({ data })
  } catch (error) { next(error) }
}
