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

export async function getOperationalAuditLogs(limit = 50) {
  return prisma.audit_logs.findMany({
    where: {
      table_name: { in: ['sync_import', 'database_backup', 'database_restore'] },
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
