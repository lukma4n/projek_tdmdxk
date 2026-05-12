import { useEffect, useState } from 'react'
import { AlertTriangle, Calculator, CheckCircle, Loader2, RotateCcw, TrendingDown } from 'lucide-react'
import { api } from '../services/api'

const EMPTY_FORM = {
  product_type: '',
  city_name: 'KAB. KETAPANG',
  finance_company: 'FIF',
  tenor: '36',
  sale_type: 'KREDIT',
  dp_gross: '',
  dp_net_customer: '',
  hutang_komisi: '',
  dealer_subsidy: '',
  tax_divisor: '1.11',
}

function currency(value, fractionDigits = 0) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(Number(value) || 0)
}

function formatNumericInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

function marginConfig(status) {
  if (status === 'minus') return { label: 'Margin Minus', note: 'Acuan keputusan mengikuti kebijakan margin manajemen bulan berjalan.', className: 'border-danger-200 bg-danger-50 text-danger-700', icon: TrendingDown }
  if (status === 'tipis') return { label: 'Margin Tipis', note: 'Acuan keputusan mengikuti kebijakan margin manajemen bulan berjalan.', className: 'border-warning-200 bg-warning-50 text-warning-700', icon: AlertTriangle }
  return { label: 'Margin Aman', note: 'Acuan keputusan mengikuti kebijakan margin manajemen bulan berjalan.', className: 'border-success-200 bg-success-50 text-success-700', icon: CheckCircle }
}

