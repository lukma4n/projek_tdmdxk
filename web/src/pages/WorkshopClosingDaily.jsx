import { useEffect, useState, useCallback, useRef } from 'react'
import fetchWithAuth from '../services/api/fetchWithAuth'
import { toPng } from 'html-to-image'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Camera,
  Receipt,
  Wrench,
  Users
} from 'lucide-react'

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export default function WorkshopClosingDaily() {
  const [data, setData] = useState(null)
  const [branchData, setBranchData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [screenshotting, setScreenshotting] = useState(false)
  const reportRef = useRef(null)
  const today = new Date().toISOString().split('T')[0]
  const [closingDate, setClosingDate] = useState(today)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [year, month] = closingDate.split('-')
      
      const [closingData, bData] = await Promise.all([
        fetchWithAuth(`/workshop/closing-daily?date=${closingDate}`),
        fetchWithAuth(`/workshop/dashboard/branch?year=${year}&month=${month}`)
      ])
      
      setData(closingData)
      setBranchData(bData)
    } catch (err) {
      setError(err.message || 'Gagal memuat data laporan harian')
    } finally {
      setLoading(false)
    }
  }, [closingDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleScreenshot = async () => {
    if (!reportRef.current) return
    try {
      setScreenshotting(true)
      // Tunggu render DOM agar gaya screenshotting (w-[1024px]) diterapkan
      await new Promise((resolve) => setTimeout(resolve, 250))
      
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `Closing_Bengkel_${closingDate}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert('Gagal membuat gambar: ' + (err.message || 'Unknown error'))
    } finally {
      setScreenshotting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data closing bengkel...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="text-danger" size={28} />
          </div>
          <p className="text-danger font-medium">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const summary = data?.summary || {}

  const stats = [
    {
      label: 'Total WO Selesai',
      value: summary.totalWO || 0,
      subtext: 'Work Orders rampung',
      icon: Wrench,
      colorClass: 'text-accent-text',
      borderClass: 'border-accent-soft',
      iconBgClass: 'bg-accent-soft text-accent',
    },
    {
      label: 'Total Pendapatan',
      value: `Rp ${(summary.totalRevenue || 0).toLocaleString('id-ID')}`,
      subtext: 'Sebelum diskon',
      icon: TrendingUp,
      colorClass: 'text-success',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-success-soft text-success',
    },
    {
      label: 'Total Diskon',
      value: `Rp ${(summary.totalDiscount || 0).toLocaleString('id-ID')}`,
      subtext: 'Diskon program/manual',
      icon: Receipt,
      colorClass: 'text-warning',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-warning-soft text-warning',
    },
    {
      label: 'Mekanik Aktif',
      value: (data?.byMechanic || []).length,
      subtext: 'Mekanik bertugas hari ini',
      icon: Users,
      colorClass: 'text-accent',
      borderClass: 'border-purple-200',
      iconBgClass: 'bg-accent-soft text-accent',
    },
  ]

  const renderBranch = () => {
    if (!branchData || !branchData.current_month) return null
    const { effective_days, current_effective_day, targets, current_month, last_month } = branchData

    const calcOutlook = (aktual) => {
      if (current_effective_day === 0) return 0
      return Math.round((aktual / current_effective_day) * effective_days)
    }

    const sections = [
      { 
        title: 'UNIT ENTRY (UE)', 
        target: targets.target_unit, 
        aktual: current_month.unit, 
        last: last_month.unit,
        isCurrency: false
      },
      { 
        title: 'PENCAPAIAN JASA', 
        target: targets.target_jasa, 
        aktual: current_month.jasa, 
        last: last_month.jasa,
        isCurrency: true
      },
      { 
        title: 'PENCAPAIAN PART', 
        target: targets.target_part, 
        aktual: current_month.part, 
        last: last_month.part,
        isCurrency: true
      },
      { 
        title: 'PENCAPAIAN OLI', 
        target: targets.target_oli, 
        aktual: current_month.oli, 
        last: last_month.oli,
        isCurrency: true
      }
    ]

    return (
      <div className="space-y-6 mb-8 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2 border-b pb-2 border-border">
          <TrendingUp size={16} className="text-accent shrink-0" />
          <h3 className="font-bold text-text text-sm uppercase">Pencapaian WS DXK Bulan Ini</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-faint uppercase tracking-wider">Total UE Bulan Ini</p>
              <h3 className="text-2xl font-black mt-1">{current_month.unit}</h3>
            </div>
            <Wrench className="w-8 h-8 text-text" />
          </div>
          <div className="bg-gradient-to-br from-accent to-accent-text text-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Total Jasa</p>
              <h3 className="text-lg font-black mt-1">Rp {current_month.jasa.toLocaleString('id-ID')}</h3>
            </div>
            <TrendingUp className="w-8 h-8 text-white/50 opacity-50" />
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Total Part</p>
              <h3 className="text-lg font-black mt-1">Rp {current_month.part.toLocaleString('id-ID')}</h3>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-400 opacity-50" />
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">Total Oli</p>
              <h3 className="text-lg font-black mt-1">Rp {current_month.oli.toLocaleString('id-ID')}</h3>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {sections.map((sec, idx) => {
            const outlook = calcOutlook(sec.aktual)
            const acv = sec.target > 0 ? ((sec.aktual / sec.target) * 100).toFixed(1) : '0.0'
            const olPct = sec.target > 0 ? ((outlook / sec.target) * 100).toFixed(1) : '0.0'
            const selisih = outlook - sec.target

            const formatVal = v => sec.isCurrency ? v.toLocaleString('id-ID') : v
            return (
              <div key={idx} className="bg-hover border border-border rounded-xl overflow-hidden">
                <div className="bg-hover px-3 py-2 border-b border-border">
                  <h3 className="font-bold text-text text-[10px] uppercase tracking-wider">{sec.title}</h3>
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-muted">Target</span>
                    <span className="text-[10px] font-bold text-text">{sec.isCurrency ? 'Rp ' : ''}{formatVal(sec.target)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-border">
                    <span className="text-[10px] font-medium text-accent">Aktual</span>
                    <span className="text-[10px] font-bold text-accent-text">{sec.isCurrency ? 'Rp ' : ''}{formatVal(sec.aktual)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-muted">ACV</span>
                    <span className="text-[10px] font-bold text-text">{acv}%</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-medium text-muted">Outlook</span>
                    <span className={`text-[10px] font-bold ${selisih >= 0 ? 'text-success' : 'text-rose-600'}`}>{olPct}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">
            Laporan Harian Bengkel
          </h1>
          <p className="text-sm text-muted mt-1">
            Rekap WO, pendapatan harian, dan pencapaian target bulanan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="px-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover transition-all shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handleScreenshot}
            disabled={screenshotting}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm disabled:opacity-50"
          >
            <Camera size={16} />
            {screenshotting ? 'Menyimpan...' : 'Screenshot'}
          </button>
        </div>
      </div>

      {/* Report Container */}
      <div 
        ref={reportRef} 
        className={`space-y-6 bg-panel p-6 rounded-xl border border-border transition-all duration-300 ${screenshotting ? 'w-[1024px] overflow-visible' : 'max-w-7xl mx-auto'}`}
      >
        {/* Report Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border gap-4">
          <div>
            <span className="px-3 py-1 text-[10px] font-bold tracking-widest text-accent bg-accent-soft rounded-full uppercase">
              TDM KETAPANG BENGKEL
            </span>
            <h2 className="text-2xl font-black text-text-strong tracking-tight mt-1.5 uppercase">
              Laporan Harian Bengkel
            </h2>
            <p className="text-xs text-faint mt-1 font-semibold">
              Tanggal: {formatTanggalIndo(data?.period)}
            </p>
          </div>
          <div className="text-left md:text-right shrink-0">
            <span className="text-[10px] font-bold text-faint block uppercase tracking-wider">Status Laporan</span>
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-success-soft text-success text-xs font-bold rounded-full">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              COMPLETED
            </span>
          </div>
        </div>

        {renderBranch()}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((card) => (
            <div key={card.label} className={`rounded-xl border ${card.borderClass} bg-panel p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{card.label}</p>
                  <p className={`text-xl font-black ${card.colorClass} tabular-nums mt-1`}>{card.value}</p>
                  {card.subtext && <p className="text-[10px] text-muted leading-tight mt-1">{card.subtext}</p>}
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBgClass} shadow-sm`}>
                  <card.icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Per Mechanic */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3 border-b pb-2 border-border">
              <Users size={16} className="text-accent shrink-0" />
              <h3 className="font-bold text-text text-sm">Performa Mekanik</h3>
            </div>
            <div className="space-y-2.5">
              {(data?.byMechanic || []).map(m => (
                <div key={m.mechanic} className="flex items-start justify-between gap-2 p-3 rounded-xl border border-border bg-hover/50 hover:bg-hover transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-text break-words leading-tight uppercase tracking-tight">{m.mechanic}</p>
                    <p className="text-xs text-faint font-medium mt-0.5">{m.count} WO Selesai</p>
                  </div>
                  <p className="font-bold text-success text-sm whitespace-nowrap shrink-0">Rp {m.revenue.toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3 border-b pb-2 border-border">
              <Receipt size={16} className="text-accent shrink-0" />
              <h3 className="font-bold text-text text-sm">Rincian Work Order ({data?.transactions?.length || 0})</h3>
            </div>
            <div className={screenshotting ? "overflow-visible" : "max-h-96 overflow-y-auto"}>
              <table className="w-full text-xs">
                <thead className="bg-hover sticky top-0">
                  <tr className="border-b border-border">
                    <th className="text-left p-2.5 font-semibold text-muted">WO Number</th>
                    <th className="text-left p-2.5 font-semibold text-muted">Mekanik</th>
                    <th className="text-left p-2.5 font-semibold text-muted">Konsumen</th>
                    <th className="text-left p-2.5 font-semibold text-muted">Tipe</th>
                    <th className="text-right p-2.5 font-semibold text-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.transactions || []).map(tx => (
                    <tr key={tx.wo_number} className="hover:bg-hover transition-colors">
                      <td className="p-2.5 font-mono text-muted">{tx.wo_number}</td>
                      <td className="p-2.5 font-medium text-text uppercase tracking-tight">{tx.mechanic || '-'}</td>
                      <td className="p-2.5 text-muted">{tx.customer_name || '-'}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-accent-soft text-accent-text text-[10px] font-bold uppercase tracking-wider">{tx.type}</span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-text tabular-nums">Rp {tx.total.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
