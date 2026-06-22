import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { AlertTriangle, Archive, DatabaseBackup, Loader2, RotateCcw, Trash2 } from 'lucide-react'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupsPage() {
  const [backups, setBackups] = useState([])
  const [backupMeta, setBackupMeta] = useState({ total: 0, total_size: 0 })
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadBackups = async () => {
    try {
      setError('')
      const [backupResponse, auditResponse] = await Promise.all([
        api.getBackups(),
        api.getAuditLogs(),
      ])
      setBackups(backupResponse.data || [])
      setBackupMeta(backupResponse.meta || { total: 0, total_size: 0 })
      setAuditLogs(auditResponse.data || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat backup')
    } finally {
      setLoading(false)
    }
  }

  const getAuditSummary = (log) => {
    let value
    try {
      value = log.new_value ? JSON.parse(log.new_value) : null
    } catch {
      value = null
    }

    if (log.table_name === 'sync_import') {
      return `Import ${value?.module || log.record_id}: ${value?.rows_success ?? 0} baris, backup ${value?.backup || '-'}`
    }

    if (log.table_name === 'database_backup') {
      if (log.field_name === 'cleanup_pre_import_backups') {
        return `Cleanup backup pre_import: ${value?.deleted_count ?? 0} file dihapus`
      }
      return `Backup manual: ${log.record_id}`
    }

    if (log.table_name === 'database_restore') {
      return `Restore dari ${log.record_id}, backup pengaman ${value?.restore_point || '-'}`
    }

    return `${log.table_name} ${log.field_name}`
  }

  useEffect(() => {
    void Promise.resolve().then(loadBackups)
  }, [])

  const handleCreateBackup = async () => {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      const response = await api.createBackup()
      setMessage(`Backup berhasil dibuat: ${response.data?.filename || '-'}`)
      await loadBackups()
    } catch (err) {
      setError(err.message || 'Gagal membuat backup')
    } finally {
      setWorking(false)
    }
  }

  const handleRestore = async (backup) => {
    const confirmed = confirm(
      `Restore database dari backup ini?\n\n${backup.filename}\n\nData aktif akan ditimpa. Sistem akan membuat backup pre_restore sebelum restore.`
    )
    if (!confirmed) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      const response = await api.restoreBackup(backup.filename)
      setMessage(`Restore berhasil. Backup pengaman: ${response.data?.restore_point || '-'}`)
      await loadBackups()
    } catch (err) {
      setError(err.message || 'Gagal restore backup')
    } finally {
      setWorking(false)
    }
  }

  const handleCleanup = async () => {
    const confirmed = confirm(
      'Hapus backup pre_import lama dan simpan 30 yang terbaru?\n\nBackup manual dan pre_restore tidak akan dihapus.'
    )
    if (!confirmed) return

    setWorking(true)
    setError('')
    setMessage('')

    try {
      const response = await api.cleanupBackups(30)
      const deletedCount = response.data?.deleted_count || 0
      const deletedSize = formatSize(response.data?.deleted_size || 0)
      setMessage(`Cleanup selesai. ${deletedCount} file dihapus (${deletedSize}).`)
      await loadBackups()
    } catch (err) {
      setError(err.message || 'Gagal cleanup backup')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Backup & Restore</h1>
          <p className="text-sm text-muted">Kelola backup SQLite sebelum import dan restore darurat</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleCleanup}
            disabled={working}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-lg shadow-accent/20 transition-all"
          >
            {working ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Cleanup Pre-Import Lama
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={working}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:brightness-110 disabled:bg-border-strong text-white rounded-lg text-sm font-medium shadow-lg shadow-accent/20 transition-all"
          >
            {working ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}
            Buat Backup Manual
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-panel rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-soft rounded-lg text-accent">
              <Archive size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase">Total Backup</p>
              <p className="text-2xl font-bold text-text-strong">{backupMeta.total || backups.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-panel rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-soft rounded-lg text-success">
              <DatabaseBackup size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase">Ukuran Backup</p>
              <p className="text-2xl font-bold text-text-strong">{formatSize(backupMeta.total_size || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-panel rounded-xl border border-border shadow-sm p-4 md:col-span-2">
          <div className="flex gap-3 text-sm text-amber-800">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <p>
              Restore akan menimpa database aktif. Gunakan hanya jika import salah atau data perlu dikembalikan.
              Cleanup hanya menghapus backup `pre_import_*` lama, bukan backup manual atau `pre_restore`.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>
      )}

      {message && (
        <div className="p-3 bg-success-50 border border-success-200 rounded-lg text-sm text-success-700">{message}</div>
      )}

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-accent" size={24} />
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">Belum ada backup di folder backup.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-hover border-b border-border">
                  {['Filename', 'Ukuran', 'Dibuat', 'Diubah', 'Aksi'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-hover/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text whitespace-nowrap">{backup.filename}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{formatSize(backup.size)}</td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{formatDate(backup.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{formatDate(backup.modified_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={working}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-text-strong">Riwayat Operasional</h2>
          <p className="text-xs text-muted">Import, backup manual, dan restore terbaru</p>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Belum ada audit operasional.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-text">{getAuditSummary(log)}</p>
                  <p className="text-xs text-muted">
                    Oleh {log.user?.name || log.user?.username || '-'} ({log.user?.role || '-'})
                  </p>
                </div>
                <p className="text-xs text-muted whitespace-nowrap">{formatDate(log.changed_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
