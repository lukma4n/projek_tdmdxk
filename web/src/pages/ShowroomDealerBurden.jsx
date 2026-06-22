import { useCallback, useEffect, useState, useRef } from 'react'
import { api } from '../services/api'
import { Loader2, RefreshCw, Save, Search, Upload, FileSpreadsheet } from 'lucide-react'

function currency(value) {
  return `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`
}

function numberValue(value) {
  return Number(String(value ?? '').replace(/\./g, '').replace(',', '.')) || 0
}

function formatNumericInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export default function ShowroomDealerBurden() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    series_key: '',
    cash_amount: '',
    credit_amount: '',
  })
  const [previewData, setPreviewData] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [burdenRes, summaryRes] = await Promise.all([
        api.getShowroomDealerBurdens({ ...(search && { search }) }),
        api.getShowroomDealerBurdenSummary(),
      ])
      setItems(burdenRes.data || [])
      setSummary(summaryRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat Beban Dealer')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadData])

  const saveItem = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.upsertShowroomDealerBurden({
        series_key: form.series_key.toUpperCase().trim(),
        cash_amount: numberValue(form.cash_amount),
        credit_amount: numberValue(form.credit_amount),
      })
      setMessage(res.message)
      setForm({ series_key: '', cash_amount: '', credit_amount: '' })
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal simpan Beban Dealer')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setForm({
      series_key: item.series_key,
      cash_amount: formatNumericInput(item.cash_amount),
      credit_amount: formatNumericInput(item.credit_amount),
    })
  }

  const [pendingFile, setPendingFile] = useState(null)
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setImporting(true)
    setError('')
    setMessage('')
    try {
      const res = await api.previewShowroomDealerBurden(file)
      setPreviewData(res)
      setShowPreview(true)
    } catch (err) {
      setError(err.message || 'Gagal preview file')
    } finally {
      setImporting(false)
    }
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return
    setImporting(true)
    setError('')
    setMessage('')
    try {
      const res = await api.uploadShowroomDealerBurden(pendingFile)
      setMessage(`${res.message} (${res.total} rows)`)
      setShowPreview(false)
      setPreviewData(null)
      setPendingFile(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal import Beban Dealer')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Master Beban Dealer</h1>
          <p className="text-sm text-muted">
            Beban dealer per series untuk CASH dan KREDIT. Data lama akan di-replace saat import data.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Upload size={16} />
            Import Data
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Total Series" value={summary?.total || 0} />
        <Card label="Source" value={summary?.sourceFile || '-'} small />
        <Card
          label="Last Sync"
          value={
            summary?.latestSyncedAt
              ? new Date(summary.latestSyncedAt).toLocaleDateString('id-ID')
              : '-'
          }
          small
        />
      </div>

      {message && (
        <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Import Preview Modal */}
      {showPreview && previewData && (
        <div className="rounded-xl border border-amber-200 bg-warning-soft p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text flex items-center gap-2">
              <FileSpreadsheet size={18} />
              Preview Import Data
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPreview(false)
                  setPreviewData(null)
                  setPendingFile(null)
                }}
                className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover"
              >
                Batal
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={importing}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                Import {previewData.total} Rows
              </button>
            </div>
          </div>
          <p className="text-sm text-muted">
            File akan <strong>menimpa semua data lama</strong>. Pastikan data sudah benar.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-panel">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-hover">
                  {['Series', 'Cash Beban', 'Credit Beban'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.sample?.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm font-semibold">{row.series_key}</td>
                    <td className="px-4 py-3 text-sm">{currency(row.cash_amount)}</td>
                    <td className="px-4 py-3 text-sm">{currency(row.credit_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.total > 5 && (
              <p className="px-4 py-2 text-xs text-muted border-t border-border">
                ...dan {previewData.total - 5} baris lainnya
              </p>
            )}
          </div>
        </div>
      )}

      {/* Form Input */}
      <form
        onSubmit={saveItem}
        className="rounded-xl border border-border bg-panel p-5 shadow-sm space-y-4"
      >
        <h2 className="font-semibold text-text">Tambah / Edit Beban Dealer</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="Series"
            value={form.series_key}
            onChange={(v) => setForm({ ...form, series_key: v.toUpperCase() })}
            placeholder="Contoh: SCOOPY"
          />
          <Input
            label="Cash Beban Dealer"
            value={form.cash_amount}
            onChange={(v) => setForm({ ...form, cash_amount: v })}
            numeric
            placeholder="0"
          />
          <Input
            label="Credit Beban Dealer"
            value={form.credit_amount}
            onChange={(v) => setForm({ ...form, credit_amount: v })}
            numeric
            placeholder="0"
          />
        </div>
        <button
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Simpan
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-hover py-2 pl-9 pr-4 text-sm"
              placeholder="Cari series..."
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-accent" />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-hover">
                  {['Series', 'Cash Beban', 'Credit Beban', 'Action'].map((h) => (
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
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                      Tidak ada data Beban Dealer.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm font-semibold">{item.series_key}</td>
                      <td className="px-4 py-3 text-sm">{currency(item.cash_amount)}</td>
                      <td className="px-4 py-3 text-sm">{currency(item.credit_amount)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-accent hover:text-accent-text font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder = '', numeric = false }) {
  const handleChange = (event) =>
    onChange(numeric ? formatNumericInput(event.target.value) : event.target.value)
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        inputMode={numeric ? 'numeric' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
      />
    </label>
  )
}

function Card({ label, value, small }) {
  return (
    <div className="rounded-xl border border-accent-soft bg-accent-soft p-4 text-accent-text">
      <p className="text-xs font-medium">{label}</p>
      <p className={small ? 'mt-1 truncate text-sm font-bold' : 'mt-1 text-2xl font-bold'}>
        {value}
      </p>
    </div>
  )
}
