import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { Loader2, RefreshCw, MessageCircle, AlertCircle, IdCard, Truck, X, Package } from 'lucide-react'
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

// ─── Modal: ubah permintaan AMBIL_SENDIRI jadi EKSPEDISI ───
function ConvertToShipmentModal({ row, onClose, onSaved }) {
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!address.trim()) {
      setError('Alamat pengiriman wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.updatePickupRequest(row.id, { delivery_method: 'EKSPEDISI', shipping_address: address.trim() })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text-strong">Ubah jadi Kirim via Ekspedisi</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-faint hover:bg-hover"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-muted">
          Untuk konsumen yang menghubungi langsung (telepon/WA) tanpa lewat /cek. Isi alamat sesuai info dari konsumen.
        </p>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-faint">Alamat Pengiriman</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Jl. Merdeka No. 12, RT 03/RW 01, Kel. Sukajadi, Kec. Delta Pawan, Ketapang"
          className="w-full rounded-xl border border-border bg-hover px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
        {error && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:bg-hover">Batal</button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Simpan
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Modal: proses permintaan EKSPEDISI jadi document_handovers ───
function ProcessShipmentModal({ row, onClose, onSaved }) {
  const docTypes = String(row.requested_docs || '').split(',').map((s) => s.trim()).filter(Boolean)
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(docTypes))
  const [includeBuku, setIncludeBuku] = useState(true)
  const [couriers, setCouriers] = useState([])
  const [courierId, setCourierId] = useState('')
  const [loadingCouriers, setLoadingCouriers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getCourierUsers()
      .then((list) => {
        setCouriers(list || [])
        if (list?.length === 1) setCourierId(String(list[0].id))
      })
      .catch(() => {})
      .finally(() => setLoadingCouriers(false))
  }, [])

  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedTypes.size === 0) {
      setError('Pilih minimal satu dokumen')
      return
    }
    if (!courierId) {
      setError('Pilih akun ekspedisi yang menangani')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.processShipmentFromPickupRequest(row.id, {
        document_types: [...selectedTypes],
        assigned_courier_id: Number(courierId),
        include_buku_service: includeBuku,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Gagal memproses pengiriman')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text-strong">Proses Pengiriman</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-faint hover:bg-hover"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-muted">
          {row.engine_number} · {row.consumer_name || '-'}<br />
          Alamat: <span className="text-text">{row.shipping_address}</span>
        </p>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-faint">Dokumen yang Dikirim</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {docTypes.map((type) => (
            <label key={type} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
              <input type="checkbox" checked={selectedTypes.has(type)} onChange={() => toggleType(type)} className="h-3.5 w-3.5" />
              {type}
            </label>
          ))}
        </div>

        <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-text cursor-pointer">
          <input type="checkbox" checked={includeBuku} onChange={(e) => setIncludeBuku(e.target.checked)} className="h-3.5 w-3.5 rounded border-border-strong text-accent" />
          Sertakan Buku Service
        </label>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-faint">Akun Ekspedisi</label>
        {loadingCouriers ? (
          <div className="flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" /> Memuat...</div>
        ) : couriers.length === 0 ? (
          <p className="text-xs text-danger">Belum ada akun berrole Ekspedisi. Buat dulu lewat Manajemen Pengguna.</p>
        ) : (
          <select
            value={courierId}
            onChange={(e) => setCourierId(e.target.value)}
            className="w-full rounded-xl border border-border bg-hover px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="">Pilih akun ekspedisi</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:bg-hover">Batal</button>
          <button
            type="submit"
            disabled={saving || couriers.length === 0}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Proses Pengiriman
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ShowroomPickupRequests() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('PENDING')
  const [updatingId, setUpdatingId] = useState(null)
  const [convertModal, setConvertModal] = useState(null)
  const [shipmentModal, setShipmentModal] = useState(null)

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
      key: 'delivery_method',
      label: 'Pengiriman',
      render: (v, row) => (
        v === 'EKSPEDISI' ? (
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold text-accent">
              <Truck size={11} /> Ekspedisi
            </span>
            {row.shipping_address && (
              <p className="mt-1 max-w-[180px] text-[10.5px] text-muted" title={row.shipping_address}>
                {row.shipping_address.length > 40 ? row.shipping_address.slice(0, 40) + '…' : row.shipping_address}
              </p>
            )}
          </div>
        ) : (
          <span className="text-[10.5px] font-medium text-faint">Ambil Sendiri</span>
        )
      ),
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

          {row.delivery_method === 'EKSPEDISI' ? (
            <button
              type="button"
              onClick={() => setShipmentModal(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-success-soft px-2 py-1 text-[10.5px] font-semibold text-success transition hover:bg-emerald-500 hover:text-white"
              title="Proses jadi pengiriman"
            >
              <Package size={12} /> Proses Pengiriman
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConvertModal(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1 text-[10.5px] font-semibold text-muted transition hover:bg-hover hover:text-text-strong"
              title="Ubah jadi kirim via ekspedisi"
            >
              <Truck size={12} /> Ubah ke Ekspedisi
            </button>
          )}

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

      {convertModal && (
        <ConvertToShipmentModal row={convertModal} onClose={() => setConvertModal(null)} onSaved={load} />
      )}
      {shipmentModal && (
        <ProcessShipmentModal row={shipmentModal} onClose={() => setShipmentModal(null)} onSaved={load} />
      )}
    </div>
  )
}
