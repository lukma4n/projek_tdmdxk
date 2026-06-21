import { prisma } from '../config/db.js'
import path from 'path'
import { existsSync } from 'fs'

export const OPEN_IMPORT_BLOCK_STATUSES = ['active', 'submitted', 'approved_kabeng', 'sent_to_kacab', 'approved_kacab', 'rejected']

export async function ensureNoActiveOpname() {
  const active = await prisma.opname_sessions.findFirst({ where: { status: { in: OPEN_IMPORT_BLOCK_STATUSES } } })
  if (active) {
    const err = new Error(`Import ditolak: Ada sesi opname sparepart (${active.session_name}) yang belum Selesai.`)
    err.status = 400
    throw err
  }
}
export async function getSessions(req, res, next) {
  try {
    const sessions = await prisma.opname_sessions.findMany({
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    res.json({ data: sessions })
  } catch (error) {
    next(error)
  }
}

export async function createSession(req, res, next) {
  try {
    let { session_name, pic_opname_name, workshop_head_name, branch_head_name } = req.body
    const userId = req.user.userId

    // Auto-generate kode opname: SO/DXK/DDMMYY
    if (!session_name || session_name.trim() === '') {
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yy = String(now.getFullYear()).slice(-2)
      session_name = `SO/DXK/${dd}${mm}${yy}`
    }

    const session = await prisma.opname_sessions.create({
      data: {
        session_name,
        pic_opname_name: String(pic_opname_name || '').trim() || null,
        workshop_head_name: String(workshop_head_name || '').trim() || null,
        branch_head_name: String(branch_head_name || '').trim() || null,
        created_by: userId,
        status: 'active',
      },
    })

    res.status(201).json({ 
      message: 'Sesi opname berhasil dibuat',
      data: session,
    })
  } catch (error) {
    next(error)
  }
}

export async function getSessionItems(req, res, next) {
  try {
    const { id } = req.params
    
    const items = await prisma.opname_items.findMany({
      where: { session_id: parseInt(id) },
      orderBy: { scanned_at: 'desc' },
    })

    res.json({ data: items })
  } catch (error) {
    next(error)
  }
}

export async function getReport(req, res, next) {
  try {
    const { id } = req.params

    const session = await prisma.opname_sessions.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          orderBy: { scanned_at: 'desc' },
        },
        creator: {
          select: { name: true, username: true },
        },
      },
    })

    if (!session) {
      return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    }

    const total = session.items.length
    const sesuai = session.items.filter(i => i.status === 'sesuai').length
    const kurang = session.items.filter(i => i.status === 'kurang').length
    const lebih = session.items.filter(i => i.status === 'lebih').length

    const totalSelisihKurang = session.items
      .filter(i => i.selisih < 0)
      .reduce((sum, i) => sum + Math.abs(i.selisih), 0)

    const totalSelisihLebih = session.items
      .filter(i => i.selisih > 0)
      .reduce((sum, i) => sum + i.selisih, 0)

    const totalQtySystem = session.items.reduce((sum, i) => sum + i.qty_system, 0)
    const totalQtyFisik = session.items.reduce((sum, i) => sum + i.qty_physical, 0)

    res.json({
      data: {
        session: {
          id: session.id,
          session_name: session.session_name,
          status: session.status,
          pic_opname_name: session.pic_opname_name,
          workshop_head_name: session.workshop_head_name,
          branch_head_name: session.branch_head_name,
          baso_signed_file: session.baso_signed_file,
          submitted_at: session.submitted_at,
          kabeng_approved_at: session.kabeng_approved_at,
          sent_to_kacab_at: session.sent_to_kacab_at,
          kacab_approved_at: session.kacab_approved_at,
          baso_printed_at: session.baso_printed_at,
          baso_uploaded_at: session.baso_uploaded_at,
          rejection_reason: session.rejection_reason,
          start_date: session.start_date,
          end_date: session.end_date,
          created_by: session.creator?.name || session.creator?.username,
        },
        summary: {
          total_parts: total,
          sesuai,
          kurang,
          lebih,
          total_selisih_kurang: totalSelisihKurang,
          total_selisih_lebih: totalSelisihLebih,
          total_qty_system: totalQtySystem,
          total_qty_fisik: totalQtyFisik,
        },
        items: session.items,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function addItem(req, res, next) {
  try {
    const { id } = req.params
    const { product_code, qty_physical } = req.body
    const userId = req.user.userId

    const session = await prisma.opname_sessions.findUnique({ where: { id: parseInt(id) } })
    if (!session || session.status !== 'active') return res.status(400).json({ error: 'Scan hanya dapat dilakukan saat sesi active' })

    const stock = await prisma.stock_parts.findUnique({
      where: { product_code },
    })

    if (!stock) {
      return res.status(404).json({ error: 'Part tidak ditemukan' })
    }

    const qtySystem = stock.qty_available
    const parsedQty = parseFloat(qty_physical) || 1

    // Cek apakah item sudah ada di session ini
    const existingItem = await prisma.opname_items.findFirst({
      where: { session_id: parseInt(id), product_code },
    })

    if (existingItem) {
      // Append: tambahkan qty fisik
      const newQtyPhysical = existingItem.qty_physical + parsedQty
      const selisih = newQtyPhysical - qtySystem
      
      let status = 'sesuai'
      if (selisih < 0) status = 'kurang'
      if (selisih > 0) status = 'lebih'

      const updatedItem = await prisma.opname_items.update({
        where: { id: existingItem.id },
        data: {
          qty_physical: newQtyPhysical,
          qty_system: qtySystem,
          selisih,
          status,
        },
      })

      return res.json({
        message: 'Qty berhasil ditambahkan',
        data: updatedItem,
        appended: true,
      })
    }

    // Baru: create item baru
    const selisih = parsedQty - qtySystem
    
    let status = 'sesuai'
    if (selisih < 0) status = 'kurang'
    if (selisih > 0) status = 'lebih'

    const item = await prisma.opname_items.create({
      data: {
        session_id: parseInt(id),
        product_code,
        product_name: stock.product_name,
        qty_system: qtySystem,
        qty_physical: parsedQty,
        selisih,
        status,
        scanned_by: userId,
      },
    })

    res.status(201).json({
      message: 'Item berhasil ditambahkan',
      data: item,
      appended: false,
    })
  } catch (error) {
    next(error)
  }
}

export async function updateItem(req, res, next) {
  try {
    const { id, itemId } = req.params
    const { qty_physical } = req.body

    const item = await prisma.opname_items.findUnique({
      where: { id: parseInt(itemId) },
    })

    if (!item || item.session_id !== parseInt(id)) {
      return res.status(404).json({ error: 'Item tidak ditemukan di sesi ini' })
    }

    const qtySystem = item.qty_system
    const newQtyPhysical = parseFloat(qty_physical) || 0
    const selisih = newQtyPhysical - qtySystem

    let status = 'sesuai'
    if (selisih < 0) status = 'kurang'
    if (selisih > 0) status = 'lebih'

    const updated = await prisma.opname_items.update({
      where: { id: parseInt(itemId) },
      data: {
        qty_physical: newQtyPhysical,
        selisih,
        status,
      },
    })

    res.json({
      message: 'Qty berhasil diperbarui',
      data: updated,
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteItem(req, res, next) {
  try {
    const { id, itemId } = req.params

    const item = await prisma.opname_items.findUnique({
      where: { id: parseInt(itemId) },
    })

    if (!item || item.session_id !== parseInt(id)) {
      return res.status(404).json({ error: 'Item tidak ditemukan di sesi ini' })
    }

    await prisma.opname_items.delete({
      where: { id: parseInt(itemId) },
    })

    res.json({
      message: 'Item berhasil dihapus',
    })
  } catch (error) {
    next(error)
  }
}

export async function completeSession(req, res, next) {
  try {
    const { id } = req.params

    const session = await prisma.opname_sessions.update({
      where: { id: parseInt(id) },
      data: {
        status: 'submitted',
        end_date: new Date(),
        submitted_at: new Date(),
      },
    })

    res.json({
      message: 'Sesi opname dikirim ke Kepala Bengkel',
      data: session,
    })
  } catch (error) {
    next(error)
  }
}

export async function approveKabeng(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (existing.status !== 'submitted') return res.status(400).json({ error: 'Status harus submitted' })
    const session = await prisma.opname_sessions.update({ where: { id }, data: { status: 'approved_kabeng', kabeng_approved_at: new Date() } })
    res.json({ message: 'Approved 1 oleh Kepala Bengkel', data: session })
  } catch (error) { next(error) }
}

export async function sendToKacab(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (existing.status !== 'approved_kabeng') return res.status(400).json({ error: 'Status harus approved_kabeng' })
    const session = await prisma.opname_sessions.update({ where: { id }, data: { status: 'sent_to_kacab', sent_to_kacab_at: new Date() } })
    res.json({ message: 'Hasil opname dikirim ke Kepala Cabang', data: session })
  } catch (error) { next(error) }
}

export async function approveKacab(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (existing.status !== 'sent_to_kacab') return res.status(400).json({ error: 'Status harus sent_to_kacab' })
    const session = await prisma.opname_sessions.update({ where: { id }, data: { status: 'approved_kacab', kacab_approved_at: new Date() } })
    res.json({ message: 'Approved 2 oleh Kepala Cabang', data: session })
  } catch (error) { next(error) }
}

export async function rejectApproval(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const reason = String(req.body.reason || '').trim()
    if (!reason) return res.status(400).json({ error: 'Alasan reject wajib diisi' })
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (!['submitted', 'approved_kabeng', 'sent_to_kacab'].includes(existing.status)) return res.status(400).json({ error: 'Status tidak dapat direject' })
    const session = await prisma.opname_sessions.update({ where: { id }, data: { status: 'rejected', rejection_reason: reason } })
    res.json({ message: 'Hasil opname direject', data: session })
  } catch (error) { next(error) }
}

export async function markBasoPrinted(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (existing.status !== 'approved_kacab') return res.status(400).json({ error: 'BASO hanya dapat dicetak setelah approved_kacab' })
    const session = await prisma.opname_sessions.update({ where: { id }, data: { baso_printed_at: new Date() } })
    res.json({ message: 'BASO ditandai sudah dicetak', data: session })
  } catch (error) { next(error) }
}

export async function uploadBasoSigned(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (existing.status !== 'approved_kacab') return res.status(400).json({ error: 'Upload BASO hanya setelah approved_kacab' })
    if (!req.file) return res.status(400).json({ error: 'File PDF BASO wajib diupload' })
    const now = new Date()
    const session = await prisma.opname_sessions.update({ where: { id }, data: { status: 'done', baso_signed_file: req.file.path, baso_uploaded_at: now } })
    res.json({ message: 'BASO signed berhasil diupload. Opname Done.', data: session })
  } catch (error) { next(error) }
}

export async function viewBasoSigned(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const session = await prisma.opname_sessions.findUnique({ where: { id } })
    if (!session) return res.status(404).json({ error: 'Sesi opname tidak ditemukan' })
    if (!session.baso_signed_file) return res.status(404).json({ error: 'BASO signed belum diupload' })
    const uploadDir = path.resolve(process.cwd(), 'uploads')
    const filePath = path.resolve(session.baso_signed_file)
    if (!filePath.startsWith(uploadDir + path.sep) && !filePath.startsWith(uploadDir + '/')) {
      return res.status(403).json({ error: 'Akses file ditolak' })
    }
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File BASO tidak ditemukan' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="BASO_PART_${session.session_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`)
    res.sendFile(filePath)
  } catch (error) { next(error) }
}

export async function deleteSession(req, res, next) {
  try {
    const { id } = req.params

    // First delete all items (cascade should handle this but let's be explicit)
    await prisma.opname_items.deleteMany({
      where: { session_id: parseInt(id) },
    })

    await prisma.opname_sessions.delete({
      where: { id: parseInt(id) },
    })

    res.json({
      message: 'Sesi opname berhasil dihapus',
    })
  } catch (error) {
    next(error)
  }
}
