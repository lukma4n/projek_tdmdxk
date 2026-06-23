import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { Loader2, RefreshCw, MessageCircle, AlertCircle, IdCard } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Status pickup request — urutan alur tindak lanjut.
const STATUS_FLOW = [
  { key: 'PENDING', label: 'Menunggu', variant: 'warning' },
  { key: 'CONTACTED', label: 'Dihubungi', variant: 'accent' },
  { key: 'DONE', label: 'Selesai', variant: 'success' },
  { key: 'CANCELLED', label: 'Dibatalkan', variant: 'danger' },
]

const STATUS_BADGE = (status) => STATUS_FLOW.find((s) => s.key === status) || { label: status, variant: 'default' }

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ShowroomPickupRequests() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('PENDING')
  const [updatingId, setUpdatingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = filterStatus ? { status: filterStatus } : {}
      const res = await api.getPickupRequests(params)
      // getPickupRequests mengembalikan array telanjang; guard bila bentuk berubah.
      setRows(Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []))
    } catch (err) {
      setError(err.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const handleUpdateStatus = async (id, status) => {
    setUpdatingId(id)
    try {
      const res = await api.updatePickupRequest(id, { status })
      setRows((prev) => prev.map((r) => (r.id === id ? res : r)))
    } catch (err) {
      setError(err.message || 'Gagal memperbarui status')
    } finally {
      setUpdatingId(null)
    }
  }

  const pendingCount = rows.filter((r) => r.status === 'PENDING').length

  const columns = [
    {
      key: 'created_at',
      label: 'Waktu Request',
      render: (v) => <span className="whitespace-nowrap">{formatDate(v)}</span>,
    },
    {
      key: 'engine_number',
      label: 'No. Mesin',
      mono: true,
      render: (v) => <span className="font-mono text-[11px]">{v}</span>,
    },
    {
      key: 'consumer_name',
      label: 'Konsumen',
      bold: true,
      render: (v) => v || '-',
    },
    {
      key: 'consumer_phone',
      label: 'No. HP',
      render: (v) =>
        v ? (
          <a
            href={`https://wa.me/${String(v).replace(/\D/g, '').replace(/^0/, '62')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-success hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle size={13} /> {v}
          </a>
        ) : (
          <span className="text-faint">-</span>
        ),
    },
    {
      key: 'requested_docs',
      label: 'Dokumen',
      render: (v) => (v ? <span className="font-semibold text-text">{v}</span> : '-'),
    },
    {
      key: 'preferred_time',
      label: 'Preferensi Waktu',
      render: (v) => v || <span className="text-faint">-</span>,
    },
    {
      key: 'notes',
      label: 'Catatan',
      render: (v) => (v ? <span className="text-muted" title={v}>{v.length > 60 ? v.slice(0, 60) + '…' : v}</span> : <span className="text-faint">-</span>),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        const s = STATUS_BADGE(v)
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'left',
      render: (_v, row) => (
        <div className="flex flex-col items-start gap-1.5">
          <a
            href={`${API_BASE}/showroom/pickup-requests/${row.id}/ktp`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-[10.5px] font-semibold text-accent transition hover:bg-accent hover:text-white"
            title="Lihat foto KTP konsumen"
          >
            <IdCard size={12} /> Lihat KTP
          </a>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FLOW.filter((s) => s.key !== row.status).map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={updatingId === row.id}
                onClick={() => handleUpdateStatus(row.id, s.key)}
                className="rounded-lg border border-border bg-panel px-2 py-1 text-[10.5px] font-semibold text-muted transition hover:bg-hover hover:text-text-strong disabled:opacity-50"
                title={`Tandai ${s.label}`}
              >
                {updatingId === row.id ? <Loader2 size={11} className="animate-spin" /> : s.label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="Permintaan Ambil Dokumen"
        breadcrumb="Layanan Publik / Pickup Requests"
        description="Permintaan ambil dokumen yang diajukan konsumen dari halaman self-check /cek."
        action={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3.5 py-2 text-xs font-semibold text-muted transition hover:bg-hover"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Filter status */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterStatus('')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterStatus === '' ? 'bg-accent text-white' : 'border border-border bg-panel text-muted hover:bg-hover'}`}
        >
          Semua
        </button>
        {STATUS_FLOW.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterStatus === s.key ? 'bg-accent text-white' : 'border border-border bg-panel text-muted hover:bg-hover'}`}
          >
            {s.label}
            {s.key === 'PENDING' && pendingCount > 0 && filterStatus !== 'PENDING' ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex gap-2.5 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-panel shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="ml-2 text-sm">Memuat data...</span>
          </div>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            emptyMessage={
              filterStatus === 'PENDING'
                ? 'Tidak ada permintaan menunggu tindakan.'
                : 'Tidak ada permintaan ambil dokumen.'
            }
          />
        )}
      </div>

      <p className="mt-3 text-[11px] text-faint">
        Daftar diurutkan dari terbaru. Menampilkan maks. 200 baris. Konsumen mengajukan dari{' '}
        <a href="/cek" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">/cek</a>{' '}
        setelah verifikasi identitas.
      </p>
    </div>
  )
}