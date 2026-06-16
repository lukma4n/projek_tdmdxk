import { useEffect, useState, useCallback } from 'react'
import { getSalesDashboard, exportSalesDashboard } from '../services/api/showroom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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
} from 'lucide-react'
import {
  LEASING_COLORS,
  dashboardStatCards,
  DATE_PRESETS,
  getDateRangePreset,
} from '../components/showroom/ShowroomSalesUtils'
import {
  CountBar,
  StatCard,
  SectionCard,
  TeamCard,
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
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
          <p className="text-sm text-slate-500">Memuat data analisis penjualan...</p>
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
  const maxModelPeriod = Math.max(...(data?.byModelPeriod || []).map((d) => d.count), 1)
  const stats = dashboardStatCards(summary, data?.period)

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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Laporan Analisis Penjualan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
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
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
          />
          <span className="text-slate-400 text-sm font-medium">s/d</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setActivePreset('')
            }}
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
          />
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <label htmlFor="sales-period-preset" className="text-xs font-semibold text-slate-500">Periode</label>
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
              className="min-w-[180px] px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
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
            <Target size={16} className="text-blue-600" />
            <input
              type="number"
              placeholder="Target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
            />
          </div>
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

      <div className="space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((card) => (
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
                <TeamCard key={team.team} {...team} collapsible />
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
                            backgroundColor: LEASING_COLORS[item.name] || '#94a3b8',
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
    </div>
  )
}
