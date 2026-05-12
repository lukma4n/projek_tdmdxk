import jwt from 'jsonwebtoken'
import { prisma } from '../config/db.js'

const JWT_COOKIE_NAME = 'dxk_token'

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
      select: { id: true, username: true, name: true, role: true },
    })

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan atau sudah nonaktif' })
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
      return res.status(401).json({ error: 'Belum login' })
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }
    
    next()
  }
}
