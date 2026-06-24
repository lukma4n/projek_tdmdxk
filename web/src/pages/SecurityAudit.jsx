import { useEffect, useState } from 'react'
import { ShieldCheck, RefreshCw, Monitor, History, LogOut } from 'lucide-react'
import { api } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const EVENT_META = {
  login_success: { label: 'Login', variant: 'success' },
  login_blocked: { label: 'Login Ditolak', variant: 'danger' },
  logout: { label: 'Logout', variant: 'default' },
  session_reset: { label: 'Sesi Direset', variant: 'warning' },
}

// Ringkas user-agent jadi nama browser/OS yang enak dibaca.
function shortDevice(ua) {
  if (!ua) return '—'
  const b = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
    : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${b} · ${os}` : b
}

export default function SecurityAudit() {
  const [sessions, setSessions] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resettingId, setResettingId] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const [s, l] = await Promise.all([api.getActiveSessions(), api.getLoginLogs({ limit: 200 })])
      setSessions(s.sessions || [])
      setLogs(l.logs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void Promise.resolve().then(load) }, [])

  const handleReset = async (row) => {
    if (!window.confirm(`Reset sesi untuk "${row.username}"? Sesi aktifnya akan dikeluarkan dan akun bisa login lagi.`)) return
    try {
      setResettingId(row.id)
      await api.resetUserSession(row.id)
      await load()
    } catch (err) {
      alert('Gagal reset sesi: ' + (err.message || 'Unknown error'))
    } finally {
      setResettingId(null)
    }
  }

  const sessionColumns = [
    { key: 'username', label: 'Username', bold: true },
    { key: 'name', label: 'Nama' },
    { key: 'role', label: 'Role' },
    { key: 'session_last_active', label: 'Aktivitas Terakhir', render: (v) => formatDateTime(v) },
    {
      key: 'active',
      label: 'Status',
      render: (v) => v
        ? <Badge variant="success">Aktif</Badge>
        : <Badge variant="default">Idle</Badge>,
    },
    {
      key: 'aksi',
      label: 'Aksi',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleReset(row)}
          disabled={resettingId === row.id}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
        >
          <LogOut size={13} /> {resettingId === row.id ? '...' : 'Reset Sesi'}
        </button>
      ),
    },
  ]

  const logColumns = [
    { key: 'created_at', label: 'Waktu', render: (v) => formatDateTime(v) },
    { key: 'username', label: 'Username', bold: true },
    {
      key: 'event',
      label: 'Kejadian',
      render: (v) => {
        const m = EVENT_META[v] || { label: v, variant: 'default' }
        return <Badge variant={m.variant}>{m.label}</Badge>
      },
    },
    { key: 'ip', label: 'IP', mono: true, render: (v) => v || '—' },
    { key: 'user_agent', label: 'Perangkat', render: (v) => shortDevice(v) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Login & Sesi"
        description="Pantau login, deteksi sharing akun, dan kelola sesi aktif (single-session)"
        action={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover hover:text-text-strong transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-danger bg-danger-soft p-4 text-sm font-medium text-danger">{error}</div>
      )}

      <Card title="Sesi Aktif" icon={Monitor} badge={sessions.length}>
        <Table columns={sessionColumns} rows={sessions} emptyMessage="Tidak ada sesi aktif" />
      </Card>

      <Card
        title="Riwayat Login"
        icon={History}
        action={<span className="text-[11px] text-faint">200 kejadian terakhir · 'Login Ditolak' menandakan percobaan sharing</span>}
      >
        <Table columns={logColumns} rows={logs} emptyMessage="Belum ada riwayat login" />
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-faint">
        <ShieldCheck size={13} /> 1 akun = 1 sesi. Login di tempat lain ditolak selama sesi masih aktif (≤60 menit sejak aktivitas terakhir). Gunakan "Reset Sesi" untuk membebaskan akun yang terkunci.
      </p>
    </div>
  )
}
