import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { AlertTriangle, BatteryCharging, Bike, FileBadge, FileText, Loader2, MapPin, RefreshCw, Timer } from 'lucide-react'

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function CountBar({ label, value, total, color = 'bg-blue-500' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600 truncate">{label || '-'}</span>
        <span className="font-semibold text-slate-800">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
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

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-blue-600" size={28} /></div>

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-danger-400 mb-2" size={32} />
          <p className="text-danger-600">{error}</p>
          <button onClick={loadData} className="mt-2 text-sm text-blue-600 hover:underline">Coba lagi</button>
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'Total Unit', value: summary?.totalUnits || 0, icon: Bike, className: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: 'Aging >= 60 Hari', value: summary?.aging60 || 0, icon: Timer, className: 'border-warning-200 bg-warning-50 text-warning-700' },
    { label: 'Aging >= 90 Hari', value: summary?.aging90 || 0, icon: AlertTriangle, className: 'border-danger-200 bg-danger-50 text-danger-700' },
    { label: 'STNK / BPKB', value: `${summary?.totalStnk || 0} / ${summary?.totalBpkb || 0}`, icon: FileText, className: 'border-success-200 bg-success-50 text-success-700' },
    { label: 'KSU Perlu Tindakan', value: (summary?.ksu?.belum_dicek || 0) + (summary?.ksu?.belum_lengkap || 0) + (summary?.ksu?.battery_mismatch || 0), icon: BatteryCharging, className: 'border-purple-200 bg-purple-50 text-purple-700' },
    { label: 'Kebutuhan Aki', value: summary?.ksu?.required_items?.battery || 0, icon: BatteryCharging, className: 'border-slate-200 bg-slate-50 text-slate-700' },
  ]

  const maxLocation = Math.max(...(summary?.byLocation || []).map((item) => item._count), 0)
  const maxSeries = Math.max(...(summary?.bySeries || []).map((item) => item._count), 0)
  const maxStnkLocation = Math.max(...(summary?.documents?.stnkByLocation || []).map((item) => item._count), 0)
  const maxBpkbLocation = Math.max(...(summary?.documents?.bpkbByLocation || []).map((item) => item._count), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Showroom</h1>
          <p className="text-sm text-slate-500">Ringkasan stock unit, aging, lokasi, series, dan dokumen showroom DXK</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`p-4 rounded-xl border ${card.className}`}>
              <div className="flex items-center justify-between"><p className="text-xs font-medium">{card.label}</p><Icon size={18} /></div>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2"><MapPin size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">Stock Per Lokasi</h2></div>
          {(summary?.byLocation || []).map((item) => <CountBar key={item.location || 'unknown'} label={item.location} value={item._count} total={maxLocation} />)}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2"><Bike size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">Stock Per Series</h2></div>
          {(summary?.bySeries || []).map((item) => <CountBar key={item.series || 'unknown'} label={item.series} value={item._count} total={maxSeries} color="bg-success-500" />)}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2"><FileText size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">STNK Per Lokasi</h2></div>
          {(summary?.documents?.stnkByLocation || []).map((item) => <CountBar key={item.stnk_location || 'unknown'} label={item.stnk_location} value={item._count} total={maxStnkLocation} color="bg-blue-500" />)}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2"><FileBadge size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">BPKB Per Lokasi</h2></div>
          {(summary?.documents?.bpkbByLocation || []).map((item) => <CountBar key={item.bpkb_location || 'unknown'} label={item.bpkb_location} value={item._count} total={maxBpkbLocation} color="bg-warning-500" />)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Freshness Data Showroom</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-500">Stock Unit</p><p className="font-semibold text-slate-800">{formatDateTime(summary?.freshness?.stockUnit)}</p></div>
          <div><p className="text-slate-500">STNK</p><p className="font-semibold text-slate-800">{formatDateTime(summary?.freshness?.stnk)}</p></div>
          <div><p className="text-slate-500">BPKB</p><p className="font-semibold text-slate-800">{formatDateTime(summary?.freshness?.bpkb)}</p></div>
          <div><p className="text-slate-500">Master Harga</p><p className="font-semibold text-slate-800">{formatDateTime(summary?.freshness?.price)}</p><p className="text-xs text-slate-400">Berlaku {formatDateTime(summary?.freshness?.priceEffectiveDate)}</p></div>
        </div>
      </div>
    </div>
  )
}
