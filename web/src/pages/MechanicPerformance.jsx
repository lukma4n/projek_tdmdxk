import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Wrench, TrendingUp, Award, Loader2, Calendar, BarChart3 } from 'lucide-react'

export default function MechanicPerformance() {
  const [data, setData] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const loadData = async (params = {}) => {
    try {
      setLoading(true)
      const result = await api.getMechanicPerformance(params)
      setData(result.data)
      setSummary(result.summary)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  const handleFilter = () => {
    const params = {}
    if (dateRange.from) params.from = dateRange.from
    if (dateRange.to) params.to = dateRange.to
    loadData(params)
  }

  const totalRevenue = data.reduce((sum, m) => sum + m.revenue, 0)
  const totalDone = data.reduce((sum, m) => sum + m.done, 0)
  const totalCancel = data.reduce((sum, m) => sum + m.cancel, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performa Mekanik</h1>
          <p className="text-sm text-slate-500">Analisis produktivitas dan pendapatan per mekanik</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm text-slate-600">Periode:</span>
        </div>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
        />
        <span className="text-sm text-slate-400">–</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
        />
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          Tampilkan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-danger-600">{error}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wrench className="text-blue-600" size={18} />
                </div>
                <span className="text-sm font-medium text-slate-500">Total Mekanik</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{summary?.totalMechanics || 0}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-success-100 rounded-lg">
                  <TrendingUp className="text-success-600" size={18} />
                </div>
                <span className="text-sm font-medium text-slate-500">WO Selesai</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalDone.toLocaleString('id-ID')}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-danger-50 rounded-lg">
                  <BarChart3 className="text-danger-600" size={18} />
                </div>
                <span className="text-sm font-medium text-slate-500">WO Batal</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalCancel.toLocaleString('id-ID')}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-warning-50 rounded-lg">
                  <Award className="text-warning-600" size={18} />
                </div>
                <span className="text-sm font-medium text-slate-500">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">Rp {totalRevenue.toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Top Performer */}
          {summary?.topMechanic && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Award size={24} className="text-yellow-300" />
                <span className="text-sm font-medium text-blue-100">Mekanik Terbaik (Revenue Tertinggi)</span>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold">{summary.topMechanic.mechanic}</p>
                  <p className="text-sm text-blue-200 mt-1">{summary.topMechanic.done} WO selesai • Rp {summary.topMechanic.revenue.toLocaleString('id-ID')}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-4xl font-bold text-yellow-300">#1</p>
                </div>
              </div>
            </div>
          )}

          {/* Performance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Detail Performa per Mekanik</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Rank', 'Mekanik', 'WO Done', 'WO Batal', 'WO Open', 'Revenue', 'Rata-rata'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((m, idx) => (
                    <tr key={m.mechanic} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-600' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.mechanic}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-success-600">{m.done}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-danger-600">{m.cancel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{m.open}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        Rp {m.revenue.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        Rp {m.average.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 by Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Award size={16} className="text-yellow-500" />
                Top 5 Revenue Tertinggi
              </h3>
              <div className="space-y-3">
                {(summary?.topRevenue || []).map((m, idx) => (
                  <div key={m.mechanic} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{m.mechanic}</span>
                        <span className="text-sm font-semibold text-slate-800">Rp {m.revenue.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${m.revenue / (summary?.topRevenue[0]?.revenue || 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" />
                Top 5 WO Done Terbanyak
              </h3>
              <div className="space-y-3">
                {(summary?.topDone || []).map((m, idx) => (
                  <div key={m.mechanic} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{m.mechanic}</span>
                        <span className="text-sm font-semibold text-success-600">{m.done} WO</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                        <div
                          className="bg-success-500 h-2 rounded-full transition-all"
                          style={{ width: `${m.done / (summary?.topDone[0]?.done || 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
