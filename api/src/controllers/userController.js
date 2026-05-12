import { prisma } from '../config/db.js'
import bcrypt from 'bcryptjs'

export async function getUsers(req, res, next) {
  try {
    const where = {}
    if (req.user.role === 'Lead PIC Stock opname') {
      where.role = 'PIC Stock opname'
    }
    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
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
    const { username, password, name, role, locations } = req.body
    const normalizedUsername = String(username || '').trim().toLowerCase()
    const normalizedName = String(name || '').trim()

    if (!normalizedUsername || !password || !normalizedName || !role) {
      return res.status(400).json({ error: 'Semua field wajib diisi' })
    }

    const validRoles = ['Admin', 'ADH', 'Kepala Cabang', 'CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman', 'PIC Stock opname', 'Lead PIC Stock opname']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }

    if (req.user.role === 'Lead PIC Stock opname' && role !== 'PIC Stock opname') {
      return res.status(403).json({ error: 'Lead PIC hanya bisa membuat user PIC Stock opname' })
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
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
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
    const { name, role, locations } = req.body
    const userId = parseInt(id)

    const validRoles = ['Admin', 'ADH', 'Kepala Cabang', 'CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman', 'PIC Stock opname', 'Lead PIC Stock opname']
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }

    const user = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(role && { role }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
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

    // Don't allow deleting yourself
    if (req.user.userId === parseInt(id)) {
      return res.status(400).json({ error: 'Tidak bisa menghapus diri sendiri' })
    }

    await prisma.users.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'User berhasil dihapus' })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { id } = req.params
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' })
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
