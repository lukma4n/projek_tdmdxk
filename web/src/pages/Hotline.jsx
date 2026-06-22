import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Search, Phone, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'

const stateColors = {
  Done: 'bg-success-100 text-success-700 border-success-200',
  Approved: 'bg-accent-soft text-accent-text border-accent-soft',
  Waiting_For_Approval: 'bg-warning-100 text-warning-700 border-warning-200',
  Cancel: 'bg-hover text-muted border-border',
}

export default function Hotline() {
  const [hotlines, setHotlines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, setPagination] = useState({ page: 1, totalPages: 1 })
  const [filterState, setFilterState] = useState('all')
  const [filterJenis, setFilterJenis] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadHotlines = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        limit: 50,
        ...(filterState !== 'all' && { state: filterState }),
        ...(filterJenis !== 'all' && { jenis_po: filterJenis }),
        ...(searchTerm && { search: searchTerm }),
      }
      const data = await api.getHotlines(params)
      setHotlines(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadHotlines)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, filterJenis, searchTerm])

  const handleUpdateState = async (id, newState) => {
    try {
      await api.updateHotlineState(id, newState)
      loadHotlines()
    } catch (err) {
      alert('Gagal update state: ' + err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Part Hotline</h1>
          <p className="text-sm text-muted">Tracking permintaan part hotline end-to-end</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-panel rounded-xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Cari no hotline atau customer..."
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
          <option value="Done">Done</option>
          <option value="Approved">Approved</option>
          <option value="Waiting_For_Approval">Waiting Approval</option>
          <option value="Cancel">Cancel</option>
        </select>

        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          className="px-3 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">Semua Jenis PO</option>
          <option value="No Claim">No Claim</option>
          <option value="Claim C1">Claim C1</option>
          <option value="Claim C2">Claim C2</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
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
                  {['No Hotline', 'Tanggal', 'Customer', 'Jenis PO', 'Qty', 'Qty PO', 'State'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hotlines.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-hover/50 transition-colors ${item.state === 'Cancel' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-text">{item.no_hotline}</td>
                    <td className="px-4 py-3 text-sm text-muted">{new Date(item.tgl_hotline).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-text font-medium">{item.customer}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-hover text-muted rounded-md border border-border">
                        {item.jenis_po}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">{item.qty_hotline || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={(item.qty_po || 0) < (item.qty_hotline || 0) ? 'text-danger-600 font-semibold' : 'text-muted'}>
                        {item.qty_po || 0}
                        {(item.qty_po || 0) < (item.qty_hotline || 0) && <span className="ml-1 text-xs">(Under Order)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.state}
                        onChange={(e) => handleUpdateState(item.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded border ${stateColors[item.state]} cursor-pointer`}
                      >
                        <option value="Done">Done</option>
                        <option value="Approved">Approved</option>
                        <option value="Waiting_For_Approval">Waiting</option>
                        <option value="Cancel">Cancel</option>
                      </select>
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

        {hotlines.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Phone className="mx-auto text-faint mb-2" size={32} />
            <p className="text-sm text-muted">Tidak ada data hotline</p>
          </div>
        )}
      </div>
    </div>
  )
}
