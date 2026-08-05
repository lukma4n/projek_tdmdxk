import { useEffect, useMemo, useState } from 'react'
import { API_BASE, api } from '../services/api'
import { Bike, Check, CheckCircle2, Download, FileBadge, FileText, Loader2, MapPin, MessageCircle, Pencil, Phone, RefreshCw, Search, User, XCircle } from 'lucide-react'

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

// Teks pesan disusun backend (api/src/services/followupMessages.js) dan ikut
// dalam respons daftar sebagai `draft_message`/`wa_url`. Halaman ini tidak lagi
// menyusun sendiri, supaya isinya selalu mengikuti template aktif yang bisa
// diubah dari menu Template Pesan WA.


function getStatus(item) {
  return item.followup?.status || 'belum_dihubungi'
}

export default function ShowroomDocumentFollowup({ type }) {
  const isStnk = type === 'stnk'
  const title = isStnk ? 'Follow-up STNK' : 'Follow-up BPKB'
  const Icon = isStnk ? FileText : FileBadge
  const [items, setItems] = useState([])
  const [daily, setDaily] = useState(null)
  const [summary, setSummary] = useState({ total: 0, byStatus: {} })
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [aging, setAging] = useState('all')
  const [agingBuckets, setAgingBuckets] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [editMobileFor, setEditMobileFor] = useState(null)
  const [mobileDraft, setMobileDraft] = useState('')
  const [savingMobile, setSavingMobile] = useState(false)

  const startEditMobile = (item) => { setEditMobileFor(item.engine_number); setMobileDraft(item.mobile || '') }
  const saveMobile = async (item) => {
    setSavingMobile(true)
    try {
      const res = await api.updateStnkBpkbTrackMobile(item.engine_number, mobileDraft)
      setItems((prev) => prev.map((it) => (it.engine_number === item.engine_number ? { ...it, mobile: res.mobile } : it)))
      setEditMobileFor(null)
    } catch (err) {
      setError(err.message || 'Gagal memperbarui Nomor HP')
    } finally {
      setSavingMobile(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getShowroomDocumentFollowups(type, {
        limit: 150,
        ...(search && { search }),
        ...(aging !== 'all' && { aging }),
      })
      setItems(response.data || [])
      setSummary(response.summary || { total: 0, byStatus: {} })
      if (response.daily) setDaily(response.daily)
      setAgingBuckets(response.agingBuckets || [])
    } catch (err) {
      setError(err.message || `Gagal memuat ${title}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, search, aging])

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

  // Buka draf WhatsApp, staf yang menekan Kirim di WhatsApp Web.
  //
  // `window.open` dipanggil LANGSUNG di handler klik — teks pesannya sudah ikut
  // dalam respons daftar. Kalau menunggu request dulu baru membuka tab, browser
  // menganggapnya bukan hasil klik user dan memblokirnya sebagai popup.
  const openWhatsapp = async (item) => {
    if (!item.wa_url) return
    const nama = item.stnk_name || item.applicant_name || 'konsumen ini'
    if (!window.confirm(
      `Buka draf WhatsApp pemberitahuan ${isStnk ? 'STNK' : 'BPKB'} untuk ${nama}?\n\n` +
      'Pesan akan terbuka di WhatsApp Web — Anda yang menekan tombol Kirim di sana.',
    )) return

    window.open(item.wa_url, '_blank', 'noopener,noreferrer')

    const key = `${item.engine_number}:sudah_dihubungi`
    setSavingKey(key)
    try {
      const res = await api.recordFollowupContact(isStnk ? 'STNK' : 'BPKB', item.engine_number)
      if (res.daily) setDaily(res.daily)
      await loadData()
    } catch (err) {
      alert('Draf sudah dibuka, tapi gagal mencatat kontaknya: ' + err.message)
    } finally {
      setSavingKey('')
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(status !== 'all' && { status }),
        ...(aging !== 'all' && { aging }),
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
          {daily && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${
                daily.sisa === 0
                  ? 'bg-danger-50 text-danger-600 border-danger-200'
                  : daily.sisa <= 5
                    ? 'bg-warning-50 text-warning-600 border-warning-200'
                    : 'bg-hover text-muted border-border'
              }`}
              title="Batas harian melindungi nomor WhatsApp dealer dari pemblokiran WhatsApp"
            >
              <MessageCircle size={15} />
              Jatah WA hari ini: {daily.sisa}/{daily.limit}
            </span>
          )}
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
      </div>

      {agingBuckets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">
            Usia dokumen — sudah berapa lama {isStnk ? 'STNK' : 'BPKB'} jadi tapi belum diambil konsumen
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAging('all')}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${aging === 'all' ? 'bg-accent border-accent text-white' : 'bg-panel border-border text-muted hover:bg-hover'}`}
            >
              Semua ({counts.all || 0})
            </button>
            {agingBuckets.map((b) => {
              const jml = summary.byAging?.[b.value] || 0
              // Rentang tua diberi warna peringatan supaya yang paling berisiko
              // langsung terlihat tanpa harus membaca angkanya satu per satu.
              const tua = b.value === '181-365' || b.value === '365+'
              const aktif = aging === b.value
              return (
                <button
                  key={b.value}
                  onClick={() => setAging(b.value)}
                  disabled={jml === 0}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 ${
                    aktif
                      ? 'bg-accent border-accent text-white'
                      : tua && jml > 0
                        ? 'bg-warning-50 border-warning-200 text-warning-600 hover:bg-warning-100'
                        : 'bg-panel border-border text-muted hover:bg-hover'
                  }`}
                >
                  {b.label} ({jml})
                </button>
              )
            })}
          </div>
        </div>
      )}

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
              return (
                <div key={item.engine_number} className="p-4 hover:bg-hover/60 transition-colors">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-accent-soft text-accent border-accent-soft"><Icon size={11} />{isStnk ? 'STNK' : 'BPKB'}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[currentStatus] || statusColors.belum_dihubungi}`}>{statuses.find((s) => s.value === currentStatus)?.label || currentStatus}</span>
                        {/* Penanda urutan garap: yang belum pernah disentuh
                            menonjol, yang sudah menampilkan berapa kali dan
                            kapan terakhir — itu yang menentukan siapa berikutnya. */}
                        {item.followup_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-hover text-muted border-border" title={`Terakhir dihubungi ${item.followup?.creator?.name || item.followup?.creator?.username || '-'}`}>
                            <MessageCircle size={10} />
                            {item.followup_count}× · {item.last_contact_days === 0 ? 'hari ini' : `${item.last_contact_days} hari lalu`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-warning-50 text-warning-600 border-warning-200">
                            Belum pernah dihubungi
                          </span>
                        )}
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                            item.waiting_days > 180
                              ? 'bg-danger-50 text-danger-600 border-danger-200'
                              : item.waiting_days > 90
                                ? 'bg-warning-50 text-warning-600 border-warning-200'
                                : 'bg-hover text-muted border-border'
                          }`}
                          title={`Sudah ${item.waiting_days || 0} hari sejak ${isStnk ? 'STNK' : 'BPKB'} jadi`}
                        >
                          {item.waiting_days || 0} hari
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex items-center gap-2 min-w-0"><User size={15} className="text-faint shrink-0" /><div className="min-w-0"><p className="text-sm font-semibold text-text truncate">{item.stnk_name || '-'}</p><p className="text-xs text-faint truncate">Pemohon: {item.applicant_name || item.requestor_name || '-'}</p></div></div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone size={15} className="text-faint shrink-0" />
                          {editMobileFor === item.engine_number ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <input value={mobileDraft} onChange={(e) => setMobileDraft(e.target.value)} placeholder="0811..." className="w-32 rounded-lg border border-border bg-panel px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-accent-soft" />
                              <button onClick={() => saveMobile(item)} disabled={savingMobile} className="shrink-0 rounded p-1 text-success hover:bg-success-50 disabled:opacity-50" title="Simpan">{savingMobile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                              <button onClick={() => setEditMobileFor(null)} disabled={savingMobile} className="shrink-0 rounded p-1 text-muted hover:bg-hover" title="Batal"><XCircle size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-muted truncate">{item.mobile || item.customer_phone || '-'}</p>
                              <button onClick={() => startEditMobile(item)} className="shrink-0 rounded p-1 text-faint hover:text-accent" title="Ubah Nomor HP konsumen"><Pencil size={13} /></button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 min-w-0"><Bike size={15} className="text-faint shrink-0" /><p className="text-sm text-muted truncate">{item.engine_number || '-'}</p></div>
                        <div className="flex items-center gap-2 min-w-0"><MapPin size={15} className="text-faint shrink-0" /><p className="text-sm text-muted truncate">{isStnk ? item.stnk_location || '-' : item.bpkb_location || '-'}</p></div>
                      </div>
                      <p className="text-xs text-muted">{isStnk ? `No Polisi: ${item.police_number || '-'} | Jadi STNK: ${formatDate(item.stnk_ready_date)}` : `No BPKB: ${item.bpkb_number || '-'} | Jadi BPKB: ${formatDate(item.bpkb_ready_date)}`}</p>
                      {item.followup?.note && <p className="text-xs text-muted">Catatan terakhir: {item.followup.note}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button onClick={() => openWhatsapp(item)} disabled={!item.wa_url || savingKey !== '' || daily?.sisa === 0} title={daily?.sisa === 0 ? 'Jatah hubungi hari ini sudah habis' : 'Buka draf di WhatsApp Web — Anda yang menekan Kirim'} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-medium transition-colors">{savingKey === `${item.engine_number}:sudah_dihubungi` ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} Buka WA</button>
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
