import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import { 
  Wrench, Phone, Package, AlertTriangle, CheckCircle, Clock,
  DollarSign, ArrowRight, Loader2, Database
} from 'lucide-react'

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
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-danger-400 mb-2" size={32} />
          <p className="text-danger-600">{error}</p>
          <button onClick={loadDashboard} className="mt-2 text-sm text-blue-600 hover:underline">Coba lagi</button>
        </div>
      </div>
    )
  }

  const summaryCards = [
    { label: 'Total WO Hari Ini', value: summary?.totalWO || 0, icon: Wrench, color: 'blue', path: '/workshop' },
    { label: 'Hotline Pending', value: summary?.totalHotline || 0, icon: Phone, color: 'warning', path: '/hotline' },
    { label: 'Stok Kritis (>365 hari)', value: summary?.criticalStock || 0, icon: Package, color: 'danger', path: '/stock' },
    { label: 'Revenue Hari Ini', value: `Rp ${(summary?.revenue || 0).toLocaleString('id-ID')}`, icon: DollarSign, color: 'success', path: '/workshop' },
  ]

  const formatDateTime = (value) => {
    if (!value) return 'Belum pernah import'
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Bengkel</h1>
          <p className="text-sm text-slate-500">Ringkasan operasional bengkel dan sparepart DXK</p>
        </div>
        <button onClick={loadDashboard} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <Clock size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          const colorMap = {
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            warning: 'bg-warning-50 text-warning-600 border-warning-200',
            danger: 'bg-danger-50 text-danger-600 border-danger-200',
            success: 'bg-success-50 text-success-600 border-success-200',
          }
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className={`p-5 rounded-xl border ${colorMap[card.color]} text-left hover:shadow-lg transition-all group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-80">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <Icon size={24} className="opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs font-medium opacity-70 group-hover:opacity-100">
                <span>Lihat detail</span>
                <ArrowRight size={12} />
              </div>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Database size={18} className="text-blue-600" />
          <div>
            <h2 className="font-semibold text-slate-800">Freshness Data</h2>
            <p className="text-xs text-slate-500">Status import terakhir per modul</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {(summary?.freshness || []).map((item) => (
            <div key={item.module} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {(item.total_rows || 0).toLocaleString('id-ID')} rows
                </span>
              </div>
              <p className="text-xs text-slate-500">Terakhir: {formatDateTime(item.last_import_at)}</p>
              {item.filename && <p className="text-xs text-slate-400 truncate" title={item.filename}>{item.filename}</p>}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-success-600">OK {item.rows_success || 0}</span>
                {item.rows_error > 0 && <span className="text-danger-600">Error {item.rows_error}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-danger-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-danger-50 border-b border-danger-200 flex items-center gap-2">
            <AlertTriangle className="text-danger-600" size={20} />
            <h2 className="font-semibold text-danger-700">Alert Kritis</h2>
          </div>
          <div className="p-4 space-y-3">
            {(summary?.alerts?.critical || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left p-4 bg-danger-50/50 hover:bg-danger-50 rounded-lg border border-danger-100 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-danger-100 rounded-md shrink-0">
                    <AlertTriangle size={14} className="text-danger-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-danger-700 text-sm">{alert.message}</p>
                  </div>
                  <ArrowRight size={14} className="text-danger-400 group-hover:text-danger-600 transition-colors shrink-0 mt-1" />
                </div>
              </button>
            ))}
            {(summary?.alerts?.critical || []).length === 0 && (
              <div className="text-center py-6">
                <CheckCircle className="mx-auto text-success-400 mb-2" size={24} />
                <p className="text-sm text-slate-500">Tidak ada alert kritis</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-warning-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-warning-50 border-b border-warning-200 flex items-center gap-2">
            <Clock className="text-warning-600" size={20} />
            <h2 className="font-semibold text-warning-700">Perlu Perhatian</h2>
          </div>
          <div className="p-4 space-y-3">
            {(summary?.alerts?.attention || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left p-4 bg-warning-50/50 hover:bg-warning-50 rounded-lg border border-warning-100 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-warning-100 rounded-md shrink-0">
                    <Clock size={14} className="text-warning-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-warning-700 text-sm">{alert.message}</p>
                  </div>
                  <ArrowRight size={14} className="text-warning-400 group-hover:text-warning-600 transition-colors shrink-0 mt-1" />
                </div>
              </button>
            ))}
            {(summary?.alerts?.attention || []).length === 0 && (
              <div className="text-center py-6">
                <CheckCircle className="mx-auto text-success-400 mb-2" size={24} />
                <p className="text-sm text-slate-500">Tidak ada peringatan</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
