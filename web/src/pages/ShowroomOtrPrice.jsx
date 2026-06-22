import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { BadgeDollarSign, Calendar, FileText, Loader2, RefreshCw, Search } from 'lucide-react'

function formatCurrency(value) {
  return `Rp ${(value || 0).toLocaleString('id-ID')}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ShowroomOtrPrice() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = { page: 1, limit: 100, ...(search && { search }) }
      const [listRes, summaryRes] = await Promise.all([
        api.getShowroomOtrPrices(params),
        api.getShowroomOtrPriceSummary(),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0, totalPages: 1 })
      setSummary(summaryRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat Harga OTR')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Master Harga</h1>
          <p className="text-sm text-muted">Harga OTR, Off The Road, Beli Dealer, dan BBN Jual dari SK Main Deler</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-lg text-sm text-muted hover:bg-hover">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-accent-soft bg-accent-soft text-accent-text">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Total Kode</p><BadgeDollarSign size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.total || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Harga Lengkap</p><BadgeDollarSign size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.completePrices || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Berlaku Sejak</p><Calendar size={18} /></div>
          <p className="text-xl font-bold mt-1">{formatDate(summary?.effectiveDate)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-panel text-text">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Source</p><FileText size={18} /></div>
          <p className="text-sm font-semibold mt-1 truncate" title={summary?.sourceFile || ''}>{summary?.sourceFile || '-'}</p>
        </div>
      </div>

      <div className="bg-panel rounded-xl border border-border shadow-sm p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode, tipe, deskripsi..." className="w-full pl-9 pr-4 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Daftar Master Harga</span>
          <span className="text-xs text-faint">{(pagination.total || 0).toLocaleString('id-ID')} total data</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-accent" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-hover border-b border-border">{['Kode', 'Tipe', 'Deskripsi', 'Harga Beli', 'Harga Off', 'Harga OTR', 'BBN Jual'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-hover/50">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-text">{item.product_code}</td>
                    <td className="px-4 py-3 text-sm text-text">{item.model_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-muted">{item.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text whitespace-nowrap">{item.dealer_purchase_price ? formatCurrency(item.dealer_purchase_price) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-text whitespace-nowrap">{item.off_road_price ? formatCurrency(item.off_road_price) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-text whitespace-nowrap">{formatCurrency(item.otr_price)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-accent-text whitespace-nowrap">{item.otr_price && item.off_road_price ? formatCurrency(item.otr_price - item.off_road_price) : '-'}</td>
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
