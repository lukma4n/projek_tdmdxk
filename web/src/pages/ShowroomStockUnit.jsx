import { useEffect, useState } from 'react'
import { API_BASE, api } from '../services/api'
import { BatteryCharging, Bike, Download, Loader2, MapPin, Package, Printer, RefreshCw, Search, Timer } from 'lucide-react'
import StockUnitBarcodeLabel from '../components/common/StockUnitBarcodeLabel'

function formatCurrency(value) {
  return `Rp ${(value || 0).toLocaleString('id-ID')}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getAgingTagByIncomingDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const monthIndex = date.getMonth()
  return String.fromCharCode(65 + monthIndex)
}

function agingTagYearClass(yearValue) {
  const year = parseInt(yearValue)
  if (!Number.isFinite(year)) return 'bg-hover text-text border-border'
  if (year <= 2023) return 'bg-danger-50 text-danger-700 border-danger-200'
  if (year === 2024) return 'bg-warning-50 text-warning-700 border-warning-200'
  if (year === 2025) return 'bg-accent-soft text-accent-text border-accent-soft'
  return 'bg-success-50 text-success-700 border-success-200'
}

function isPosOrPameranLocation(locationValue) {
  const location = String(locationValue || '').toLowerCase()
  return location.includes('pos') || location.includes('pameran')
}

function calculateIncomingAgingDays(incomingDate) {
  if (!incomingDate) return 0
  const date = new Date(incomingDate)
  if (Number.isNaN(date.getTime())) return 0
  const today = new Date()
  const diffMs = today.getTime() - date.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

function getAgingFifoDays(unit) {
  if (isPosOrPameranLocation(unit.location)) {
    return unit.movement_aging_days || 0
  }
  return calculateIncomingAgingDays(unit.incoming_date)
}

function normalizeUnitStateLabel(value) {
  const state = String(value || '').trim()
  if (!state) return '-'
  return state.replace(/^stock\s+/i, '').trim() || state
}

function agingToneClass(days) {
  if (days >= 90) return 'bg-danger-50 text-danger-600 border-danger-200'
  if (days >= 60) return 'bg-warning-50 text-warning-600 border-warning-200'
  return 'bg-success-50 text-success-600 border-success-200'
}

const KSU_LABELS = {
  belum_dicek: 'Belum dicek',
  belum_lengkap: 'Belum lengkap',
  lengkap: 'Lengkap',
  sudah_diserahkan: 'Diserahkan',
}

const AGING_TAG_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function ksuBadgeClass(status) {
  if (status === 'lengkap') return 'bg-success-50 text-success-600 border-success-200'
  if (status === 'sudah_diserahkan') return 'bg-accent-soft text-accent border-accent-soft'
  if (status === 'belum_lengkap') return 'bg-warning-50 text-warning-600 border-warning-200'
  return 'bg-hover text-muted border-border'
}

function ksuStandardText(ksu) {
  if (!ksu?.standard) return 'Standar belum ada'
  if (!ksu.standard.is_verified) return 'Standar belum lengkap'
  if (!ksu.standard.battery_required) return 'Standar OK - tanpa aki'
  return `Standar OK - aki ${ksu.standard.standard_battery_type || '-'}`
}

const emptyKsuForm = {
  has_helmet: false,
  has_service_book: false,
  has_tool_kit: false,
  has_mirror: false,
  has_battery: false,
  actual_battery_type: '',
  status: 'belum_lengkap',
  notes: '',
}

function chunkItems(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function ShowroomStockUnit() {
  const [units, setUnits] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({ series: [], states: [], locations: [] })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [series, setSeries] = useState('all')
  const [state, setState] = useState('all')
  const [location, setLocation] = useState('all')
  const [agingMin, setAgingMin] = useState('all')
  const [agingTag, setAgingTag] = useState('all')
  const [ksuModal, setKsuModal] = useState(null)
  const [ksuForm, setKsuForm] = useState(emptyKsuForm)
  const [ksuSaving, setKsuSaving] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedMap, setSelectedMap] = useState(new Map())
  const [printingAll, setPrintingAll] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = {
        page: 1,
        limit: 50,
        ...(search && { search }),
        ...(series !== 'all' && { series }),
        ...(state !== 'all' && { state }),
        ...(location !== 'all' && { location }),
        ...(agingMin !== 'all' && { aging_min: agingMin }),
        ...(agingTag !== 'all' && { aging_tag: agingTag }),
      }
      const [listRes, summaryRes, filterRes] = await Promise.all([
        api.getShowroomStockUnits(params),
        api.getShowroomStockUnitSummary(),
        api.getShowroomStockUnitFilters(),
      ])
      setUnits(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0, totalPages: 1 })
      setSummary(summaryRes)
      setFilters(filterRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat stock unit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, series, state, location, agingMin, agingTag])

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(series !== 'all' && { series }),
        ...(state !== 'all' && { state }),
        ...(location !== 'all' && { location }),
        ...(agingMin !== 'all' && { aging_min: agingMin }),
        ...(agingTag !== 'all' && { aging_tag: agingTag }),
      }).toString()

      const response = await fetch(`${API_BASE}/showroom/stock-units/export${params ? '?' + params : ''}`, {
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
      a.download = `Stock_Unit_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal export stock unit: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const openKsuModal = async (unit) => {
    try {
      const res = await api.getShowroomUnitKsu(unit.engine_number)
      const check = res.ksu?.check
      setKsuModal(res)
      setKsuForm({
        has_helmet: Boolean(check?.has_helmet),
        has_service_book: Boolean(check?.has_service_book),
        has_tool_kit: Boolean(check?.has_tool_kit),
        has_mirror: Boolean(check?.has_mirror),
        has_battery: Boolean(check?.has_battery),
        actual_battery_type: check?.actual_battery_type || '',
        status: res.ksu?.status === 'sudah_diserahkan' ? 'sudah_diserahkan' : 'belum_lengkap',
        notes: check?.notes || '',
      })
    } catch (err) {
      alert('Gagal membuka KSU: ' + err.message)
    }
  }

  const saveKsu = async () => {
    try {
      setKsuSaving(true)
      await api.updateShowroomUnitKsu(ksuModal.unit.engine_number, ksuForm)
      setKsuModal(null)
      await loadData()
    } catch (err) {
      alert('Gagal simpan KSU: ' + err.message)
    } finally {
      setKsuSaving(false)
    }
  }

  // Batch print label
  const printLabels = (labelItems, title = 'Print Label Stock Unit') => {
    const printableItems = labelItems.filter((item) => item.engine_number)
    if (!printableItems.length) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pagesHtml = chunkItems(printableItems, 12).map((pageItems) => `
      <div class="page">
        ${pageItems.map((item) => `
          <div class="label">
            <div class="header">STOCK UNIT - TDM Ketapang</div>
            <div class="series">${escapeHtml(item.series || '-')} / ${escapeHtml(item.color || '-')}</div>
            <div class="meta">
              <span class="label-text">No Mesin</span><span>${escapeHtml(item.engine_number)}</span>
              <span class="label-text">No Rangka</span><span>${escapeHtml(item.chassis_number || '-')}</span>
            </div>
            <svg class="barcode" data-code="${escapeHtml(item.engine_number)}"></svg>
          </div>
        `).join('')}
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; padding-top: 2mm; break-after: page; page-break-after: always; }
          .page:last-child { break-after: auto; page-break-after: auto; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .series { font-size: 8px; font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .meta { font-size: 7px; color: #374151; display: grid; grid-template-columns: 13mm 1fr; gap: 0.4mm 1mm; margin-top: 0.8mm; }
          .label-text { color: #6b7280; }
          svg { width: 100%; height: 12mm; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          document.querySelectorAll('.barcode').forEach(svg => {
            JsBarcode(svg, svg.dataset.code, { format: 'CODE128', width: 2, height: 42, displayValue: false, margin: 3 });
          });
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handlePrintSelected = () => {
    const selectedItems = Array.from(selectedMap.values())
    if (!selectedItems.length) {
      alert('Pilih minimal satu unit untuk print')
      return
    }
    printLabels(selectedItems, 'Print Label Stock Unit Terpilih')
  }

  const handlePrintAll = async () => {
    try {
      setPrintingAll(true)
      const total = pagination.total || summary?.total || 1000
      const params = {
        page: 1,
        limit: Math.max(total, 1),
        ...(search && { search }),
        ...(series !== 'all' && { series }),
        ...(state !== 'all' && { state }),
        ...(location !== 'all' && { location }),
        ...(agingMin !== 'all' && { aging_min: agingMin }),
        ...(agingTag !== 'all' && { aging_tag: agingTag }),
      }
      const response = await api.getShowroomStockUnits(params)
      printLabels(response.data || [], 'Print Semua Label Stock Unit')
    } catch (err) {
      alert('Gagal print semua label stock unit: ' + err.message)
    } finally {
      setPrintingAll(false)
    }
  }

  const toggleSelect = (item) => {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedMap((prev) => {
        const next = new Map(prev)
        units.forEach((unit) => next.delete(unit.id))
        return next
      })
    } else {
      setSelectedMap((prev) => {
        const next = new Map(prev)
        units.forEach((unit) => next.set(unit.id, unit))
        return next
      })
    }
  }

  const allPageSelected = units.length > 0 && units.every((u) => selectedMap.has(u.id))
  const somePageSelected = units.some((u) => selectedMap.has(u.id)) && !allPageSelected

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Stock Unit Showroom</h1>
          <p className="text-sm text-muted">Monitoring unit fisik showroom cabang DXK</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700 disabled:opacity-60">
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Export Excel
          </button>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-lg text-sm text-muted hover:bg-hover">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl border border-accent-soft bg-accent-soft text-accent-text">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Total Unit</p><Package size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.total || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Aging &gt;= 60 Hari</p><Timer size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.aging60 || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-danger-200 bg-danger-50 text-danger-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Aging &gt;= 90 Hari</p><Timer size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.aging90 || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Series Terbanyak</p><Bike size={18} /></div>
          <p className="text-xl font-bold mt-1 truncate">{summary?.bySeries?.[0]?.series || '-'}</p>
        </div>
        <div className="p-4 rounded-xl border border-purple-200 bg-accent-soft text-accent">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">KSU Perlu Tindakan</p><BatteryCharging size={18} /></div>
          <p className="text-2xl font-bold mt-1">{(summary?.ksu?.belum_dicek || 0) + (summary?.ksu?.belum_lengkap || 0) + (summary?.ksu?.battery_mismatch || 0)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-hover text-text">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Kebutuhan Aki</p><BatteryCharging size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.ksu?.required_items?.battery || 0}</p>
          <p className="text-xs text-muted">Item lain {summary?.ksu?.total || 0}</p>
        </div>
      </div>

      <div className="bg-panel rounded-xl border border-border shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari engine, chassis, series..." className="w-full pl-9 pr-4 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={series} onChange={(e) => setSeries(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm">
          <option value="all">Semua Series</option>
          {filters.series?.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm">
          <option value="all">Semua State</option>
          {filters.states?.map((item) => <option key={item} value={item}>{normalizeUnitStateLabel(item)}</option>)}
        </select>
        <select value={agingMin} onChange={(e) => setAgingMin(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm">
          <option value="all">Semua Aging</option>
          <option value="30">Aging &gt;= 30 Hari</option>
          <option value="60">Aging &gt;= 60 Hari</option>
          <option value="90">Aging &gt;= 90 Hari</option>
        </select>
        <select value={agingTag} onChange={(e) => setAgingTag(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm">
          <option value="all">Semua Tag Aging</option>
          {AGING_TAG_OPTIONS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm max-w-xs">
          <option value="all">Semua Lokasi</option>
          {filters.locations?.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text">Daftar Stock Unit</span>
            <span className="text-xs text-faint">{(pagination.total || 0).toLocaleString('id-ID')} total data</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintSelected}
              disabled={selectedMap.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-soft text-accent-text text-xs font-medium hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={13} /> Print Terpilih ({selectedMap.size})
            </button>
            <button
              onClick={handlePrintAll}
              disabled={printingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-panel text-muted text-xs font-medium hover:bg-hover disabled:opacity-40"
            >
              {printingAll ? <Loader2 className="animate-spin" size={13} /> : <Printer size={13} />} Print Semua
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-accent" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-hover border-b border-border">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
                    />
                  </th>
                  {['Unit', 'Engine/Chassis', 'Lokasi', 'Aging', 'State', 'KSU', 'Tahun', 'Harga OTR', 'Label'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit) => {
                  const fifoDays = getAgingFifoDays(unit)

                  return <tr key={unit.id} className="hover:bg-hover/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedMap.has(unit.id)}
                        onChange={() => toggleSelect(unit)}
                        className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-text">{unit.series || '-'}</p>
                      <p className="text-xs text-muted">{unit.product_type || '-'} / {unit.color || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      <p>{unit.engine_number}</p>
                      <p className="text-faint">{unit.chassis_number || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted max-w-xs">
                      <div className="flex items-start gap-1"><MapPin size={13} className="mt-0.5 shrink-0 text-faint" /><span>{unit.location || '-'}</span></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${agingToneClass(unit.stock_aging_days || 0)}`}>{unit.stock_aging_days || 0} hari</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${agingTagYearClass(unit.year)}`}>Tag {getAgingTagByIncomingDate(unit.incoming_date)}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${agingToneClass(fifoDays)}`}>FIFO {fifoDays} hari</span>
                      </div>
                      <p className="text-xs text-faint mt-1">Masuk {formatDate(unit.incoming_date)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{normalizeUnitStateLabel(unit.engine_state)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => openKsuModal(unit)} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ksuBadgeClass(unit.ksu?.status)}`} title="Klik untuk cek KSU unit">
                        {KSU_LABELS[unit.ksu?.status] || 'Belum dicek'}
                      </button>
                      <p className={`text-xs mt-1 ${unit.ksu?.standard?.is_verified ? 'text-faint' : 'text-warning-600'}`}>{ksuStandardText(unit.ksu)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">{unit.year || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
                      {unit.otr_price ? formatCurrency(unit.otr_price) : <span className="text-warning-600">Belum ada OTR</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedItem(unit)}
                        className="rounded-lg bg-hover p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                        title="Print label barcode"
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedItem && <StockUnitBarcodeLabel item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {ksuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/80 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-panel shadow-xl">
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-bold text-text-strong">Cek Fisik KSU Unit</h2>
              <p className="text-sm text-muted">{ksuModal.unit.series} / {ksuModal.unit.product_type} / {ksuModal.unit.engine_number}</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-accent-soft bg-accent-soft p-3 text-sm text-accent-text">
                {ksuStandardText(ksuModal.ksu)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['has_helmet', 'Helm standar Honda'],
                  ['has_service_book', 'Buku servis'],
                  ['has_tool_kit', 'Tools'],
                  ['has_mirror', 'Spion'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-text">
                    <input type="checkbox" checked={ksuForm[key]} onChange={(e) => setKsuForm((form) => ({ ...form, [key]: e.target.checked }))} className="h-4 w-4 rounded border-border-strong" /> {label}
                  </label>
                ))}
                {ksuModal.ksu?.standard?.battery_required && (
                  <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-text">
                    <input type="checkbox" checked={ksuForm.has_battery} onChange={(e) => setKsuForm((form) => ({ ...form, has_battery: e.target.checked }))} className="h-4 w-4 rounded border-border-strong" /> Aki
                  </label>
                )}
              </div>
              {ksuModal.ksu?.standard?.battery_required && (
                <div>
                  <label className="text-xs font-semibold text-muted">Tipe Aki Aktual</label>
                  <select value={ksuForm.actual_battery_type} onChange={(e) => setKsuForm((form) => ({ ...form, actual_battery_type: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm">
                    <option value="">Pilih tipe aki</option>
                    {(ksuModal.batteryTypes || []).map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted">Status</label>
                <select value={ksuForm.status} onChange={(e) => setKsuForm((form) => ({ ...form, status: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm">
                  <option value="belum_lengkap">Simpan hasil checklist</option>
                  <option value="sudah_diserahkan">KSU sudah diserahkan</option>
                </select>
              </div>
              <textarea value={ksuForm.notes} onChange={(e) => setKsuForm((form) => ({ ...form, notes: e.target.value }))} placeholder="Catatan kekurangan / keterangan" className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-5">
              <button onClick={() => setKsuModal(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:bg-hover">Batal</button>
              <button onClick={saveKsu} disabled={ksuSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:brightness-110 disabled:opacity-60">
                {ksuSaving && <Loader2 className="animate-spin" size={14} />} Simpan KSU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
