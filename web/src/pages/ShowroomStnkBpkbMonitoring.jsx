import { useEffect, useState, useCallback } from 'react'
import {
  getShowroomStnkBpkbTrackMonitoring,
  exportShowroomStnkBpkbTrack,
} from '../services/api/showroom'
import { financeShortName } from '../data/financeCompanyMap'
import {
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
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
  Clock,
  TrendingUp,

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


function CountBar({ label, value, total, color = 'bg-accent' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted truncate font-medium">{label || '-'}</span>
        <span className="font-bold text-text tabular-nums">{value.toLocaleString('id-ID')}</span>
      </div>
      <div className="h-2.5 rounded-full bg-hover overflow-hidden">
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
    <div className={`relative overflow-hidden rounded-xl border ${borderClass} bg-panel p-5 shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className={`text-3xl font-black ${colorClass} tabular-nums`}>{(value || 0).toLocaleString('id-ID')}</p>
          {subtext && <p className="text-xs text-muted">{subtext}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgClass} shadow-sm`}>
          <Icon size={24} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-panel rounded-xl border border-border shadow-sm p-6 space-y-5 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-text text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function AnomalyTable({ rows, columns, emptyMessage }) {
  if (rows.length === 0) {
    return <p className="text-sm text-faint py-4 text-center">{emptyMessage}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-hover">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 text-xs font-semibold uppercase text-muted ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <tr key={`${row.engine_number}-${idx}`} className="hover:bg-hover">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right font-bold tabular-nums' : 'text-muted'}`}>
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
  { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-success-soft text-success' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
  { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-faint">CASH</span> },
  { key: 'tgl_mohon_faktur', label: 'Tgl Mohon Faktur', render: (r) => formatTanggalIndo(r.tgl_mohon_faktur) },
  { key: 'birojasa', label: 'Birojasa', render: (r) => r.birojasa || '-' },
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
      return <span className={days > 30 ? 'text-danger' : days > 14 ? 'text-warning' : 'text-text'}>{days} hari</span>
    },
  },

]

const BPKB_OVERDUE_COLUMNS = [
  { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
  { key: 'stnk_name', label: 'Nama' },
  { key: 'series', label: 'Series' },
  { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-success-soft text-success' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
  { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-faint">CASH</span> },
  { key: 'tgl_jadi_bpkb', label: 'Tgl Jadi BPKB', render: (r) => formatTanggalIndo(r.tgl_jadi_bpkb) },
  { key: 'no_bpkb', label: 'No BPKB', render: (r) => <span className="font-mono text-xs">{r.no_bpkb || '-'}</span> },
  {
    key: 'days_overdue',
    label: 'Hari Overdue',
    align: 'right',
    render: (r) => <span className="text-danger font-bold">{r.days_overdue} hari</span>,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApplyFilters = () => {
    void loadData()
  }

  const handleResetFilters = () => {
    setFilters({ series: '', finance_company: '', birojasa: '', tahun: '', status_stnk: '', status_bpkb: '', customer_type: '', aging_min: '', aging_max: '' })
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
  const facets = data?.facets || { series: [], financeCompanies: [], birojasas: [], tahun: [] }

  const statCards = [
    {
      label: 'STNK Belum Jadi',
      value: summary.stnk?.BELUM_JADI || 0,
      subtext: `+ ${summary.stnk?.BELUM_DIAMBIL || 0} belum diambil`,
      icon: FileText,
      colorClass: 'text-danger',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-danger-soft text-danger',
    },
    {
      label: 'BPKB Belum Jadi',
      value: summary.bpkb?.BELUM_JADI || 0,
      subtext: `+ ${summary.bpkb?.BELUM_DIAMBIL || 0} belum diambil`,
      icon: FileBadge,
      colorClass: 'text-warning',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-warning-soft text-warning',
    },
    {
      label: 'Plat Belum Jadi',
      value: summary.platPending || 0,
      subtext: `${summary.fakturPending || 0} faktur belum`,
      icon: Clock,
      colorClass: 'text-accent-text',
      borderClass: 'border-accent-soft',
      iconBgClass: 'bg-accent-soft text-accent',
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
      colorClass: 'text-success',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-success-soft text-success',
    },
    {
      label: 'Kredit Customer',
      value: summary.kreditCount || 0,
      subtext: 'Ada finance company',
      icon: Briefcase,
      colorClass: 'text-indigo-700',
      borderClass: 'border-indigo-200',
      iconBgClass: 'bg-indigo-100 text-accent',
    },
  ]

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data monitoring STNK & BPKB...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="text-danger" size={28} />
          </div>
          <p className="text-danger font-medium">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors">
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
          <div className="h-0.5 bg-accent animate-pulse" />
        </div>
      )}
      {error && data && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger-soft border border-red-200 rounded-lg text-sm text-danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto text-xs font-semibold underline">Coba Lagi</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">Monitoring STNK & BPKB</h1>
          <p className="text-sm text-muted mt-1">
            Tracking dokumen STNK & BPKB yang belum jadi / belum diambil · {data?.totalRows || 0} unit
            {data?.syncedAt && (
              <span className="ml-2 text-xs text-faint">
                (sinkron terakhir: {formatTanggalLengkap(data.syncedAt)})
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover transition-all shadow-sm"
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
      <div className="bg-panel rounded-xl border border-border shadow-sm p-5 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <Filter size={18} className="text-accent" />
              <h3 className="font-bold text-text">Filter</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <select
                value={filters.birojasa}
                onChange={(e) => setFilters({ ...filters, birojasa: e.target.value })}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
              >
                <option value="">Semua Biro Jasa</option>
                {facets.birojasas.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                value={filters.customer_type}
                onChange={(e) => setFilters({ ...filters, customer_type: e.target.value })}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
              >
                <option value="">Cash & Kredit</option>
                <option value="CASH">Cash</option>
                <option value="KREDIT">Kredit</option>
              </select>
              <select
                value={filters.status_stnk}
                onChange={(e) => setFilters({ ...filters, status_stnk: e.target.value })}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
              >
                <option value="">Status STNK: Semua</option>
                <option value="BELUM_JADI">Belum Jadi</option>
                <option value="BELUM_DIAMBIL">Belum Diambil</option>
                <option value="SUDAH_DIAMBIL">Sudah Diambil</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-colors shadow-sm"
            >
              Terapkan
            </button>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-hover text-text rounded-lg text-sm font-semibold hover:bg-hover transition-colors"
            >
              Reset
            </button>
          </div>
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
              color="bg-danger"
            />
            <CountBar
              label="Belum Diambil (STNK jadi, belum diserahkan)"
              value={summary.stnk?.BELUM_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-warning"
            />
            <CountBar
              label="Sudah Diambil / Closed"
              value={summary.stnk?.SUDAH_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-success"
            />
          </div>
        </SectionCard>

        <SectionCard title="Status BPKB" icon={FileBadge}>
          <div className="space-y-3">
            <CountBar
              label="Belum Jadi (Tgl Jadi BPKB kosong)"
              value={summary.bpkb?.BELUM_JADI || 0}
              total={summary.total || 1}
              color="bg-danger"
            />
            <CountBar
              label="Belum Diambil (BPKB jadi, belum diserahkan)"
              value={summary.bpkb?.BELUM_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-warning"
            />
            <CountBar
              label="Sudah Diambil / Closed"
              value={summary.bpkb?.SUDAH_DIAMBIL || 0}
              total={summary.total || 1}
              color="bg-success"
            />
          </div>
        </SectionCard>
      </div>



      {/* Distribusi BPKB Belum Jadi per Leasing */}
      <SectionCard title="Distribusi BPKB Belum Jadi per Leasing" icon={FileBadge}>
        {(data?.byFinance || []).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byFinance}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    onClick={(data) => {
                      if (data && data.name) {
                        setFilters((prev) => ({ ...prev, finance_company: data.name }))
                        setTimeout(() => void loadData(), 0)
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {data.byFinance.map((entry, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    formatter={(value, name) => [`${value} unit`, financeShortName(name) || name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Custom Legend Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted font-semibold uppercase text-left">
                    <th className="pb-2">Leasing</th>
                    <th className="pb-2 text-right">Jumlah</th>
                    <th className="pb-2 text-right">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const totalLeasing = data.byFinance.reduce((sum, item) => sum + item.count, 0) || 1
                    return data.byFinance.map((row, idx) => {
                      const pct = ((row.count / totalLeasing) * 100).toFixed(1)
                      return (
                        <tr
                          key={row.name}
                          className="hover:bg-hover cursor-pointer text-text font-medium"
                          onClick={() => {
                            setFilters((prev) => ({ ...prev, finance_company: row.name }))
                            setTimeout(() => void loadData(), 0)
                          }}
                        >
                          <td className="py-2 flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="font-semibold">{financeShortName(row.name) || row.name}</span>
                          </td>
                          <td className="py-2 text-right font-bold tabular-nums">{row.count} unit</td>
                          <td className="py-2 text-right text-muted font-medium tabular-nums">{pct}%</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-faint py-4 text-center">Belum ada data leasing.</p>
        )}
      </SectionCard>

      {/* Biro Jasa breakdown */}
      <SectionCard
        title="Per Biro Jasa (STNK/BPKB Belum Jadi)"
        icon={Briefcase}
        action={<span className="text-sm font-semibold text-muted">{(data?.byBirojasa || []).length} biro jasa</span>}
      >
        {(data?.byBirojasa || []).length > 0 ? (
          <>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-hover">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted">Biro Jasa</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">STNK Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">Plat Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">BPKB Belum Jadi</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-rose-600">BPKB Overdue</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byBirojasa.map((row) => {
                    const total = row.stnk_belum_jadi + row.bpkb_belum_jadi
                    return (
                      <tr
                        key={row.name}
                        className="hover:bg-hover cursor-pointer"
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, birojasa: row.name }))
                          setTimeout(() => void loadData(), 0)
                        }}
                      >
                        <td className="px-3 py-2.5 text-text font-medium">{row.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.stnk_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-danger-soft text-danger font-semibold text-xs">{row.stnk_belum_jadi}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.plat_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-warning-soft text-warning font-semibold text-xs">{row.plat_belum_jadi}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.bpkb_belum_jadi > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-accent-soft text-accent-text font-semibold text-xs">{row.bpkb_belum_jadi}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.bpkb_overdue > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-xs">{row.bpkb_overdue}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-text tabular-nums">{total}</td>
                      </tr>
                    )
                  })}
                  {/* Summary Row */}
                  {(() => {
                    const totalStnk = data.byBirojasa.reduce((sum, r) => sum + r.stnk_belum_jadi, 0)
                    const totalPlat = data.byBirojasa.reduce((sum, r) => sum + r.plat_belum_jadi, 0)
                    const totalBpkb = data.byBirojasa.reduce((sum, r) => sum + r.bpkb_belum_jadi, 0)
                    const totalOverdue = data.byBirojasa.reduce((sum, r) => sum + r.bpkb_overdue, 0)
                    const grandTotal = data.byBirojasa.reduce((sum, r) => sum + r.stnk_belum_jadi + r.bpkb_belum_jadi, 0)
                    return (
                      <tr className="bg-hover font-bold border-t-2 border-border">
                        <td className="px-3 py-3 text-text uppercase tracking-wider text-xs">Total Akumulasi</td>
                        <td className="px-3 py-3 text-right tabular-nums text-danger">{totalStnk.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-warning">{totalPlat.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-accent-text">{totalBpkb.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-rose-700">{totalOverdue.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-strong">{grandTotal.toLocaleString('id-ID')}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-faint py-4 text-center">Belum ada data biro jasa. Semua unit sudah selesai.</p>
        )}
      </SectionCard>

      {/* Anomali Section */}
      <SectionCard
        title="Dokumen Perlu Perhatian"
        icon={AlertTriangle}
        action={
          <button
            onClick={() => setAnomalyExpanded(!anomalyExpanded)}
            className="text-faint hover:text-muted transition-colors"
          >
            {anomalyExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        }
      >
        {anomalyExpanded && (
          <>
            <div className="flex gap-1 p-1 bg-hover rounded-xl mb-4">
              {[
                { key: 'stnkBelumJadi', label: `STNK Belum Jadi (${anomalies.stnkBelumJadiBelumFollowup?.count || 0})` },
                { key: 'stnkSudahJadi', label: `STNK Belum Diserahkan (${anomalies.stnkSudahJadiBelumDiambil?.count || 0})` },
                { key: 'bpkbOverdue', label: `BPKB Overdue >180 Hari (${anomalies.bpkbOverdue?.count || 0})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveAnomalyTab(tab.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeAnomalyTab === tab.key
                      ? 'bg-panel text-accent-text shadow-sm'
                      : 'text-muted hover:text-text'
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
                emptyMessage="Semua STNK dalam proses sudah ditindaklanjuti. ✅"
              />
            )}
            {activeAnomalyTab === 'stnkSudahJadi' && (
              <AnomalyTable
                rows={anomalies.stnkSudahJadiBelumDiambil?.rows || []}
                columns={STNK_BELUM_DIAMBIL_COLUMNS}
                emptyMessage="Semua STNK yang sudah selesai telah diserahkan ke konsumen. ✅"
              />
            )}
            {activeAnomalyTab === 'bpkbOverdue' && (
              <AnomalyTable
                rows={anomalies.bpkbOverdue?.rows || []}
                columns={BPKB_OVERDUE_COLUMNS}
                emptyMessage="Tidak ada BPKB yang melewati batas waktu 180 hari. ✅"
              />
            )}
          </>
        )}
      </SectionCard>

      {/* Top Pending BPKB */}
      <SectionCard
        title={`BPKB Tertunda Paling Lama (${topPendingBpkb.count} unit)`}
        icon={Clock}
      >
        <AnomalyTable
          rows={topPendingBpkb.rows || []}
          columns={[
            { key: 'engine_number', label: 'No Mesin', render: (r) => <span className="font-mono text-xs">{r.engine_number}</span> },
            { key: 'stnk_name', label: 'Nama' },
            { key: 'series', label: 'Series' },
            { key: 'customer_type', label: 'Tipe', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.customer_type === 'CASH' ? 'bg-success-soft text-success' : 'bg-indigo-100 text-indigo-700'}`}>{r.customer_type}</span> },
            { key: 'finance_company', label: 'Leasing', render: (r) => r.finance_company_short || <span className="text-faint">CASH</span> },
            { key: 'birojasa', label: 'Birojasa' },
            { key: 'tgl_mohon_faktur', label: 'Tgl Mohon Faktur', render: (r) => formatTanggalIndo(r.tgl_mohon_faktur) },
            {
              key: 'days_pending',
              label: 'Hari Pending',
              align: 'right',
              render: (r) => <span className={r.days_pending > 90 ? 'text-danger font-bold' : r.days_pending > 30 ? 'text-warning' : 'text-text'}>{r.days_pending} hari</span>,
            },

          ]}
          emptyMessage="Tidak ada BPKB pending."
        />
      </SectionCard>
    </div>
  )
}
