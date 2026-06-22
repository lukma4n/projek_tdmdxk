import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { FileUp, Loader2, RefreshCw, Search } from 'lucide-react'

function currency(value) {
  return `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`
}

export default function ShowroomProgram() {
  const [tab, setTab] = useState('leasing')
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ total: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, summaryRes] = await Promise.all([
        tab === 'leasing'
          ? api.getShowroomTacPrograms({ ...(search && { search }) }).then((res) => ({ ...res, pagination: { total: res.data?.length || 0 } }))
          : api.getShowroomMdPrograms({ page: 1, limit: 100, ...(search && { search }) }),
        api.getShowroomProgramSummary(),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { total: 0 })
      setSummary(summaryRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat Master Program')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab])

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPreviewing(true)
    setPendingFile(file)
    setPreview(null)
    setMessage('')
    setError('')
    try {
      const res = await api.previewShowroomPrograms(file)
      setPreview(res)
    } catch (err) {
      setPendingFile(null)
      setError(err.message || 'Gagal preview Master Program')
    } finally {
      setPreviewing(false)
      event.target.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingFile) return
    setUploading(true)
    setMessage('')
    setError('')
    try {
      const res = await api.uploadShowroomPrograms(pendingFile)
      setMessage(`${res.message}. Leasing ${res.leasing.total}, SCP/MD ${res.md.total}.`)
      setPendingFile(null)
      setPreview(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal import Master Program')
    } finally {
      setUploading(false)
    }
  }

  const cancelPreview = () => {
    setPendingFile(null)
    setPreview(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Master Program</h1>
          <p className="text-sm text-muted">Subsidi leasing/finco dari TAC dan subsidi AHM/MD/dealer dari SCP.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover"><RefreshCw size={16} /> Refresh</button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
            {previewing ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />} Preview Program
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={importFile} className="hidden" disabled={uploading || previewing} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-accent-soft bg-accent-soft p-4 text-accent-text"><p className="text-xs font-medium">Program Leasing</p><p className="mt-1 text-2xl font-bold">{summary?.leasingTotal || 0}</p></div>
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-success-700"><p className="text-xs font-medium">Program AHM/MD</p><p className="mt-1 text-2xl font-bold">{summary?.mdTotal || 0}</p></div>
        <div className="rounded-xl border border-border bg-panel p-4 text-text"><p className="text-xs font-medium">Source</p><p className="mt-1 truncate text-sm font-semibold">{summary?.sourceFile || '-'}</p></div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}

      {preview && (
        <div className="rounded-xl border border-accent-soft bg-accent-soft p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-accent-text">Preview Import Program</h2>
              <p className="text-sm text-accent-text">File: {pendingFile?.name || '-'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelPreview} disabled={uploading} className="rounded-lg border border-accent-soft bg-panel px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-soft disabled:opacity-60">Batal</button>
              <button onClick={confirmImport} disabled={uploading} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">{uploading && <Loader2 className="animate-spin" size={16} />} Konfirmasi Import</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-panel p-4"><p className="text-xs font-semibold text-muted">Program Leasing/TAC</p><p className="mt-1 text-2xl font-black text-text-strong">{preview.leasingTotal || 0}</p></div>
            <div className="rounded-lg bg-panel p-4"><p className="text-xs font-semibold text-muted">Program AHM/MD/SCP</p><p className="mt-1 text-2xl font-black text-text-strong">{preview.mdTotal || 0}</p></div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PreviewSample title="Sample Leasing/TAC" rows={preview.leasingSample || []} type="leasing" />
            <PreviewSample title="Sample AHM/MD/SCP" rows={preview.mdSample || []} type="md" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setTab('leasing')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'leasing' ? 'bg-accent text-white' : 'bg-hover text-muted'}`}>TAC Leasing</button>
          <button onClick={() => setTab('md')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'md' ? 'bg-accent text-white' : 'bg-hover text-muted'}`}>AHM/MD/SCP</button>
        </div>
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode unit, series, leasing..." className="w-full rounded-lg border border-border bg-hover py-2 pl-9 pr-4 text-sm" /></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><span className="text-sm font-semibold text-text">Daftar Master Program</span><span className="text-xs text-faint">{(pagination.total || 0).toLocaleString('id-ID')} total data</span></div>
        {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-accent" /></div> : <div className="overflow-x-auto">{tab === 'leasing' ? <LeasingTable items={items} /> : <MdTable items={items} />}</div>}
      </div>
    </div>
  )
}

function LeasingTable({ items }) {
  return <table className="w-full"><thead><tr className="border-b border-border bg-hover">{['Series', 'Leasing', 'DP Category', 'Tenor', 'Amount', 'Periode'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 text-sm font-semibold">{item.series_key}</td><td className="px-4 py-3 text-sm font-semibold">{item.leasing}</td><td className="px-4 py-3 text-sm">{item.dp_category === 'GT_15' ? '> 15%' : '< 15%'}</td><td className="px-4 py-3 text-sm">{item.tenor}</td><td className="px-4 py-3 text-sm font-bold text-accent-text">{currency(item.amount)}</td><td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(item.period_start)} - {formatDate(item.period_end)}</td></tr>)}</tbody></table>
}

function MdTable({ items }) {
  return <table className="w-full"><thead><tr className="border-b border-border bg-hover">{['Kode', 'Tipe Jualan', 'AHM', 'MD', 'Dealer', 'Total', 'Periode', 'Source'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 font-mono text-sm font-semibold">{item.product_code}</td><td className="px-4 py-3 text-sm font-semibold">{item.sale_type}</td><td className="px-4 py-3 text-sm">{currency(item.ahm_discount)}</td><td className="px-4 py-3 text-sm">{currency(item.md_discount)}</td><td className="px-4 py-3 text-sm">{currency(item.dealer_discount)}</td><td className="px-4 py-3 text-sm font-bold text-accent-text">{currency(item.total_discount)}</td><td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(item.period_start)} - {formatDate(item.period_end)}</td><td className="px-4 py-3 text-xs text-muted">{item.document_number || item.source_file || '-'}</td></tr>)}</tbody></table>
}

function PreviewSample({ title, rows, type }) {
  return <div className="overflow-hidden rounded-lg border border-accent-soft bg-panel"><div className="border-b border-accent-soft px-4 py-3 text-sm font-bold text-text">{title}</div>{rows.length === 0 ? <div className="p-4 text-sm text-muted">Tidak ada data.</div> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-hover">{(type === 'leasing' ? ['Kode', 'Leasing', 'Tenor', 'Subsidi'] : ['Kode', 'Tipe', 'AHM', 'MD', 'Dealer', 'Total']).map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => type === 'leasing' ? <tr key={index}><td className="px-3 py-2 font-mono text-xs font-semibold">{row.product_code}</td><td className="px-3 py-2 text-xs">{row.leasing}</td><td className="px-3 py-2 text-xs">{row.tenor}</td><td className="px-3 py-2 text-xs font-semibold">{currency(row.finco_subsidy)}</td></tr> : <tr key={index}><td className="px-3 py-2 font-mono text-xs font-semibold">{row.product_code}</td><td className="px-3 py-2 text-xs">{row.sale_type}</td><td className="px-3 py-2 text-xs">{currency(row.ahm_discount)}</td><td className="px-3 py-2 text-xs">{currency(row.md_discount)}</td><td className="px-3 py-2 text-xs">{currency(row.dealer_discount)}</td><td className="px-3 py-2 text-xs font-semibold">{currency(row.total_discount)}</td></tr>)}</tbody></table></div>}</div>
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (date.getFullYear() <= 1970) return '-'
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
