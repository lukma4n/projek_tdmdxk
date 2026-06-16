import { useEffect, useState } from 'react'
import { API_BASE, api } from '../services/api'
import { Download, FileText, Loader2, MapPin, RefreshCw, Search, UserRound } from 'lucide-react'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ShowroomStnk() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({ locations: [] })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  const [customerType, setCustomerType] = useState('all')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = { page: 1, limit: 50, ...(search && { search }), ...(location !== 'all' && { location }), ...(customerType !== 'all' && { customer_type: customerType }) }
      const [listRes, summaryRes, filterRes] = await Promise.all([
        api.getShowroomStnks(params),
        api.getShowroomStnkSummary(),
        api.getShowroomStnkFilters(),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0, totalPages: 1 })
      setSummary(summaryRes)
      setFilters(filterRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat data STNK')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, location, customerType])

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(location !== 'all' && { location }),
        ...(customerType !== 'all' && { customer_type: customerType }),
      }).toString()

      const response = await fetch(`${API_BASE}/showroom/stnks/export${params ? '?' + params : ''}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const exportError = await response.json().catch(() => ({ error: 'Export gagal' }))
        throw new Error(exportError.error || 'Export gagal')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href = url
      a.download = `Stock_STNK_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal export STNK: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock STNK Showroom</h1>
          <p className="text-sm text-slate-500">Monitoring dokumen STNK cabang DXK</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700 disabled:opacity-60">
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Export Excel
          </button>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Total STNK</p><FileText size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.total || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">💵 Cash</p><UserRound size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.byCustomerType?.cash || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">💳 Kredit</p><UserRound size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.byCustomerType?.kredit || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Lokasi Terbanyak</p><MapPin size={18} /></div>
          <p className="text-xl font-bold mt-1 truncate">{summary?.byLocation?.[0]?.stnk_location || '-'}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Sync Terakhir</p><RefreshCw size={18} /></div>
          <p className="text-lg font-bold mt-1">{formatDate(summary?.latestSyncedAt)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari engine, polisi, nama, SO..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <option value="all">Semua Lokasi</option>
          {filters.locations?.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium">
          <option value="all">Semua: Cash & Kredit</option>
          <option value="CASH">💵 Cash</option>
          <option value="KREDIT">💳 Kredit</option>
        </select>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Daftar Stock STNK</span>
          <span className="text-xs text-slate-400">{(pagination.total || 0).toLocaleString('id-ID')} total data</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-200">{['Nama', 'Tipe', 'Engine/Polisi', 'Lokasi', 'Jadi STNK', 'Expired STNK', 'Leasing', 'Salesman'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{item.stnk_name || '-'}</p><p className="text-xs text-slate-500 flex items-center gap-1"><UserRound size={12} />{item.applicant_name || '-'}</p></td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.customer_type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{item.customer_type || '-'}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600"><p>{item.engine_number}</p><p className="text-slate-400">{item.police_number || '-'}</p></td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.stnk_location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(item.stnk_ready_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(item.stnk_expired_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.finance_company_short || <span className="text-slate-400">-</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.salesman || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
