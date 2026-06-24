import { useEffect, useState } from 'react'
import { RefreshCw, Database, Clock } from 'lucide-react'
import { api } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Table from '../components/ui/Table'

function formatDateTime(value) {
  if (!value) return null
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function freshnessInfo(lastImportAt) {
  if (!lastImportAt) return { label: 'Belum import', color: 'text-faint', bg: 'bg-panel' }
  const ageMs = Date.now() - new Date(lastImportAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < 1) return { label: 'Segar', color: 'text-success', bg: 'bg-success-soft' }
  if (ageDays < 3) return { label: `${Math.floor(ageDays)}h lalu`, color: 'text-warning', bg: 'bg-warning-soft' }
  return { label: `${Math.floor(ageDays)}h lalu`, color: 'text-danger', bg: 'bg-danger-soft' }
}

export default function DataFreshness() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getDataFreshness()
      setRows(data.freshness || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void Promise.resolve().then(load) }, [])

  const columns = [
    { key: 'label', label: 'Modul', bold: true },
    {
      key: 'last_import_at',
      label: 'Sync Terakhir',
      render: (v) => v
        ? <span className="text-muted">{formatDateTime(v)}</span>
        : <span className="text-faint italic">Belum pernah import</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => {
        const { label, color, bg } = freshnessInfo(row.last_import_at)
        return (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${color} ${bg}`}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'total_rows',
      label: 'Total Data',
      align: 'right',
      mono: true,
      render: (v) => (v || 0).toLocaleString('id-ID'),
    },
    {
      key: 'rows_success',
      label: 'Import OK',
      align: 'right',
      render: (v) => <span className="text-success font-semibold">{(v || 0).toLocaleString('id-ID')}</span>,
    },
    {
      key: 'rows_error',
      label: 'Error',
      align: 'right',
      render: (v) => v > 0
        ? <span className="text-danger font-semibold">{v}</span>
        : <span className="text-faint">0</span>,
    },
    {
      key: 'filename',
      label: 'File Terakhir',
      render: (v) => v
        ? <span className="text-xs text-muted font-mono">{v}</span>
        : <span className="text-faint text-xs">—</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kesegaran Data Import"
        description="Status import data terakhir dari sistem induk AHM per modul"
        timestamp={lastRefresh ? `Diperbarui ${lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : undefined}
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
        <div className="rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger font-medium">
          {error}
        </div>
      )}

      <Card
        title="Status per Modul"
        icon={Database}
        action={
          <span className="flex items-center gap-1 text-[11px] text-faint">
            <Clock size={12} /> snapshot harian dari sistem induk AHM
          </span>
        }
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-faint text-sm">
            Memuat data...
          </div>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            emptyMessage="Belum ada data import"
          />
        )}
      </Card>
    </div>
  )
}
