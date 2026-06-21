import { useState, useEffect } from 'react'
import { api } from '../services/api'
import {
  Search,
  Wrench,
  ChevronRight,
  AlertTriangle,
  TrendingDown,
  Loader2,
  Coins,
  Clock,
  RefreshCw,
  TrendingUp,
  RotateCcw,
  UserCheck,
  ChevronLeft,
  X,
  CheckCircle2
} from 'lucide-react'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, limit: 50, total: 0 })

  const loadWorkOrders = async (page = 1) => {
    try {
      setLoading(true)
      const params = {
        page: page,
        limit: 50,
        ...(filterState !== 'all' && { state: filterState }),
        ...(filterType !== 'all' && { type: filterType }),
        ...(searchTerm && { search: searchTerm }),
      }
      const data = await api.getWorkOrders(params)
      setWorkOrders(data.data)
      setPagination({
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        limit: data.pagination.limit,
        total: data.pagination.total
      })
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

  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([
      loadWorkOrders(currentPage),
      loadSummary()
    ])
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setFilterState('all')
    setFilterType('all')
  }

  // Reset page to 1 when filters change
  useEffect(() => {
    void Promise.resolve().then(() => {
      setCurrentPage(1)
    })
  }, [filterState, filterType, searchTerm])

  // Load work orders when page or filters change
  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadWorkOrders(currentPage)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, filterType, searchTerm, currentPage])

  // Load summary once on mount
  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadSummary()
    })
  }, [])

  const totalWO = summary?.summary?.total || 0
  const totalDone = summary?.summary?.done || 0
  const totalCancel = summary?.summary?.cancel || 0
  const totalOpen = summary?.summary?.open || 0
  const totalRevenue = summary?.summary?.revenue || 0
  const averageRevenue = summary?.summary?.average || 0
  const hasActiveFilters = searchTerm !== '' || filterState !== 'all' || filterType !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Wrench size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Monitoring & Analisis Workshop</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">Pantau real-time data work order, kinerja mekanik, dan capaian program</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all shadow-sm self-start sm:self-center cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total WO */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Work Order (WO)</p>
              <p className="text-3xl font-black text-slate-800 tabular-nums">
                {totalWO.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm">
              <Wrench size={24} />
            </div>
          </div>
          <div className="mt-3 text-[10px] sm:text-xs text-slate-500 font-semibold flex items-center gap-1.5 flex-wrap">
            <span className="text-success-600 bg-success-50 px-1.5 py-0.5 rounded">{totalDone.toLocaleString('id-ID')} Selesai</span>
            <span>•</span>
            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{totalOpen.toLocaleString('id-ID')} Antrian</span>
            <span>•</span>
            <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">{totalCancel.toLocaleString('id-ID')} Batal</span>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-indigo-400/30" />
        </div>

        {/* Total Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Pendapatan (Revenue)</p>
              <p className="text-3xl font-black text-emerald-700 tabular-nums">
                Rp {Math.round(totalRevenue).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
              <Coins size={24} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 font-medium">Total nominal dari WO selesai</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-400/30" />
        </div>

        {/* Rata-rata */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rata-rata Nilai WO</p>
              <p className="text-3xl font-black text-amber-700 tabular-nums">
                Rp {Math.round(averageRevenue).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 font-medium">Rata-rata omset per kendaraan selesai</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-amber-400/30" />
        </div>

        {/* Antrian Aktif */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">WO Aktif (Antrian)</p>
              <p className={`text-3xl font-black tabular-nums ${totalOpen > 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                {totalOpen.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 shadow-sm">
              <Clock size={24} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 font-medium">Job order dengan status Open</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-purple-400/30" />
        </div>
      </div>

      {/* Program AHM Breakdown Widget */}
      {summary?.programBreakdown && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <TrendingUp size={16} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Capaian Program Khusus AHM</h2>
              <p className="text-xs text-slate-500">Pemantauan performa program servis gratis KPB dan cek rangka LCR</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KPB */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    KPB (Servis Berkala)
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Total: {summary.programBreakdown.kpb?.total || 0} WO
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-800 mt-2">
                  Rp {Math.round(summary.programBreakdown.kpb?.revenue || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total revenue dari KPB selesai</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] sm:text-xs font-semibold pt-4 mt-4 border-t border-slate-200/60 text-slate-600">
                <span className="flex items-center gap-1 text-success-600">
                  <CheckCircle2 size={12} />
                  {summary.programBreakdown.kpb?.done || 0} Selesai
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock size={12} />
                  {summary.programBreakdown.kpb?.open || 0} Antrian
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <AlertTriangle size={12} />
                  {summary.programBreakdown.kpb?.cancel || 0} Batal
                </span>
              </div>
            </div>

            {/* LCR */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                    LCR (Layanan Cek Rangka)
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Total: {summary.programBreakdown.lcr?.total || 0} WO
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-800 mt-2">
                  Rp {Math.round(summary.programBreakdown.lcr?.revenue || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total revenue dari LCR selesai</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] sm:text-xs font-semibold pt-4 mt-4 border-t border-slate-200/60 text-slate-600">
                <span className="flex items-center gap-1 text-success-600">
                  <CheckCircle2 size={12} />
                  {summary.programBreakdown.lcr?.done || 0} Selesai
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock size={12} />
                  {summary.programBreakdown.lcr?.open || 0} Antrian
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <AlertTriangle size={12} />
                  {summary.programBreakdown.lcr?.cancel || 0} Batal
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kinerja & Alasan Batal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Kinerja Mekanik */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <UserCheck size={16} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Top 5 Mekanik Teraktif</h2>
                <p className="text-xs text-slate-500">Mekanik dengan penyelesaian Work Order terbanyak</p>
              </div>
            </div>
            <div className="space-y-4 my-2">
              {summary?.mechanics && summary.mechanics.length > 0 ? (
                summary.mechanics.slice(0, 5).map((mech, idx) => {
                  const maxCount = summary.mechanics[0].count || 1
                  const pct = (mech.count / maxCount) * 100
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{mech.name}</span>
                        <span className="text-xs font-bold text-slate-500">{mech.count} WO</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                  <UserCheck size={28} className="opacity-40 mb-1" />
                  <p className="text-xs">Tidak ada data mekanik</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Reasons */}
        <div className={`bg-white rounded-2xl border ${totalCancel > 0 ? 'border-danger-200' : 'border-slate-200'} shadow-sm p-5 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalCancel > 0 ? 'bg-danger-50 text-danger-600' : 'bg-slate-50 text-slate-400'}`}>
                <TrendingDown size={16} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Analisis Alasan Cancel</h2>
                <p className="text-xs text-slate-500">Evaluasi penyebab pembatalan Work Order</p>
              </div>
            </div>
            <div className="space-y-4 my-2">
              {summary?.cancelReasons && summary.cancelReasons.length > 0 ? (
                summary.cancelReasons.slice(0, 5).map((item, idx) => {
                  const maxCount = summary.cancelReasons[0].count || 1
                  const pct = (item.count / maxCount) * 100
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700 truncate max-w-[240px]" title={item.reason}>
                          {item.reason}
                        </span>
                        <span className="text-xs font-bold text-danger-600 shrink-0">{item.count} WO</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-danger-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <CheckCircle2 size={32} className="text-emerald-500 opacity-60 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Laporan Bersih</p>
                  <p className="text-xs mt-0.5">Tidak ada Work Order yang dibatalkan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari no WO, customer, plat nomor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 text-slate-700"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <option value="all">Semua State</option>
              <option value="done">Done</option>
              <option value="open">Open</option>
              <option value="cancel">Cancel</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <option value="all">Semua Tipe</option>
              {['REG', 'KPB', 'LCR', 'SLS', 'HOTLINE', 'CLA', 'WAR', 'PDI'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RotateCcw size={12} />
            Reset Filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        ) : error ? (
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <AlertTriangle className="text-danger-500 mb-2" size={28} />
            <p className="text-sm font-semibold text-danger-700">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {['No WO', 'Tanggal', 'State', 'Tipe', 'Mekanik', 'Customer', 'Unit', 'Total'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left">{h}</th>
                  ))}
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700">
                      {item.wo_number}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {item.date_confirm ? new Date(item.date_confirm).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${stateColors[item.state] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${typeColors[item.type] || 'bg-slate-100 text-slate-600'}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 font-medium text-xs">{item.mechanic || '-'}</td>
                    <td className="px-5 py-3 text-slate-700 font-medium text-xs">{item.customer_name || '-'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{item.unit_name || '-'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800 text-xs">
                      {item.state === 'cancel' ? (
                        <span className="text-xs text-danger-600 flex items-center gap-1 font-semibold">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span className="truncate max-w-[120px]" title={item.alasan_batal || 'Batal'}>
                            {item.alasan_batal || 'Batal'}
                          </span>
                        </span>
                      ) : (
                        `Rp ${(item.total || 0).toLocaleString('id-ID')}`
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
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
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Wrench className="text-slate-300 mb-2" size={40} />
            <p className="text-sm font-semibold text-slate-500">Tidak ada data work order</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan kata kunci pencarian lain atau ganti filter</p>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && workOrders.length > 0 && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-5 py-4 gap-3 bg-slate-50/30">
            <div className="text-xs font-medium text-slate-500">
              Menampilkan <span className="font-bold text-slate-700">{(currentPage - 1) * pagination.limit + 1}</span> -{' '}
              <span className="font-bold text-slate-700">{Math.min(currentPage * pagination.limit, pagination.total)}</span> dari{' '}
              <span className="font-bold text-slate-700">{pagination.total.toLocaleString('id-ID')}</span> data
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-600">
                Halaman <span className="font-bold text-slate-800">{currentPage}</span> dari{' '}
                <span className="font-bold text-slate-800">{pagination.totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))}
                disabled={currentPage === pagination.totalPages}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-all shadow-sm cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

