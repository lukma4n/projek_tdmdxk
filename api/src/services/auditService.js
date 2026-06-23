import { prisma } from '../config/db.js'

function stringify(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export async function createAuditLog({ userId, tableName, recordId, fieldName, oldValue = null, newValue = null }) {
  if (!userId) return null

  return prisma.audit_logs.create({
    data: {
      table_name: tableName,
      record_id: String(recordId),
      field_name: fieldName,
      old_value: stringify(oldValue),
      new_value: stringify(newValue),
      user_id: userId,
    },
  })
}

/**
 * Catat aksi IT Master yang melewati pemeriksaan authorize()/authorizeMenu().
 * Hanya untuk request yang mengubah data (non-GET) — superadmin bypass total,
 * sehingga jejaknya perlu terekam. Fire-and-forget: tidak boleh memblokir atau
 * menggagalkan request. Body request TIDAK dicatat (bisa berisi data sensitif).
 */
export function logItMasterAction(req) {
  if (!req?.user || req.user.role !== 'IT Master') return
  const method = req.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (req._itMasterLogged) return // hindari log ganda bila route pakai 2 middleware
  req._itMasterLogged = true

  createAuditLog({
    userId: req.user.userId,
    tableName: 'it_master_action',
    recordId: (req.originalUrl || req.path || '').split('?')[0] || '/',
    fieldName: method,
    newValue: { ip: req.ip || null, username: req.user.username || null },
  }).catch(() => {})
}

export async function getOperationalAuditLogs(limit = 50) {
  return prisma.audit_logs.findMany({
    where: {
      table_name: { in: ['sync_import', 'database_backup', 'database_restore', 'it_master_action'] },
    },
    orderBy: { changed_at: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, username: true, name: true, role: true },
      },
    },
  })
}
