import { useState } from 'react'
import { api } from '../services/api'
import { Loader2, RefreshCw, Copy, Printer, Table2, Search } from 'lucide-react'

function currency(value) {
  return `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`
}

export default function ShowroomDiscountTable() {
  const [rows, setRows] = useState([])
  const [period, setPeriod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    series_key: '',
    leasing: '',
    tenor: '',
    sale_type: '',
  })
  const [copied, setCopied] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const query = {}
      if (filters.series_key) query.series_key = filters.series_key
      if (filters.leasing) query.leasing = filters.leasing
      if (filters.tenor) query.tenor = filters.tenor
      if (filters.sale_type) query.sale_type = filters.sale_type

      const res = await api.getShowroomDiscountTable(query)
      setRows(res.data || [])
      setPeriod(res.period)
    } catch (err) {
      setError(err.message || 'Gagal memuat Tabel Diskon')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    void loadData()
  }

  const handleReset = () => {
    setFilters({ series_key: '', leasing: '', tenor: '', sale_type: '' })
    setRows([])
    setPeriod(null)
    setError('')
    setSearched(false)
  }

  const handleCopy = () => {
    const lines = buildWhatsAppText(rows, period)
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Tabel Diskon Marketing</h1>
          <p className="text-sm text-muted">
            Masukkan filter dulu, lalu klik Cari. Total Diskon = Program + TAC Leasing + Beban Dealer.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Copy size={16} /> {copied ? 'Tersalin!' : 'Copy WhatsApp'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover print:hidden"
            >
              <Printer size={16} /> Print
            </button>
          </div>
        )}
      </div>

      {period && (
        <div className="rounded-lg border border-accent-soft bg-accent-soft p-4 text-accent-text">
          <p className="text-xs font-semibold uppercase">Periode Program Aktif</p>
          <p className="mt-1 text-sm font-semibold">
            {formatDate(period.start)} - {formatDate(period.end)} | {period.document_number || '-'}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Filter Card */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Tipe Jualan</label>
            <select
              value={filters.sale_type}
              onChange={(e) => setFilters((f) => ({ ...f, sale_type: e.target.value }))}
              className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
            >
              <option value="">Semua</option>
              <option value="CASH">CASH</option>
              <option value="KREDIT">KREDIT</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Series / Kode</label>
            <input
              value={filters.series_key}
              onChange={(e) => setFilters((f) => ({ ...f, series_key: e.target.value }))}
              placeholder="Contoh: SCOOPY"
              className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Leasing</label>
            <select
              value={filters.leasing}
              onChange={(e) => setFilters((f) => ({ ...f, leasing: e.target.value }))}
              className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
            >
              <option value="">Semua Leasing</option>
              <option value="FIF">FIF</option>
              <option value="ADIRA">ADIRA</option>
              <option value="OTO">OTO</option>
              <option value="IMFI">IMFI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Tenor</label>
            <select
              value={filters.tenor}
              onChange={(e) => setFilters((f) => ({ ...f, tenor: e.target.value }))}
              className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
            >
              <option value="">Semua Tenor</option>
              <option value="18">18 Bulan</option>
              <option value="24">24 Bulan</option>
              <option value="30">30 Bulan</option>
              <option value="36">36 Bulan</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Mencari...' : 'Cari'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-border bg-panel px-5 py-2 text-sm text-muted hover:bg-hover"
          >
            <RefreshCw size={16} /> Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-accent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-hover">
                  {[
                    'Series',
                    'Tipe',
                    'Leasing',
                    'Program AHM',
                    'Program MD',
                    'Dealer',
                    'TAC Leasing',
                    'Beban Dealer',
                    'Total Diskon',
                    'Periode',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!searched ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted">
                      Masukkan filter lalu klik Cari.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted">
                      Tidak ada data yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.product_code}-${row.sale_type}`}>
                      <td className="px-4 py-3 text-sm font-semibold">{row.series_key}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            row.sale_type === 'CASH'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-accent-soft text-accent-text'
                          }`}
                        >
                          {row.sale_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.sale_type === 'CASH' ? (
                          '-'
                        ) : row.tac_lt15 ? (
                          <span className="font-semibold">{row.tac_lt15.leasing}</span>
                        ) : row.tac_gt15 ? (
                          <span className="font-semibold">{row.tac_gt15.leasing}</span>
                        ) : (
                          <span className="text-faint">TAC tidak tersedia</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-accent-text">
                        {row.ahm_discount > 0 ? currency(row.ahm_discount) : <span className="text-faint">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-accent-text">
                        {row.md_discount > 0 ? currency(row.md_discount) : <span className="text-faint">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-accent-text">
                        {row.dealer_discount > 0 ? currency(row.dealer_discount) : <span className="text-faint">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-warning">
                        {row.sale_type === 'KREDIT' ? (
                          row.tac_lt15 ? (
                            <span>{currency(row.tac_lt15.amount)}</span>
                          ) : row.tac_gt15 ? (
                            <span>{currency(row.tac_gt15.amount)}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )
                        ) : (
                          <span className="text-faint">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-accent">
                        {row.sale_type === 'CASH' ? (
                          row.dealer_burden_cash > 0 ? (
                            <span>{currency(row.dealer_burden_cash)}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )
                        ) : (
                          row.dealer_burden_credit > 0 ? (
                            <span>{currency(row.dealer_burden_credit)}</span>
                          ) : (
                            <span className="text-faint">-</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-700">
                        {row.total_discount > 0 ? (
                          currency(row.total_discount)
                        ) : (
                          <span className="text-faint">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {row.period_start || row.period_end
                          ? `${formatDate(row.period_start)} - ${formatDate(row.period_end)}`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Preview */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-success-soft p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-800">
            <Table2 size={18} />
            <h3 className="font-semibold">Preview Copy WhatsApp</h3>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-green-900 bg-panel rounded-lg p-4 border border-green-100">
            {buildWhatsAppText(rows, period)}
          </pre>
        </div>
      )}
    </div>
  )
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (date.getFullYear() <= 1970) return '-'
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildWhatsAppText(rows, period) {
  const lines = []
  lines.push('📋 *TABEL DISKON MARKETING*')
  if (period) {
    lines.push(`📅 Periode: ${formatDate(period.start)} - ${formatDate(period.end)}`)
    lines.push(`📄 ${period.document_number || ''}`)
  }
  lines.push('')

  const grouped = rows.reduce((acc, row) => {
    const key = row.series_key
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  for (const [series, groupRows] of Object.entries(grouped)) {
    lines.push(`🏍️ *${series}*`)
    lines.push('')

    for (const row of groupRows) {
      lines.push(`🔹 *${row.sale_type}*`)
      
      if (row.ahm_discount > 0) {
        lines.push(`   Program AHM: ${currency(row.ahm_discount)}`)
      }
      if (row.md_discount > 0) {
        lines.push(`   Program MD: ${currency(row.md_discount)}`)
      }
      if (row.dealer_discount > 0) {
        lines.push(`   Diskon Dealer: ${currency(row.dealer_discount)}`)
      }
      
      if (row.sale_type === 'CASH' && row.dealer_burden_cash > 0) {
        lines.push(`   Beban Dealer: ${currency(row.dealer_burden_cash)}`)
      }
      if (row.sale_type === 'KREDIT' && row.dealer_burden_credit > 0) {
        lines.push(`   Beban Dealer: ${currency(row.dealer_burden_credit)}`)
      }
      
      if (row.sale_type === 'KREDIT') {
        const leasing = row.tac_lt15?.leasing || row.tac_gt15?.leasing || ''
        if (leasing) {
          lines.push(`   Leasing: ${leasing}`)
        }
        const tacAmount = row.tac_lt15?.amount || row.tac_gt15?.amount || 0
        if (tacAmount > 0) {
          lines.push(`   TAC Leasing: ${currency(tacAmount)}`)
        }
      }
      if (row.total_discount > 0) {
        lines.push(`   💰 Total Diskon: ${currency(row.total_discount)}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
