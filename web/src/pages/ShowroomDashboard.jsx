import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { AlertTriangle, BatteryCharging, Bike, FileBadge, FileText, Loader2, MapPin, RefreshCw, Timer, TrendingUp, Bell } from 'lucide-react'

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function CountBar({ label, value, total, color = 'bg-accent' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted truncate font-medium">{label || '-'}</span>
        <span className="font-bold text-text tabular-nums">{value}</span>
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

function StatCard({ label, value, icon: Icon, colorClass, borderClass, iconBgClass }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderClass} bg-panel p-5 shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className={`text-3xl font-black ${colorClass} tabular-nums`}>{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgClass} shadow-sm`}>
          <Icon size={24} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-panel rounded-xl border border-border shadow-sm p-6 space-y-5 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="font-bold text-text text-lg">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ShowroomDashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      setSummary(await api.getShowroomDashboard())
    } catch (err) {
      setError(err.message || 'Gagal memuat dashboard showroom')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data showroom...</p>
        </div>
      </div>
    )
  }

  if (error) {
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

  const cards = [
    {
      label: 'Total Unit',
      value: summary?.totalUnits || 0,
      icon: Bike,
      colorClass: 'text-accent-text',
      borderClass: 'border-accent-soft',
      iconBgClass: 'bg-accent-soft text-accent',
    },
    {
      label: 'Aging ≥ 60 Hari',
      value: summary?.aging60 || 0,
      icon: Timer,
      colorClass: 'text-warning',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-warning-soft text-warning',
    },
    {
      label: 'Aging ≥ 90 Hari',
      value: summary?.aging90 || 0,
      icon: AlertTriangle,
      colorClass: 'text-danger',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-danger-soft text-danger',
    },
    {
      label: 'STNK / BPKB',
      value: `${summary?.totalStnk || 0} / ${summary?.totalBpkb || 0}`,
      icon: FileText,
      colorClass: 'text-success',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-success-soft text-success',
    },
    {
      label: 'KSU Perlu Tindakan',
      value: (summary?.ksu?.belum_dicek || 0) + (summary?.ksu?.belum_lengkap || 0) + (summary?.ksu?.battery_mismatch || 0),
      icon: Bell,
      colorClass: 'text-accent',
      borderClass: 'border-purple-200',
      iconBgClass: 'bg-accent-soft text-accent',
    },
    {
      label: 'Kebutuhan Aki',
      value: summary?.ksu?.required_items?.battery || 0,
      icon: BatteryCharging,
      colorClass: 'text-text',
      borderClass: 'border-border',
      iconBgClass: 'bg-hover text-muted',
    },
  ]

  const maxLocation = Math.max(...(summary?.byLocation || []).map((item) => item._count), 0)
  const maxSeries = Math.max(...(summary?.bySeries || []).map((item) => item._count), 0)
  const maxStnkLocation = Math.max(...(summary?.documents?.stnkByLocation || []).map((item) => item._count), 0)
  const maxBpkbLocation = Math.max(...(summary?.documents?.bpkbByLocation || []).map((item) => item._count), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">Dashboard Unit</h1>
          <p className="text-sm text-muted mt-1">Ringkasan stock unit, aging, lokasi, series, dan dokumen showroom DXK</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-5 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover hover:border-border-strong transition-all shadow-sm"
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="Stock Per Lokasi" icon={MapPin}>
          <div className="space-y-4">
            {(summary?.byLocation || []).map((item) => (
              <CountBar key={item.location || 'unknown'} label={item.location} value={item._count} total={maxLocation} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Stock Per Series" icon={Bike}>
          <div className="space-y-4">
            {(summary?.bySeries || []).map((item) => (
              <CountBar key={item.series || 'unknown'} label={item.series} value={item._count} total={maxSeries} color="bg-success" />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="STNK Per Lokasi" icon={FileText}>
          <div className="space-y-4">
            {(summary?.documents?.stnkByLocation || []).map((item) => (
              <CountBar key={item.stnk_location || 'unknown'} label={item.stnk_location} value={item._count} total={maxStnkLocation} color="bg-accent" />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="BPKB Per Lokasi" icon={FileBadge}>
          <div className="space-y-4">
            {(summary?.documents?.bpkbByLocation || []).map((item) => (
              <CountBar key={item.bpkb_location || 'unknown'} label={item.bpkb_location} value={item._count} total={maxBpkbLocation} color="bg-warning" />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Freshness */}
      <div className="bg-panel rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-hover text-muted">
            <TrendingUp size={20} />
          </div>
          <h2 className="font-bold text-text text-lg">Freshness Data Showroom</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { label: 'Stock Unit', value: formatDateTime(summary?.freshness?.stockUnit), color: 'text-accent', bg: 'bg-accent-soft' },
            { label: 'STNK', value: formatDateTime(summary?.freshness?.stnk), color: 'text-success', bg: 'bg-success-soft' },
            { label: 'BPKB', value: formatDateTime(summary?.freshness?.bpkb), color: 'text-warning', bg: 'bg-warning-soft' },
            { label: 'Master Harga', value: formatDateTime(summary?.freshness?.price), color: 'text-accent', bg: 'bg-accent-soft', sub: `Berlaku ${formatDateTime(summary?.freshness?.priceEffectiveDate)}` },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-xl p-4 border border-border`}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{item.label}</p>
              <p className={`font-bold ${item.color}`}>{item.value}</p>
              {item.sub && <p className="text-xs text-faint mt-1">{item.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
