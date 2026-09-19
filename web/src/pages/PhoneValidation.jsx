import { useEffect, useState } from 'react'
import { PhoneOff, Search, Download, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { api, API_BASE } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import KpiCard from '../components/ui/KpiCard'
import Table from '../components/ui/Table'

const SOURCES = [
  { value: 'customers', label: 'Data Konsumen' },
  { value: 'handovers', label: 'Serah Terima Dokumen' },
]

const REASON_LABELS = {
  kosong: 'Nomor HP kosong',
  dobel: 'Dua nomor tertulis jadi satu',
  bukan_seluler: 'Bukan nomor seluler',
  terlalu_pendek: 'Terlalu pendek',
  terlalu_panjang: 'Terlalu panjang',
}

export default function PhoneValidation() {
  const [source, setSource] = useState('customers')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ total_invalid: 0, by_reason: {} })
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        const res = await api.getInvalidPhones({ source, search, page })
        if (cancelled) return
        setRows(res.data || [])
        setSummary(res.summary || { total_invalid: 0, by_reason: {} })
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void Promise.resolve().then(load)
    return () => { cancelled = true }
  }, [source, search, page])

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({ source, ...(search && { search }) }).toString()
      const response = await fetch(`${API_BASE}/phone-validation/export?${params}`, { credentials: 'include' })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Export gagal')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `Validasi_Nomor_HP_${source}_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Nama', bold: true },
    { key: 'reference', label: 'Referensi' },
    { key: 'raw_phone', label: 'Nomor Asli', mono: true, render: (v) => v || <span className="text-faint italic">kosong</span> },
    {
      key: 'alasan',
      label: 'Alasan Tidak Valid',
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-danger-soft text-danger">
          {REASON_LABELS[v] || v}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Validasi Nomor HP Konsumen"
        description="Nomor HP tidak valid berdasarkan aturan validasi yang sama dipakai untuk tautan WhatsApp"
        action={
          <button
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover hover:text-text-strong transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={15} className={exporting ? 'animate-spin' : ''} /> Export Excel
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger font-medium">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => { setSource(s.value); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              source === s.value ? 'bg-accent text-white' : 'bg-panel border border-border text-muted hover:bg-hover'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Tidak Valid" value={summary.total_invalid.toLocaleString('id-ID')} icon={PhoneOff} iconBgClass="bg-danger-soft text-danger" />
        {Object.entries(REASON_LABELS).map(([key, label]) => (
          <KpiCard key={key} label={label} value={(summary.by_reason?.[key] || 0).toLocaleString('id-ID')} />
        ))}
      </div>

      <Card
        title="Daftar Nomor Tidak Valid"
        icon={PhoneOff}
        action={
          <div className="flex items-center gap-2">
            <Search size={14} className="text-faint" />
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchDraft); setPage(1) } }}
              placeholder="Cari nama atau referensi..."
              className="px-3 py-1.5 text-sm bg-hover border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        }
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-faint text-sm">
            <Loader2 className="animate-spin mr-2" size={18} /> Memuat data...
          </div>
        ) : error && rows.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto text-danger-400 mb-2" size={24} />
          </div>
        ) : (
          <Table columns={columns} rows={rows} emptyMessage="Tidak ada nomor tidak valid" />
        )}
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Halaman {pagination.page} dari {pagination.totalPages} • {pagination.total.toLocaleString('id-ID')} data
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 px-3 py-2 bg-panel border border-border rounded-lg disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 bg-panel border border-border rounded-lg disabled:opacity-40"
            >
              Berikutnya <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
