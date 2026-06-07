import { useEffect, useState, useCallback, useRef } from 'react'
import { getSalesDashboard, exportSalesDashboard } from '../services/api/showroom'
import { toPng } from 'html-to-image'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  CreditCard,
  Bike,
  BarChart3,
  Download,
  ChevronDown,
  ChevronUp,
  Camera,
  LayoutDashboard,
  MapPin,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Zap,
} from 'lucide-react'

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function formatTanggalIndo(dateStr) {
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
        <span className="font-bold text-slate-800 tabular-nums">{value} unit</span>
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
          {subtext && <p className="text-sm text-slate-500">{subtext}</p>}
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

function TeamCard({ team, total, salesmen }) {
  const [expanded, setExpanded] = useState(false)
  const maxCount = Math.max(...salesmen.map((s) => s.count), 1)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
            {team.charAt(0)}
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-800 text-sm">TEAM {team}</p>
            <p className="text-xs text-slate-500">{salesmen.length} salesman</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-blue-700 tabular-nums">{total}</span>
          {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="p-4 space-y-3 bg-white">
          {salesmen.map((s) => (
            <div key={s.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{s.name}</span>
                <span className="font-bold text-slate-800 tabular-nums">{s.count} unit</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ShowroomSalesDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [screenshotting, setScreenshotting] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const activeTabRef = useRef(activeTab)
  const reportRef = useRef(null)
  const today = getTodayStr()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [closingDate, setClosingDate] = useState(today)
  const [target, setTarget] = useState('')

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const currentTab = activeTabRef.current
      const params = currentTab === 'dashboard'
        ? { from, to, target: target || undefined }
        : { from: closingDate, to: closingDate }
      const result = await getSalesDashboard(params)
      setData(result)
    } catch (err) {
      setError(err.message || `Gagal memuat data ${currentTab === 'dashboard' ? 'dashboard penjualan' : 'closing harian'}`)
    } finally {
      setLoading(false)
    }
  }, [from, to, closingDate, target])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleShortcut = (type) => {
    let f, toDate
    if (type === 'today') {
      f = getTodayStr()
      toDate = f
    } else if (type === 'yesterday') {
      f = getYesterdayStr()
      toDate = f
    } else if (type === 'month') {
      const d = new Date()
      d.setDate(1)
      f = d.toISOString().split('T')[0]
      toDate = getTodayStr()
    }
    setFrom(f)
    setTo(toDate)
  }

  const handleClosingShortcut = (type) => {
    if (type === 'today') {
      setClosingDate(getTodayStr())
    } else if (type === 'yesterday') {
      setClosingDate(getYesterdayStr())
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = activeTab === 'dashboard' ? { from, to } : { from: closingDate, to: closingDate }
      const blob = await exportSalesDashboard(params)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Closing_Harian_${activeTab === 'dashboard' ? `${from}_${to}` : closingDate}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengekspor: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  const handleScreenshot = async () => {
    if (!reportRef.current) return
    try {
      setScreenshotting(true)
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: false,
      })
      const link = document.createElement('a')
      link.download = `Closing_Harian_${closingDate}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Screenshot error:', err)
      alert('Gagal membuat gambar: ' + (err.message || 'Unknown error'))
    } finally {
      setScreenshotting(false)
    }
  }

  // Only show full loading/error screen on initial load (no data yet).
  // During refresh, keep the UI mounted so native date pickers don't close.
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
          <p className="text-sm text-slate-500">Memuat data closing harian...</p>
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

  const summary = data?.summary || {}

  // ── Dashboard Tab: Period-Only Data ──
  const maxModelPeriod = Math.max(...(data?.byModelPeriod || []).map((d) => d.count), 1)

  const dashboardStatCards = [
    {
      label: 'Closing DO',
      value: summary.closingDo || 0,
      subtext: formatTanggalIndo(data?.period?.from),
      icon: Bike,
      colorClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      iconBgClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Cash',
      value: summary.cashCount || 0,
      subtext: `${summary.cashPercent || 0}%`,
      icon: TrendingUp,
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Kredit',
      value: summary.creditCount || 0,
      subtext: `${summary.creditPercent || 0}%`,
      icon: CreditCard,
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Grand Total',
      value: summary.closingDo || 0,
      subtext: `Periode ${formatTanggalIndo(data?.period?.from)} ${data?.period?.from !== data?.period?.to ? `- ${formatTanggalIndo(data?.period?.to)}` : ''}`,
      icon: BarChart3,
      colorClass: 'text-slate-700',
      borderClass: 'border-slate-200',
      iconBgClass: 'bg-slate-100 text-slate-600',
    },
  ]

  // ── Closing Report Tab: Kumulatif Data ──

  const closingStatCards = [
    {
      label: 'Closing DO',
      value: summary.closingDo || 0,
      subtext: formatTanggalIndo(data?.period?.from),
      icon: Bike,
      colorClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      iconBgClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Cash',
      value: summary.cashCount || 0,
      subtext: `${summary.cashPercent || 0}%`,
      icon: TrendingUp,
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Kredit',
      value: summary.creditCount || 0,
      subtext: `${summary.creditPercent || 0}%`,
      icon: CreditCard,
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Grand Total',
      value: summary.grandTotal || 0,
      subtext: (() => {
        const f = new Date(data?.period?.from || '')
        const t = new Date(data?.period?.to || '')
        const isSameMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()
        if (isSameMonth) {
          return `Kumulatif s/d ${formatTanggalIndo(data?.period?.to)}`
        }
        return `Periode ${formatTanggalIndo(data?.period?.from)} - ${formatTanggalIndo(data?.period?.to)}`
      })(),
      icon: BarChart3,
      colorClass: 'text-slate-700',
      borderClass: 'border-slate-200',
      iconBgClass: 'bg-slate-100 text-slate-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Refresh indicator — subtle, doesn't unmount inputs */}
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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' ? 'Dashboard Penjualan' : 'Laporan Closing Harian'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'dashboard'
              ? 'Analisis penjualan showroom DXK per periode'
              : 'Laporan harian siap screenshot untuk share ke tim marketing'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'dashboard' ? (
            <>
              {/* Dashboard: Range date picker */}
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
              />
              <span className="text-slate-400 text-sm font-medium">s/d</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
              />
              <button onClick={() => handleShortcut('today')} className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Hari Ini
              </button>
              <button onClick={() => handleShortcut('yesterday')} className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                Kemarin
              </button>
              <button onClick={() => handleShortcut('month')} className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                Bulan Ini
              </button>
              {/* Target input */}
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-600" />
                <input
                  type="number"
                  placeholder="Target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                />
              </div>
            </>
          ) : (
            <>
              {/* Closing: Single date picker */}
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
              />
              <button onClick={() => handleClosingShortcut('today')} className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Hari Ini
              </button>
              <button onClick={() => handleClosingShortcut('yesterday')} className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                Kemarin
              </button>
            </>
          )}
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
          {activeTab === 'closing' && (
            <button
              onClick={handleScreenshot}
              disabled={screenshotting}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm disabled:opacity-50"
            >
              <Camera size={16} />
              {screenshotting ? 'Menyimpan...' : 'Screenshot'}
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard Penjualan
        </button>
        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'closing'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt size={18} />
          Laporan Closing Harian
        </button>
      </div>

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardStatCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          {/* Period Comparison */}
          {data?.comparison && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Closing DO vs Bulan Lalu',
                  current: summary.closingDo || 0,
                  prev: data.comparison.prevTotal || 0,
                  growth: data.comparison.growthPercent || 0,
                  color: data.comparison.growthPercent >= 0 ? 'text-emerald-700' : 'text-red-700',
                  bg: data.comparison.growthPercent >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
                },
                {
                  label: 'Cash vs Bulan Lalu',
                  current: summary.cashCount || 0,
                  prev: data.comparison.prevCash || 0,
                  growth: data.comparison.cashGrowthPercent || 0,
                  color: data.comparison.cashGrowthPercent >= 0 ? 'text-emerald-700' : 'text-red-700',
                  bg: data.comparison.cashGrowthPercent >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
                },
                {
                  label: 'Kredit vs Bulan Lalu',
                  current: summary.creditCount || 0,
                  prev: data.comparison.prevCredit || 0,
                  growth: data.comparison.creditGrowthPercent || 0,
                  color: data.comparison.creditGrowthPercent >= 0 ? 'text-emerald-700' : 'text-red-700',
                  bg: data.comparison.creditGrowthPercent >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${item.bg}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <div className="flex items-end gap-3 mt-2">
                    <p className="text-2xl font-black text-slate-800 tabular-nums">{item.current.toLocaleString('id-ID')}</p>
                    <div className={`flex items-center gap-1 text-xs font-bold ${item.color} mb-1`}>
                      {item.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {item.growth}%
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Bulan lalu: {item.prev.toLocaleString('id-ID')} unit</p>
                </div>
              ))}
            </div>
          )}

          {/* Master Sales Coverage */}
          {summary.totalActiveSales != null && (
            <div className="grid grid-cols-1 gap-4">
              <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sales Aktif di Master</p>
                <p className="text-3xl font-black text-purple-700 tabular-nums mt-2">{summary.totalActiveSales}</p>
              </div>
            </div>
          )}

          {/* Daily Trend Chart */}
          <SectionCard title="Trend Penjualan Harian" icon={Activity}>
            {(data?.dailyTrend || []).length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(str) => {
                        const d = new Date(str)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                      stroke="#94a3b8"
                      fontSize={12}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value, name) => [`${value} unit`, name]}
                    />
                    <Line type="monotone" dataKey="count" name="Total" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} />
                    <Line type="monotone" dataKey="cash" name="Cash" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                    <Line type="monotone" dataKey="credit" name="Kredit" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Tidak ada data untuk periode ini.</p>
            )}
          </SectionCard>

          {/* Area vs Model Correlation */}
          <SectionCard title="Korelasi Area vs Model" icon={BarChart3}>
            {(data?.areaModelCorrelation || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Area</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Model</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.areaModelCorrelation || []).map((row) => (
                    <tr key={`${row.area}-${row.model}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-700">{row.area}</td>
                      <td className="py-2 px-3 text-slate-600">{row.model}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800 tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Belum ada data korelasi area-model untuk periode ini.</p>
            )}
          </SectionCard>

          {/* Productivity & Gap Analysis */}
          {data?.analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-indigo-600" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produktivitas</p>
                </div>
                <p className="text-2xl font-black text-indigo-700 tabular-nums">{data.analysis.avgUnitsPerSales || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Unit / Sales per periode</p>
                <p className="text-xs text-slate-400 mt-1">Rata-rata {data.analysis.avgUnitsPerDay || 0} unit/hari</p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-blue-600" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Proyeksi Akhir Bulan</p>
                </div>
                <p className="text-2xl font-black text-blue-700 tabular-nums">{(data.analysis.projectedMonthEnd || 0).toLocaleString('id-ID')}</p>
                <p className="text-xs text-slate-500 mt-1">Estimasi jika pace tetap</p>
                <p className="text-xs text-slate-400 mt-1">{data.analysis.daysRemaining || 0} hari tersisa</p>
              </div>

              {data.analysis.target > 0 && (
                <div className={`rounded-2xl border p-5 shadow-sm ${data.analysis.gap <= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className={data.analysis.gap <= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Target vs Gap</p>
                  </div>
                  <p className="text-2xl font-black tabular-nums">
                    <span className={data.analysis.gap <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{data.analysis.gap <= 0 ? '+' : ''}{data.analysis.gap}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {data.analysis.gap <= 0 ? 'Target tercapai! 🎉' : `Butuh ${data.analysis.dailyRequired} unit/hari untuk target ${data.analysis.target}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Team Performance */}
          <SectionCard
            title="Team Performance"
            icon={Users}
            action={<span className="text-sm font-semibold text-slate-500">{data?.byTeamPeriod?.length || 0} Team</span>}
          >
            {(data?.byTeamPeriod || []).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.byTeamPeriod || []).map((team) => (
                  <TeamCard key={team.team} {...team} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Belum ada data team untuk periode ini.</p>
            )}
          </SectionCard>

          {/* Cash & Credit + Leasing + Top Model */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SectionCard title="Sales Type" icon={CreditCard}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                        <TrendingUp size={18} />
                      </div>
                      <span className="font-bold text-emerald-800">Cash</span>
                    </div>
                    <p className="text-3xl font-black text-emerald-700 tabular-nums">
                      {(summary.cashCount || 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-emerald-600 mt-1">
                      {summary.cashPercent || 0}% dari total periode
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <CreditCard size={18} />
                      </div>
                      <span className="font-bold text-amber-800">Kredit</span>
                    </div>
                    <p className="text-3xl font-black text-amber-700 tabular-nums">
                      {(summary.creditCount || 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-amber-600 mt-1">
                      {summary.creditPercent || 0}% dari total periode
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Leasing Breakdown (% dari Total Kredit)" icon={CreditCard}>
                {(data?.byLeasingPeriod || []).length > 0 ? (
                <div className="space-y-4">
                  {(data?.byLeasingPeriod || []).map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="text-xs text-slate-400">{item.percent}%</span>
                        </div>
                        <span className="font-bold text-slate-800 tabular-nums">{item.count} unit</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor:
                              item.name === 'FIF' ? '#2563eb' :
                              item.name === 'OTO' ? '#f59e0b' :
                              item.name === 'ADIRA' ? '#10b981' :
                              item.name === 'IMFI' ? '#8b5cf6' :
                              '#94a3b8',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">Belum ada data leasing untuk periode ini.</p>
                )}
              </SectionCard>
            </div>

            <SectionCard title="Unit Paling Laku (Top Model)" icon={BarChart3}>
              {(data?.byModelPeriod || []).length > 0 ? (
                <div className="space-y-4">
                  {(data?.byModelPeriod || []).map((item) => (
                    <CountBar key={item.name} label={item.name} value={item.count} total={maxModelPeriod} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">Belum ada data model untuk periode ini.</p>
              )}
            </SectionCard>
          </div>

          {/* Kabupaten & Kecamatan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Top Kabupaten" icon={MapPin}>
              {(data?.byKabupatenPeriod || []).length > 0 ? (
                <div className="space-y-4">
                  {(data?.byKabupatenPeriod || []).map((item) => (
                    <CountBar key={item.name} label={item.name} value={item.count} total={Math.max(...(data?.byKabupatenPeriod || []).map((d) => d.count), 1)} color="bg-purple-500" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">Belum ada data area untuk periode ini.</p>
              )}
            </SectionCard>
            <SectionCard title="Top Kecamatan" icon={MapPin}>
              {(data?.byKecamatanPeriod || []).length > 0 ? (
                <div className="space-y-4">
                  {(data?.byKecamatanPeriod || []).map((item) => (
                    <CountBar key={item.name} label={item.name} value={item.count} total={Math.max(...(data?.byKecamatanPeriod || []).map((d) => d.count), 1)} color="bg-teal-500" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">Belum ada data kecamatan untuk periode ini.</p>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ─── CLOSING REPORT TAB ─── */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          {/* Report Container for Screenshot */}
          <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200">
            {/* Report Header */}
            <div className="text-center pb-4 border-b-2 border-slate-800">
              <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">
                LAPORAN CLOSINGAN HARIAN
              </h2>
              <h3 className="text-lg font-bold text-slate-800 mt-1 uppercase">
                CABANG KETAPANG 2026
              </h3>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Tanggal: {formatTanggalIndo(data?.period?.from)}
              </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {closingStatCards.map((card) => (
                <div key={card.label} className={`rounded-xl border ${card.borderClass} bg-white p-4 shadow-sm`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
                      <p className={`text-2xl font-black ${card.colorClass} tabular-nums`}>{(card.value || 0).toLocaleString('id-ID')}</p>
                      {card.subtext && <p className="text-[10px] text-slate-500 leading-tight">{card.subtext}</p>}
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBgClass} shadow-sm`}>
                      <card.icon size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Master Sales Coverage */}
            {summary.totalActiveSales != null && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-purple-700">Sales Terdaftar</p>
                  <p className="text-xl font-black text-purple-700 mt-1">{(summary.totalActiveSales || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-lg border border-success-200 bg-success-50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-success-700">Sudah Closing</p>
                  <p className="text-xl font-black text-success-700 mt-1">{(summary.salesWithClosing || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}

            {/* Team Performance */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
                <Users size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-800">Team Performance (Kumulatif Bulan Ini)</h3>
                <span className="text-xs text-slate-500 ml-auto">{data?.byTeam?.length || 0} Team</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data?.byTeam || []).map((team) => (
                  <div key={team.team} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 font-bold text-xs">
                          {team.team.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">TEAM {team.team}</p>
                          <p className="text-[10px] text-slate-500">{team.salesmen.length} salesman</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-blue-700 tabular-nums">{team.total}</span>
                    </div>
                    <div className="p-3 space-y-2 bg-white">
                      {team.salesmen.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{s.name}</span>
                          <span className="font-bold text-slate-800 tabular-nums">{s.count} unit</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cash & Credit + Leasing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Cash & Kredit cards */}
              <div className="grid grid-cols-2 gap-3 content-start">
                <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                      <TrendingUp size={16} />
                    </div>
                    <span className="font-bold text-emerald-800 text-sm">Cash</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">
                    {(data?.summary?.cashMonthCount || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {data?.summary?.cashMonthPercent || 0}% dari total
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                      <CreditCard size={16} />
                    </div>
                    <span className="font-bold text-amber-800 text-sm">Kredit</span>
                  </div>
                  <p className="text-2xl font-black text-amber-700 tabular-nums">
                    {(data?.summary?.creditMonthCount || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    {data?.summary?.creditMonthPercent || 0}% dari total
                  </p>
                </div>
              </div>

              {/* Right: Leasing Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <CreditCard size={16} className="text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Leasing Breakdown</h3>
                </div>
                <div className="space-y-3">
                  {(data?.byLeasing || []).map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.percent}%</span>
                        </div>
                        <span className="font-bold text-slate-800 tabular-nums">{item.count} unit</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor:
                              item.name === 'FIF' ? '#2563eb' :
                              item.name === 'OTO' ? '#f59e0b' :
                              item.name === 'ADIRA' ? '#10b981' :
                              item.name === 'IMFI' ? '#8b5cf6' :
                              '#94a3b8',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail Transaksi */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
                <Receipt size={16} className="text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Detail Transaksi</h3>
                <span className="text-xs text-slate-500 ml-auto">{(data?.transactions || []).length} transaksi</span>
              </div>
              {(data?.transactions || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">SO Number</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Tanggal</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500 whitespace-nowrap">Coordinator</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Sales</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Customer</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Tipe</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Model</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Leasing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data?.transactions || []).map((tx) => (
                        <tr key={tx.so_number} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-mono text-slate-700">{tx.so_number}</td>
                          <td className="py-1.5 px-2 text-slate-600">{formatTanggalIndo(tx.so_date)}</td>
                          <td className="py-1.5 px-2 text-slate-600 text-[10px]">{tx.sales_coord_name || '-'}</td>
                          <td className="py-1.5 px-2 font-medium text-slate-700">{tx.salesman || '-'}</td>
                          <td className="py-1.5 px-2 text-slate-600">{tx.customer_name || '-'}</td>
                          <td className="py-1.5 px-2 text-slate-600">{tx.type || '-'}</td>
                          <td className="py-1.5 px-2 text-slate-600">{tx.model || '-'}</td>
                          <td className="py-1.5 px-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              tx.sales_type === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {tx.sales_type || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">Tidak ada transaksi untuk tanggal ini.</p>
              )}
            </div>

            {/* Market by Area */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
                <MapPin size={16} className="text-purple-600" />
                <h3 className="font-bold text-slate-800 text-sm">Market by Area</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Top Kabupaten</p>
                  <div className="space-y-2">
                    {(data?.byKabupaten || []).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate max-w-[130px]">{item.name}</span>
                        <span className="font-bold text-slate-800 tabular-nums">{item.count} unit</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Top Kecamatan</p>
                  <div className="space-y-2">
                    {(data?.byKecamatan || []).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate max-w-[130px]">{item.name}</span>
                        <span className="font-bold text-slate-800 tabular-nums">{item.count} unit</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
