import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { FileUp, Loader2, MapPin, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'

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

function formatInputNumber(value) {
  return formatNumericInput(value)
}

function areaValue(area) {
  return `${area?.city_code || ''}|${area?.city_name || ''}`
}

function areaLabel(area) {
  return `${area?.city_code ? `[${area.city_code}] ` : ''}${area?.city_name || ''}`
}

function parseAreaLabel(value) {
  const text = String(value || '').trim().toUpperCase()
  const match = text.match(/^\[(\d+)\]\s*(.+)$/)
  return { city_code: match?.[1] || '', city_name: match?.[2] || text }
}

function buildAreaOptions(rows, areaCodes) {
  const byKey = new Map()
  for (const area of areaCodes || []) {
    byKey.set(`${area.code}|${area.name}`, { city_code: area.code, city_name: area.name })
  }
  for (const row of rows) {
    if (!row.city_name) continue
    byKey.set(areaValue(row), { city_code: row.city_code || '', city_name: row.city_name })
  }
  return Array.from(byKey.values()).sort((a, b) => String(a.city_name).localeCompare(String(b.city_name)))
}

function ensureAreaOption(options, form) {
  if (!form?.city_name) return options
  const value = areaValue(form)
  if (options.some((option) => areaValue(option) === value)) return options
  return [{ city_code: form.city_code || '', city_name: form.city_name }, ...options]
}

function findExactArea(options, form) {
  const label = areaLabel(form)
  return options.find((area) => areaLabel(area) === label)
}

export default function ShowroomBbnPrice() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [areaOptions, setAreaOptions] = useState([])

  const [areaCodes, setAreaCodes] = useState([])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, summaryRes, areaRes] = await Promise.all([
        api.getShowroomBbnPrices({ page: 1, limit: 100, ...(search && { search }) }),
        api.getShowroomBbnPriceSummary(),
        api.getShowroomBbnPrices({ page: 1, limit: 2000 }),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0 })
      setSummary(summaryRes)
      setAreaOptions(buildAreaOptions(areaRes.data || [], areaCodes))
    } catch (err) {
      setError(err.message || 'Gagal memuat Master BBN')
    } finally {
      setLoading(false)
    }
  }

  // Lazy-load area codes on mount
  useEffect(() => {
    let cancelled = false
    import('../data/indonesiaAreaCodes').then(({ INDONESIA_AREA_CODES }) => {
      if (cancelled) return
      setAreaCodes(INDONESIA_AREA_CODES || [])
    })
    return () => { cancelled = true }
  }, [])

  // Reload data setelah area codes tersedia
  useEffect(() => {
    if (areaCodes.length === 0) return
    const timer = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCodes])

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')
    setError('')
    try {
      const res = await api.uploadShowroomBbnPrice(file)
      setMessage(`${res.message}. Total ${res.total}, baru ${res.created}, update ${res.updated}.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal import Master BBN')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const startEdit = (item) => {
    setEditingItem(item)
    setEditForm({
      product_code: item.product_code || '',
      city_code: item.city_code || '',
      city_name: item.city_name || '',
      notice: formatInputNumber(item.notice),
      pnbp_stck: formatInputNumber(item.pnbp_stck),
      jasa: formatInputNumber(item.jasa),
      jasa_area: formatInputNumber(item.jasa_area),
      fee_pusat: formatInputNumber(item.fee_pusat),
    })
    setMessage('')
    setError('')
  }

  const startCreate = () => {
    setEditingItem(null)
    setEditForm({
      product_code: '',
      city_code: '',
      city_name: '',
      notice: '',
      pnbp_stck: '',
      jasa: '',
      jasa_area: '',
      fee_pusat: '',
    })
    setMessage('')
    setError('')
  }

  const closeEdit = () => {
    setEditingItem(null)
    setEditForm(null)
  }

  const setEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  const setEditArea = (value) => {
    const selected = modalAreaOptions.find((area) => areaLabel(area) === value || areaValue(area) === value)
    const area = selected || parseAreaLabel(value)
    setEditForm((current) => ({ ...current, city_code: area.city_code, city_name: area.city_name }))
  }

  const editTotal = editForm
    ? numberValue(editForm.notice) + numberValue(editForm.pnbp_stck) + numberValue(editForm.jasa) + numberValue(editForm.jasa_area) + numberValue(editForm.fee_pusat)
    : 0
  const modalAreaOptions = editForm ? ensureAreaOption(areaOptions, editForm) : areaOptions

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editForm) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const selectedArea = findExactArea(areaOptions, editForm)
      if (!selectedArea) {
        setError('Area harus dipilih dari daftar area yang sudah ada di Master BBN. Contoh: [6111] KAB. KAYONG UTARA.')
        return
      }
      const payload = {
        ...editForm,
        product_code: editForm.product_code.toUpperCase(),
        city_code: selectedArea.city_code,
        city_name: selectedArea.city_name,
      }
      const res = editingItem
        ? await api.updateShowroomBbnPrice(editingItem.id, payload)
        : await api.createShowroomBbnPrice(payload)
      setMessage(res.message)
      closeEdit()
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal simpan Master BBN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master BBN</h1>
          <p className="text-sm text-slate-500">Notice, PNBP/STCK, jasa, dan total biaya BBN internal per kode unit dan area.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={startCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Tambah Master</button>
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            {uploading ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />} Import BBN
            <input type="file" accept=".html,.htm,.xlsx,.xls,.csv" onChange={importFile} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700"><p className="text-xs font-medium">Total Data</p><p className="mt-1 text-2xl font-bold">{summary?.total || 0}</p></div>
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-success-700"><p className="text-xs font-medium">Area/Kota</p><p className="mt-1 text-2xl font-bold">{summary?.cityCount || 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700"><p className="text-xs font-medium">Source</p><p className="mt-1 truncate text-sm font-semibold">{summary?.sourceFile || '-'}</p></div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode unit atau area..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <span className="text-sm font-semibold text-slate-700">Daftar Master BBN</span>
          <span className="text-xs text-slate-400">{(pagination.total || 0).toLocaleString('id-ID')} total data</span>
        </div>
        {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 bg-slate-50">{['Kode', 'Area', 'Notice', 'PNBP/STCK', 'Jasa', 'Jasa Area', 'Biaya Tambahan', 'Total', 'Aksi'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => <tr key={item.id} className="hover:bg-slate-50/50"><td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{item.product_code}</td><td className="px-4 py-3 text-sm text-slate-600"><span className="inline-flex items-center gap-1"><MapPin size={13} />{item.city_code ? `[${item.city_code}] ` : ''}{item.city_name}</span></td><td className="px-4 py-3 text-sm">{currency(item.notice)}</td><td className="px-4 py-3 text-sm">{currency(item.pnbp_stck)}</td><td className="px-4 py-3 text-sm">{currency(item.jasa)}</td><td className="px-4 py-3 text-sm">{currency(item.jasa_area)}</td><td className="px-4 py-3 text-sm">{currency(item.fee_pusat)}</td><td className="px-4 py-3 text-sm font-bold text-blue-700">{currency(item.total)}</td><td className="px-4 py-3"><button onClick={() => startEdit(item)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-blue-100 hover:text-blue-700"><Pencil size={13} /> Edit</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && closeEdit()}>
          <form onSubmit={saveEdit} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{editingItem ? 'Edit Master BBN' : 'Tambah Master BBN'}</h2>
                <p className="text-xs text-slate-500">Gunakan tambah master jika kode unit + area belum tersedia di data import. Total dihitung otomatis.</p>
              </div>
              <button type="button" onClick={closeEdit} className="rounded-lg p-1 hover:bg-slate-100"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
              <Input label="Kode Unit" value={editForm.product_code} onChange={(v) => setEditField('product_code', v.toUpperCase())} />
              <AreaInput label="Area" value={areaLabel(editForm)} onChange={setEditArea} options={modalAreaOptions} />
              <ReadOnly label="Kode Area" value={editForm.city_code || '-'} />
              <ReadOnly label="Total Baru" value={currency(editTotal)} />
              <Input label="Notice" value={editForm.notice} onChange={(v) => setEditField('notice', v)} numeric />
              <Input label="PNBP/STCK" value={editForm.pnbp_stck} onChange={(v) => setEditField('pnbp_stck', v)} numeric />
              <Input label="Jasa" value={editForm.jasa} onChange={(v) => setEditField('jasa', v)} numeric />
              <Input label="Jasa Area" value={editForm.jasa_area} onChange={(v) => setEditField('jasa_area', v)} numeric />
              <Input label="Biaya Tambahan" value={editForm.fee_pusat} onChange={(v) => setEditField('fee_pusat', v)} numeric />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeEdit} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Master'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, placeholder = '', numeric = false }) {
  const handleChange = (event) => {
    onChange(numeric ? formatNumericInput(event.target.value) : event.target.value)
  }

  return <label className="block"><span className="mb-1 block text-xs font-semibold text-blue-700">{label}</span><input value={value} placeholder={placeholder} inputMode={numeric ? 'numeric' : undefined} onChange={handleChange} className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm" /></label>
}

function AreaInput({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-blue-700">{label}</span><input list="bbn-area-options" value={value} placeholder="Ketik kode/nama area, lalu pilih dari daftar..." onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm" /><datalist id="bbn-area-options">{options.map((area) => <option key={areaValue(area)} value={areaLabel(area)} />)}</datalist><span className="mt-1 block text-[11px] text-slate-400">Area wajib dipilih dari daftar standar yang muncul.</span></label>
}

function ReadOnly({ label, value }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-blue-700">{label}</span><div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">{value}</div></label>
}
