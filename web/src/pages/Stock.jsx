import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Search, Package, AlertTriangle, Loader2, Printer, MapPin, LayoutGrid, List, Check, X } from 'lucide-react'
import BarcodeLabel from '../components/common/BarcodeLabel'

function getAgingColor(days) {
  if (days > 365) return { bg: 'bg-danger-50', text: 'text-danger-600', border: 'border-danger-200', badge: 'bg-danger-100 text-danger-700' }
  if (days >= 180) return { bg: 'bg-warning-50', text: 'text-warning-600', border: 'border-warning-200', badge: 'bg-warning-100 text-warning-700' }
  return { bg: 'bg-success-50', text: 'text-success-600', border: 'border-success-200', badge: 'bg-success-100 text-success-700' }
}

function getAgingLabel(days) {
  if (days > 365) return 'Kritis'
  if (days >= 180) return 'Pantau'
  return 'Aman'
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

export default function Stock() {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterRanking, setFilterRanking] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [locationSummary, setLocationSummary] = useState([])
  const [viewMode, setViewMode] = useState('list') // 'list' | 'location'
  const [, setPagination] = useState({ page: 1, totalPages: 1 })
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedMap, setSelectedMap] = useState(new Map())

  const selectedCount = selectedMap.size
  const allPageSelected = stock.length > 0 && stock.every((item) => selectedMap.has(item.id))

  const loadStock = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        limit: 50,
        ...(searchTerm && { search: searchTerm }),
        ...(filterCategory !== 'all' && { kategori: filterCategory }),
        ...(filterRanking !== 'all' && { ranking: filterRanking }),
        ...(filterLocation !== 'all' && { lokasi: filterLocation }),
      }
      const data = await api.getStock(params)
      setStock(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await api.getCategories()
      setCategories(data.data)
    } catch {
      // ignore
    }
  }

  const loadLocations = async () => {
    try {
      const data = await api.getStockLocations()
      setLocationSummary(data.data || [])
      setLocations(data.data?.map((l) => l.location) || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadStock()
      loadCategories()
      loadLocations()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterCategory, filterRanking, filterLocation])

  const handlePrintBatch = (items) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const pagesHtml = chunkItems(items.filter((item) => item.product_code), 12).map((pageItems) => `
      <div class="page">
        ${pageItems.map(item => `
          <div class="label">
            <div class="header">DXK - ${escapeHtml(item.branch_code || 'DXK')}</div>
            <div class="code">${escapeHtml(item.product_code)}</div>
            <div class="name">${escapeHtml(item.product_name)}</div>
            <svg class="barcode" data-code="${escapeHtml(item.product_code)}"></svg>
            <div class="meta">
              <span>Cat: ${escapeHtml(item.kategori || '-')}</span>
              <span>Qty: ${escapeHtml(item.qty_available || 0)}</span>
              <span>Rnk: ${escapeHtml(item.ranking || '-')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Label Batch</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; padding-top: 2mm; break-after: page; page-break-after: always; }
          .page:last-child { break-after: auto; page-break-after: auto; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .code { font-size: 8px; font-family: monospace; font-weight: bold; color: #111827; margin-bottom: 0.8mm; }
          .name { font-size: 7px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .meta { font-size: 7px; color: #6b7280; display: flex; justify-content: space-between; margin-top: 0.8mm; }
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
        stock.forEach((item) => next.delete(item.id))
        return next
      })
    } else {
      setSelectedMap((prev) => {
        const next = new Map(prev)
        stock.forEach((item) => next.set(item.id, item))
        return next
      })
    }
  }

  const handlePrintSelected = () => {
    const selectedItems = Array.from(selectedMap.values())
    if (!selectedItems.length) return
    handlePrintBatch(selectedItems)
  }

  const clearSelection = () => setSelectedMap(new Map())

  const criticalCount = stock.filter((s) => s.aging_days > 365).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stok Sparepart</h1>
          <p className="text-sm text-slate-500">{stock.length} part ditampilkan</p>
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-50 text-danger-600 rounded-lg border border-danger-200 text-sm font-medium">
            <AlertTriangle size={14} />
            {criticalCount} part kritis
          </div>
        )}
      </div>

      {/* Kartu Ringkasan Lokasi */}
      {locationSummary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {locationSummary.map((loc) => (
            <button
              key={loc.location}
              onClick={() => setFilterLocation(loc.location)}
              className={`text-left rounded-xl border p-3 shadow-sm transition-all ${
                filterLocation === loc.location
                  ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-300'
                  : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <MapPin size={13} />
                {loc.location}
              </div>
              <div className="text-lg font-bold text-slate-800">{loc.total_parts}</div>
              <div className="text-xs text-slate-400">{loc.total_qty_available.toLocaleString('id-ID')} qty</div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama part..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterRanking}
          onChange={(e) => setFilterRanking(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Ranking</option>
          {['A', 'B', 'C', 'D', 'E'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Lokasi</option>
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === 'list' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Tampilan list"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('location')}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === 'location' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Tampilan lokasi"
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrintSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white transition-colors"
              title={`Print ${selectedCount} label terpilih`}
            >
              <Printer size={14} />
              <span>Print Terpilih</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{selectedCount}</span>
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              title="Batal pilih"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <button
          onClick={() => stock.length > 0 && handlePrintBatch(stock.slice(0, 20))}
          disabled={selectedCount > 0 || !stock.length}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-sm text-slate-600 transition-colors disabled:opacity-60"
          title="Print 20 label pertama"
        >
          <Printer size={14} />
          Print Batch
        </button>
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
                  <th className="px-3 py-3 text-center w-10">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors">
                      {allPageSelected ? <Check size={14} className="text-blue-600" /> : null}
                    </button>
                  </th>
                  {['Kode Part', 'Nama Barang', 'Kategori', 'Lokasi', 'Aging', 'Qty', 'Ranking', 'Barcode'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.map((item) => {
                  const colors = getAgingColor(item.aging_days)
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${colors.bg} border-l-4 ${colors.border}`}>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleSelect(item)} className="flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors">
                          {selectedMap.has(item.id) ? <Check size={14} className="text-blue-600" /> : null}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-700">{item.product_code}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{item.product_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} />
                          {item.location || item.lokasi || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${colors.text}`}>{item.aging_days} hari</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${colors.badge}`}>
                            {getAgingLabel(item.aging_days)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.qty_available}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      item.ranking === 'E' ? 'bg-danger-100 text-danger-700' :
                      item.ranking === 'D' ? 'bg-warning-100 text-warning-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {item.ranking}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                      title="Print label barcode"
                    >
                      <Printer size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}

    {selectedItem && <BarcodeLabel item={selectedItem} onClose={() => setSelectedItem(null)} />}

    {stock.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Package className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-slate-500">Tidak ada data stok</p>
          </div>
        )}
      </div>
    </div>
  )
}
