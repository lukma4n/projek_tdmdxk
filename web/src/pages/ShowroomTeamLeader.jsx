import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { FileUp, Loader2, RefreshCw, Save, Search, Trash2 } from 'lucide-react'

function clean(value = '') {
  return String(value || '').trim()
}

export default function ShowroomTeamLeader() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [form, setForm] = useState({ name: '' })

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, sumRes] = await Promise.all([
        api.getShowroomTeamLeaders({ all: true, ...(search && { search }) }),
        api.getShowroomTeamLeaderSummary(),
      ])
      setItems(listRes.data || [])
      setSummary(sumRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat data Team Leader')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const saveItem = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.upsertShowroomTeamLeader({
        name: clean(form.name),
      })
      setMessage(res.message)
      setForm({ name: '' })
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal simpan data Team Leader')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus data team leader ini?')) return
    setError('')
    setMessage('')
    try {
      const res = await api.deleteShowroomTeamLeader(id)
      setMessage(res.message)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal hapus data Team Leader')
    }
  }

  const handleToggleActive = async (item) => {
    const nextActive = !item.is_active
    if (!confirm(`Yakin ${nextActive ? 'aktifkan' : 'nonaktifkan'} "${item.name}"?`)) return
    setError('')
    setMessage('')
    try {
      const res = await api.updateShowroomTeamLeaderStatus(item.id, nextActive)
      setMessage(res.message)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal ubah status Team Leader')
    }
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setImporting(true)
    setError('')
    setMessage('')
    try {
      const res = await api.previewShowroomTeamLeaders(file)
      setPreviewData(res)
      setShowPreview(true)
    } catch (err) {
      setError(err.message || 'Gagal preview file')
      setPendingFile(null)
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleImportConfirm = async () => {
    if (!pendingFile) return
    setImporting(true)
    setError('')
    setMessage('')
    try {
      const res = await api.uploadShowroomTeamLeaders(pendingFile)
      setMessage(`${res.message} (${res.total} rows)`)
      setShowPreview(false)
      setPreviewData(null)
      setPendingFile(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal import data Team Leader')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Master Team Leader</h1>
          <p className="text-sm text-muted">Daftar Team Leader untuk mapping struktur tim Sales.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover">
            <RefreshCw size={16} /> Refresh
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
            <FileUp size={16} /> Import Data
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} disabled={importing} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-accent-soft bg-accent-soft p-4 text-accent-text">
          <p className="text-xs font-medium">Total Team Leader</p>
          <p className="mt-1 text-2xl font-bold">{summary?.total || 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-panel p-4 text-text">
          <p className="text-xs font-medium">Source</p>
          <p className="mt-1 truncate text-sm font-semibold">{summary?.sourceFile || '-'}</p>
        </div>
        <div className="rounded-xl border border-border bg-panel p-4 text-text">
          <p className="text-xs font-medium">Last Sync</p>
          <p className="mt-1 text-sm font-semibold">
            {summary?.latestSyncedAt ? new Date(summary.latestSyncedAt).toLocaleDateString('id-ID') : '-'}
          </p>
        </div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}

      {/* Import Preview */}
      {showPreview && previewData && (
        <div className="rounded-xl border border-amber-200 bg-warning-soft p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text">Preview Import ({previewData.total} rows)</h2>
            <div className="flex gap-2">
              <button onClick={() => { setShowPreview(false); setPreviewData(null); setPendingFile(null) }} className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover">Batal</button>
              <button onClick={handleImportConfirm} disabled={importing} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
                {importing && <Loader2 className="animate-spin" size={16} />} Konfirmasi Import
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg bg-panel">
            <table className="w-full">
              <thead><tr className="bg-hover border-b border-border">
                {['No', 'Nama'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(previewData.sample || []).map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-sm">{row.no || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{row.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form tambah */}
      <form onSubmit={saveItem} className="rounded-xl border border-border bg-panel p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-text">Tambah / Edit Team Leader</h2>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Nama Team Leader *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full max-w-md rounded-lg border border-border bg-hover px-3 py-2 text-sm" placeholder="Contoh: ANDRI YANI SUSANTO" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
          </button>
          <button type="button" onClick={() => setForm({ name: '' })} className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover">Reset</button>
        </div>
      </form>

      {/* Tabel */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold text-text">Daftar Team Leader</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama..." className="w-64 rounded-lg border border-border bg-hover py-2 pl-9 pr-4 text-sm" />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-accent" size={24} /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Tidak ada data Team Leader.</div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-hover">
                  {['No', 'Nama', 'Status', 'Aksi'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-hover/50 ${item.is_active ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3 text-sm text-muted">{item.no || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-text">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_active ? 'bg-success-50 text-success-700' : 'bg-hover text-muted'}`}>
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setForm({ name: item.name })} className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-muted hover:bg-hover">Edit</button>
                        <button onClick={() => handleToggleActive(item)} className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-muted hover:bg-hover">
                          {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-100"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
