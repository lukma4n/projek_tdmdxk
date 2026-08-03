import { randomUUID } from 'crypto'
import { prisma } from '../config/db.js'

function toJsonString(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function lockConflictError(message = 'Proses import sedang berjalan. Coba lagi setelah selesai.') {
  const error = new Error(message)
  error.status = 409
  error.statusCode = 409
  return error
}

// Lock hanya valid selama proses yang memegangnya masih hidup. Bila proses mati
// di tengah import (OOM-kill PM2, restart, crash), blok `finally` di
// withImportLock tidak pernah jalan sehingga lock tertinggal di DB dan memblokir
// semua import berikutnya sampai TTL habis. Karena itu semua lock dibuang saat
// startup — tidak mungkin ada import yang selamat melewati restart proses.
export async function releaseStaleImportLocks() {
  const result = await prisma.import_locks.deleteMany({})
  return result.count
}

export async function getImportLocks() {
  const now = new Date()
  const rows = await prisma.import_locks.findMany({
    where: { expires_at: { gt: now } },
    orderBy: { acquired_at: 'desc' },
  })

  return rows.map((row) => ({
    key: row.key,
    module: row.module,
    reason: row.reason,
    owner: row.owner,
    acquired_at: row.acquired_at,
    expires_at: row.expires_at,
    metadata: row.metadata,
  }))
}

export async function isImportLocked(key) {
  const now = new Date()
  const lock = await prisma.import_locks.findFirst({
    where: { key, expires_at: { gt: now } },
    select: { id: true },
  })

  return Boolean(lock)
}

export async function assertImportNotLocked(key, message = 'Proses import sedang berjalan') {
  const locked = await isImportLocked(key)
  if (!locked) return
  throw lockConflictError(message)
}

export async function withImportLock(key, fn, meta = {}) {
  const now = new Date()
  const ttlMs = Number.isFinite(meta.ttlMs) ? Math.max(1000, meta.ttlMs) : 30 * 60 * 1000
  const expiresAt = new Date(now.getTime() + ttlMs)
  const owner = randomUUID()

  // Hapus expired locks terlebih dahulu (bukan untuk key aktif, hanya yang sudah expired)
  await prisma.import_locks.deleteMany({
    where: { expires_at: { lte: now } },
  }).catch(() => {})

  // Atomic create — jika key sudah ada dan belum expired, unique constraint akan throw P2002
  try {
    await prisma.import_locks.create({
      data: {
        key,
        module: meta.module || key,
        reason: meta.reason || 'import',
        owner,
        metadata: toJsonString(meta.metadata || null),
        expires_at: expiresAt,
      },
    })
  } catch (error) {
    if (error?.code === 'P2002') throw lockConflictError()
    throw error
  }

  try {
    return await fn()
  } finally {
    await prisma.import_locks.deleteMany({ where: { key, owner } }).catch(() => {})
  }
}
