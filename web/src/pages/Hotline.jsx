import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Search, Phone, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'

const stateColors = {
  Done: 'bg-success-100 text-success-700 border-success-200',
  Approved: 'bg-blue-100 text-blue-700 border-blue-200',
  Waiting_For_Approval: 'bg-warning-100 text-warning-700 border-warning-200',
  Cancel: 'bg-slate-100 text-slate-500 border-slate-200',
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
          <h1 className="text-2xl font-bold text-slate-900">Part Hotline</h1>
          <p className="text-sm text-slate-500">Tracking permintaan part hotline end-to-end</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari no hotline atau customer..."
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
          <option value="Done">Done</option>
          <option value="Approved">Approved</option>
          <option value="Waiting_For_Approval">Waiting Approval</option>
          <option value="Cancel">Cancel</option>
        </select>

        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Jenis PO</option>
          <option value="No Claim">No Claim</option>
          <option value="Claim C1">Claim C1</option>
          <option value="Claim C2">Claim C2</option>
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
                  {['No Hotline', 'Tanggal', 'Customer', 'Jenis PO', 'Qty', 'Qty PO', 'State'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hotlines.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${item.state === 'Cancel' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{item.no_hotline}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(item.tgl_hotline).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">{item.customer}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                        {item.jenis_po}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.qty_hotline || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={(item.qty_po || 0) < (item.qty_hotline || 0) ? 'text-danger-600 font-semibold' : 'text-slate-600'}>
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

        {hotlines.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Phone className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-slate-500">Tidak ada data hotline</p>
          </div>
        )}
      </div>
    </div>
  )
}
