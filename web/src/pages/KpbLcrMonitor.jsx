import { useState, useEffect } from 'react'
import { api } from '../services/api'
import {
  Receipt, ShieldCheck, Loader2, AlertTriangle, Search,
  ChevronRight, ArrowRight,
  Filter, Download, Calendar
} from 'lucide-react'

const stateColors = {
  done: 'bg-success-100 text-success-700 border-success-200',
  open: 'bg-accent-soft text-accent-text border-accent-soft',
  cancel: 'bg-hover text-muted border-border',
}

export default function KpbLcrMonitor() {
  const [summary, setSummary] = useState(null)
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeProgram, setActiveProgram] = useState('all')
  const [filterState, setFilterState] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const loadProgramSummary = async (params = {}) => {
    try {
      const data = await api.getProgramSummary(params)
      setSummary(data)
    } catch {
      // ignore
    }
  }

  const loadWorkOrders = async (params = {}) => {
    try {
      setLoading(true)
      const query = {
        page: 1,
        limit: 50,
        ...(activeProgram !== 'all' && { type: activeProgram === 'kpb' ? 'KPB' : 'LCR' }),
        ...(filterState !== 'all' && { state: filterState }),
        ...(searchTerm && { search: searchTerm }),
        ...params,
      }
      const data = await api.getWorkOrders(query)
      setWorkOrders(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadProgramSummary()
      loadWorkOrders()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProgram, filterState, searchTerm])

  const handleFilter = () => {
    const params = {}
    if (dateRange.from) params.from = dateRange.from
    if (dateRange.to) params.to = dateRange.to
    loadProgramSummary(params)
    loadWorkOrders(params)
  }

  const kpbData = summary?.kpb || { total: 0, done: 0, cancel: 0, open: 0, revenue: 0 }
  const lcrData = summary?.lcr || { total: 0, done: 0, cancel: 0, open: 0, revenue: 0 }

  const kpbDonePct = kpbData.total > 0 ? Math.round((kpbData.done / kpbData.total) * 100) : 0
  const kpbCancelPct = kpbData.total > 0 ? Math.round((kpbData.cancel / kpbData.total) * 100) : 0

  const lcrDonePct = lcrData.total > 0 ? Math.round((lcrData.done / lcrData.total) * 100) : 0
  const lcrCancelPct = lcrData.total > 0 ? Math.round((lcrData.cancel / lcrData.total) * 100) : 0

  const getKpbCardClass = () => {
    if (activeProgram === 'kpb') {
      return 'bg-accent-soft border-accent-soft ring-2 ring-offset-2 ring-accent-soft'
    }
    return 'bg-panel border-border hover:border-border'
  }

  const getLcrCardClass = () => {
    if (activeProgram === 'lcr') {
      return 'bg-warning-soft border-amber-300 ring-2 ring-offset-2 ring-amber-200'
    }
    return 'bg-panel border-border hover:border-border'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Monitoring Program AHM</h1>
          <p className="text-sm text-muted">Pantau KPB servis gratis dan LCR cek rangka</p>
        </div>
        <button
          onClick={() => { loadProgramSummary(); loadWorkOrders(); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-lg text-sm font-medium text-muted hover:bg-hover transition-all shadow-sm"
        >
          <Loader2 size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* KPB Card */}
        <div
          onClick={() => setActiveProgram(activeProgram === 'kpb' ? 'all' : 'kpb')}
          className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${getKpbCardClass()}`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-soft">
                <Receipt size={22} className="text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-strong">KPB</h3>
                <p className="text-xs text-muted">Kartu Perawatan Berkala</p>
              </div>
            </div>
            <span className="text-xs font-medium text-faint">
              {activeProgram === 'kpb' ? 'Filter aktif' : 'Klik untuk filter'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-text">{kpbData.total.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Total WO</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-success-600">{kpbData.done.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Selesai</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-danger-600">{kpbData.cancel.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Cancel</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-accent">{kpbData.open.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Open</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Status</span>
              <span className="font-medium text-text">{kpbDonePct}% selesai</span>
            </div>
            <div className="h-2 bg-hover rounded-full overflow-hidden flex">
              <div className="h-full bg-success-400" style={{ width: `${kpbDonePct}%` }} />
              <div className="h-full bg-danger-400" style={{ width: `${kpbCancelPct}%` }} />
              <div className="h-full bg-accent" style={{ width: `${100 - kpbDonePct - kpbCancelPct}%` }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between">
            <p className="text-xs text-muted">
              Revenue: <span className="font-semibold text-text">Rp {(kpbData.revenue || 0).toLocaleString('id-ID')}</span>
            </p>
            {activeProgram === 'kpb' && (
              <span className="flex items-center gap-1 text-xs font-medium text-accent">
                Tabel difilter <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>

        {/* LCR Card */}
        <div
          onClick={() => setActiveProgram(activeProgram === 'lcr' ? 'all' : 'lcr')}
          className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${getLcrCardClass()}`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-warning-soft">
                <ShieldCheck size={22} className="text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-strong">LCR</h3>
                <p className="text-xs text-muted">Layanan Cek Rangka</p>
              </div>
            </div>
            <span className="text-xs font-medium text-faint">
              {activeProgram === 'lcr' ? 'Filter aktif' : 'Klik untuk filter'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-text">{lcrData.total.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Total WO</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-success-600">{lcrData.done.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Selesai</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-danger-600">{lcrData.cancel.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Cancel</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-accent">{lcrData.open.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted mt-0.5">Open</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Status</span>
              <span className="font-medium text-text">{lcrDonePct}% selesai</span>
            </div>
            <div className="h-2 bg-hover rounded-full overflow-hidden flex">
              <div className="h-full bg-success-400" style={{ width: `${lcrDonePct}%` }} />
              <div className="h-full bg-danger-400" style={{ width: `${lcrCancelPct}%` }} />
              <div className="h-full bg-accent" style={{ width: `${100 - lcrDonePct - lcrCancelPct}%` }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between">
            <p className="text-xs text-muted">
              Revenue: <span className="font-semibold text-text">Rp {(lcrData.revenue || 0).toLocaleString('id-ID')}</span>
            </p>
            {activeProgram === 'lcr' && (
              <span className="flex items-center gap-1 text-xs font-medium text-warning">
                Tabel difilter <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-panel rounded-xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-faint" />
          <span className="text-sm text-muted">Periode:</span>
        </div>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
          className="px-3 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-sm text-faint">–</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
          className="px-3 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-accent hover:brightness-110 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Tampilkan
        </button>
      </div>

      {/* Filters + Toggle */}
      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-faint" />
            <span className="text-sm font-semibold text-text">Filter dan Pencarian</span>
          </div>

          {/* Program toggle chips */}
          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'Semua Program' },
              { key: 'kpb', label: 'KPB' },
              { key: 'lcr', label: 'LCR' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setActiveProgram(activeProgram === opt.key ? 'all' : opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  (activeProgram === opt.key || (opt.key === 'all' && activeProgram === 'all'))
                    ? 'bg-accent text-white shadow-md'
                    : 'bg-hover text-muted border border-border hover:bg-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              placeholder="Cari no WO, customer, atau mekanik..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="px-3 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">Semua State</option>
            <option value="done">Done</option>
            <option value="open">Open</option>
            <option value="cancel">Cancel</option>
          </select>

          <button
            onClick={() => alert('Fitur Export data sedang dikembangkan!')}
            className="flex items-center gap-1.5 px-3 py-2 bg-hover border border-border rounded-lg text-sm text-muted hover:bg-hover transition-all"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Daftar Work Order</span>
            {activeProgram !== 'all' && (
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                activeProgram === 'kpb'
                  ? 'bg-accent-soft text-accent border-accent-soft'
                  : 'bg-warning-soft text-warning border-amber-100'
              }`}>
                {activeProgram === 'kpb' ? 'KPB' : 'LCR'}
              </span>
            )}
          </div>
          <span className="text-xs text-faint">
            {(pagination?.total || 0).toLocaleString('id-ID')} total data
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-accent" size={24} />
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
                <tr className="bg-hover border-b border-border">
                  {['No WO', 'Tanggal', 'State', 'Tipe', 'Mekanik', 'Customer', 'Unit', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((item) => (
                  <tr key={item.id} className="hover:bg-hover/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-text">{item.wo_number}</td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {item.date_confirm ? new Date(item.date_confirm).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${stateColors[item.state]}`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium font-semibold ${
                        item.type === 'KPB'
                          ? 'bg-accent-soft text-accent'
                          : item.type === 'LCR'
                          ? 'bg-warning-soft text-warning'
                          : 'bg-hover text-muted'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">{item.mechanic || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text">{item.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted">{item.unit_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text">
                      {item.state === 'cancel' ? (
                        <span className="text-xs text-danger-600 flex items-center gap-1">
                          {item.alasan_batal || 'Batal'}
                        </span>
                      ) : (
                        `Rp ${(item.total || 0).toLocaleString('id-ID')}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1.5 hover:bg-hover rounded-md text-faint hover:text-muted transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {workOrders.length === 0 && !loading && (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto text-faint mb-2" size={32} />
            <p className="text-sm text-muted">Tidak ada data work order</p>
          </div>
        )}
      </div>
    </div>
  )
}
