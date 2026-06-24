import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import {
  Wrench, Phone, Package, AlertTriangle, CheckCircle, Clock,
  DollarSign, ArrowRight, Loader2,
  RefreshCw, Bell
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import Card from '../components/ui/Card'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

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
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data dashboard...</p>
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
          <button onClick={loadDashboard} className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const criticalCount = summary?.alerts?.critical?.length || 0
  const attentionCount = summary?.alerts?.attention?.length || 0

  const kpiCards = [
    {
      label: 'WO Hari Ini',
      value: (summary?.totalWO || 0).toLocaleString('id-ID'),
      icon: Wrench,
      trend: formatTrendPct(summary?.trend?.totalWO),
    },
    {
      label: 'Revenue Hari Ini',
      value: `Rp ${(summary?.revenue || 0).toLocaleString('id-ID')}`,
      icon: DollarSign,
      trend: formatTrendPct(summary?.trend?.revenue),
    },
    {
      label: 'Hotline Pending',
      value: (summary?.totalHotline || 0).toLocaleString('id-ID'),
      icon: Phone,
    },
    {
      label: 'WO Open',
      value: (summary?.openWO || 0).toLocaleString('id-ID'),
      icon: Clock,
    },
    {
      label: 'Stok Kritis > 365h',
      value: (summary?.criticalStock || 0).toLocaleString('id-ID'),
      icon: Package,
    },
    {
      label: 'Stok > 180h',
      value: (summary?.attentionStock || 0).toLocaleString('id-ID'),
      icon: AlertTriangle,
    },
  ]

  const woColumns = [
    { key: 'wo_number', label: 'No WO', mono: true, bold: true, className: 'text-accent' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'unit', label: 'Unit' },
    { key: 'mechanic', label: 'Mekanik' },
    {
      key: 'state',
      label: 'State',
      render: (val) => {
        const stateColors = {
          Open: { variant: 'warning' },
          Selesai: { variant: 'success' },
          Batal: { variant: 'danger' },
        }
        const c = stateColors[val] || { variant: 'default' }
        return <Badge variant={c.variant}>{val}</Badge>
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      mono: true,
      bold: true,
      render: (val) => `Rp ${(val || 0).toLocaleString('id-ID')}`,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Dashboard Bengkel"
        description="Ringkasan operasional bengkel dan sparepart DXK"
        action={
          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover hover:text-text-strong transition-all shadow-sm"
          >
            <RefreshCw size={15} /> Refresh Data
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Alerts + Open WO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Alert Kritis */}
        <Card
          title="Alert Kritis"
          icon={AlertTriangle}
          badge={criticalCount}
        >
          <div className="space-y-2">
            {(summary?.alerts?.critical || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 rounded-xl border border-border hover:bg-hover hover:border-border-strong transition-all group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider bg-danger-soft text-danger px-1.5 py-0.5 rounded-md">
                  {alert.type === 'stock' ? 'Stok' : alert.type === 'workshop' ? 'WO' : alert.type}
                </span>
                <span className="flex-1 text-sm font-semibold text-text truncate">
                  {alert.message}
                </span>
                <ArrowRight size={14} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
            {(summary?.alerts?.critical || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-faint">
                <CheckCircle size={32} className="text-success mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada alert kritis</p>
              </div>
            )}
          </div>
        </Card>

        {/* Perlu Perhatian */}
        <Card
          title="Perlu Perhatian"
          icon={Bell}
          badge={attentionCount}
        >
          <div className="space-y-2">
            {(summary?.alerts?.attention || []).map((alert, i) => (
              <button
                key={i}
                onClick={() => navigate(alert.path)}
                className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 rounded-xl border border-border hover:bg-hover hover:border-border-strong transition-all group"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider bg-warning-soft text-warning px-1.5 py-0.5 rounded-md">
                  {alert.type === 'stock' ? 'Stok' : alert.type === 'workshop' ? 'WO' : alert.type}
                </span>
                <span className="flex-1 text-sm font-semibold text-text truncate">
                  {alert.message}
                </span>
                <ArrowRight size={14} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
            {(summary?.alerts?.attention || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-faint">
                <CheckCircle size={32} className="text-success mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada peringatan</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Open Work Order */}
      <Card
        title="Open Work Order"
        icon={Wrench}
        action={
          <span className="text-[11.5px] text-accent font-semibold cursor-pointer hover:underline">
            Lihat semua →
          </span>
        }
      >
        <Table
          columns={woColumns}
          rows={summary?.openWOList || []}
          onRowClick={(row) => row.path && navigate(row.path)}
          emptyMessage="Tidak ada work order open"
        />
      </Card>

    </div>
  )
}