export default function SalesOrderMargin() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState(null)
  const [tacPrograms, setTacPrograms] = useState([])
  const [bbnAreas, setBbnAreas] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    async function loadMasters() {
      try {
        const [tacRes, bbnRes] = await Promise.all([
          api.getShowroomTacPrograms(),
          api.getShowroomBbnPrices({ page: 1, limit: 1000 }),
        ])
        if (!ignore) {
          setTacPrograms(tacRes.data || [])
          setBbnAreas(uniqueOptions((bbnRes.data || []).map((item) => item.city_name), ['KAB. KETAPANG']))
        }
      } catch {
        if (!ignore) {
          setTacPrograms([])
          setBbnAreas(['KAB. KETAPANG'])
        }
      }
    }
    void loadMasters()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.previewSalesOrderMargin(form)
        setPreview(res.data)
      } catch {
        setPreview(null)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [form])

  const setField = (key, value) => setForm((current) => {
    if (key === 'finance_company') return { ...current, finance_company: value, tenor: value === 'IMFI' ? '0' : current.tenor === '0' ? '36' : current.tenor }
    if (key === 'sale_type') return { ...current, sale_type: value, finance_company: value === 'CASH' ? '' : current.finance_company || 'FIF', tenor: value === 'CASH' ? '0' : current.tenor === '0' ? '36' : current.tenor }
    return { ...current, [key]: value }
  })
  const margin = marginConfig(preview?.marginStatus)
  const MarginIcon = margin.icon
  const leasingOptions = uniqueOptions(tacPrograms.map((item) => item.leasing), ['FIF', 'ADIRA', 'IMFI', 'OTO'])
  const tenorOptions = uniqueOptions(
    tacPrograms
      .filter((item) => Number(item.amount) > 0 && item.leasing === form.finance_company && (!preview?.tac_series_key || item.series_key === preview.tac_series_key))
      .map((item) => String(item.tenor)),
    ['12', '18', '24', '30', '36'],
  )
  const isCash = form.sale_type === 'CASH'
  const usesPromoScheme = form.finance_company === 'IMFI' && !isCash

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Simulasi DP & Margin</h1>
          <p className="text-sm text-slate-500">Kontrol DP net sebelum deal: sistem hitung TAC/program otomatis dan menampilkan sisa margin sebagai acuan keputusan.</p>
        </div>
        <button onClick={() => setForm(EMPTY_FORM)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><RotateCcw size={16} /> Reset</button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.8fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2"><Calculator size={18} className="text-blue-600" /><h2 className="font-semibold text-slate-800">Input Pertanyaan Sales</h2></div>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Unit dan Program</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input label="Kode Unit" value={form.product_type} onChange={(v) => setField('product_type', v.toUpperCase())} placeholder="Contoh: MRBC" autoFocus />
              <Select label="Area BBN" value={form.city_name} onChange={(v) => setField('city_name', v)} options={bbnAreas} />
              {isCash ? <ReadOnly label="Leasing" value="Tidak dipakai CASH" /> : <Select label="Leasing" value={form.finance_company} onChange={(v) => setField('finance_company', v)} options={leasingOptions} />}
              {isCash ? <ReadOnly label="Tenor" value="Tidak dipakai CASH" /> : usesPromoScheme ? <ReadOnly label="Tenor" value="Tidak dipakai IMFI" /> : <Select label="Tenor" value={form.tenor} onChange={(v) => setField('tenor', v)} options={tenorOptions} />}
              <Select label="Tipe Jualan" value={form.sale_type} onChange={(v) => setField('sale_type', v)} options={['KREDIT', 'CASH']} />
              <ReadOnly label={isCash ? 'Program' : usesPromoScheme ? 'Scheme IMFI' : 'Series TAC'} value={isCash ? 'Cash: tanpa TAC/Finco' : usesPromoScheme ? 'Dana Promosi Scheme' : preview?.tac_series_key || '-'} />
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-500">Simulasi DP Net</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label={isCash ? 'Simulasi Diskon Tambahan' : 'DP Gross Konsumen'} value={form.dp_gross} onChange={(v) => setField('dp_gross', v)} placeholder="2.150.000" numeric />
              <Input label={isCash ? 'Setoran Konsumen' : 'DP Net Konsumen Mau Setor'} value={form.dp_net_customer} onChange={(v) => setField('dp_net_customer', v)} placeholder="450.000" numeric />
            </div>
            <p className="text-xs text-blue-700">{isCash ? 'Cash: Sisa Piutang = OTR - (Setoran + Program MD + Diskon Dealer Manual).' : 'Tambahan diskon dihitung otomatis: DP Gross - TAC/program - DP Net konsumen.'}</p>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Beban Tambahan Jika Ada</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Hutang Komisi" value={form.hutang_komisi} onChange={(v) => setField('hutang_komisi', v)} numeric />
              <Input label={isCash ? 'Diskon Dealer Manual' : 'Subsidi Dealer Manual'} value={form.dealer_subsidy} onChange={(v) => setField('dealer_subsidy', v)} numeric />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className={`rounded-xl border p-5 shadow-sm ${margin.className}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase">Sisa Margin Simulasi</p>
                <p className="mt-1 text-3xl font-black">{currency(preview?.marginRemaining || 0, 2)}</p>
              </div>
              {loading ? <Loader2 className="animate-spin" size={38} /> : <MarginIcon size={38} />}
            </div>
            <p className="mt-2 text-sm font-semibold">{margin.label}. {margin.note}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="DP Setelah Program" value={currency(preview?.dpAfterProgram || 0)} />
            <Metric label="Tambahan Diskon" value={currency(preview?.additionalDiscount || 0)} />
            <Metric label={isCash ? 'Sisa Piutang' : usesPromoScheme ? 'Dana Promosi IMFI' : 'TAC Leasing'} value={currency(isCash ? preview?.sisaPiutang || 0 : preview?.tac_program_subsidy || 0)} />
            <Metric label="Total Beban Dealer" value={currency(preview?.totalBebanDealer || 0)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Rincian DP dan Program</p>
            <Row label="DP Gross" value={currency(preview?.dpGross || 0)} />
            {!isCash && <Row label={usesPromoScheme ? 'Dana Promosi IMFI' : 'TAC Leasing'} value={currency(preview?.tac_program_subsidy || 0)} />}
            {usesPromoScheme && <Row label="Dana Titipan Cabang" value={currency(preview?.promo_scheme_branch_deposit_amount || 0)} />}
            {!isCash && <Row label="Status TAC" value={preview?.tac_lookup_message || '-'} />}
            {!isCash && !usesPromoScheme && <Row label="Tenor TAC Tersedia" value={(preview?.tac_available_tenors || []).join(', ') || '-'} />}
            <Row label="Subsidi AHM" value={currency(preview?.ahm_discount || 0)} />
            <Row label="Subsidi MD" value={currency(preview?.md_discount || 0)} />
            <Row label="Subsidi Dealer Program" value={currency(preview?.program_dealer_discount || 0)} />
            <Row label="Total Program MD" value={currency(preview?.program_total_discount || 0)} />
            <Row label="Total Disc" value={currency(preview?.totalDisc || 0)} />
            {isCash && <Row label="Sisa Piutang" value={currency(preview?.sisaPiutang || 0)} bold />}
            <Row label="DP Setelah Program" value={currency(preview?.dpAfterProgram || 0)} />
            <Row label="DP Net Konsumen" value={currency(preview?.dpNetCustomer || 0)} />
            <Row label="Tambahan Diskon" value={currency(preview?.additionalDiscount || 0)} bold />
            <Row label="Hutang Komisi" value={currency(preview?.hutangKomisiGross || 0, 2)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Audit Margin</p>
            <Row label="Nama Unit" value={preview?.description || preview?.series || '-'} />
            <Row label="Harga OTR" value={currency(preview?.otr_price || 0)} />
            <Row label="Harga Beli Dealer" value={currency(preview?.purchase_price || 0)} />
            <Row label="Kategori DP" value={preview?.tac_dp_category === 'GT_15' ? `> 15% (${preview?.dp_percent || 0}%)` : `< 15% (${preview?.dp_percent || 0}%)`} />
            <Row label="Total Harga Jual" value={currency(preview?.totalHargaJual || 0, 2)} />
            <Row label="Total Disc" value={currency(preview?.totalDisc || 0, 2)} />
            <Row label="Total Tax" value={currency(preview?.totalTax || 0, 2)} />
            <Row label="Total BBN" value={currency(preview?.totalBbn || 0, 2)} />
            <Row label="Sisa Piutang" value={currency(preview?.sisaPiutang || 0, 2)} />
            <Row label="Total Beban Dealer" value={currency(preview?.totalBebanDealer || 0)} />
            <Row label="Margin Sebelum Diskon Tambahan" value={currency(preview?.marginBeforeAdditionalDiscount || 0, 2)} />
            <Row label="GP Unit" value={currency(preview?.gpUnit || 0, 2)} />
            <Row label="GP BBN" value={currency(preview?.gpBbn || 0, 2)} />
            <Row label="Sisa Margin" value={currency(preview?.marginRemaining || 0, 2)} bold />
          </div>
        </div>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder = '', autoFocus = false, numeric = false }) {
  const handleChange = (event) => {
    onChange(numeric ? formatNumericInput(event.target.value) : event.target.value)
  }

  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><input autoFocus={autoFocus} type={type} inputMode={numeric ? 'numeric' : undefined} value={value} placeholder={placeholder} onChange={handleChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" /></label>
}

function Select({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function uniqueOptions(values, fallback = []) {
  return Array.from(new Set([...fallback, ...values].filter(Boolean))).sort((a, b) => Number(a) && Number(b) ? Number(a) - Number(b) : String(a).localeCompare(String(b)))
}

function ReadOnly({ label, value }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{value}</div></label>
}

function Metric({ label, value, highlight = false, danger = false }) {
  const className = danger ? 'text-danger-700' : highlight ? 'text-blue-700' : 'text-slate-900'
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${className}`}>{value}</p></div>
}

function Row({ label, value, bold = false }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0"><span className="text-sm text-slate-500">{label}</span><span className={bold ? 'text-lg font-black text-slate-900' : 'text-sm font-semibold text-slate-700'}>{value}</span></div>
}
