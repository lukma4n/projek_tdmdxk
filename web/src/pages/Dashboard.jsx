import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import {
  Wrench, Phone, Package, AlertTriangle, CheckCircle, Clock,
  DollarSign, ArrowRight, Loader2, Database, TrendingUp, TrendingDown,
  RefreshCw, Bell
} from 'lucide-react'

function formatDateTime(value) {
  if (!value) return 'Belum pernah import'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatCard({ label, value, icon: Icon, colorClass, borderClass, iconBgClass, trend }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderClass} bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`text-3xl font-black ${colorClass} tabular-nums truncate`} title={value}>{value}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBgClass} shadow-sm`}>
          <Icon size={24} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend.isPositive ? (
            <TrendingUp size={14} className="text-emerald-500" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
          <span className={`text-xs font-semibold ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.text}
          </span>
          <span className="text-xs text-slate-400 font-medium">vs kemarin</span>
        </div>
      )}
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

function SectionCard({ title, icon: Icon, colorClass = "text-blue-600", bgClass = "bg-blue-50", badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgClass} ${colorClass}`}>
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
        </div>
        {badge > 0 && (
          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${bgClass} ${colorClass}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 p-4 flex flex-col">
        {children}
      </div>
    </div>
  )
}

const formatTrendPct = (trend) => {
  if (!trend || trend.previous === 0) {
    if (!trend || trend.current === 0) return null
    return { text: 'Baru', isPositive: trend.current > 0 }
  }
  const pct = Math.round((trend.delta / trend.previous) * 100)
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, isPositive: pct >= 0 }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { setLastSync, setAlerts } = useAppStore()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const data = await api.getDashboard()
      setSummary(data)
      setLastSync(new Date().toISOString())
      setAlerts(data.alerts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
          <p className="text-sm text-slate-500">Memuat data dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadDashboard} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const criticalCount = summary?.alerts?.critical?.length || 0
  const attentionCount = summary?.alerts?.attention?.length || 0

  const cards = [
    {
      label: 'WO Hari Ini',
      value: (summary?.totalWO || 0).toLocaleString('id-ID'),
      icon: Wrench,
      colorClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      iconBgClass: 'bg-blue-100 text-blue-600',
      trend: formatTrendPct(summary?.trend?.totalWO),
    },
    {
      label: 'Revenue Hari Ini',
      value: `Rp ${(summary?.revenue || 0).toLocaleString('id-ID')}`,
      icon: DollarSign,
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-emerald-100 text-emerald-600',
      trend: formatTrendPct(summary?.trend?.revenue),
    },
    {
      label: 'Hotline Pending',
      value: (summary?.totalHotline || 0).toLocaleString('id-ID'),
      icon: Phone,
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'WO Open',
      value: (summary?.openWO || 0).toLocaleString('id-ID'),
      icon: Clock,
      colorClass: 'text-purple-700',
      borderClass: 'border-purple-200',
      iconBgClass: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Stok Kritis > 365h',
      value: (summary?.criticalStock || 0).toLocaleString('id-ID'),
      icon: Package,
      colorClass: 'text-red-700',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-red-100 text-red-600',
    },
    {
      label: 'Stok > 180h',
      value: (summary?.attentionStock || 0).toLocaleString('id-ID'),
      icon: AlertTriangle,
      colorClass: 'text-orange-700',
      borderClass: 'border-orange-200',
      iconBgClass: 'bg-orange-100 text-orange-600',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Bengkel</h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan operasional bengkel dan sparepart DXK</p>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <RefreshCw size={16} /> Refresh Data
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard 
          title="Alert Kritis" 
          icon={AlertTriangle} 
          colorClass="text-red-600" 
          bgClass="bg-red-100"
          badge={criticalCount}
        >
          <div className="space-y-2 flex-1">
            {(summary?.alerts?.critical || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-md">
                  {alert.type === 'stock' ? 'Stok' : alert.type === 'workshop' ? 'WO' : alert.type}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
                  {alert.message}
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
            {(summary?.alerts?.critical || []).length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400">
                <CheckCircle size={32} className="text-emerald-500 mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada alert kritis</p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard 
          title="Perlu Perhatian" 
          icon={Bell} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-100"
          badge={attentionCount}
        >
          <div className="space-y-2 flex-1">
            {(summary?.alerts?.attention || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
                  {alert.type === 'stock' ? 'Stok' : alert.type === 'workshop' ? 'WO' : alert.type}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
                  {alert.message}
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
            {(summary?.alerts?.attention || []).length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400">
                <CheckCircle size={32} className="text-emerald-500 mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada peringatan</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Freshness */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Database size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Freshness Data Bengkel</h2>
            <p className="text-xs text-slate-500 mt-0.5">Status import terakhir per modul</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(summary?.freshness || []).map((item) => (
            <div key={item.module} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between group hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{item.label}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                    {(item.total_rows || 0).toLocaleString('id-ID')} baris
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-sm mb-1">{formatDateTime(item.last_import_at)}</p>
                {item.filename && (
                  <p className="text-[10px] text-slate-400 truncate mb-3" title={item.filename}>
                    {item.filename}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold pt-3 border-t border-slate-200">
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  OK {item.rows_success || 0}
                </span>
                {item.rows_error > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Error {item.rows_error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
