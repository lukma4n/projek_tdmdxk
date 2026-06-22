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
  Monitor,
  Smartphone,
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
  const [screenshotFormat, setScreenshotFormat] = useState('desktop') // 'desktop' | 'mobile'
  const reportRef = useRef(null)
  const today = getTodayStr()
  const [closingDate, setClosingDate] = useState(today)
  
  // Filter states
  const [filterLeasing, setFilterLeasing] = useState('all')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterSales, setFilterSales] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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
      handleDateChange(getTodayStr())
    } else if (type === 'yesterday') {
      handleDateChange(getYesterdayStr())
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
      // Tunggu 500ms agar DOM stabil sebelum capture
      await new Promise(resolve => setTimeout(resolve, 500))
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: false,
        style: { transform: 'none' },
      })
      const link = document.createElement('a')
      const formatLabel = screenshotFormat === 'mobile' ? 'Mobile' : 'Desktop'
      link.download = `Closing_Harian_${closingDate}_${formatLabel}.png`
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
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data closing harian...</p>
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

  // Cari team dengan total tertinggi untuk badge TOP TEAM
  const topTeam = (data?.byTeam || []).reduce((max, team) => 
    team.total > (max?.total || 0) ? team : max, null
  )

  // Filter transaksi
  const filteredTransactions = (data?.transactions || []).filter(tx => {
    // Filter by leasing
    const txLeasing = tx.sales_type === 'Cash' ? 'Cash' : (tx.finco || tx.sales_type || '-')
    if (filterLeasing !== 'all' && txLeasing !== filterLeasing) return false
    
    // Filter by team
    if (filterTeam !== 'all' && tx.sales_coord_name !== filterTeam) return false
    
    // Filter by sales
    if (filterSales !== 'all' && tx.salesman !== filterSales) return false
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchSO = (tx.so_number || '').toLowerCase().includes(query)
      const matchCustomer = (tx.customer_name || '').toLowerCase().includes(query)
      const matchModel = (tx.model || '').toLowerCase().includes(query)
      const matchSales = (tx.salesman || '').toLowerCase().includes(query)
      if (!matchSO && !matchCustomer && !matchModel && !matchSales) return false
    }
    
    return true
  })

  // Hitung total transaksi per leasing untuk footer tabel (dari filtered)
  const leasingTotals = filteredTransactions.reduce((acc, tx) => {
    const leasing = tx.sales_type === 'Cash' ? 'Cash' : (tx.finco || tx.sales_type || 'Lainnya')
    acc[leasing] = (acc[leasing] || 0) + 1
    return acc
  }, {})
  
  // Extract unique values untuk dropdown filter
  const uniqueLeasings = [...new Set((data?.transactions || []).map(tx => 
    tx.sales_type === 'Cash' ? 'Cash' : (tx.finco || tx.sales_type || '-')
  ))].filter(Boolean).sort()
  
  const uniqueTeams = [...new Set((data?.transactions || []).map(tx => 
    tx.sales_coord_name
  ))].filter(Boolean).sort()
  
  const uniqueSalesmen = [...new Set((data?.transactions || []).map(tx => 
    tx.salesman
  ))].filter(Boolean).sort()
  
  // Reset filters when date changes
  const handleDateChange = (newDate) => {
    setClosingDate(newDate)
    setFilterLeasing('all')
    setFilterTeam('all')
    setFilterSales('all')
    setSearchQuery('')
  }

  // Inline stat cards (size=small) untuk report yang compact
  const stats = [
    {
      label: 'Closing DO',
      value: summary.closingDo || 0,
      subtext: formatTanggalIndo(data?.period?.from),
      icon: Bike,
      colorClass: 'text-accent-text',
      borderClass: 'border-accent-soft',
      iconBgClass: 'bg-accent-soft text-accent',
    },
    {
      label: 'Cash',
      value: summary.cashCount || 0,
      subtext: `${summary.cashPercent || 0}%`,
      icon: TrendingUp,
      colorClass: 'text-success',
      borderClass: 'border-emerald-200',
      iconBgClass: 'bg-success-soft text-success',
    },
    {
      label: 'Kredit',
      value: summary.creditCount || 0,
      subtext: `${summary.creditPercent || 0}%`,
      icon: CreditCard,
      colorClass: 'text-warning',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-warning-soft text-warning',
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
      colorClass: 'text-text',
      borderClass: 'border-border',
      iconBgClass: 'bg-hover text-muted',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {loading && data && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-0.5 bg-accent animate-pulse" />
        </div>
      )}
      {error && data && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger-soft border border-red-200 rounded-lg text-sm text-danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto text-xs font-semibold underline">Coba Lagi</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">
            Laporan Closing Harian
          </h1>
          <p className="text-sm text-muted mt-1">
            Laporan harian siap screenshot untuk share ke tim marketing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={closingDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
          <button onClick={() => handleClosingShortcut('today')} className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:brightness-110 transition-colors">
            Hari Ini
          </button>
          <button onClick={() => handleClosingShortcut('yesterday')} className="px-3 py-2 text-xs font-semibold bg-hover text-text rounded-lg hover:bg-hover transition-colors">
            Kemarin
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover transition-all shadow-sm"
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
          
          {/* Screenshot Format Toggle */}
          <div className="flex items-center gap-1 bg-hover rounded-lg p-1">
            <button
              onClick={() => setScreenshotFormat('desktop')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                screenshotFormat === 'desktop' 
                  ? 'bg-panel text-text-strong shadow-sm' 
                  : 'text-muted hover:text-text-strong'
              }`}
            >
              <Monitor size={14} />
              Desktop
            </button>
            <button
              onClick={() => setScreenshotFormat('mobile')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                screenshotFormat === 'mobile' 
                  ? 'bg-panel text-text-strong shadow-sm' 
                  : 'text-muted hover:text-text-strong'
              }`}
            >
              <Smartphone size={14} />
              Mobile
            </button>
          </div>
          
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
      <div 
        ref={reportRef} 
        className={`space-y-6 bg-panel p-6 rounded-xl border border-border transition-all ${
          screenshotting 
            ? screenshotFormat === 'mobile' 
              ? 'w-[768px] min-w-[768px]' 
              : 'w-[1200px] min-w-[1200px]'
            : ''
        }`}
      >
        {/* Report Header */}
        <div className="flex items-start justify-between pb-6 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent text-[10px] font-bold tracking-wider">
                TDM KETAPANG
              </span>
            </div>
            <h2 className="text-2xl font-black text-text-strong tracking-tight uppercase">
              LAPORAN CLOSING HARIAN SHOWROOM
            </h2>
            <p className="text-sm text-muted font-medium">
              Tanggal: {formatTanggalIndo(data?.period?.from)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold text-faint tracking-wider">STATUS LAPORAN</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-soft border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              <span className="text-xs font-bold text-success">FINALIZED</span>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((card) => (
            <div key={card.label} className={`rounded-xl border ${card.borderClass} bg-panel p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{card.label}</p>
                  <p className={`text-2xl font-black ${card.colorClass} tabular-nums`}>{(card.value || 0).toLocaleString('id-ID')}</p>
                  {card.subtext && <p className="text-[10px] text-muted leading-tight">{card.subtext}</p>}
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
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
            <Users size={18} className="text-accent" />
            <h3 className="font-bold text-text">Team Performance (Kumulatif Bulan Ini)</h3>
            <span className="text-xs text-muted ml-auto">{data?.byTeam?.length || 0} Team</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 scrollbar-hide overflow-x-auto">
            {(data?.byTeam || []).map((team) => (
              <TeamCard 
                key={team.team} 
                {...team} 
                collapsible={false}
                isTopTeam={topTeam && team.team === topTeam.team}
              />
            ))}
          </div>
        </div>

        {/* Cash & Credit + Leasing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Cash & Kredit cards */}
          <div className="grid grid-cols-2 gap-3 content-start">
            <div className="bg-success-soft rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-success-soft text-success">
                  <TrendingUp size={16} />
                </div>
                <span className="font-bold text-emerald-800 text-sm">Cash</span>
              </div>
              <p className="text-2xl font-black text-success tabular-nums">
                {(data?.summary?.cashMonthCount || 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-success mt-1">
                {data?.summary?.cashMonthPercent || 0}% dari total
              </p>
            </div>
            <div className="bg-warning-soft rounded-lg border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning-soft text-warning">
                  <CreditCard size={16} />
                </div>
                <span className="font-bold text-amber-800 text-sm">Kredit</span>
              </div>
              <p className="text-2xl font-black text-warning tabular-nums">
                {(data?.summary?.creditMonthCount || 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-warning mt-1">
                {data?.summary?.creditMonthPercent || 0}% dari total
              </p>
            </div>
          </div>

          {/* Right: Leasing Breakdown */}
          <div className="bg-panel rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <CreditCard size={16} className="text-accent" />
              <h3 className="font-bold text-text text-sm uppercase tracking-wide">Leasing Breakdown</h3>
            </div>
            <div className="space-y-3">
              {(data?.byLeasing || []).map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text">{item.name}</span>
                      <span className="text-xs text-muted font-medium">({item.percent}%)</span>
                    </div>
                    <span className="font-bold text-text tabular-nums">{item.count} unit</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-hover overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
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
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
            <Receipt size={16} className="text-accent" />
            <h3 className="font-bold text-text text-sm">Detail Transaksi</h3>
            <span className="text-xs text-muted ml-auto">
              {filteredTransactions.length} dari {(data?.transactions || []).length} transaksi
            </span>
          </div>
          
          {(data?.transactions || []).length > 0 ? (
            <>
              {/* Filter Controls */}
              <div className="bg-hover border border-border rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Search */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      🔍 Cari
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="SO, Customer, Model, Sales..."
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-panel text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    />
                  </div>
                  
                  {/* Filter Leasing */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      💳 Leasing
                    </label>
                    <select
                      value={filterLeasing}
                      onChange={(e) => setFilterLeasing(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    >
                      <option value="all">Semua Leasing</option>
                      {uniqueLeasings.map(leasing => (
                        <option key={leasing} value={leasing}>{leasing}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Filter Team */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      👥 Team Leader
                    </label>
                    <select
                      value={filterTeam}
                      onChange={(e) => setFilterTeam(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    >
                      <option value="all">Semua Team</option>
                      {uniqueTeams.map(team => (
                        <option key={team} value={team}>{team.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Filter Sales */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      👤 Sales
                    </label>
                    <select
                      value={filterSales}
                      onChange={(e) => setFilterSales(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    >
                      <option value="all">Semua Sales</option>
                      {uniqueSalesmen.map(sales => (
                        <option key={sales} value={sales}>{sales.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Reset Filter Button */}
                {(filterLeasing !== 'all' || filterTeam !== 'all' || filterSales !== 'all' || searchQuery) && (
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted">
                      Filter aktif: <strong>{filteredTransactions.length}</strong> transaksi ditampilkan
                    </span>
                    <button
                      onClick={() => {
                        setFilterLeasing('all')
                        setFilterTeam('all')
                        setFilterSales('all')
                        setSearchQuery('')
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-muted bg-panel border border-border-strong rounded-lg hover:bg-hover transition-colors"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}
              </div>
              
              {/* Tabel atau Empty State */}
              {filteredTransactions.length === 0 ? (
                <div className="bg-hover border border-border rounded-lg p-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-hover rounded-full flex items-center justify-center mb-3">
                    <Receipt className="text-faint" size={28} />
                  </div>
                  <p className="text-sm font-semibold text-muted mb-1">Tidak ada transaksi ditemukan</p>
                  <p className="text-xs text-muted">
                    Coba ubah filter atau kata kunci pencarian
                  </p>
                </div>
              ) : (
              <div className="overflow-x-auto -mx-2 px-2 scrollbar-hide mb-4">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-hover">
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">No.</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">SO Number</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Tanggal</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Coordinator</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Sales</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Customer</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Tipe</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Model</th>
                        <th className="text-left py-2 px-2 font-semibold text-muted whitespace-nowrap">Leasing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map((tx, idx) => {
                        const leasingLabel = tx.sales_type === 'Cash' ? 'Cash' : (tx.finco || tx.sales_type || '-')
                        const leasingPillClass = leasingLabel === 'Cash'
                          ? 'bg-success-soft text-success border-emerald-200'
                          : leasingLabel === 'FIF' ? 'bg-accent-soft text-accent-text border-accent-soft'
                          : leasingLabel === 'OTO' ? 'bg-warning-soft text-warning border-amber-200'
                          : leasingLabel === 'ADIRA' ? 'bg-teal-100 text-teal-700 border-teal-200'
                          : leasingLabel === 'IMFI' ? 'bg-accent-soft text-accent border-purple-200'
                          : 'bg-hover text-text border-border'
                        const formattedDate = tx.so_date ? new Date(tx.so_date).toLocaleDateString('id-ID', { 
                          day: '2-digit', 
                          month: 'short',
                          year: 'numeric'
                        }) : '-'
                        return (
                        <tr key={tx.so_number} className="hover:bg-hover transition-colors">
                          <td className="py-2 px-2 text-faint tabular-nums">{idx + 1}</td>
                          <td className="py-2 px-2 font-mono text-text whitespace-nowrap">{tx.so_number}</td>
                          <td className="py-2 px-2 text-muted whitespace-nowrap">{formattedDate}</td>
                          <td className="py-2 px-2 text-muted text-[10px] max-w-[120px] truncate" title={tx.sales_coord_name || '-'}>
                            {(tx.sales_coord_name || '-').toUpperCase()}
                          </td>
                          <td className="py-2 px-2 font-medium text-text max-w-[140px] truncate" title={tx.salesman || '-'}>
                            {(tx.salesman || '-').toUpperCase()}
                          </td>
                          <td className="py-2 px-2 text-muted max-w-[160px] truncate" title={tx.customer_name || '-'}>
                            {tx.customer_name || '-'}
                          </td>
                          <td className="py-2 px-2 text-muted whitespace-nowrap">{tx.type || '-'}</td>
                          <td className="py-2 px-2 text-muted max-w-[100px] truncate" title={tx.model || '-'}>
                            {tx.model || '-'}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${leasingPillClass}`}>
                              {leasingLabel}
                            </span>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              {/* Total Summary (Outside Table for Responsive) - Only show if has data */}
              {filteredTransactions.length > 0 && (
              <div className="bg-hover border-t-2 border-border-strong rounded-lg p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm font-bold text-text uppercase tracking-wide">Total</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(leasingTotals)
                      .sort((a, b) => b[1] - a[1])
                      .map(([leasing, count]) => {
                        const pillClass = leasing === 'Cash'
                          ? 'bg-emerald-200 text-emerald-800 border-emerald-300'
                          : leasing === 'FIF' ? 'bg-accent-soft text-accent-text border-accent-soft'
                          : leasing === 'OTO' ? 'bg-amber-200 text-amber-800 border-amber-300'
                          : leasing === 'ADIRA' ? 'bg-teal-200 text-teal-800 border-teal-300'
                          : leasing === 'IMFI' ? 'bg-purple-200 text-purple-800 border-purple-300'
                          : 'bg-hover text-text border-border-strong'
                        return (
                          <span key={leasing} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm leading-none ${pillClass}`}>
                            <span className="leading-none">{leasing}:</span>
                            <span className="leading-none tabular-nums">{count}</span>
                          </span>
                        )
                      })}
                  </div>
                </div>
              </div>
              )}
            </>
          ) : (
            <p className="text-xs text-faint py-4 text-center">Tidak ada transaksi untuk tanggal ini.</p>
          )}
        </div>
      </div>
    </div>
  )
}
