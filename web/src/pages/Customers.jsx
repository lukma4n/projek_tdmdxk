import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { API_BASE } from '../services/api'
import {
  Users, Loader2, AlertTriangle, Search, Phone,
  Calendar, Download, RefreshCw, User, Bike,
  CheckCircle2, Clock, BellRing, ChevronDown, Wrench, MessageSquare, X
} from 'lucide-react'

const statusColors = {
  belum: 'bg-slate-50 text-slate-600 border-slate-200',
  kpb1_due: 'bg-blue-50 text-blue-600 border-blue-200',
  kpb2_due: 'bg-amber-50 text-amber-600 border-amber-200',
  kpb3_due: 'bg-danger-50 text-danger-600 border-danger-200',
  kpb4_due: 'bg-purple-50 text-purple-600 border-purple-200',
}

const followupStatuses = [
  { value: 'belum_dihubungi', label: 'Belum Dihubungi' },
  { value: 'sudah_dihubungi', label: 'Sudah Dihubungi' },
  { value: 'booking', label: 'Booking' },
  { value: 'datang', label: 'Datang' },
  { value: 'batal', label: 'Batal' },
]

const followupColors = {
  belum_dihubungi: 'bg-slate-50 text-slate-600 border-slate-200',
  sudah_dihubungi: 'bg-blue-50 text-blue-600 border-blue-200',
  booking: 'bg-warning-50 text-warning-600 border-warning-200',
  datang: 'bg-success-50 text-success-600 border-success-200',
  batal: 'bg-danger-50 text-danger-600 border-danger-200',
}

function getCurrentKpbLevel(item) {
  if (!item?.kpb_status || item.kpb_status === 'belum') return 'KPB1'
  return item.kpb_status.replace('_due', '').toUpperCase()
}

