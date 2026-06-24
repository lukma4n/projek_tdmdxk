import { prisma } from '../config/db.js'

// Sesi dianggap "aktif" bila aktivitas terakhir dalam window ini. Selaras dengan
// idle-logout frontend (60 menit) — sesi yang ditinggal otomatis bebas setelahnya.
export const SESSION_ACTIVE_WINDOW_MS = 60 * 60 * 1000

function isTestEnv() {
  return (process.env.DATABASE_URL || '').includes('test.db') || process.env.NODE_ENV === 'test'
}

// Enforcement single-session: ON di produksi/dev, OFF saat test (agar suite tak
// rusak), kecuali dipaksa lewat env ENFORCE_SINGLE_SESSION.
export function singleSessionEnabled() {
  if (process.env.ENFORCE_SINGLE_SESSION === 'true') return true
  if (process.env.ENFORCE_SINGLE_SESSION === 'false') return false
  return !isTestEnv()
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || null
}

export function clientUserAgent(req) {
  const ua = req.headers['user-agent']
  return ua ? String(ua).slice(0, 300) : null
}

// Sesi aktif = punya session_id & aktivitas terakhir masih dalam window.
export function isSessionActive(user) {
  if (!user?.session_id || !user?.session_last_active) return false
  return Date.now() - new Date(user.session_last_active).getTime() < SESSION_ACTIVE_WINDOW_MS
}

// Catat kejadian login (fire-and-forget; jangan ganggu alur auth bila gagal).
export async function logLogin({ userId = null, username, event, req }) {
  try {
    await prisma.login_logs.create({
      data: {
        user_id: userId,
        username: String(username || '').slice(0, 100),
        event,
        ip: clientIp(req),
        user_agent: clientUserAgent(req),
      },
    })
  } catch {
    /* abaikan kegagalan audit */
  }
}
