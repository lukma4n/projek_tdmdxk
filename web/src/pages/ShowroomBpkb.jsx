import { useEffect, useState } from 'react'
import { API_BASE, api } from '../services/api'
import { AlertTriangle, Download, FileBadge, Loader2, MapPin, Printer, RefreshCw, Search, UserRound, Check, X } from 'lucide-react'
import BpkbBarcodeLabel from '../components/common/BpkbBarcodeLabel'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getCustomerName(item) {
  return item?.stnk_name || item?.applicant_name || item?.requestor_name || '-'
}

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function chunkItems(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export default function ShowroomBpkb() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({ locations: [] })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedMap, setSelectedMap] = useState(new Map())

  const selectedCount = selectedMap.size
  const allPageSelected = items.length > 0 && items.every((item) => selectedMap.has(item.id))

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = { page: 1, limit: 50, ...(search && { search }), ...(location !== 'all' && { location }) }
      const [listRes, summaryRes, filterRes] = await Promise.all([
        api.getShowroomBpkbs(params),
        api.getShowroomBpkbSummary(),
        api.getShowroomBpkbFilters(),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0, totalPages: 1 })
      setSummary(summaryRes)
      setFilters(filterRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat data BPKB')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, location])

  const handleExport = async () => {
    try {
      setExporting(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(location !== 'all' && { location }),
      }).toString()

      const response = await fetch(`${API_BASE}/showroom/bpkbs/export${params ? '?' + params : ''}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
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
      a.download = `Stock_BPKB_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal export BPKB: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const printLabels = (labelItems, title = 'Print Label BPKB') => {
    const printableItems = labelItems.filter((item) => item.engine_number)
    if (!printableItems.length) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pagesHtml = chunkItems(printableItems, 12).map((pageItems) => `
      <div class="page">
        ${pageItems.map((item) => `
          <div class="label">
            <div class="header">BPKB - TDM Ketapang</div>
            <div class="name">${escapeHtml(getCustomerName(item))}</div>
            <div class="meta">
              <span class="label-text">No Mesin</span><span>${escapeHtml(item.engine_number)}</span>
              <span class="label-text">No BPKB</span><span>${escapeHtml(item.bpkb_number || '-')}</span>
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
          .name { font-size: 8px; font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

  const handlePrintBatch = () => {
    printLabels(items, 'Print Label BPKB Halaman Ini')
  }

  const handlePrintAll = async () => {
    try {
      setPrintingAll(true)
      const total = pagination.total || summary?.total || 1000
      const params = {
        page: 1,
        limit: Math.max(total, 1),
        ...(search && { search }),
        ...(location !== 'all' && { location }),
      }
      const response = await api.getShowroomBpkbs(params)
      printLabels(response.data || [], 'Print Semua Label BPKB')
    } catch (err) {
      alert('Gagal print semua label BPKB: ' + err.message)
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
        items.forEach((item) => next.delete(item.id))
        return next
      })
    } else {
      setSelectedMap((prev) => {
        const next = new Map(prev)
        items.forEach((item) => next.set(item.id, item))
        return next
      })
    }
  }

  const handlePrintSelected = () => {
    const selectedItems = Array.from(selectedMap.values())
    if (!selectedItems.length) return
    printLabels(selectedItems, `Print ${selectedItems.length} Label BPKB Terpilih`)
  }

  const clearSelection = () => setSelectedMap(new Map())

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock BPKB Showroom</h1>
          <p className="text-sm text-slate-500">Monitoring dokumen BPKB cabang DXK</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintSelected}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              >
                <Printer size={16} />
                <span>Print Terpilih</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{selectedCount}</span>
              </button>
              <button
                onClick={clearSelection}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                title="Batal pilih"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <button onClick={handlePrintAll} disabled={ printingAll || selectedCount > 0 || !(pagination.total || items.length) } className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60">
            {printingAll ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />} Print Sesuai Filter
          </button>
          <button onClick={handlePrintBatch} disabled={!items.length || selectedCount > 0} className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-60">
            <Printer size={16} /> Print Halaman Ini
          </button>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700 disabled:opacity-60">
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Export Excel
          </button>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Total BPKB</p><FileBadge size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.total || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-danger-200 bg-danger-50 text-danger-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Overdue &gt;= 365 Hari</p><AlertTriangle size={18} /></div>
          <p className="text-2xl font-bold mt-1">{summary?.overdue365 || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Lokasi Terbanyak</p><MapPin size={18} /></div>
          <p className="text-xl font-bold mt-1 truncate">{summary?.byLocation?.[0]?.bpkb_location || '-'}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Sync Terakhir</p><RefreshCw size={18} /></div>
          <p className="text-lg font-bold mt-1">{formatDate(summary?.latestSyncedAt)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari engine, no BPKB, nama, invoice..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <option value="all">Semua Lokasi</option>
          {filters.locations?.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <div className="flex basis-full items-center gap-2 text-xs text-slate-500">
          <Printer size={13} className="text-slate-400" />
          <span>Print Sesuai Filter akan mencetak semua label dari lokasi/search yang sedang dipilih.</span>
        </div>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Daftar Stock BPKB</span>
          <span className="text-xs text-slate-400">{(pagination.total || 0).toLocaleString('id-ID')} total data</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-3 text-center w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors">
                    {allPageSelected ? <Check size={14} className="text-blue-600" /> : null}
                  </button>
                </th>
                {['Nama', 'Engine/BPKB', 'Lokasi', 'Jadi BPKB', 'Overdue', 'Salesman', 'Label'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggleSelect(item)} className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors">
                        {selectedMap.has(item.id) ? <Check size={14} className="text-blue-600" /> : null}
                      </button>
                    </td>
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{item.stnk_name || '-'}</p><p className="text-xs text-slate-500 flex items-center gap-1"><UserRound size={12} />{item.applicant_name || item.requestor_name || '-'}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600"><p>{item.engine_number}</p><p className="text-slate-400">{item.bpkb_number || '-'}</p></td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.bpkb_location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(item.bpkb_ready_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${item.overdue_days >= 365 ? 'bg-danger-50 text-danger-600 border-danger-200' : 'bg-success-50 text-success-600 border-success-200'}`}>{item.overdue_days || 0} hari</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.salesman || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-500 transition-colors hover:bg-blue-100 hover:text-blue-600"
                        title="Print label BPKB"
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedItem && <BpkbBarcodeLabel item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