function KpbCell({ status, wo }) {
  if (status === 'done') {
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-success-50 text-success-600 border-success-200 w-fit">
          <CheckCircle2 size={10} />
          <span>Done</span>
        </span>
        <span className="text-xs text-slate-400 mt-1">{wo || 'WO'}</span>
      </div>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-warning-50 text-warning-600 border-warning-200">
        <Clock size={10} />
        <span>Pending</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-50 text-slate-400 border-slate-200">
      <span>-</span>
    </span>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState(null)
  const [alerts, setAlerts] = useState({ data: [], summary: { overdue: 0, warning: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterKpb, setFilterKpb] = useState('all')
  const [filterModel, setFilterModel] = useState('all')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [models, setModels] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [exporting, setExporting] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)
  const [followupTarget, setFollowupTarget] = useState(null)
  const [followupHistory, setFollowupHistory] = useState([])
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupForm, setFollowupForm] = useState({ kpb_level: 'KPB1', status: 'sudah_dihubungi', note: '' })

  const loadAll = async () => {
    await Promise.all([
      loadSummary(),
      loadCustomers(),
      loadAlerts(),
      loadModels(),
    ])
  }

  const loadSummary = async () => {
    try {
      const data = await api.getCustomerSummary()
      setSummary(data)
    } catch {
      // ignore
    }
  }

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        limit: 50,
        ...(searchTerm && { search: searchTerm }),
        ...(filterKpb !== 'all' && { kpb_status: filterKpb }),
        ...(filterModel !== 'all' && { model: filterModel }),
        ...(filterYear && { kpb_year: filterYear }),
        ...(filterMonth && { kpb_month: filterMonth }),
      }
      const data = await api.getCustomers(params)
      setCustomers(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAlerts = async () => {
    try {
      const data = await api.getCustomerAlerts({ days: 7 })
      setAlerts(data)
    } catch {
      // ignore
    }
  }

  const loadModels = async () => {
    try {
      const data = await api.getCustomerModels()
      setModels(data.data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadAll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKpb, filterModel, filterYear, filterMonth, searchTerm])

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        ...(filterKpb !== 'all' && { kpb_status: filterKpb }),
        ...(filterYear && { kpb_year: filterYear }),
        ...(filterMonth && { kpb_month: filterMonth }),
        ...(searchTerm && { search: searchTerm }),
        ...(filterModel !== 'all' && { model: filterModel }),
      }).toString()

      const response = await fetch(`${API_BASE}/customers/export?${params}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export gagal')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const suffix = filterKpb !== 'all' ? filterKpb : 'Semua'
      a.href = url
      a.download = `Konsumen_${suffix}_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal export: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const openFollowup = async (item) => {
    setFollowupTarget(item)
    setFollowupForm({ kpb_level: getCurrentKpbLevel(item), status: item.followup?.status || 'sudah_dihubungi', note: '' })
    setFollowupHistory([])
    setFollowupLoading(true)

    try {
      const data = await api.getCustomerFollowups(item.id)
      setFollowupHistory(data.data || [])
    } catch (err) {
      alert('Gagal memuat follow-up: ' + err.message)
    } finally {
      setFollowupLoading(false)
    }
  }

  const saveFollowup = async () => {
    if (!followupTarget) return
    try {
      setFollowupLoading(true)
      await api.createCustomerFollowup(followupTarget.id, followupForm)
      await Promise.all([loadCustomers(), loadAlerts()])
      const data = await api.getCustomerFollowups(followupTarget.id)
      setFollowupHistory(data.data || [])
      setFollowupForm({ ...followupForm, note: '' })
    } catch (err) {
      alert('Gagal menyimpan follow-up: ' + err.message)
    } finally {
      setFollowupLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDays = (days) => {
    if (days < 0) return `${Math.abs(days)} hari lewat`
    if (days === 0) return 'Hari ini'
    return `${days} hari lagi`
  }

  const getAlertBadge = (days) => {
    if (days < 0) return 'bg-danger-50 text-danger-600 border-danger-200'
    if (days <= 7) return 'bg-warning-50 text-warning-600 border-warning-200'
    return 'bg-success-50 text-success-600 border-success-200'
  }

  const summaryCards = [
    {
      label: 'Total Konsumen',
      value: summary?.total || 0,
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Belum KPB',
      value: summary?.belum || 0,
      icon: CheckCircle2,
      color: 'success',
    },
    {
      label: 'KPB 1 Jatuh Tempo',
      value: summary?.kpb1_due || 0,
      icon: BellRing,
      color: 'blue',
    },
    {
      label: 'KPB 2 Jatuh Tempo',
      value: summary?.kpb2_due || 0,
      icon: Clock,
      color: 'warning',
    },
    {
      label: 'KPB 3 Jatuh Tempo',
      value: summary?.kpb3_due || 0,
      icon: AlertTriangle,
      color: 'danger',
    },
    {
      label: 'KPB 4 Jatuh Tempo',
      value: summary?.kpb4_due || 0,
      icon: Wrench,
      color: 'purple',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Konsumen</h1>
          <p className="text-sm text-slate-500">Monitoring Service Berkala KPB (Kartu Perawatan Berkala)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          const colorMap = {
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            success: 'bg-success-50 text-success-600 border-success-200',
            warning: 'bg-warning-50 text-warning-600 border-warning-200',
            danger: 'bg-danger-50 text-danger-600 border-danger-200',
            purple: 'bg-purple-50 text-purple-600 border-purple-200',
          }
          return (
            <div key={card.label} className={`p-4 rounded-xl border ${colorMap[card.color]}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <Icon size={18} className="opacity-60" />
              </div>
              <p className="text-2xl font-extrabold">{card.value.toLocaleString('id-ID')}</p>
            </div>
          )
        })}
      </div>

      {/* Alerts Panel */}
      {(alerts.data.length > 0 || alerts.summary.overdue > 0 || alerts.summary.warning > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="w-full px-5 py-4 flex items-center justify-between bg-danger-50 border-b border-danger-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-danger-600" size={18} />
              <span className="font-semibold text-danger-700 text-sm">Alert Konsumen KPB Mendekati Tenggat</span>
              <span className="ml-2 text-xs bg-danger-100 text-danger-600 px-2 py-0.5 rounded-full font-medium">
                {alerts.summary.overdue} lewat, {alerts.summary.warning} dalam 7 hari
              </span>
            </div>
            <ChevronDown size={16} className={`text-danger-600 transition-transform ${showAlerts ? 'rotate-180' : ''}`} />
          </button>

          {showAlerts && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Konsumen', 'Kontak', 'Motor', 'Tgl Beli', 'KPB', 'Tenggat', 'Status', 'Follow-up'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.data.slice(0, 10).map((alert, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">{alert.customer}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{alert.customer_mobile || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bike size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{alert.model || '-'} {alert.no_frame ? `(${alert.no_frame})` : ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(alert.so_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[alert.kpb_status] || 'bg-slate-50 text-slate-600'}`}>
                          {alert.kpb_label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">{formatDate(alert.kpb_due_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${getAlertBadge(alert.days_remaining)}`}>
                          {formatDays(alert.days_remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openFollowup(alert)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-100"
                        >
                          <MessageSquare size={13} />
                          {alert.followup ? followupStatuses.find((s) => s.value === alert.followup.status)?.label || 'Follow-up' : 'Follow-up'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, no HP, atau no rangka..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterKpb}
          onChange={(e) => setFilterKpb(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Status KPB</option>
          <option value="belum">Belum KPB</option>
          <option value="kpb1_due">KPB 1 Jatuh Tempo</option>
          <option value="kpb2_due">KPB 2 Jatuh Tempo</option>
          <option value="kpb3_due">KPB 3 Jatuh Tempo</option>
          <option value="kpb4_due">KPB 4 Jatuh Tempo</option>
        </select>

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Tahun</option>
          <option value="2022">2022</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Bulan</option>
          <option value="1">Januari</option>
          <option value="2">Februari</option>
          <option value="3">Maret</option>
          <option value="4">April</option>
          <option value="5">Mei</option>
          <option value="6">Juni</option>
          <option value="7">Juli</option>
          <option value="8">Agustus</option>
          <option value="9">September</option>
          <option value="10">Oktober</option>
          <option value="11">November</option>
          <option value="12">Desember</option>
        </select>

        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Model</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <button
          onClick={handleExportExcel}
          disabled={exporting || customers.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 hover:bg-green-100 transition-all disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {exporting ? 'Mengeksport...' : 'Export'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Daftar Konsumen</span>
          </div>
          <span className="text-xs text-slate-400">
            {(pagination?.total || 0).toLocaleString('id-ID')} total data
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto text-danger-400 mb-2" size={24} />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['No', 'Nama Konsumen', 'Kontak', 'Motor', 'Tgl Beli', 'KPB1', 'KPB2', 'KPB3', 'KPB4', 'Status', 'Follow-up'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{item.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        {item.customer_mobile && (
                          <span className="text-sm text-slate-600 flex items-center gap-1">
                            <Phone size={12} /> {item.customer_mobile}
                          </span>
                        )}
                        {item.no_ktp && (
                          <span className="text-xs text-slate-400">KTP: {item.no_ktp}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        {item.model && (
                          <span className="text-sm font-medium text-slate-700">{item.model} ({item.color || '-'}) {item.type ? `[${item.type}]` : ''}</span>
                        )}
                        {item.no_frame && (
                          <span className="text-xs text-slate-400 font-mono">{item.no_frame.substring(0, 20)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {formatDate(item.so_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <KpbCell status={item.kpb1_status} wo={item.kpb1_wo} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <KpbCell status={item.kpb2_status} wo={item.kpb2_wo} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <KpbCell status={item.kpb3_status} wo={item.kpb3_wo} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <KpbCell status={item.kpb4_status} wo={item.kpb4_wo} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[item.kpb_status] || statusColors.belum}`}>
                        {item.kpb_status === 'belum' ? 'Belum'
                         : item.kpb_status === 'kpb1_due' ? 'KPB 1'
                         : item.kpb_status === 'kpb2_due' ? 'KPB 2'
                         : item.kpb_status === 'kpb3_due' ? 'KPB 3'
                         : item.kpb_status === 'kpb4_due' ? 'KPB 4' : 'Belum'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => openFollowup(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <MessageSquare size={13} />
                        {item.followup ? (
                          <span className={`px-1.5 py-0.5 rounded border ${followupColors[item.followup.status] || followupColors.belum_dihubungi}`}>
                            {followupStatuses.find((s) => s.value === item.followup.status)?.label || item.followup.status}
                          </span>
                        ) : 'Catat'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {customers.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Users className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-slate-500">Tidak ada data konsumen</p>
            <p className="text-xs text-slate-400 mt-1">Upload file Excel Report Penjualan untuk mengisi data</p>
          </div>
        )}
      </div>

      {followupTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && setFollowupTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Follow-up KPB</h2>
                <p className="text-sm text-slate-500">{followupTarget.customer_name} - {followupTarget.customer_mobile || '-'}</p>
              </div>
              <button onClick={() => setFollowupTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Level KPB</label>
                    <select
                      value={followupForm.kpb_level}
                      onChange={(e) => setFollowupForm({ ...followupForm, kpb_level: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {['KPB1', 'KPB2', 'KPB3', 'KPB4'].map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={followupForm.status}
                      onChange={(e) => setFollowupForm({ ...followupForm, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {followupStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                  <textarea
                    value={followupForm.note}
                    onChange={(e) => setFollowupForm({ ...followupForm, note: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: konsumen bersedia datang Sabtu pagi"
                  />
                </div>

                <button
                  onClick={saveFollowup}
                  disabled={followupLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {followupLoading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                  Simpan Follow-up
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-700">Riwayat</h3>
                {followupLoading && followupHistory.length === 0 ? (
                  <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-blue-600" size={22} /></div>
                ) : followupHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada follow-up.</p>
                ) : followupHistory.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${followupColors[item.status] || followupColors.belum_dihubungi}`}>
                        {item.kpb_level} - {followupStatuses.find((s) => s.value === item.status)?.label || item.status}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(item.followup_at)}</span>
                    </div>
                    {item.note && <p className="text-sm text-slate-700 mt-2">{item.note}</p>}
                    <p className="text-xs text-slate-400 mt-2">Oleh {item.creator?.name || item.creator?.username || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
