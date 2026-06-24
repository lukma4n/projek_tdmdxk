import { prisma } from '../config/db.js'
import { SESSION_ACTIVE_WINDOW_MS, logLogin } from '../services/sessionService.js'

// Riwayat login (audit) — untuk deteksi penyalahgunaan/sharing akun.
export async function getLoginLogs(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500)
    const where = {}
    if (req.query.event) where.event = String(req.query.event)
    if (req.query.username) where.username = { contains: String(req.query.username) }

    const logs = await prisma.login_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    })
    res.json({ logs })
  } catch (error) {
    next(error)
  }
}

// Daftar sesi yang sedang aktif (untuk pantau siapa sedang login + reset).
export async function getActiveSessions(req, res, next) {
  try {
    const users = await prisma.users.findMany({
      where: { session_id: { not: null } },
      select: { id: true, username: true, name: true, role: true, session_last_active: true },
      orderBy: { session_last_active: 'desc' },
    })
    const now = Date.now()
    const sessions = users.map((u) => ({
      ...u,
      active: u.session_last_active ? now - new Date(u.session_last_active).getTime() < SESSION_ACTIVE_WINDOW_MS : false,
    }))
    res.json({ sessions, active_window_minutes: SESSION_ACTIVE_WINDOW_MS / 60000 })
  } catch (error) {
    next(error)
  }
}

// Reset paksa sesi seorang user (IT Master) → akun langsung bisa login lagi.
export async function resetUserSession(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ error: 'ID user tidak valid' })

    const user = await prisma.users.findUnique({ where: { id }, select: { id: true, username: true } })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })

    await prisma.users.update({ where: { id }, data: { session_id: null, session_last_active: null } })
    await logLogin({ userId: id, username: user.username, event: 'session_reset', req })

    res.json({ message: `Sesi untuk ${user.username} berhasil direset.` })
  } catch (error) {
    next(error)
  }
}
