import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { Loader2, RefreshCw, Save, Search } from 'lucide-react'

const TENORS = [12, 18, 24, 30, 36]
const DEFAULT_LEASING_OPTIONS = ['FIF', 'ADIRA', 'IMFI', 'OTO']
const EMPTY_MATRIX = Object.fromEntries(['LT_15', 'GT_15'].flatMap((cat) => TENORS.map((tenor) => [`${cat}_${tenor}`, ''])))

function currency(value) { return `Rp ${(Number(value) || 0).toLocaleString('id-ID')}` }

function numberValue(value) { return Number(String(value ?? '').replace(/\./g, '').replace(',', '.')) || 0 }
function formatNumericInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export default function ShowroomTacLeasing() {
  const [items, setItems] = useState([])
  const [promoSchemes, setPromoSchemes] = useState([])
  const [aliases, setAliases] = useState([])
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ leasing: 'FIF', series_key: 'SCOOPY', period_start: '2026-01-06', period_end: '', source_file: 'MANUAL TAC', ...EMPTY_MATRIX })
  const [aliasForm, setAliasForm] = useState({ keyword: '', series_key: '', priority: 100 })
  const [promoForm, setPromoForm] = useState({ leasing: 'IMFI', scheme_name: 'Dana Promosi Scheme', otr_min: '', otr_max: '', tenor: '0', dp_min_percent: '0', dp_max_percent: '100', gross_amount: '', branch_deposit_amount: '100.000', period_start: '2026-01-06', period_end: '2026-12-31', source_file: 'JUKLAK TAC IMFI 2025.pdf' })

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [programRes, aliasRes, summaryRes, promoRes] = await Promise.all([
        api.getShowroomTacPrograms({ ...(search && { search }) }),
        api.getShowroomSeriesAliases(),
        api.getShowroomTacSummary(),
        api.getShowroomPromoSchemes({ ...(search && { search }) }),
      ])
      setItems(programRes.data || [])
      setAliases(aliasRes.data || [])
      setSummary(summaryRes)
      setPromoSchemes(promoRes.data || [])
    } catch (err) { setError(err.message || 'Gagal memuat TAC Leasing') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { const timer = setTimeout(() => { void loadData() }, 300); return () => clearTimeout(timer) }, [loadData])

  const saveMatrix = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      const rows = ['LT_15', 'GT_15']
        .flatMap((dp_category) => TENORS.map((tenor) => ({ dp_category, tenor, amount: form[`${dp_category}_${tenor}`] })))
        .filter((row) => String(row.amount).trim() !== '')
        .map((row) => ({ ...row, amount: numberValue(row.amount) }))
      const res = await api.upsertShowroomTacMatrix({ leasing: form.leasing, series_key: form.series_key, period_start: form.period_start, period_end: form.period_end, source_file: form.source_file, rows })
      setMessage(`${res.message}. Baru ${res.created}, update ${res.updated}.`)
      setForm((current) => ({ ...current, ...EMPTY_MATRIX }))
      await loadData()
    } catch (err) { setError(err.message || 'Gagal simpan matrix TAC') }
    finally { setSaving(false) }
  }

  const saveAlias = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      await api.upsertShowroomSeriesAlias(aliasForm)
      setAliasForm({ keyword: '', series_key: '', priority: 100 })
      setMessage('Alias series tersimpan')
      await loadData()
    } catch (err) { setError(err.message || 'Gagal simpan alias') }
    finally { setSaving(false) }
  }

  const savePromoScheme = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      const res = await api.upsertShowroomPromoScheme({ ...promoForm, otr_min: numberValue(promoForm.otr_min), otr_max: promoForm.otr_max ? numberValue(promoForm.otr_max) : null, tenor: numberValue(promoForm.tenor), dp_min_percent: numberValue(promoForm.dp_min_percent), dp_max_percent: numberValue(promoForm.dp_max_percent), gross_amount: numberValue(promoForm.gross_amount), branch_deposit_amount: numberValue(promoForm.branch_deposit_amount) })
      setMessage(res.message)
      setPromoForm((current) => ({ ...current, otr_min: '', otr_max: '', gross_amount: '' }))
      await loadData()
    } catch (err) { setError(err.message || 'Gagal simpan Dana Promosi Scheme') }
    finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Master TAC Leasing</h1><p className="text-sm text-slate-500">TAC/MBD berbasis series, DP category, tenor, dan leasing.</p></div><button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Card label="Total TAC" value={summary?.total || 0} /><Card label="Series" value={summary?.seriesCount || 0} /><Card label="Dana Promosi" value={summary?.promoSchemeTotal || 0} /><Card label="Source" value={summary?.sourceFile || '-'} small /></div>
    {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}{error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.8fr]">
      <form onSubmit={saveMatrix} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="font-semibold text-slate-800">Input Matrix TAC</h2><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Select label="Leasing" value={form.leasing} onChange={(v) => setForm({ ...form, leasing: v })} options={leasingOptions(items)} /><Select label="Series" value={form.series_key} onChange={(v) => setForm({ ...form, series_key: v })} options={seriesOptions(aliases)} /><Input label="Source" value={form.source_file} onChange={(v) => setForm({ ...form, source_file: v })} /><Input label="Mulai Berlaku" type="date" value={form.period_start} onChange={(v) => setForm({ ...form, period_start: v })} /><Input label="Akhir Berlaku" type="date" value={form.period_end} onChange={(v) => setForm({ ...form, period_end: v })} /></div><Matrix title="DP < 15%" category="LT_15" form={form} setForm={setForm} /><Matrix title="DP > 15%" category="GT_15" form={form} setForm={setForm} /><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan Matrix</button></form>
      <form onSubmit={saveAlias} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="font-semibold text-slate-800">Alias Series</h2><div className="grid grid-cols-1 gap-3"><Input label="Keyword" value={aliasForm.keyword} onChange={(v) => setAliasForm({ ...aliasForm, keyword: v.toUpperCase() })} placeholder="Contoh: SCOOPY" /><Input label="Series" value={aliasForm.series_key} onChange={(v) => setAliasForm({ ...aliasForm, series_key: v.toUpperCase() })} placeholder="Contoh: SCOOPY" /><Input label="Priority" type="number" value={aliasForm.priority} onChange={(v) => setAliasForm({ ...aliasForm, priority: v })} /></div><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Simpan Alias</button><div className="max-h-80 overflow-y-auto divide-y divide-slate-100">{aliases.map((alias) => <div key={alias.id} className="flex items-center justify-between py-2 text-sm"><span className="font-mono font-semibold">{alias.keyword}</span><span className="text-slate-500">{alias.series_key}</span></div>)}</div></form>
    </div>
    <form onSubmit={savePromoScheme} className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-4"><div><h2 className="font-semibold text-slate-800">Dana Promosi Scheme</h2><p className="text-sm text-slate-600">Khusus IMFI berbasis range OTR. Tenor 0 berarti semua tenor, DP 0-100 berarti semua DP. Nominal net otomatis gross dikurangi dana titipan cabang.</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><Select label="Leasing" value={promoForm.leasing} onChange={(v) => setPromoForm({ ...promoForm, leasing: v })} options={leasingOptions([...items, ...promoSchemes])} /><Input label="Scheme" value={promoForm.scheme_name} onChange={(v) => setPromoForm({ ...promoForm, scheme_name: v })} /><Input label="OTR Min" value={promoForm.otr_min} onChange={(v) => setPromoForm({ ...promoForm, otr_min: v })} numeric /><Input label="OTR Max" value={promoForm.otr_max} onChange={(v) => setPromoForm({ ...promoForm, otr_max: v })} placeholder="Kosong = tanpa batas" numeric /><Input label="Tenor" value={promoForm.tenor} onChange={(v) => setPromoForm({ ...promoForm, tenor: v.replace(/\D/g, '') })} placeholder="0 = semua" /><Input label="DP Min %" value={promoForm.dp_min_percent} onChange={(v) => setPromoForm({ ...promoForm, dp_min_percent: v })} /><Input label="DP Max %" value={promoForm.dp_max_percent} onChange={(v) => setPromoForm({ ...promoForm, dp_max_percent: v })} /><Input label="Gross TAC" value={promoForm.gross_amount} onChange={(v) => setPromoForm({ ...promoForm, gross_amount: v })} numeric /><Input label="Dana Titipan" value={promoForm.branch_deposit_amount} onChange={(v) => setPromoForm({ ...promoForm, branch_deposit_amount: v })} numeric /><Input label="Mulai Berlaku" type="date" value={promoForm.period_start} onChange={(v) => setPromoForm({ ...promoForm, period_start: v })} /><Input label="Akhir Berlaku" type="date" value={promoForm.period_end} onChange={(v) => setPromoForm({ ...promoForm, period_end: v })} /><Input label="Source" value={promoForm.source_file} onChange={(v) => setPromoForm({ ...promoForm, source_file: v })} /></div><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan Dana Promosi</button></form>
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden"><div className="border-b border-amber-100 bg-amber-50 p-4"><h2 className="font-semibold text-slate-800">Daftar Dana Promosi Scheme</h2></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-200 bg-slate-50">{['Leasing','Range OTR','Tenor','DP %','Gross','Titipan','Net','Periode'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{promoSchemes.map((item) => <tr key={item.id}><td className="px-4 py-3 text-sm font-semibold">{item.leasing}</td><td className="px-4 py-3 text-sm">{currency(item.otr_min)} - {item.otr_max >= 999999999999 ? '∞' : currency(item.otr_max)}</td><td className="px-4 py-3 text-sm">{item.tenor || 'Semua'}</td><td className="px-4 py-3 text-sm">{item.dp_min_percent}% - {item.dp_max_percent}%</td><td className="px-4 py-3 text-sm">{currency(item.gross_amount)}</td><td className="px-4 py-3 text-sm">{currency(item.branch_deposit_amount)}</td><td className="px-4 py-3 text-sm font-bold text-amber-700">{currency(item.amount)}</td><td className="px-4 py-3 text-xs text-slate-500">{formatDate(item.period_start)} - {formatDate(item.period_end)}</td></tr>)}</tbody></table></div></div>
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="border-b border-slate-100 p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm" placeholder="Cari leasing atau series..." /></div></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-200 bg-slate-50">{['Leasing','Series','DP','Tenor','Amount','Periode'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 text-sm font-semibold">{item.leasing}</td><td className="px-4 py-3 text-sm">{item.series_key}</td><td className="px-4 py-3 text-sm">{item.dp_category === 'GT_15' ? '> 15%' : '< 15%'}</td><td className="px-4 py-3 text-sm">{item.tenor}</td><td className="px-4 py-3 text-sm font-bold text-blue-700">{currency(item.amount)}</td><td className="px-4 py-3 text-xs text-slate-500">{formatDate(item.period_start)} - {formatDate(item.period_end)}</td></tr>)}</tbody></table></div>}</div>
  </div>
}

