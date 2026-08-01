import { prisma } from '../config/db.js'
import bcrypt from 'bcryptjs'

// Satu sumber kebenaran role valid di backend -- harus tetap sinkron dengan
// ROLES di web/src/config/roles.js (dua tempat berbeda, tidak dibagi lewat
// import karena backend/frontend adalah paket terpisah).
const VALID_ROLES = ['Admin', 'ADH', 'Kepala Cabang', 'CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman', 'PIC Stock opname', 'Salesman', 'Ekspedisi', 'IT Master']

export async function getUsers(req, res, next) {
  try {
    const where = {}
    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        created_at: true,
        showroom_user_locations: { select: { location_name: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    res.json({
      data: users.map((u) => ({
        ...u,
        locations: u.showroom_user_locations.map((l) => l.location_name),
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function getUserById(req, res, next) {
  try {
    const { id } = req.params
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        created_at: true,
        showroom_user_locations: { select: { location_name: true } },
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' })
    }

    res.json({
      data: {
        ...user,
        locations: user.showroom_user_locations.map((l) => l.location_name),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function createUser(req, res, next) {
  try {
    const { username, password, name, role, locations, phone } = req.body
    const normalizedUsername = String(username || '').trim().toLowerCase()
    const normalizedName = String(name || '').trim()
    const normalizedPhone = phone ? String(phone).trim() : null

    if (!normalizedUsername || !password || !normalizedName || !role) {
      return res.status(400).json({ error: 'Semua field wajib diisi' })
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }



    // Check if username exists (case-insensitive for SQLite)
    const existing = await prisma.$queryRaw`
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER(${normalizedUsername})
      LIMIT 1
    `

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const user = await prisma.users.create({
      data: {
        username: normalizedUsername,
        password_hash,
        name: normalizedName,
        role,
        phone: normalizedPhone,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        created_at: true,
      },
    })

    if (Array.isArray(locations) && locations.length > 0) {
      await prisma.showroom_user_locations.createMany({
        data: locations.map((loc) => ({
          user_id: user.id,
          location_name: String(loc).trim(),
        })),
      })
    }

    const createdLocations = await prisma.showroom_user_locations.findMany({
      where: { user_id: user.id },
      select: { location_name: true },
    })

    res.status(201).json({
      message: 'User berhasil dibuat',
      data: {
        ...user,
        locations: createdLocations.map((l) => l.location_name),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params
    const { name, role, locations, phone } = req.body
    const userId = parseInt(id)
    const normalizedPhone = phone ? String(phone).trim() : null

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }

    const user = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(phone !== undefined && { phone: normalizedPhone }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        created_at: true,
      },
    })

    if (Array.isArray(locations)) {
      await prisma.showroom_user_locations.deleteMany({ where: { user_id: userId } })
      if (locations.length > 0) {
        await prisma.showroom_user_locations.createMany({
          data: locations.map((loc) => ({
            user_id: userId,
            location_name: String(loc).trim(),
          })),
        })
      }
    }

    const updatedLocations = await prisma.showroom_user_locations.findMany({
      where: { user_id: userId },
      select: { location_name: true },
    })

    res.json({
      message: 'User berhasil diupdate',
      data: {
        ...user,
        locations: updatedLocations.map((l) => l.location_name),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params
    const userId = parseInt(id)

    // Don't allow deleting yourself
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Tidak bisa menghapus diri sendiri' })
    }

    // Cek target user, blokir hapus IT Master
    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true, username: true },
    })
    if (!targetUser) {
      return res.status(404).json({ error: 'User tidak ditemukan' })
    }
    if (targetUser.role === 'IT Master') {
      return res.status(403).json({ error: 'User IT Master tidak dapat dihapus' })
    }

    // Paksa hapus berantai
    await prisma.$transaction(async (tx) => {
      // 1. SET NULL untuk FK optional
      await tx.sync_logs.updateMany({ where: { user_id: userId }, data: { user_id: null } })
      await tx.hotlines.updateMany({ where: { state_updated_by: userId }, data: { state_updated_by: null } })
      await tx.showroom_unit_ksu_checks.updateMany({ where: { checked_by: userId }, data: { checked_by: null } })
      await tx.showroom_unit_ksu_checks.updateMany({ where: { handed_over_by: userId }, data: { handed_over_by: null } })
      await tx.showroom_opname_items.updateMany({ where: { scanned_by: userId }, data: { scanned_by: null } })
      await tx.showroom_notifications.updateMany({ where: { user_id: userId }, data: { user_id: null } })
      await tx.showroom_opname_sessions.updateMany({ where: { reviewed_by: userId }, data: { reviewed_by: null } })
      await tx.showroom_ksu_standards.updateMany({ where: { updated_by: userId }, data: { updated_by: null } })

      // 2. DELETE untuk FK required
      // Hapus child items dulu sebelum session
      await tx.opname_items.deleteMany({ where: { scanned_by: userId } })
      await tx.opname_sessions.deleteMany({ where: { created_by: userId } })
      
      await tx.showroom_user_locations.deleteMany({ where: { user_id: userId } })
      await tx.audit_logs.deleteMany({ where: { user_id: userId } })
      await tx.kpb_followups.deleteMany({ where: { created_by: userId } })
      await tx.showroom_document_followups.deleteMany({ where: { created_by: userId } })
      await tx.showroom_opname_sessions.deleteMany({ where: { created_by: userId } })
      await tx.showroom_sales_order_margins.deleteMany({ where: { created_by: userId } })
      await tx.showroom_opname_assignments.deleteMany({ where: { user_id: userId } })

      // document_handovers/_steps: FK required (created_by/performed_by) tanpa onDelete.
      // Hapus step yang dikerjakan user dulu, lalu handover yang dibuat user
      // (steps di bawah handover tsb ikut terhapus via FK Cascade handover_id).
      await tx.document_handover_steps.deleteMany({ where: { performed_by: userId } })
      await tx.document_handovers.deleteMany({ where: { created_by: userId } })

      // 3. Delete user
      await tx.users.delete({ where: { id: userId } })
    })

    res.json({ message: 'User berhasil dihapus secara paksa beserta seluruh riwayatnya' })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { id } = req.params
    const { password } = req.body

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password minimal 8 karakter' })
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Password terlalu panjang' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    await prisma.users.update({
      where: { id: parseInt(id) },
      data: { password_hash },
    })

    res.json({ message: 'Password berhasil direset' })
  } catch (error) {
    next(error)
  }
}
