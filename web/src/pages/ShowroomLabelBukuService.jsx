import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import ServiceBookLabel from '../components/common/ServiceBookLabel'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Printer,
  CalendarDays,
  Search,
  BookOpen,
} from 'lucide-react'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export default function ShowroomLabelBukuService() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState(getTodayStr)
  const [selectedItem, setSelectedItem] = useState(null)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await api.getServiceBookLabels({ date })
      setItems(result.items || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat data label buku service')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleShortcut = (type) => {
    if (type === 'today') {
      setDate(getTodayStr())
    } else if (type === 'yesterday') {
      setDate(getYesterdayStr())
    }
  }

  const handlePrintAll = async () => {
    if (!filteredItems.length) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Duplicate each item 3 times (3 labels per customer)
    const allLabels = []
    filteredItems.forEach((item) => {
      allLabels.push(item, item, item)
    })

    const labelsPerPage = 12 // 3 columns x 4 rows
    const pages = []
    for (let i = 0; i < allLabels.length; i += labelsPerPage) {
      pages.push(allLabels.slice(i, i + labelsPerPage))
    }

    const renderLabel = (item, idx) => {
      const svgId = `barcode-${idx}`
      return `
        <div class="label">
          <div class="header">BUKU SERVICE - TDM KETAPANG</div>
          <div class="meta">
            <span class="meta-label">NO MESIN / RANGKA</span>
            <span class="meta-value">${escapeHtml(item.no_engine)} / ${escapeHtml(item.no_frame)}</span>
            <span class="meta-label">TYPE</span>
            <span class="meta-value">${escapeHtml(item.model && item.model !== '-' ? item.model : '-')}</span>
            <span class="meta-label">NAMA</span>
            <span class="name-value">${escapeHtml(item.customer_name)}</span>
            <span class="meta-label">ALAMAT</span>
            <span class="meta-value">${escapeHtml(item.alamat)}</span>
            <span class="meta-label">TGL PEMBELIAN</span>
            <span class="meta-value">${escapeHtml(item.so_date)}</span>
          </div>
          <svg id="${svgId}" class="barcode"></svg>
        </div>
      `
    }

    const barcodeScripts = allLabels.map((item, idx) => {
      if (!item.no_engine || item.no_engine === '-') return ''
      return `JsBarcode("#barcode-${idx}", "${item.no_engine}", { format: "CODE128", width: 2, height: 42, displayValue: false, margin: 3 });`
    }).filter(Boolean).join('\n')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label Buku Service - ${date}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .meta { font-size: 7px; color: #111827; display: grid; grid-template-columns: 20mm 1fr; gap: 0.3mm 0.8mm; }
          .meta-label { color: #111827; }
          .meta-value { font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .name-value { font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .barcode { width: 100%; height: 12mm; margin-top: 0.8mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pages.map((page, pIdx) => `<div class="page">${page.map((item, iIdx) => renderLabel(item, pIdx * labelsPerPage + iIdx)).join('')}</div>`).join('')}
        <script>
          window.onload = () => {
            ${barcodeScripts}
            setTimeout(() => { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const filteredItems = items.filter((item) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      item.so_number.toLowerCase().includes(s) ||
      item.customer_name.toLowerCase().includes(s) ||
      item.no_engine.toLowerCase().includes(s) ||
      item.salesman.toLowerCase().includes(s)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-accent mx-auto" size={32} />
          <p className="text-sm text-muted">Memuat data label buku service...</p>
        </div>
      </div>
    )
  }

  if (error) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">Label Buku Service</h1>
          <p className="text-sm text-muted mt-1">
            Cetak label stiker untuk buku service fisik customer
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
          <button
            onClick={() => handleShortcut('today')}
            className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:brightness-110 transition-colors"
          >
            Hari Ini
          </button>
          <button
            onClick={() => handleShortcut('yesterday')}
            className="px-3 py-2 text-xs font-semibold bg-hover text-text rounded-lg hover:bg-hover transition-colors"
          >
            Kemarin
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover transition-all shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handlePrintAll}
            disabled={!filteredItems.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:brightness-110 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> Print Semua ({filteredItems.length * 3} label)
          </button>
        </div>
      </div>

      {/* Search & Count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Cari SO, customer, no mesin, atau salesman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <CalendarDays size={16} />
          <span className="font-medium">{filteredItems.length} transaksi</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        {filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-hover text-left">
                  <th className="py-3 px-4 font-semibold text-muted">No</th>
                  <th className="py-3 px-4 font-semibold text-muted">SO Number</th>
                  <th className="py-3 px-4 font-semibold text-muted">Tanggal</th>
                  <th className="py-3 px-4 font-semibold text-muted">Customer</th>
                  <th className="py-3 px-4 font-semibold text-muted">No Mesin</th>
                  <th className="py-3 px-4 font-semibold text-muted">Type</th>
                  <th className="py-3 px-4 font-semibold text-muted">Model</th>
                  <th className="py-3 px-4 font-semibold text-muted">Salesman</th>
                  <th className="py-3 px-4 font-semibold text-muted">Leasing</th>
                  <th className="py-3 px-4 font-semibold text-muted text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.so_number}
                    className="border-b border-border hover:bg-accent-soft/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-muted tabular-nums">{item.no}</td>
                    <td className="py-3 px-4 font-mono text-xs text-text">{item.so_number}</td>
                    <td className="py-3 px-4 text-muted">{item.so_date}</td>
                    <td className="py-3 px-4 font-medium text-text">{item.customer_name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted">{item.no_engine}</td>
                    <td className="py-3 px-4 text-muted">{item.type}</td>
                    <td className="py-3 px-4 text-muted">{item.model}</td>
                    <td className="py-3 px-4 text-muted">{item.salesman}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.sales_type === 'Cash'
                            ? 'bg-success-soft text-success'
                            : item.sales_type === 'FIF'
                            ? 'bg-accent-soft text-accent-text'
                            : 'bg-hover text-muted'
                        }`}
                      >
                        {item.sales_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft text-accent-text rounded-lg text-xs font-semibold hover:bg-accent-soft transition-colors"
                        title="Preview & Print Label"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-faint">
            <BookOpen size={40} className="mb-3" />
            <p className="text-sm">Tidak ada transaksi untuk tanggal ini</p>
            <p className="text-xs mt-1">Pilih tanggal lain atau import data penjualan terlebih dahulu</p>
          </div>
        )}
      </div>

      {/* Label Preview Modal */}
      {selectedItem && (
        <ServiceBookLabel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
