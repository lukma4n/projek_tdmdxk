import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  getShowroomStnkBpkbTrackMonitoring,
  exportShowroomStnkBpkbTrack,
} from '../services/api/showroom'
import { financeShortName, customerType } from '../data/financeCompanyMap'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  FileText,
  FileBadge,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Phone,
  X,
  ChevronDown,
  ChevronUp,
  Briefcase,
} from 'lucide-react'

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTanggalLengkap(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function CountBar({ label, value, total, color = 'bg-blue-500' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600 truncate font-medium">{label || '-'}</span>
        <span className="font-bold text-slate-800 tabular-nums">{value.toLocaleString('id-ID')}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out group-hover:opacity-80`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, subtext, icon: Icon, colorClass, borderClass, iconBgClass }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderClass} bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`text-3xl font-black ${colorClass} tabular-nums`}>{(value || 0).toLocaleString('id-ID')}</p>
          {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBgClass} shadow-sm`}>
          <Icon size={24} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  const config = {
    BELUM_JADI: { label: 'Belum Jadi', color: 'bg-red-100 text-red-700' },
    BELUM_DIAMBIL: { label: 'Belum Diambil', color: 'bg-amber-100 text-amber-700' },
    SUDAH_DIAMBIL: { label: 'Sudah Diambil', color: 'bg-emerald-100 text-emerald-700' },
  }
  const c = config[status] || { label: status || '-', color: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${c.color}`}>{c.label}</span>
}

function AnomalyTable({ rows, columns, emptyMessage }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">{emptyMessage}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 text-xs font-semibold uppercase text-slate-500 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <tr key={`${row.engine_number}-${idx}`} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right font-bold tabular-nums' : 'text-slate-600'}`}>
                  {col.render ? col.render(row) : row[col.key] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const STNK_COLUMNS = [
  { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
  { key: 'stnk_name', label: 'Nama' },
  { key: 'series', label: 'Series' },
  { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
  { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-slate-400">CASH</span> },
  { key: 'tgl_mohon_faktur', label: 'Tgl Mohon Faktur', render: (r) => formatTanggalIndo(r.tgl_mohon_faktur) },
  { key: 'birojasa', label: 'Birojasa', render: (r) => r.birojasa || '-' },
  {
    key: 'whatsapp',
    label: 'Aksi',
    render: (r) =>
      r.mobile ? (
        <a
          href={`https://wa.me/${String(r.mobile).replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Phone size={12} />
          WhatsApp
        </a>
      ) : (
        <span className="text-slate-400 text-xs">-</span>
      ),
  },
]

const STNK_BELUM_DIAMBIL_COLUMNS = [
  { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
  { key: 'stnk_name', label: 'Nama' },
  { key: 'series', label: 'Series' },
  { key: 'no_stnk', label: 'No STNK', render: (r) => <span className="font-mono text-xs">{r.no_stnk || '-'}</span> },
  { key: 'tgl_terima_stnk', label: 'Tgl Terima', render: (r) => formatTanggalIndo(r.tgl_terima_stnk) },
  {
    key: 'days_waiting',
    label: 'Hari Tunggu',
    align: 'right',
    render: (r) => {
      if (!r.tgl_terima_stnk) return '-'
      const days = Math.floor((new Date() - new Date(r.tgl_terima_stnk)) / (24 * 60 * 60 * 1000))
      return <span className={days > 30 ? 'text-red-600' : days > 14 ? 'text-amber-600' : 'text-slate-700'}>{days} hari</span>
    },
  },
  {
    key: 'whatsapp',
    label: 'Aksi',
    render: (r) =>
      r.mobile ? (
        <a
          href={`https://wa.me/${String(r.mobile).replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Phone size={12} />
          WhatsApp
        </a>
      ) : (
        <span className="text-slate-400 text-xs">-</span>
      ),
  },
]

const BPKB_OVERDUE_COLUMNS = [
  { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
  { key: 'stnk_name', label: 'Nama' },
  { key: 'series', label: 'Series' },
  { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
  { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-slate-400">CASH</span> },
  { key: 'tgl_jadi_bpkb', label: 'Tgl Jadi BPKB', render: (r) => formatTanggalIndo(r.tgl_jadi_bpkb) },
  { key: 'no_bpkb', label: 'No BPKB', render: (r) => <span className="font-mono text-xs">{r.no_bpkb || '-'}</span> },
  {
    key: 'days_overdue',
    label: 'Hari Overdue',
    align: 'right',
    render: (r) => <span className="text-red-600 font-bold">{r.days_overdue} hari</span>,
  },
  {
    key: 'whatsapp',
    label: 'Aksi',
    render: (r) =>
      r.mobile ? (
        <a
          href={`https://wa.me/${String(r.mobile).replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Phone size={12} />
          WhatsApp
        </a>
      ) : (
        <span className="text-slate-400 text-xs">-</span>
      ),
  },
]

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6']

export default function ShowroomStnkBpkbMonitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [activeAnomalyTab, setActiveAnomalyTab] = useState('stnkBelumJadi')
  const [anomalyExpanded, setAnomalyExpanded] = useState(true)
  const [filters, setFilters] = useState({
    area: '',
    series: '',
    finance_company: '',
    birojasa: '',
    tahun: '',
    status_stnk: '',
    status_bpkb: '',
    customer_type: '',
    aging_min: '',
    aging_max: '',
  })

  const buildParams = useCallback(() => {
    const params = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) params[k] = v
    })
    return params
  }, [filters])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await getShowroomStnkBpkbTrackMonitoring(buildParams())
      setData(result)
    } catch (err) {
      setError(err.message || 'Gagal memuat data monitoring STNK & BPKB')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-effect-deps
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApplyFilters = () => {
    void loadData()
  }

  const handleResetFilters = () => {
    setFilters({ area: '', series: '', finance_company: '', birojasa: '', tahun: '', status_stnk: '', status_bpkb: '', customer_type: '', aging_min: '', aging_max: '' })
    setTimeout(() => void loadData(), 0)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const blob = await exportShowroomStnkBpkbTrack(buildParams())
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Track_STNK_BPKB_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengekspor: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  const summary = data?.summary || { stnk: {}, bpkb: {}, total: 0, platPending: 0, fakturPending: 0, bpkbOverdue: 0, cashCount: 0, kreditCount: 0 }
  const facets = data?.facets || { areas: [], series: [], financeCompanies: [], birojasas: [], tahun: [] }

  const statCards = [
    {
      label: 'STNK Belum Jadi',
      value: summary.stnk?.BELUM_JADI || 0,
      subtext: `+ ${summary.stnk?.BELUM_DIAMBIL || 0} belum diambil`,
      icon: FileText,
      colorClass: 'text-red-700',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-red-100 text-red-600',
    },
    {
      label: 'BPKB Belum Jadi',
      value: summary.bpkb?.BELUM_JADI || 0,
      subtext: `+ ${summary.bpkb?.BELUM_DIAMBIL || 0} belum diambil`,
      icon: FileBadge,
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Plat Belum Jadi',
      value: summary.platPending || 0,
      subtext: `${summary.fakturPending || 0} faktur belum`,
      icon: Clock,
      colorClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      iconBgClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'BPKB Overdue > 180 hari',
      value: summary.bpkbOverdue || 0,
      subtext: 'Belum diambil & lewat jatuh tempo',
      icon: AlertCircle,
      colorClass: 'text-rose-700',
      borderClass: 'border-rose-200',
      iconBgClass: 'bg-rose-100 text-rose-600',
    },
    {
      label: 'Cash Customer',
      value: summary.cashCount || 0,
      subtext: 'Tanpa finance company',
      icon: TrendingUp,
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Kredit Customer',
      value: summary.kreditCount || 0,
      subtext: 'Ada finance company',
      icon: Briefcase,
      colorClass: 'text-indigo-700',
      borderClass: 'border-indigo-200',
      iconBgClass: 'bg-indigo-100 text-indigo-600',
    },
  ]

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
          <p className="text-sm text-slate-500">Memuat data monitoring STNK & BPKB...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const anomalies = data?.anomalies || {}
  const topPendingBpkb = data?.topPendingBpkb || { count: 0, rows: [] }

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {loading && data && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-0.5 bg-blue-500 animate-pulse" />
        </div>
      )}
      {error && data && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto text-xs font-semibold underline">Coba Lagi</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Monitoring STNK & BPKB</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tracking dokumen STNK & BPKB yang belum jadi / belum diambil · {data?.totalRows || 0} unit
            {data?.syncedAt && (
              <span className="ml-2 text-xs text-slate-400">
                (sinkron terakhir: {formatTanggalLengkap(data.syncedAt)})
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Mengekspor...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">Filter</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-10 gap-3">
          <select
            value={filters.area}
            onChange={(e) => setFilters({ ...filters, area: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Area</option>
            {facets.areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filters.series}
            onChange={(e) => setFilters({ ...filters, series: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Series</option>
            {facets.series.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.finance_company}
            onChange={(e) => setFilters({ ...filters, finance_company: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Leasing</option>
            {facets.financeCompanies.map((f) => <option key={f} value={f}>{financeShortName(f)}</option>)}
          </select>
          <select
            value={filters.birojasa}
            onChange={(e) => setFilters({ ...filters, birojasa: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Biro Jasa</option>
            {facets.birojasas.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={filters.tahun}
            onChange={(e) => setFilters({ ...filters, tahun: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Semua Tahun</option>
            {facets.tahun.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filters.status_stnk}
            onChange={(e) => setFilters({ ...filters, status_stnk: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">STNK: Semua</option>
            <option value="BELUM_JADI">Belum Jadi</option>
            <option value="BELUM_DIAMBIL">Belum Diambil</option>
            <option value="SUDAH_DIAMBIL">Sudah Diambil</option>
          </select>
          <select
            value={filters.status_bpkb}
            onChange={(e) => setFilters({ ...filters, status_bpkb: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">BPKB: Semua</option>
            <option value="BELUM_JADI">Belum Jadi</option>
            <option value="BELUM_DIAMBIL">Belum Diambil</option>
            <option value="SUDAH_DIAMBIL">Sudah Diambil</option>
          </select>
          <select
            value={filters.customer_type}
            onChange={(e) => setFilters({ ...filters, customer_type: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
          >
            <option value="">Semua: Cash & Kredit</option>
            <option value="CASH">💵 Cash</option>
            <option value="KREDIT">💳 Kredit</option>
          </select>
          <input
            type="number"
            placeholder="Aging min (hari)"
            value={filters.aging_min}
            onChange={(e) => setFilters({ ...filters, aging_min: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="number"
            placeholder="Aging max (hari)"
            value={filters.aging_max}
            onChange={(e) => setFilters({ ...filters, aging_max: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Terapkan Filter
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Status STNK & BPKB Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Status STNK" icon={FileText}>
          <div className="space-y-3">
            <CountBar
              label="Belum Jadi (Tgl Terima STNK kosong)"
              value={summary.stnk?.BELUM_JADI || 0}
              total={summary.total || 1}
              color="bg-red-500"
            />
            <CountBar
              label="Belum Diambil (STNK jadi, belum diserahkan)"
              value={summary.stnk?.BELUM_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-amber-500"
            />
            <CountBar
              label="Sudah Diambil / Closed"
              value={summary.stnk?.SUDAH_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-emerald-500"
            />
          </div>
        </SectionCard>

        <SectionCard title="Status BPKB" icon={FileBadge}>
          <div className="space-y-3">
            <CountBar
              label="Belum Jadi (Tgl Jadi BPKB kosong)"
              value={summary.bpkb?.BELUM_JADI || 0}
              total={summary.total || 1}
              color="bg-red-500"
            />
            <CountBar
              label="Belum Diambil (BPKB jadi, belum diserahkan)"
              value={summary.bpkb?.BELUM_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-amber-500"
            />
            <CountBar
              label="Sudah Diambil / Closed"
              value={summary.bpkb?.SUDAH_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-emerald-500"
            />
          </div>
        </SectionCard>
      </div>

      {/* Breakdown Chart */}
      <SectionCard
        title="Top 10 Series dengan STNK/BPKB Belum Jadi"
        icon={TrendingUp}
        action={<span className="text-sm font-semibold text-slate-500">{(data?.bySeries || []).length} series</span>}
      >
        {(data?.bySeries || []).length > 0 ? (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bySeries} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={75} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`${value} unit`, 'Jumlah']}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">Belum ada data series.</p>
        )}
      </SectionCard>

      {/* Breakdown 2 kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top 10 Area (Belum Jadi)" icon={Filter}>
          {(data?.byArea || []).length > 0 ? (
            <div className="space-y-3">
              {data.byArea.map((item) => (
                <CountBar
                  key={item.name}
                  label={item.name}
                  value={item.count}
                  total={Math.max(...data.byArea.map((d) => d.count), 1)}
                  color="bg-purple-500"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Belum ada data area.</p>
          )}
        </SectionCard>

        <SectionCard title="Distribusi BPKB Belum Jadi per Leasing" icon={FileBadge}>
          {(data?.byFinance || []).length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byFinance}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                    label={(entry) => entry.count > 0 ? `${financeShortName(entry.name)?.slice(0, 12) || '?'}: ${entry.count}` : ''}
                  >
                    {data.byFinance.map((entry, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    formatter={(value, name) => [`${value} unit`, financeShortName(name) || name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Belum ada data leasing.</p>
          )}
        </SectionCard>
      </div>

      {/* Biro Jasa breakdown */}
      <SectionCard
        title="Per Biro Jasa (STNK/BPKB Belum Jadi)"
        icon={Briefcase}
        action={<span className="text-sm font-semibold text-slate-500">{(data?.byBirojasa || []).length} biro jasa</span>}
      >
        {(data?.byBirojasa || []).length > 0 ? (
          <>
            <div className="h-[320px] mb-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byBirojasa} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    angle={-15}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value, name) => [`${value} unit`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="stnk_belum_jadi" name="STNK Belum Jadi" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="plat_belum_jadi" name="Plat Belum Jadi" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="bpkb_belum_jadi" name="BPKB Belum Jadi" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Biro Jasa</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">STNK Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Plat Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">BPKB Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-rose-600">BPKB Overdue</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byBirojasa.map((row) => {
                    const total = row.stnk_belum_jadi + row.bpkb_belum_jadi
                    return (
                      <tr key={row.name} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-700 font-medium">{row.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.stnk_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-xs">{row.stnk_belum_jadi}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.plat_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-xs">{row.plat_belum_jadi}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.bpkb_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-xs">{row.bpkb_belum_jadi}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.bpkb_overdue > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-xs">{row.bpkb_overdue}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-800 tabular-nums">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">Belum ada data biro jasa. Semua unit sudah selesai.</p>
        )}
      </SectionCard>

      {/* Tahun breakdown */}
      <SectionCard title="Distribusi per Tahun (STNK/BPKB Belum Jadi)" icon={Clock}>
        {(data?.byTahun || []).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.byTahun.map((item) => (
              <div key={item.name} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <p className="text-xs font-semibold text-slate-500 uppercase">{item.name}</p>
                <p className="text-2xl font-black text-slate-800 tabular-nums mt-1">{item.count}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">Belum ada data tahun.</p>
        )}
      </SectionCard>

      {/* Anomali Section */}
      <SectionCard
        title="Anomali & Tindak Lanjut"
        icon={AlertTriangle}
        action={
          <button
            onClick={() => setAnomalyExpanded(!anomalyExpanded)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            {anomalyExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        }
      >
        {anomalyExpanded && (
          <>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
              {[
                { key: 'stnkBelumJadi', label: `STNK Belum Jadi belum Followup (${anomalies.stnkBelumJadiBelumFollowup?.count || 0})` },
                { key: 'stnkSudahJadi', label: `STNK Sudah Jadi belum Diambil (${anomalies.stnkSudahJadiBelumDiambil?.count || 0})` },
                { key: 'bpkbOverdue', label: `BPKB Overdue >180hr (${anomalies.bpkbOverdue?.count || 0})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveAnomalyTab(tab.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeAnomalyTab === tab.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeAnomalyTab === 'stnkBelumJadi' && (
              <AnomalyTable
                rows={anomalies.stnkBelumJadiBelumFollowup?.rows || []}
                columns={STNK_COLUMNS}
                emptyMessage="Tidak ada STNK yang belum jadi dan belum difollowup. ✅"
              />
            )}
            {activeAnomalyTab === 'stnkSudahJadi' && (
              <AnomalyTable
                rows={anomalies.stnkSudahJadiBelumDiambil?.rows || []}
                columns={STNK_BELUM_DIAMBIL_COLUMNS}
                emptyMessage="Tidak ada STNK yang sudah jadi dan belum diambil. ✅"
              />
            )}
            {activeAnomalyTab === 'bpkbOverdue' && (
              <AnomalyTable
                rows={anomalies.bpkbOverdue?.rows || []}
                columns={BPKB_OVERDUE_COLUMNS}
                emptyMessage="Tidak ada BPKB yang overdue > 180 hari. ✅"
              />
            )}
          </>
        )}
      </SectionCard>

      {/* Top Pending BPKB */}
      <SectionCard
        title={`Top 50 BPKB Pending Terlama (${topPendingBpkb.count} total)`}
        icon={Clock}
      >
        <AnomalyTable
          rows={topPendingBpkb.rows || []}
          columns={[
            { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
            { key: 'stnk_name', label: 'Nama' },
            { key: 'series', label: 'Series' },
            { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
            { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-slate-400">CASH</span> },
            { key: 'birojasa', label: 'Birojasa' },
            { key: 'tgl_mohon_faktur', label: 'Tgl Mohon Faktur', render: (r) => formatTanggalIndo(r.tgl_mohon_faktur) },
            {
              key: 'days_pending',
              label: 'Hari Pending',
              align: 'right',
              render: (r) => <span className={r.days_pending > 90 ? 'text-red-600 font-bold' : r.days_pending > 30 ? 'text-amber-600' : 'text-slate-700'}>{r.days_pending} hari</span>,
            },
            {
              key: 'whatsapp',
              label: 'Aksi',
              render: (r) =>
                r.mobile ? (
                  <a
                    href={`https://wa.me/${String(r.mobile).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <Phone size={12} />
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs">-</span>
                ),
            },
          ]}
          emptyMessage="Tidak ada BPKB pending."
        />
      </SectionCard>
    </div>
  )
}
