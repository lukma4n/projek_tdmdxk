import { useEffect, useState, useCallback } from 'react'
import { getSalesDashboard, exportSalesDashboard } from '../services/api/showroom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, ReferenceLine, BarChart, Bar } from 'recharts'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  CreditCard,
  BarChart3,
  Download,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Zap,
  Calendar,
  Award,
} from 'lucide-react'
import {
  LEASING_COLORS,
  dashboardStatCards,
  DATE_PRESETS,
  getDateRangePreset,
  teamCardTitle,
} from '../components/showroom/ShowroomSalesUtils'
import {
  StatCard,
  SectionCard,
  TeamPerformanceGroups,
  AreaBreakdownTable,
} from '../components/showroom/ShowroomSalesPrimitives'

export default function ShowroomSalesAnalysis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const initialRange = getDateRangePreset('mtd')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [activePreset, setActivePreset] = useState('mtd')
  const [target, setTarget] = useState('')
  const [visibleLines, setVisibleLines] = useState({
    count: true,
    cash: true,
    credit: true,
  })

  const handleLegendClick = useCallback((e) => {
    const { dataKey } = e
    if (!dataKey) return
    setVisibleLines((prev) => ({
      ...prev,
      [dataKey]: !prev[dataKey],
    }))
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await getSalesDashboard({ from, to, target: target || undefined })
      setData(result)
    } catch (err) {
      setError(err.message || 'Gagal memuat data analisis penjualan')
    } finally {
      setLoading(false)
    }
  }, [from, to, target])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handlePreset = (presetKey) => {
    const range = getDateRangePreset(presetKey)
    setFrom(range.from)
    setTo(range.to)
    setActivePreset(presetKey)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const blob = await exportSalesDashboard({ from, to })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Analisis_Penjualan_${from}_${to}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengekspor: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data analisis penjualan...</p>
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

  const summary = data?.summary || {}
  const stats = dashboardStatCards(summary, data?.period, data?.analysis, data?.comparison)
  
  // Transform flat areaModelCorrelation into simple horizontal layout
  const simpleChartData = (data?.areaModelCorrelation || []).slice(0, 8).map((row) => ({
    name: `${String(row.area || 'Lainnya').replace('KAB. ', '')} - ${row.model}`,
    unit: row.count,
  }))

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
          <h1 className="text-3xl font-black text-text-strong tracking-tight">
            Laporan Analisis Penjualan
          </h1>
          <p className="text-sm text-muted mt-1">
            Analisis penjualan showroom DXK per periode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value)
              setActivePreset('')
            }}
            className="px-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
          <span className="text-faint text-sm font-medium">s/d</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setActivePreset('')
            }}
            className="px-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-faint" />
            <label htmlFor="sales-period-preset" className="text-xs font-semibold text-muted">Periode</label>
            <select
              id="sales-period-preset"
              value={activePreset || 'custom'}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'custom') {
                  setActivePreset('')
                } else {
                  handlePreset(value)
                }
              }}
              className="min-w-[180px] px-3 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Target size={16} className="text-accent" />
            <input
              type="number"
              placeholder="Target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-24 px-3 py-2 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
            />
          </div>
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

      <div className="space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* Productivity & Gap Analysis */}
        {data?.analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-indigo-200 bg-accent-soft p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-accent" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Produktivitas</p>
              </div>
              <p className="text-2xl font-black text-indigo-700 tabular-nums">{data.analysis.avgUnitsPerSales || 0}</p>
              <p className="text-xs text-muted mt-1">Unit / Sales ({summary.totalActiveSales || 0} sales aktif)</p>
              <p className="text-xs text-faint mt-1">Rata-rata {data.analysis.avgUnitsPerDay || 0} unit/hari</p>
            </div>

            <div className="rounded-xl border border-accent-soft bg-accent-soft p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-accent" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Proyeksi Akhir Bulan</p>
              </div>
              <p className="text-2xl font-black text-accent-text tabular-nums">{(data.analysis.projectedMonthEnd || 0).toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-1">Estimasi jika pace tetap</p>
              <p className="text-xs text-faint mt-1">{data.analysis.daysRemaining || 0} hari kerja tersisa</p>
            </div>

            {data.analysis.target > 0 && (
              <div className={`rounded-xl border p-5 shadow-sm flex items-center justify-between gap-4 ${data.analysis.gap <= 0 ? 'border-emerald-200 bg-success-soft' : 'border-rose-200 bg-rose-50'}`}>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Target size={16} className={data.analysis.gap <= 0 ? 'text-success' : 'text-rose-600'} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Target vs Gap</p>
                  </div>
                  <p className="text-2xl font-black tabular-nums">
                    <span className={data.analysis.gap <= 0 ? 'text-success' : 'text-rose-700'}>
                      {data.analysis.gap <= 0 ? `+${Math.abs(data.analysis.gap)}` : `-${data.analysis.gap}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted leading-normal">
                    {data.analysis.gap <= 0 ? 'Target tercapai! 🎉' : `Butuh ${data.analysis.dailyRequired} unit/hari kerja untuk target ${data.analysis.target}`}
                  </p>
                </div>
                <div className="relative flex items-center justify-center shrink-0 w-20 h-20">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="32" stroke={data.analysis.gap <= 0 ? '#d1fae5' : '#fee2e2'} strokeWidth="6" fill="transparent" />
                    <circle cx="40" cy="40" r="32" stroke={data.analysis.gap <= 0 ? '#10b981' : '#f43f5e'} strokeWidth="6" fill="transparent"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min(100, data.analysis.attainmentRate || 0) / 100)}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-sm font-black text-text">
                    {data.analysis.attainmentRate || 0}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily Trend Chart */}
        <SectionCard title="Trend Penjualan Harian" icon={Activity} action={
          <span className="text-[10px] text-faint font-semibold italic">
            Klik legend untuk menyembunyikan/menampilkan grafik
          </span>
        }>
          {(data?.dailyTrend || []).length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                  <Legend onClick={handleLegendClick} wrapperStyle={{ paddingTop: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 'semibold' }} />
                  {data?.analysis?.targetPace > 0 && (
                    <ReferenceLine
                      y={data.analysis.targetPace}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Pace Target (${data.analysis.targetPace} unit/hari)`,
                        fill: '#f43f5e',
                        position: 'top',
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}
                    />
                  )}
                  <Area type="monotone" dataKey="count" name="Total" stroke="#2563eb" fill="url(#colorTotal)" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} hide={!visibleLines.count} />
                  <Area type="monotone" dataKey="cash" name="Cash" stroke="#10b981" fill="url(#colorCash)" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} hide={!visibleLines.cash} />
                  <Area type="monotone" dataKey="credit" name="Kredit" stroke="#f59e0b" fill="url(#colorCredit)" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} hide={!visibleLines.credit} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-faint">Tidak ada data untuk periode ini.</p>
          )}
        </SectionCard>

        {/* Area vs Model Correlation */}
        <SectionCard 
          title="Tipe Motor Terlaris per Kabupaten" 
          icon={BarChart3}
          action={
            <span className="text-[10px] text-faint font-semibold italic">
              Memetakan tipe motor yang paling laku di setiap wilayah
            </span>
          }
        >
          {(data?.areaModelCorrelation || []).length > 0 ? (
            <div className="space-y-4">
              {/* Quick Explanation for Laymen */}
              {data.areaModelCorrelation[0] && (
                <div className="p-4 bg-accent-soft/70 border border-accent-soft rounded-xl flex items-start gap-3 text-xs text-accent-text shadow-sm">
                  <span className="text-base shrink-0">💡</span>
                  <div className="leading-relaxed">
                    <span className="font-bold text-accent-text">Penjelasan Singkat:</span> Halaman ini membandingkan penjualan motor berdasarkan wilayah kabupaten dan tipe motornya. Saat ini, penjualan paling banyak adalah model <span className="font-bold text-accent-text underline decoration-accent">{data.areaModelCorrelation[0].model}</span> di <span className="font-bold text-accent-text">{String(data.areaModelCorrelation[0].area).replace('KAB. ', '')}</span> yaitu sebanyak <span className="font-bold text-accent-text bg-accent-soft/80 px-1.5 py-0.5 rounded">{data.areaModelCorrelation[0].count} unit</span>.
                  </div>
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Simple Horizontal Bar Chart */}
                <div className="flex-1 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={simpleChartData}
                      margin={{ left: 10, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#475569"
                        fontSize={11}
                        tickLine={false}
                        width={180}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value} unit terjual`, 'Total Penjualan']}
                      />
                      <Bar
                        dataKey="unit"
                        name="Total Penjualan"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      >
                        {simpleChartData.map((entry, index) => {
                          const colors = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff']
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Detailed Table */}
                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-faint">
                        <th className="text-left pb-2 font-semibold text-muted">Kabupaten/Kota</th>
                        <th className="text-left pb-2 font-semibold text-muted">Tipe Motor</th>
                        <th className="text-right pb-2 font-semibold text-muted">Jumlah Terjual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data?.areaModelCorrelation || []).map((row) => (
                        <tr key={`${row.area}-${row.model}`} className="hover:bg-hover transition-colors">
                          <td className="py-2.5 font-medium text-text">{String(row.area || 'Lainnya').replace('KAB. ', '')}</td>
                          <td className="py-2.5 text-muted font-semibold">{row.model}</td>
                          <td className="py-2.5 text-right font-black text-text tabular-nums">{row.count} Unit</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-faint py-4 text-center">Belum ada data korelasi area-model untuk periode ini.</p>
          )}
        </SectionCard>

        {/* Team Performance & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard
              title="Team Performance"
              icon={Users}
              action={
                <span className="text-xs font-semibold text-muted">
                  {(data?.byTeamPeriod || []).filter((t) => t.kind === 'team').length} Tim • {summary.salesWithClosing || 0}/{summary.totalActiveSales || 0} sales closing
                  <span className={`ml-2 px-2 py-0.5 rounded-full font-bold ${(summary.productiveRate || 0) >= 60 ? 'bg-success-soft text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {summary.productiveRate || 0}% produktif
                  </span>
                </span>
              }
            >
              {(data?.byTeamPeriod || []).length > 0 ? (
                <TeamPerformanceGroups
                  teams={data.byTeamPeriod}
                  posList={data.byPosPeriod || []}
                  gridClassName="grid grid-cols-1 md:grid-cols-2 gap-4"
                />
              ) : (
                <p className="text-sm text-faint py-4 text-center">Belum ada data team untuk periode ini.</p>
              )}
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Leaderboard Sales (Top 5)" icon={Award}>
              {(data?.topSalespeople || []).length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {(data?.topSalespeople || []).map((sales, idx) => {
                    const maxCount = data.topSalespeople[0].count || 1
                    const percentage = Math.round((sales.count / maxCount) * 100)
                    
                    return (
                      <div key={sales.name} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Minimalist number */}
                          <span className="text-xs font-bold text-faint w-5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-semibold text-text text-sm truncate uppercase tracking-tight">
                            {sales.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Minimal thin bar indicating ratio */}
                          <div className="w-16 h-1.5 rounded-full bg-hover overflow-hidden hidden sm:block">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-sm font-bold text-text tabular-nums w-14 text-right">
                            {sales.count} unit
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-faint py-4 text-center">Belum ada data sales untuk periode ini.</p>
              )}
              {(summary.paretoShare || 0) > 0 && (
                <p className="text-[11px] text-faint mt-3 pt-3 border-t border-border leading-relaxed">
                  📊 Konsentrasi: <span className="font-bold text-text">{summary.paretoTopPct || 0}% sales teratas</span> menyumbang <span className="font-bold text-text">{summary.paretoShare || 0}%</span> total penjualan.
                </p>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Komparasi Performa Tim vs Bulan Lalu */}
        <SectionCard title="Komparasi Performa Tim (vs Bulan Lalu)" icon={Activity}>
          {(data?.teamComparison || []).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(data.teamComparison).map((item) => (
                <div key={`${item.kind}:${item.team}`} className="p-3 bg-hover border border-border rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-accent" />
                    <span className="font-bold text-text text-xs uppercase truncate" title={teamCardTitle(item)}>{teamCardTitle(item)}</span>
                  </div>
                  {item.kind === 'team' && (item.location || item.pos) && (
                    <p className="text-[10px] text-faint uppercase">
                      {[item.location && `Pos ${item.location}`, item.pos && `Kapos ${item.pos}`].filter(Boolean).join(' • ')}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2 pt-1">
                    <p className="text-xl font-black text-text tabular-nums">{item.current}</p>
                    <div className={`flex items-center text-[10px] font-bold ${item.growth >= 0 ? 'text-success' : 'text-rose-600'}`}>
                      {item.growth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {Math.abs(item.growth)}%
                    </div>
                  </div>
                  <p className="text-[10px] text-faint">Bulan lalu: {item.prev} unit</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-faint py-4 text-center">Belum ada data perbandingan tim.</p>
          )}
        </SectionCard>

        {/* Cash & Credit + Leasing + Top Model */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-6">
            <SectionCard title="Sales Type" icon={CreditCard}>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-4 flex-1 w-full">
                  <div className="bg-success-soft border border-emerald-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-soft text-success">
                        <TrendingUp size={16} />
                      </div>
                      <span className="font-bold text-emerald-800 text-sm">Cash</span>
                    </div>
                    <p className="text-2xl font-black text-success tabular-nums">
                      {(summary.cashCount || 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-success">
                      {summary.cashPercent || 0}% dari total periode
                    </p>
                  </div>
                  <div className="bg-warning-soft border border-amber-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-soft text-warning">
                        <CreditCard size={16} />
                      </div>
                      <span className="font-bold text-amber-800 text-sm">Kredit</span>
                    </div>
                    <p className="text-2xl font-black text-warning tabular-nums">
                      {(summary.creditCount || 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-warning">
                      {summary.creditPercent || 0}% dari total periode
                    </p>
                  </div>
                </div>
                <div className="h-40 w-40 shrink-0 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Cash', value: summary.cashCount || 0 },
                          { name: 'Kredit', value: summary.creditCount || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} unit`, 'Sales']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center leading-none">
                    <span className="text-xs text-faint font-semibold uppercase tracking-wider">Total</span>
                    <span className="text-lg font-black text-text mt-0.5">{(summary.closingDo || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Leasing Performance (% dari Total Kredit)" icon={CreditCard}>
              {(data?.byLeasingPeriod || []).length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-40 w-40 shrink-0 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.byLeasingPeriod}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {(data.byLeasingPeriod).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={LEASING_COLORS[entry.name] || '#94a3b8'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} unit`, 'Penjualan']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center leading-none">
                      <span className="text-xs text-faint font-semibold uppercase tracking-wider">Kredit</span>
                      <span className="text-lg font-black text-text mt-0.5">{(summary.creditCount || 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2.5">
                    {(data.byLeasingPeriod).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: LEASING_COLORS[item.name] || '#94a3b8' }} />
                          <span className="font-semibold text-text">{item.name}</span>
                          <span className="text-xs text-faint">({item.percent}%)</span>
                        </div>
                        <span className="font-bold text-text tabular-nums">{item.count} unit</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-faint py-4 text-center">Belum ada data leasing untuk periode ini.</p>
              )}
            </SectionCard>

            <SectionCard title="Komparasi Performa Leasing (vs Bulan Lalu)" icon={Activity}>
              {(data?.leasingComparison || []).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(data.leasingComparison).map((item) => (
                    <div key={item.name} className="p-3 bg-hover border border-border rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: LEASING_COLORS[item.name] || '#94a3b8' }} />
                        <span className="font-bold text-text text-xs uppercase">{item.name}</span>
                      </div>
                      <div className="flex items-baseline gap-2 pt-1">
                        <p className="text-xl font-black text-text tabular-nums">{item.current}</p>
                        <div className={`flex items-center text-[10px] font-bold ${item.growth >= 0 ? 'text-success' : 'text-rose-600'}`}>
                          {item.growth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {Math.abs(item.growth)}%
                        </div>
                      </div>
                      <p className="text-[10px] text-faint">Bulan lalu: {item.prev} unit</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-faint py-4 text-center">Belum ada data perbandingan leasing.</p>
              )}
            </SectionCard>

          </div>

          <div className="space-y-6">
            <SectionCard title="Unit Paling Laku (Top Model)" icon={BarChart3}>
              {(data?.byModelPeriod || []).length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {(data?.byModelPeriod || []).map((item, idx) => {
                    const maxCount = data.byModelPeriod[0].count || 1
                    const percentage = Math.round((item.count / maxCount) * 100)
                    
                    return (
                      <div key={item.name} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Minimalist number */}
                          <span className="text-xs font-bold text-faint w-5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-semibold text-text text-sm truncate uppercase tracking-tight">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Minimal thin bar indicating ratio */}
                          <div className="w-16 h-1.5 rounded-full bg-hover overflow-hidden hidden sm:block">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-sm font-bold text-text tabular-nums">
                            {item.count} unit
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-faint py-4 text-center">Belum ada data model untuk periode ini.</p>
              )}
            </SectionCard>

          </div>
        </div>

        {/* Detail wilayah — tabel full-width (cash + breakdown leasing + vs bulan lalu) */}
        <SectionCard title="Penjualan per Kabupaten" icon={MapPin} collapsible defaultOpen={false} action={
          <span className="text-xs font-semibold text-muted">{data?.byKabupatenPeriod?.length || 0} kabupaten • {(data?.areaTotals?.count || 0).toLocaleString('id-ID')} unit</span>
        }>
          <AreaBreakdownTable items={data?.byKabupatenPeriod || []} totals={data?.areaTotals} stripPrefix accentColor="text-purple-700" />
        </SectionCard>

        <SectionCard title="Penjualan per Kecamatan" icon={MapPin} collapsible defaultOpen={false} action={
          <span className="text-xs font-semibold text-muted">{data?.byKecamatanPeriod?.length || 0} kecamatan • {(data?.areaTotals?.count || 0).toLocaleString('id-ID')} unit</span>
        }>
          <AreaBreakdownTable items={data?.byKecamatanPeriod || []} totals={data?.areaTotals} accentColor="text-teal-700" />
        </SectionCard>
      </div>
    </div>
  )
}
