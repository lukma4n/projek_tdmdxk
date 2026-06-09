import { useEffect, useState, useCallback, useRef } from 'react'
import { getSalesDashboard, exportSalesDashboard } from '../services/api/showroom'
import { toPng } from 'html-to-image'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  CreditCard,
  Download,
  Camera,
  Receipt,
  BarChart3,
  Bike,
} from 'lucide-react'
import {
  getTodayStr,
  getYesterdayStr,
  formatTanggalIndo,
  LEASING_COLORS,
} from '../components/showroom/ShowroomSalesUtils'
import {
  TeamCard,
} from '../components/showroom/ShowroomSalesPrimitives'

export default function ShowroomClosingDaily() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [screenshotting, setScreenshotting] = useState(false)
  const reportRef = useRef(null)
  const today = getTodayStr()
  const [closingDate, setClosingDate] = useState(today)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await getSalesDashboard({ from: closingDate, to: closingDate })
      setData(result)
    } catch (err) {
      setError(err.message || 'Gagal memuat data closing harian')
    } finally {
      setLoading(false)
    }
  }, [closingDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleClosingShortcut = (type) => {
    if (type === 'today') {
      setClosingDate(getTodayStr())
    } else if (type === 'yesterday') {
      setClosingDate(getYesterdayStr())
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const blob = await exportSalesDashboard({ from: closingDate, to: closingDate })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Closing_Harian_${closingDate}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengekspor: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  const handleScreenshot = async () => {
    if (!reportRef.current) return
    try {
      setScreenshotting(true)
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: false,
      })
      const link = document.createElement('a')
      link.download = `Closing_Harian_${closingDate}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Screenshot error:', err)
      alert('Gagal membuat gambar: ' + (err.message || 'Unknown error'))
    } finally {
      setScreenshotting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
          <p className="text-sm text-slate-500">Memuat data closing harian...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const summary = data?.summary || {}

  // Inline stat cards (size=small) untuk report yang compact
  const stats = [
    {
      label: 'Closing DO',
      value: summary.closingDo || 0,
      subtext: formatTanggalIndo(data?.period?.from),
      icon: Bike,
      colorClass: 'text-blue-700',
      borderClass: 'border-blue-200',
      iconBgClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Cash',
      value: summary.cashCount || 0,
      subtext: `${summary.cashPercent || 0}%`,
      icon: TrendingUp,
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Kredit',
      value: summary.creditCount || 0,
      subtext: `${summary.creditPercent || 0}%`,
      icon: CreditCard,
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Grand Total',
      value: summary.grandTotal || 0,
      subtext: (() => {
        const f = new Date(data?.period?.from || '')
        const t = new Date(data?.period?.to || '')
        const isSameMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()
        if (isSameMonth) {
          return `Kumulatif s/d ${formatTanggalIndo(data?.period?.to)}`
        }
        return `Periode ${formatTanggalIndo(data?.period?.from)} - ${formatTanggalIndo(data?.period?.to)}`
      })(),
      icon: BarChart3,
      colorClass: 'text-slate-700',
      borderClass: 'border-slate-200',
      iconBgClass: 'bg-slate-100 text-slate-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {loading && data && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-0.5 bg-blue-500 animate-pulse" />
        </div>
      )}
      {error && data && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto text-xs font-semibold underline">Coba Lagi</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Laporan Closing Harian
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Laporan harian siap screenshot untuk share ke tim marketing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
          />
          <button onClick={() => handleClosingShortcut('today')} className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Hari Ini
          </button>
          <button onClick={() => handleClosingShortcut('yesterday')} className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
            Kemarin
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Mengekspor...' : 'Export Excel'}
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

      {/* Report Container for Screenshot */}
      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200">
        {/* Report Header */}
        <div className="text-center pb-4 border-b-2 border-slate-800">
          <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">
            LAPORAN CLOSINGAN HARIAN
          </h2>
          <h3 className="text-lg font-bold text-slate-800 mt-1 uppercase">
            CABANG KETAPANG 2026
          </h3>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Tanggal: {formatTanggalIndo(data?.period?.from)}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((card) => (
            <div key={card.label} className={`rounded-xl border ${card.borderClass} bg-white p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
                  <p className={`text-2xl font-black ${card.colorClass} tabular-nums`}>{(card.value || 0).toLocaleString('id-ID')}</p>
                  {card.subtext && <p className="text-[10px] text-slate-500 leading-tight">{card.subtext}</p>}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBgClass} shadow-sm`}>
                  <card.icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Team Performance */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
            <Users size={18} className="text-blue-600" />
            <h3 className="font-bold text-slate-800">Team Performance (Kumulatif Bulan Ini)</h3>
            <span className="text-xs text-slate-500 ml-auto">{data?.byTeam?.length || 0} Team</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.byTeam || []).map((team) => (
              <TeamCard key={team.team} {...team} collapsible={false} />
            ))}
          </div>
        </div>

        {/* Cash & Credit + Leasing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Cash & Kredit cards */}
          <div className="grid grid-cols-2 gap-3 content-start">
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
                <span className="font-bold text-emerald-800 text-sm">Cash</span>
              </div>
              <p className="text-2xl font-black text-emerald-700 tabular-nums">
                {(data?.summary?.cashMonthCount || 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {data?.summary?.cashMonthPercent || 0}% dari total
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                  <CreditCard size={16} />
                </div>
                <span className="font-bold text-amber-800 text-sm">Kredit</span>
              </div>
              <p className="text-2xl font-black text-amber-700 tabular-nums">
                {(data?.summary?.creditMonthCount || 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {data?.summary?.creditMonthPercent || 0}% dari total
              </p>
            </div>
          </div>

          {/* Right: Leasing Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <CreditCard size={16} className="text-blue-600" />
              <h3 className="font-bold text-slate-800 text-sm">Leasing Breakdown</h3>
            </div>
            <div className="space-y-3">
              {(data?.byLeasing || []).map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-[10px] text-slate-400">{item.percent}%</span>
                    </div>
                    <span className="font-bold text-slate-800 tabular-nums">{item.count} unit</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: LEASING_COLORS[item.name] || '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Transaksi */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
            <Receipt size={16} className="text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">Detail Transaksi</h3>
            <span className="text-xs text-slate-500 ml-auto">{(data?.transactions || []).length} transaksi</span>
          </div>
          {(data?.transactions || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">SO Number</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Tanggal</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500 whitespace-nowrap">Coordinator</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Sales</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Customer</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Tipe</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Model</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-slate-500">Leasing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.transactions || []).map((tx) => (
                    <tr key={tx.so_number} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-mono text-slate-700">{tx.so_number}</td>
                      <td className="py-1.5 px-2 text-slate-600">{formatTanggalIndo(tx.so_date)}</td>
                      <td className="py-1.5 px-2 text-slate-600 text-[10px]">{tx.sales_coord_name || '-'}</td>
                      <td className="py-1.5 px-2 font-medium text-slate-700">{tx.salesman || '-'}</td>
                      <td className="py-1.5 px-2 text-slate-600">{tx.customer_name || '-'}</td>
                      <td className="py-1.5 px-2 text-slate-600">{tx.type || '-'}</td>
                      <td className="py-1.5 px-2 text-slate-600">{tx.model || '-'}</td>
                      <td className="py-1.5 px-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          tx.sales_type === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {tx.sales_type || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">Tidak ada transaksi untuk tanggal ini.</p>
          )}
        </div>
      </div>
    </div>
  )
}
