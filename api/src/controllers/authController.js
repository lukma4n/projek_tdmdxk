import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/db.js'

const JWT_COOKIE_NAME = 'dxk_token'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

function isSecureCookie(req) {
  // Only use secure cookies in production AND when not on localhost
  if (process.env.NODE_ENV !== 'production') return false
  const host = req.headers.host || ''
  return !host.includes('localhost') && !host.includes('127.0.0.1')
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' })
    }

    // Case-insensitive username lookup for SQLite using raw query
    const users = await prisma.$queryRaw`
      SELECT id, username, password_hash, name, role, created_at
      FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `
    const user = users[0] || null

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' })
    }

    const isValid = await bcrypt.compare(password, user.password_hash)

    if (!isValid) {
      return res.status(401).json({ error: 'Username atau password salah' })
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    // Set httpOnly cookie for security (XSS protection)
    const maxAgeMs = JWT_EXPIRES_IN.includes('h')
      ? parseInt(JWT_EXPIRES_IN) * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000

    res.cookie(JWT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureCookie(req),
      sameSite: 'lax',
      maxAge: maxAgeMs,
    })

    const locations = await prisma.showroom_user_locations.findMany({
      where: { user_id: user.id },
      select: { location_name: true },
    })

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        locations: locations.map((l) => l.location_name),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function logout(req, res, next) {
  try {
    res.clearCookie(JWT_COOKIE_NAME, {
      httpOnly: true,
      secure: isSecureCookie(req),
      sameSite: 'lax',
    })
    res.json({ message: 'Logout berhasil' })
  } catch (error) {
    next(error)
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, name: true, role: true, created_at: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' })
    }

    const locations = await prisma.showroom_user_locations.findMany({
      where: { user_id: user.id },
      select: { location_name: true },
    })

    res.json({ user: { ...user, locations: locations.map((l) => l.location_name) } })
  } catch (error) {
    next(error)
  }
}