function Matrix({ title, category, form, setForm }) { return <div><p className="mb-2 text-xs font-bold uppercase text-slate-400">{title}</p><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{TENORS.map((tenor) => <Input key={tenor} label={`${tenor} bulan`} value={form[`${category}_${tenor}`]} onChange={(v) => setForm({ ...form, [`${category}_${tenor}`]: v })} numeric />)}</div></div> }
function Input({ label, value, onChange, type = 'text', placeholder = '', numeric = false }) {
  const handleChange = (event) => onChange(numeric ? formatNumericInput(event.target.value) : event.target.value)
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><input type={type} inputMode={numeric ? 'numeric' : undefined} value={value} placeholder={placeholder} onChange={handleChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" /></label>
}
function Select({ label, value, onChange, options }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function leasingOptions(items) { return Array.from(new Set([...DEFAULT_LEASING_OPTIONS, ...items.map((item) => item.leasing)])).filter(Boolean).sort() }
function seriesOptions(aliases) { return Array.from(new Set(['SCOOPY', ...aliases.map((alias) => alias.series_key)])).filter(Boolean).sort() }
function Card({ label, value, small }) { return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700"><p className="text-xs font-medium">{label}</p><p className={small ? 'mt-1 truncate text-sm font-bold' : 'mt-1 text-2xl font-bold'}>{value}</p></div> }
function formatDate(value) { if (!value) return '-'; return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
