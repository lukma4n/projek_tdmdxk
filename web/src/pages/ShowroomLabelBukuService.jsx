import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../services/api'
import ServiceBookLabel, { LABELS_PER_CUSTOMER } from '../components/common/ServiceBookLabel'
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Printer,
  CalendarDays,
  Search,
  BookOpen,
  CheckCircle2,
  Circle,
} from 'lucide-react'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Pakai komponen tanggal lokal — toISOString() menggeser tanggal ke hari
// sebelumnya bagi pengguna WIB sebelum pukul 07:00.
function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayStr() {
  return toDateStr(new Date())
}

function formatPrintedAt(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ShowroomLabelBukuService() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dateFrom, setDateFrom] = useState(getTodayStr)
  const [dateTo, setDateTo] = useState(getTodayStr)
  const [selectedItem, setSelectedItem] = useState(null)
  const [search, setSearch] = useState('')
  const [sco, setSco] = useState('')
  const [salesman, setSalesman] = useState('')
  const [status, setStatus] = useState('unprinted')
  const [selected, setSelected] = useState(() => new Set())

  const loadData = useCallback(async () => {
    if (dateFrom > dateTo) {
      setError('Tanggal "dari" tidak boleh melewati tanggal "sampai"')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const result = await api.getServiceBookLabels({ date_from: dateFrom, date_to: dateTo })
      setItems(result.items || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat data label buku service')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const handleToday = () => {
    setDateFrom(getTodayStr())
    setDateTo(getTodayStr())
  }

  // Opsi dropdown diturunkan dari hasil rentang yang sedang dibuka, supaya user
  // tidak disodori pilihan yang hasilnya nol.
  const options = useMemo(() => {
    const scoSet = new Set()
    const salesSet = new Set()
    for (const item of items) {
      if (item.sales_coord_name && item.sales_coord_name !== '-') scoSet.add(item.sales_coord_name)
      if (item.salesman && item.salesman !== '-') salesSet.add(item.salesman)
    }
    return {
      scos: [...scoSet].sort(),
      salesmen: [...salesSet].sort(),
    }
  }, [items])

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter((item) => {
      if (status === 'unprinted' && item.printed_at) return false
      if (status === 'printed' && !item.printed_at) return false
      if (sco && item.sales_coord_name !== sco) return false
      if (salesman && item.salesman !== salesman) return false
      if (!s) return true
      return (
        item.so_number.toLowerCase().includes(s) ||
        item.customer_name.toLowerCase().includes(s) ||
        item.no_engine.toLowerCase().includes(s) ||
        item.salesman.toLowerCase().includes(s)
      )
    })
  }, [items, search, status, sco, salesman])

  // Seleksi bertahan saat filter berubah, tapi hanya baris yang terlihat yang
  // ikut dicetak — mencegah tercetaknya baris yang sedang tersembunyi.
  const visibleSelected = useMemo(
    () => filteredItems.filter((item) => selected.has(item.so_number)),
    [filteredItems, selected],
  )

  const allVisibleSelected = filteredItems.length > 0 && visibleSelected.length === filteredItems.length

  const toggleRow = (soNumber) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(soNumber)) next.delete(soNumber)
      else next.add(soNumber)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredItems.forEach((item) => next.delete(item.so_number))
      else filteredItems.forEach((item) => next.add(item.so_number))
      return next
    })
  }

  const markPrinted = async (soNumbers, printed) => {
    await api.setServiceBookLabelPrinted(soNumbers, printed)
    const stamp = printed ? new Date().toISOString() : null
    setItems((prev) => prev.map((item) => (
      soNumbers.includes(item.so_number)
        ? { ...item, printed_at: stamp, printed_by_name: printed ? 'Anda' : null }
        : item
    )))
  }

  const buildLabelHtml = (labelItems) => {
    const renderLabel = (item) => `
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
          <span class="address-value">${escapeHtml(item.alamat)}</span>
          <span class="meta-label">TGL PEMBELIAN</span>
          <span class="meta-value">${escapeHtml(item.so_date)}</span>
        </div>
      </div>
    `

    const allLabels = []
    labelItems.forEach((item) => {
      for (let i = 0; i < LABELS_PER_CUSTOMER; i += 1) allLabels.push(item)
    })

    const labelsPerPage = 12 // 3 kolom x 4 baris
    const pages = []
    for (let i = 0; i < allLabels.length; i += labelsPerPage) {
      pages.push(allLabels.slice(i, i + labelsPerPage))
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label Buku Service - ${escapeHtml(dateFrom)} s/d ${escapeHtml(dateTo)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .label { width: 64mm; height: 32mm; padding: 3mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.6mm; }
          .meta { font-size: 7px; color: #111827; display: grid; grid-template-columns: 19mm 1fr; gap: 0.2mm 0.8mm; line-height: 1.1; align-items: start; }
          .meta-label { color: #111827; }
          .meta-value { font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .name-value { font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          /* ALAMAT boleh wrap maksimal 2 baris agar tidak terpotong */
          .address-value { font-weight: 600; color: #111827; white-space: normal; line-height: 1.05; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pages.map((page) => `<div class="page">${page.map((item) => renderLabel(item)).join('')}</div>`).join('')}
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `
  }

  const handlePrintSelected = async () => {
    if (!visibleSelected.length) return
    setNotice('')
    setError('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('Jendela cetak diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.')
      return
    }

    printWindow.document.write(buildLabelHtml(visibleSelected))
    printWindow.document.close()

    const soNumbers = visibleSelected.map((item) => item.so_number)
    try {
      await markPrinted(soNumbers, true)
      setSelected(new Set())
      setNotice(`${soNumbers.length} transaksi ditandai sudah dicetak.`)
    } catch (err) {
      // Jendela cetak sudah terbuka dan tidak bisa ditarik kembali — beri tahu
      // dengan jelas supaya user menandai ulang, bukan mengira sudah tercatat.
      setError(`Label sudah dikirim ke printer tapi gagal ditandai: ${err.message}. Silakan tandai ulang setelah refresh.`)
    }
  }

  const handleToggleOnePrinted = async (item) => {
    setNotice('')
    setError('')
    try {
      await markPrinted([item.so_number], !item.printed_at)
    } catch (err) {
      setError(err.message || 'Gagal mengubah status cetak')
    }
  }

  const handlePrintedFromModal = async (item) => {
    try {
      await markPrinted([item.so_number], true)
    } catch (err) {
      setError(`Label sudah dikirim ke printer tapi gagal ditandai: ${err.message}`)
    }
  }

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

  const selectClass = 'px-3 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text-strong tracking-tight">Label Buku Service</h1>
          <p className="text-sm text-muted mt-1">
            Cetak label stiker untuk buku service fisik customer
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={selectClass}
            aria-label="Tanggal dari"
          />
          <span className="text-sm text-muted">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={selectClass}
            aria-label="Tanggal sampai"
          />
          <button onClick={handleToday} className="px-3 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:brightness-110 transition-colors">
            Hari Ini
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 bg-panel border border-border rounded-xl text-sm font-semibold text-muted hover:bg-hover transition-all shadow-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handlePrintSelected}
            disabled={!visibleSelected.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:brightness-110 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> Cetak Terpilih ({visibleSelected.length * LABELS_PER_CUSTOMER} label)
          </button>
        </div>
      </div>

      {/* Pesan */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Cari SO, customer, no mesin, atau salesman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-panel text-text focus:outline-none focus:ring-2 focus:ring-accent-soft shadow-sm"
          />
        </div>

        <select value={sco} onChange={(e) => setSco(e.target.value)} className={selectClass} aria-label="Filter SCO">
          <option value="">Semua SCO</option>
          {options.scos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={salesman} onChange={(e) => setSalesman(e.target.value)} className={selectClass} aria-label="Filter salesman">
          <option value="">Semua Salesman</option>
          {options.salesmen.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Filter status cetak">
          <option value="unprinted">Belum Dicetak</option>
          <option value="printed">Sudah Dicetak</option>
          <option value="all">Semua Status</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-muted">
          <CalendarDays size={16} />
          <span className="font-medium">{filteredItems.length} transaksi</span>
          {visibleSelected.length > 0 && (
            <span className="font-semibold text-accent-text">· {visibleSelected.length} dipilih</span>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        {filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-hover text-left">
                  <th className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Pilih semua baris terlihat"
                      className="h-4 w-4 cursor-pointer accent-current"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold text-muted">No</th>
                  <th className="py-3 px-4 font-semibold text-muted">SO Number</th>
                  <th className="py-3 px-4 font-semibold text-muted">Tanggal</th>
                  <th className="py-3 px-4 font-semibold text-muted">Customer</th>
                  <th className="py-3 px-4 font-semibold text-muted">No Mesin</th>
                  <th className="py-3 px-4 font-semibold text-muted">Model</th>
                  <th className="py-3 px-4 font-semibold text-muted">SCO</th>
                  <th className="py-3 px-4 font-semibold text-muted">Salesman</th>
                  <th className="py-3 px-4 font-semibold text-muted">Leasing</th>
                  <th className="py-3 px-4 font-semibold text-muted">Status</th>
                  <th className="py-3 px-4 font-semibold text-muted text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.so_number}
                    className="border-b border-border hover:bg-accent-soft/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selected.has(item.so_number)}
                        onChange={() => toggleRow(item.so_number)}
                        aria-label={`Pilih ${item.so_number}`}
                        className="h-4 w-4 cursor-pointer accent-current"
                      />
                    </td>
                    <td className="py-3 px-4 text-muted tabular-nums">{item.no}</td>
                    <td className="py-3 px-4 font-mono text-xs text-text">{item.so_number}</td>
                    <td className="py-3 px-4 text-muted">{item.so_date}</td>
                    <td className="py-3 px-4 font-medium text-text">{item.customer_name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted">{item.no_engine}</td>
                    <td className="py-3 px-4 text-muted">{item.model}</td>
                    <td className="py-3 px-4 text-muted">{item.sales_coord_name}</td>
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
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleOnePrinted(item)}
                        title={item.printed_at
                          ? `Dicetak ${formatPrintedAt(item.printed_at)}${item.printed_by_name ? ` oleh ${item.printed_by_name}` : ''} — klik untuk batalkan`
                          : 'Klik untuk tandai sudah dicetak'}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          item.printed_at
                            ? 'bg-success-soft text-success hover:brightness-95'
                            : 'bg-hover text-muted hover:brightness-95'
                        }`}
                      >
                        {item.printed_at ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        {item.printed_at ? 'Sudah' : 'Belum'}
                      </button>
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
            <p className="text-sm">Tidak ada transaksi yang cocok</p>
            <p className="text-xs mt-1">Ubah rentang tanggal atau filter di atas</p>
          </div>
        )}
      </div>

      {/* Label Preview Modal */}
      {selectedItem && (
        <ServiceBookLabel
          item={selectedItem}
          onPrinted={handlePrintedFromModal}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
