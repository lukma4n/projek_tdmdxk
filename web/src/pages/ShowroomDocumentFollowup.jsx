import { useEffect, useMemo, useState } from 'react'
import { API_BASE, api } from '../services/api'
import { Bike, CheckCircle2, Download, FileBadge, FileText, Loader2, MapPin, MessageCircle, Phone, RefreshCw, Search, User, XCircle } from 'lucide-react'

const statuses = [
  { value: 'all', label: 'Semua' },
  { value: 'belum_dihubungi', label: 'Belum Dihubungi' },
  { value: 'sudah_dihubungi', label: 'Sudah Dihubungi' },
  { value: 'diambil', label: 'Diambil' },
  { value: 'pending', label: 'Pending' },
  { value: 'batal', label: 'Batal' },
]

const statusColors = {
  belum_dihubungi: 'bg-hover text-muted border-border',
  sudah_dihubungi: 'bg-accent-soft text-accent border-accent-soft',
  diambil: 'bg-success-50 text-success-600 border-success-200',
  pending: 'bg-warning-50 text-warning-600 border-warning-200',
  batal: 'bg-danger-50 text-danger-600 border-danger-200',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

function buildStnkMessage() {
  return [
    'Salam Satu Hati Pelanggan Setia Honda',
    '',
    'Kami Mau menginformasikan Bahwa STNK motor Honda anda Sudah Jadi',
    'Diharapkan untuk segera mengambil STNK di Dealer Honda TDM Motor.',
    'ALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan',
    '',
    'DENGAN PERSYARATAN :',
    '# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)',
    'konsumen wajib membawa STNK Sementara dan KTP asli',
    '',
    'Jam buka',
    'Senin-Jumat   : 09.00-16.00',
    'Sabtu               : 09.00-14.00',
    'Istirahat          : 12.00-13.30',
    '',
    'Terimakasih',
  ].join('\n')
}

function buildBpkbMessage() {
  return [
    'Salam Satu Hati Pelanggan Setia Honda',
    '',
    'kami Mau menginformasikan Bahwa BPKB motor Honda anda Sudah Jadi',
    'Diharapkan untuk segera mengambil BPKB di Dealer Honda TDM Motor.',
    'ALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan',
    '',
    'DENGAN PERSYARATAN :',
    '# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)',
    'konsumen wajib membawa STNK dan KTP asli',
    '',
    '# Jika Pengambilan BPKB diwakili',
    'konsumen wajib : membawa surat kuasa dr pemilik kendaraan yg bertanda tangan diatas materai 10.000',
    'dan ktp Asli pembeli dan yg mewakili 1 lembar STNK dan KTP Asli',
    '',
    'Jam buka',
    'Senin-Jumat : 09.00-16.00',
    'Sabtu                : 09.00-14.00',
    'Istirahat          : 12.00-13.30',
    '',
    'Terimakasih',
  ].join('\n')
}

function buildWhatsappUrl(type, item) {
  const phone = normalizePhone(item.mobile || item.customer_phone)
  if (!phone) return ''
  const message = type === 'stnk' ? buildStnkMessage(item) : buildBpkbMessage(item)
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function getStatus(item) {
  return item.followup?.status || 'belum_dihubungi'
}

export default function ShowroomDocumentFollowup({ type }) {
  const isStnk = type === 'stnk'
  const title = isStnk ? 'Follow-up STNK' : 'Follow-up BPKB'
  const Icon = isStnk ? FileText : FileBadge
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({ total: 0, byStatus: {} })
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [overdueMin, setOverdueMin] = useState('all')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getShowroomDocumentFollowups(type, {
        limit: 150,
        ...(search && { search }),
        ...(!isStnk && overdueMin !== 'all' && { overdue_min: overdueMin }),
      })
      setItems(response.data || [])
      setSummary(response.summary || { total: 0, byStatus: {} })
    } catch (err) {
      setError(err.message || `Gagal memuat ${title}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, search, overdueMin])

  const counts = useMemo(() => ({ all: summary.total || 0, ...(summary.byStatus || {}) }), [summary])
  const filteredItems = useMemo(() => {
    if (status === 'all') return items
    return items.filter((item) => getStatus(item) === status)
  }, [items, status])

  const saveStatus = async (item, nextStatus, note = '') => {
    const key = `${item.engine_number}:${nextStatus}`
    setSavingKey(key)
    try {
      await api.createShowroomDocumentFollowup(type, item.engine_number, { status: nextStatus, note })
      await loadData()
    } catch (err) {
      alert(`Gagal menyimpan follow-up ${isStnk ? 'STNK' : 'BPKB'}: ` + err.message)
    } finally {
      setSavingKey('')
    }
  }

  const openWhatsapp = async (item) => {
    const url = buildWhatsappUrl(type, item)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
    await saveStatus(item, 'sudah_dihubungi', `Dibuka via tombol WhatsApp Follow-up ${isStnk ? 'STNK' : 'BPKB'}`)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(status !== 'all' && { status }),
        ...(!isStnk && overdueMin !== 'all' && { overdue_min: overdueMin }),
      }).toString()
      const response = await fetch(`${API_BASE}/showroom/document-followups/${type}/export${params ? '?' + params : ''}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const exportError = await response.json().catch(() => ({ error: 'Export gagal' }))
        throw new Error(exportError.error || 'Export gagal')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href = url
      a.download = `Followup_${isStnk ? 'STNK' : 'BPKB'}_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Gagal export ${title}: ` + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">{title}</h1>
          <p className="text-sm text-muted">Pipeline follow-up pengambilan dokumen {isStnk ? 'STNK' : 'BPKB'} konsumen</p>
          {!isStnk && <p className="text-xs text-warning-600 mt-1">Hanya BPKB pembelian cash. BPKB leasing tidak ditampilkan karena diserahkan ke leasing.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 bg-panel border border-border rounded-lg text-sm font-medium text-muted hover:bg-hover">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={handleExport} disabled={exporting || filteredItems.length === 0} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-green-600/20">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-accent-soft bg-accent-soft text-accent-text">
          <p className="text-xs font-medium opacity-80">Total Pipeline</p>
          <p className="text-2xl font-bold mt-1">{counts.all || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-panel text-text">
          <p className="text-xs font-medium opacity-80">Belum Dihubungi</p>
          <p className="text-2xl font-bold mt-1">{counts.belum_dihubungi || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <p className="text-xs font-medium opacity-80">Diambil</p>
          <p className="text-2xl font-bold mt-1">{counts.diambil || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-700">
          <p className="text-xs font-medium opacity-80">Pending / Batal</p>
          <p className="text-2xl font-bold mt-1">{(counts.pending || 0) + (counts.batal || 0)}</p>
        </div>
      </div>

      <div className="bg-panel rounded-xl border border-border shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isStnk ? 'Cari nama, no mesin, no polisi...' : 'Cari nama, no mesin, no BPKB...'} className="w-full pl-9 pr-4 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        {!isStnk && (
          <select value={overdueMin} onChange={(e) => setOverdueMin(e.target.value)} className="px-3 py-2 bg-hover border border-border rounded-lg text-sm">
            <option value="all">Semua Overdue</option>
            <option value="180">Overdue &gt;= 180 Hari</option>
            <option value="365">Overdue &gt;= 365 Hari</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button key={item.value} onClick={() => setStatus(item.value)} className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${status === item.value ? 'bg-accent border-accent text-white' : 'bg-panel border-border text-muted hover:bg-hover'}`}>
            {item.label} ({counts[item.value] || 0})
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-accent" size={26} /></div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-success-400 mb-2" size={32} /><p className="text-sm text-muted">Tidak ada data follow-up sesuai filter</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const currentStatus = getStatus(item)
              const waUrl = buildWhatsappUrl(type, item)
              return (
                <div key={item.engine_number} className="p-4 hover:bg-hover/60 transition-colors">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-accent-soft text-accent border-accent-soft"><Icon size={11} />{isStnk ? 'STNK' : 'BPKB'}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[currentStatus] || statusColors.belum_dihubungi}`}>{statuses.find((s) => s.value === currentStatus)?.label || currentStatus}</span>
                        {!isStnk && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border bg-warning-50 text-warning-600 border-warning-200">{item.overdue_days || 0} hari</span>}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex items-center gap-2 min-w-0"><User size={15} className="text-faint shrink-0" /><div className="min-w-0"><p className="text-sm font-semibold text-text truncate">{item.stnk_name || '-'}</p><p className="text-xs text-faint truncate">Pemohon: {item.applicant_name || item.requestor_name || '-'}</p></div></div>
                        <div className="flex items-center gap-2 min-w-0"><Phone size={15} className="text-faint shrink-0" /><p className="text-sm text-muted truncate">{item.mobile || item.customer_phone || '-'}</p></div>
                        <div className="flex items-center gap-2 min-w-0"><Bike size={15} className="text-faint shrink-0" /><p className="text-sm text-muted truncate">{item.engine_number || '-'}</p></div>
                        <div className="flex items-center gap-2 min-w-0"><MapPin size={15} className="text-faint shrink-0" /><p className="text-sm text-muted truncate">{isStnk ? item.stnk_location || '-' : item.bpkb_location || '-'}</p></div>
                      </div>
                      <p className="text-xs text-muted">{isStnk ? `No Polisi: ${item.police_number || '-'} | Jadi STNK: ${formatDate(item.stnk_ready_date)}` : `No BPKB: ${item.bpkb_number || '-'} | Jadi BPKB: ${formatDate(item.bpkb_ready_date)}`}</p>
                      {item.followup?.note && <p className="text-xs text-muted">Catatan terakhir: {item.followup.note}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button onClick={() => openWhatsapp(item)} disabled={!waUrl || savingKey !== ''} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-medium transition-colors">{savingKey === `${item.engine_number}:sudah_dihubungi` ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} WhatsApp</button>
                      <button onClick={() => saveStatus(item, 'diambil', `Ditandai diambil dari halaman ${title}`)} disabled={savingKey !== ''} className="inline-flex items-center gap-1.5 px-3 py-2 bg-success-50 border border-success-200 text-success-700 rounded-lg text-xs font-medium hover:bg-success-100 disabled:opacity-50">Diambil</button>
                      <button onClick={() => saveStatus(item, 'pending', `Ditandai pending dari halaman ${title}`)} disabled={savingKey !== ''} className="inline-flex items-center gap-1.5 px-3 py-2 bg-warning-50 border border-warning-200 text-warning-700 rounded-lg text-xs font-medium hover:bg-warning-100 disabled:opacity-50">Pending</button>
                      <button onClick={() => saveStatus(item, 'batal', `Ditandai batal dari halaman ${title}`)} disabled={savingKey !== ''} className="inline-flex items-center gap-1.5 px-3 py-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-xs font-medium hover:bg-danger-100 disabled:opacity-50"><XCircle size={14} /> Batal</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
