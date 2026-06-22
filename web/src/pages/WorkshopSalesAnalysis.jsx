import { useEffect, useState, useCallback } from 'react'
import { api, API_BASE } from '../services/api'
import { Loader2, AlertTriangle, RefreshCw, BarChart, Users, Settings } from 'lucide-react'

export default function WorkshopSalesAnalysis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [period, setPeriod] = useState({ from: today, to: today })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/workshop/analysis?from=${period.from}&to=${period.to}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Gagal memuat data')
      setData(await res.json())
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong">Analisa Penjualan Bengkel</h1>
          <p className="text-sm text-muted mt-1">Performa mekanik dan tipe pekerjaan</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))} className="px-4 py-2 border rounded-xl" />
          <span>-</span>
          <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))} className="px-4 py-2 border rounded-xl" />
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-panel border rounded-xl shadow-sm hover:bg-hover"><RefreshCw size={16}/> Refresh</button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" size={32} /></div>
      )}

      {error && !data && (
        <div className="bg-danger-soft text-danger p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle /> {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-panel p-6 rounded-xl border border-border">
              <p className="text-sm text-muted font-bold uppercase">Total Revenue</p>
              <p className="text-4xl font-black text-success">Rp {(data.summary.totalRevenue || 0).toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-panel p-6 rounded-xl border border-border">
              <p className="text-sm text-muted font-bold uppercase">Total WO Done</p>
              <p className="text-4xl font-black text-accent">{(data.summary.totalWO || 0).toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-panel p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <Users className="text-accent" />
                <h3 className="font-bold text-text">Berdasarkan Mekanik</h3>
              </div>
              <div className="space-y-3">
                {data.byMechanic.map(m => (
                  <div key={m.mechanic} className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-text">{m.mechanic}</p>
                      <p className="text-xs text-muted">{m.count} WO</p>
                    </div>
                    <p className="font-bold text-success text-sm">Rp {m.revenue.toLocaleString('id-ID')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-panel p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <Settings className="text-accent" />
                <h3 className="font-bold text-text">Berdasarkan Tipe Pekerjaan</h3>
              </div>
              <div className="space-y-3">
                {data.byType.map(t => (
                  <div key={t.type} className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-text">{t.type}</p>
                      <p className="text-xs text-muted">{t.count} WO</p>
                    </div>
                    <p className="font-bold text-success text-sm">Rp {t.revenue.toLocaleString('id-ID')}</p>
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
