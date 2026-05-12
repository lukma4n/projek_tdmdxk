import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Search, Wrench, ChevronRight, AlertTriangle, TrendingDown, Loader2 } from 'lucide-react'

const stateColors = {
  done: 'bg-success-100 text-success-700 border-success-200',
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  cancel: 'bg-slate-100 text-slate-500 border-slate-200',
}

const typeColors = {
  REG: 'bg-slate-100 text-slate-600',
  KPB: 'bg-blue-50 text-blue-600',
  LCR: 'bg-warning-50 text-warning-600',
  SLS: 'bg-success-50 text-success-600',
  HOTLINE: 'bg-danger-50 text-danger-600',
  CLA: 'bg-purple-50 text-purple-600',
  WAR: 'bg-orange-50 text-orange-600',
  PDI: 'bg-teal-50 text-teal-600',
}

export default function Workshop() {
  const [workOrders, setWorkOrders] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterState, setFilterState] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [, setPagination] = useState({ page: 1, totalPages: 1 })

  const loadWorkOrders = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        limit: 50,
        ...(filterState !== 'all' && { state: filterState }),
        ...(filterType !== 'all' && { type: filterType }),
        ...(searchTerm && { search: searchTerm }),
      }
      const data = await api.getWorkOrders(params)
      setWorkOrders(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    try {
      const data = await api.getWorkshopSummary()
      setSummary(data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadWorkOrders()
      loadSummary()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, filterType, searchTerm])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workshop</h1>
          <p className="text-sm text-slate-500">Monitoring work order dan kinerja mekanik</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-medium">Total WO</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{summary.summary?.total || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">Rp {(summary.summary?.revenue || 0).toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-medium">Rata-rata</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">Rp {Math.round(summary.summary?.average || 0).toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-medium">Cancel</p>
            <p className="text-2xl font-bold text-danger-600 mt-1">{summary.summary?.cancel || 0}</p>
          </div>
        </div>
      )}

      {/* Cancel Analysis */}
      {summary?.cancelReasons && summary.cancelReasons.length > 0 && (
        <div className="bg-white rounded-xl border border-danger-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-danger-50 border-b border-danger-200 flex items-center gap-2">
            <TrendingDown className="text-danger-600" size={18} />
            <h2 className="font-semibold text-danger-700 text-sm">Analisis Alasan Cancel</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {summary.cancelReasons.map((item, i) => {
                const maxCount = summary.cancelReasons[0].count
                const widthPercent = (item.count / maxCount) * 100
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-28 shrink-0">{item.reason}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div 
                        className="h-full bg-danger-400 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${widthPercent}%` }}
                      >
                        <span className="text-[10px] text-white font-bold">{item.count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari no WO atau customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua State</option>
          <option value="done">Done</option>
          <option value="open">Open</option>
          <option value="cancel">Cancel</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Tipe</option>
          {['REG', 'KPB', 'LCR', 'SLS', 'HOTLINE', 'CLA', 'WAR', 'PDI'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  {['No WO', 'Tanggal', 'State', 'Tipe', 'Mekanik', 'Customer', 'Unit', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{item.wo_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.date_confirm ? new Date(item.date_confirm).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${stateColors[item.state]}`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[item.type]}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.mechanic}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.unit_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.state === 'cancel' ? (
                        <span className="text-xs text-danger-600 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {item.alasan_batal || 'Cancel'}
                        </span>
                      ) : (
                        `Rp ${(item.total || 0).toLocaleString('id-ID')}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
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
            <Wrench className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-slate-500">Tidak ada data work order</p>
          </div>
        )}
      </div>
    </div>
  )
}
