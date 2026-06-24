import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { prisma } from '../config/db.js'
import { singleSessionEnabled, isSessionActive, logLogin } from '../services/sessionService.js'

const JWT_COOKIE_NAME = 'token'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

function isSecureCookie(req) {
  if (process.env.NODE_ENV !== 'production') return false
  return req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https'
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' })
    }

    // Case-insensitive username lookup for SQLite using raw query
    const users = await prisma.$queryRaw`
      SELECT id, username, password_hash, name, role, created_at, session_id, session_last_active
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

    // Single-session: tolak login bila akun ini SEDANG dipakai di sesi lain
    // (anti-sharing). Sesi yang sudah idle > window dianggap bebas (lihat
    // isSessionActive) sehingga tidak mengunci akun secara permanen.
    if (singleSessionEnabled() && isSessionActive(user)) {
      await logLogin({ userId: user.id, username: user.username, event: 'login_blocked', req })
      return res.status(409).json({
        error: 'Akun ini sedang digunakan di perangkat/sesi lain. Tutup sesi tersebut terlebih dahulu, tunggu 60 menit tanpa aktivitas, atau hubungi IT untuk mereset sesi.',
      })
    }

    // Buat session id baru, simpan + tandai waktu aktivitas, sematkan di token (sid).
    const sessionId = randomUUID()
    await prisma.users.update({
      where: { id: user.id },
      data: { session_id: sessionId, session_last_active: new Date() },
    })

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        sid: sessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    await logLogin({ userId: user.id, username: user.username, event: 'login_success', req })

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
    // Bebaskan sesi: kosongkan session_id agar akun bisa login lagi segera.
    if (req.user?.userId) {
      await prisma.users.update({
        where: { id: req.user.userId },
        data: { session_id: null, session_last_active: null },
      }).catch(() => {})
      await logLogin({ userId: req.user.userId, username: req.user.username, event: 'logout', req })
    }
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
