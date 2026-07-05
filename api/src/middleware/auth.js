import jwt from 'jsonwebtoken'
import { prisma } from '../config/db.js'
import { logItMasterAction } from '../services/auditService.js'
import { singleSessionEnabled } from '../services/sessionService.js'

const JWT_COOKIE_NAME = 'token'
// Hemat write: hanya perbarui session_last_active bila sudah lewat interval ini.
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000

export async function authenticate(req, res, next) {
  // Prefer cookie (httpOnly), fallback to Authorization header for compatibility
  const token = req.cookies?.[JWT_COOKIE_NAME] || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true, session_id: true, session_last_active: true },
    })

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan atau sudah nonaktif' })
    }

    // Single-session: token (yg punya sid) hanya valid bila cocok dgn session_id
    // terbaru. Bila berbeda/null berarti sesi sudah digantikan (login di tempat
    // lain), logout, atau di-reset IT → tolak. Token lama tanpa sid dilewati
    // (kompat mundur saat transisi; akan ber-sid setelah login berikutnya).
    if (singleSessionEnabled() && decoded.sid && decoded.sid !== user.session_id) {
      return res.status(401).json({ error: 'SESSION_SUPERSEDED', message: 'Sesi berakhir: akun digunakan di perangkat lain atau sesi telah direset.' })
    }

    // Perbarui jejak aktivitas (throttled, fire-and-forget) agar window sesi akurat.
    if (decoded.sid && user.session_id === decoded.sid) {
      const last = user.session_last_active ? new Date(user.session_last_active).getTime() : 0
      if (Date.now() - last > ACTIVITY_UPDATE_THROTTLE_MS) {
        prisma.users.update({ where: { id: user.id }, data: { session_last_active: new Date() } }).catch(() => {})
      }
    }

    const locations = await prisma.showroom_user_locations.findMany({
      where: { user_id: user.id },
      select: { location_name: true },
    })

    req.user = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      locations: locations.map((l) => l.location_name),
    }
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token tidak valid' })
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses ditolak' })
    }
    // Bypass untuk IT Master agar bisa akses semuanya (sebagai superadmin)
    if (req.user.role === 'IT Master') {
      logItMasterAction(req, res)
      return next()
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Akses ditolak. Role Anda: ${req.user.role}` })
    }
    next()
  }
}

// Middleware baru untuk Dynamic RBAC (Mengecek akses ke database berdasarkan Menu Key)
export function authorizeMenu(menuKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses ditolak' })
    }
    // IT Master otomatis lolos
    if (req.user.role === 'IT Master') {
      logItMasterAction(req, res)
      return next()
    }

    try {
      const permission = await prisma.role_permissions.findFirst({
        where: {
          menu_key: menuKey,
          role_name: req.user.role
        }
      })

      if (!permission) {
        return res.status(403).json({ error: `Akses ditolak untuk modul ${menuKey}. Role Anda: ${req.user.role}` })
      }
      next()
    } catch (error) {
      return res.status(500).json({ error: 'Gagal memverifikasi hak akses dari server.' })
    }
  }
}
