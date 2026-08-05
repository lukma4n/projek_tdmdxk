import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import {
  AlertTriangle, Bike, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  FileBadge, FileText, History, Loader2, MapPin, MessageCircle, Pencil, Phone, RefreshCw, Search, User, X,
} from 'lucide-react'

const JENIS = [
  { value: 'all', label: 'Semua' },
  { value: 'KPB', label: 'KPB' },
  { value: 'STNK', label: 'STNK' },
  { value: 'BPKB', label: 'BPKB' },
]

const warnaJenis = {
  KPB: 'bg-accent-soft text-accent border-accent-soft',
  STNK: 'bg-warning-50 text-warning-600 border-warning-200',
  BPKB: 'bg-success-50 text-success-600 border-success-200',
}

const warnaStatus = {
  belum_dihubungi: 'bg-hover text-muted border-border',
  sudah_dihubungi: 'bg-accent-soft text-accent border-accent-soft',
  booking: 'bg-warning-50 text-warning-600 border-warning-200',
  datang: 'bg-success-50 text-success-600 border-success-200',
  diambil: 'bg-success-50 text-success-600 border-success-200',
  pending: 'bg-warning-50 text-warning-600 border-warning-200',
  batal: 'bg-danger-50 text-danger-600 border-danger-200',
}

const labelStatus = {
  belum_dihubungi: 'Belum Dihubungi', sudah_dihubungi: 'Sudah Dihubungi',
  booking: 'Booking', datang: 'Datang', diambil: 'Diambil', pending: 'Pending', batal: 'Batal',
}

const IkonJenis = ({ kind }) => {
  if (kind === 'KPB') return <Bike size={12} />
  if (kind === 'STNK') return <FileText size={12} />
  return <FileBadge size={12} />
}

function tanggal(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Tanggal lokal (bukan toISOString) — input type="date" memakai kalender setempat,
// dan toISOString menggeser tanggal untuk zona WIB.
function tanggalInput(offsetHari = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetHari)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export default function FollowupCenter() {
  const [items, setItems] = useState([])
  const [ringkasan, setRingkasan] = useState({ total: 0, per_jenis: {}, belum_dihubungi: 0 })
  const [tersaring, setTersaring] = useState({})
  const [daily, setDaily] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [areas, setAreas] = useState([])

  const [kind, setKind] = useState('all')
  const [nomorBermasalah, setNomorBermasalah] = useState(false)
  const [alasanLabel, setAlasanLabel] = useState({})
  const [area, setArea] = useState('all')
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [detail, setDetail] = useState(null)
  const [editNomor, setEditNomor] = useState(null)   // { key, draft }
  const [simpanNomor, setSimpanNomor] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.getFollowupQueue({
        kind, area, search, page, limit: 50,
        ...(nomorBermasalah && { nomor: 'bermasalah' }),
      })
      setItems(res.data || [])
      setRingkasan(res.ringkasan || { total: 0, per_jenis: {}, belum_dihubungi: 0 })
      setTersaring(res.tersaring || {})
      setAlasanLabel(res.alasan_nomor_label || {})
      setDaily(res.daily || null)
      setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 })
    } catch (err) {
      setError(err.message || 'Gagal memuat antrean follow-up')
    } finally {
      setLoading(false)
    }
  }, [kind, area, search, page, nomorBermasalah])

  // Pola `void Promise.resolve().then(...)` dipakai konsisten dengan halaman
  // lain di proyek ini: menunda setState keluar dari fase render effect.
  useEffect(() => { void Promise.resolve().then(loadData) }, [loadData])
  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const res = await api.getFollowupAreas()
        setAreas(res.data || [])
      } catch {
        setAreas([])
      }
    })
  }, [])

  // Ganti filter selalu kembali ke halaman 1, kalau tidak bisa berhenti di
  // halaman yang tidak ada lagi setelah hasilnya menyusut.
  const gantiFilter = (setter) => (nilai) => { setter(nilai); setPage(1) }

  // Buka draf WhatsApp, staf yang menekan Kirim.
  //
  // `window.open` dipanggil LANGSUNG di dalam handler klik — teks pesannya sudah
  // ikut dalam respons antrean. Kalau menunggu request dulu baru membuka tab,
  // browser menganggapnya bukan hasil klik user dan memblokirnya sebagai popup.
  const kirim = async (item) => {
    const kebutuhan = item.kebutuhan || [item.kind]
    const nama = item.customer_name || 'konsumen ini'
    if (!item.wa_url) return
    if (!window.confirm(
      `Buka draf WhatsApp ${kebutuhan.join(' + ')} untuk ${nama} (${item.phone})?\n\n` +
      'Pesan akan terbuka di WhatsApp Web — Anda yang menekan tombol Kirim di sana.',
    )) return

    window.open(item.wa_url, '_blank', 'noopener,noreferrer')

    setBusyKey(`${item.kind}:${item.key}`)
    try {
      const res = await api.recordFollowupContact(item.kind, item.key, {
        kebutuhan,
        kpb_level: item.kpb_label,
      })
      if (res.daily) setDaily(res.daily)
      await loadData()
    } catch (err) {
      alert('Draf sudah dibuka, tapi gagal mencatat kontaknya: ' + err.message)
    } finally {
      setBusyKey('')
    }
  }

  const jadwalkan = async (item) => {
    const tgl = window.prompt(
      `Jadwalkan hubungi ulang ${item.customer_name || ''}\nFormat: YYYY-MM-DD (konsumen disembunyikan dari antrean sampai tanggal ini)`,
      tanggalInput(7),
    )
    if (!tgl) return
    const catatan = window.prompt('Catatan (opsional), mis. "konsumen janji datang Sabtu"') || ''

    setBusyKey(`${item.kind}:${item.key}`)
    try {
      await api.scheduleFollowup(item.kind, item.key, {
        next_followup_at: tgl, status: 'pending', note: catatan, kpb_level: item.kpb_label,
      })
      await loadData()
    } catch (err) {
      alert('Gagal menyimpan jadwal: ' + err.message)
    } finally {
      setBusyKey('')
    }
  }

  const simpanPerbaikanNomor = async (item) => {
    setSimpanNomor(true)
    try {
      const res = await api.updateFollowupPhone(item.kind, item.key, editNomor.draft)
      setEditNomor(null)
      await loadData()
      alert(res.message)
    } catch (err) {
      alert(err.message)
    } finally {
      setSimpanNomor(false)
    }
  }

  const bukaRiwayat = async (item) => {
    setDetail({ item, loading: true, data: [], pengiriman: [] })
    try {
      const res = await api.getFollowupHistory(item.kind, item.key)
      setDetail({ item, loading: false, data: res.data || [], pengiriman: res.pengiriman || [] })
    } catch (err) {
      setDetail({ item, loading: false, data: [], pengiriman: [], error: err.message })
    }
  }

  const jumlahTersaring = useMemo(
    () => ['nomor_tidak_valid', 'baru_dihubungi', 'dijadwalkan_nanti']
      .reduce((a, k) => a + (tersaring[k] || 0), 0),
    [tersaring],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Pusat Follow-up</h1>
          <p className="text-sm text-muted">
            KPB, STNK, dan BPKB dalam satu antrean — diurutkan berdasarkan siapa yang paling mungkin datang
          </p>
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
        </div>
      </div>

      {daily?.sisa === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-warning-200 bg-warning-50 text-warning-600 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Jatah hubungi hari ini sudah habis ({daily.limit} konsumen). Antrean tetap bisa ditelusuri dan dijadwalkan,
            tapi lanjutkan menghubungi besok. Batas ini menjaga nomor WhatsApp dealer tetap aman — mengirim
            berpuluh pesan beruntun tetap terbaca blast walau ditekan manual.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total antrean', nilai: ringkasan.total, ikon: Clock },
          { label: 'KPB', nilai: ringkasan.per_jenis?.KPB || 0, ikon: Bike },
          { label: 'STNK', nilai: ringkasan.per_jenis?.STNK || 0, ikon: FileText },
          { label: 'BPKB', nilai: ringkasan.per_jenis?.BPKB || 0, ikon: FileBadge },
        ].map((k) => (
          <div key={k.label} className="p-4 bg-panel border border-border rounded-xl">
            <div className="flex items-center gap-2 text-muted text-xs font-medium">
              <k.ikon size={14} /> {k.label}
            </div>
            <p className="text-2xl font-bold text-text-strong mt-1">{k.nilai.toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchDraft); setPage(1) } }}
            placeholder="Cari nama, no HP, no mesin, no polisi..."
            className="w-full pl-9 pr-4 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select value={area} onChange={(e) => gantiFilter(setArea)(e.target.value)} className="px-3 py-2 bg-panel border border-border rounded-lg text-sm max-w-[220px]">
          <option value="all">Semua area</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {JENIS.map((j) => (
          <button
            key={j.value}
            onClick={() => gantiFilter(setKind)(j.value)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium ${kind === j.value ? 'bg-accent border-accent text-white' : 'bg-panel border-border text-muted hover:bg-hover'}`}
          >
            {j.label}
          </button>
        ))}
        {/* Nomor bermasalah tidak lagi hilang diam-diam: bisa dibuka, dilihat
            alasannya, dan diperbaiki di sumber datanya. */}
        <button
          onClick={() => { setNomorBermasalah((v) => !v); setPage(1) }}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${
            nomorBermasalah
              ? 'bg-danger-600 border-danger-600 text-white'
              : 'bg-panel border-border text-muted hover:bg-hover'
          }`}
        >
          <AlertTriangle size={14} />
          Nomor bermasalah
          {!nomorBermasalah && tersaring.nomor_tidak_valid > 0 && ` (${tersaring.nomor_tidak_valid})`}
        </button>
      </div>

      {jumlahTersaring > 0 && (
        <p className="text-xs text-muted">
          {jumlahTersaring.toLocaleString('id-ID')} target disembunyikan:{' '}
          {tersaring.baru_dihubungi > 0 && `${tersaring.baru_dihubungi} baru dihubungi (<7 hari)`}
          {tersaring.baru_dihubungi > 0 && (tersaring.dijadwalkan_nanti > 0 || tersaring.nomor_tidak_valid > 0) && ', '}
          {tersaring.dijadwalkan_nanti > 0 && `${tersaring.dijadwalkan_nanti} dijadwalkan hubungi ulang`}
          {tersaring.dijadwalkan_nanti > 0 && tersaring.nomor_tidak_valid > 0 && ', '}
          {tersaring.nomor_tidak_valid > 0 && `${tersaring.nomor_tidak_valid} nomor HP bermasalah`}
          {tersaring.per_alasan && Object.keys(tersaring.per_alasan).length > 0 && (
            <> — {Object.entries(tersaring.per_alasan)
              .map(([k, n]) => `${n} ${(alasanLabel[k] || k).toLowerCase()}`)
              .join(', ')}</>
          )}
        </p>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-600 text-sm">{error}</div>
      )}

      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted"><Loader2 className="mx-auto animate-spin mb-2" size={24} />Memuat antrean...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto text-success-400 mb-2" size={32} />
            <p className="text-sm text-muted">Tidak ada target follow-up sesuai filter</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, idx) => {
              const kebutuhan = item.kebutuhan || [item.kind]
              const sibuk = busyKey === `${item.kind}:${item.key}`
              const nomorUrut = (pagination.page - 1) * 50 + idx + 1
              return (
                <div key={`${item.kind}-${item.key}`} className="p-4 hover:bg-hover/60 transition-colors">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex gap-3 min-w-0">
                      <div className="shrink-0 w-10 text-center">
                        <div className="text-xs text-muted">#{nomorUrut}</div>
                        <div className="text-sm font-bold text-accent">{Math.round(item.skor)}</div>
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {kebutuhan.map((k) => (
                            <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${warnaJenis[k]}`}>
                              <IkonJenis kind={k} />{k}
                            </span>
                          ))}
                          {item.gabungan && (
                            <span className="text-xs text-success-600 font-medium">1 pesan untuk keduanya</span>
                          )}
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${warnaStatus[item.status] || warnaStatus.belum_dihubungi}`}>
                            {labelStatus[item.status] || item.status}
                          </span>
                        </div>
                        <p className="font-semibold text-text-strong truncate flex items-center gap-1.5">
                          <User size={14} className="text-muted shrink-0" />
                          {item.customer_name || '(tanpa nama)'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          {editNomor?.key === `${item.kind}:${item.key}` ? (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              <input
                                autoFocus
                                value={editNomor.draft}
                                onChange={(e) => setEditNomor({ ...editNomor, draft: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') simpanPerbaikanNomor(item)
                                  if (e.key === 'Escape') setEditNomor(null)
                                }}
                                placeholder="08xx..."
                                className="w-40 px-2 py-1 bg-panel border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                              <button onClick={() => simpanPerbaikanNomor(item)} disabled={simpanNomor} className="px-2 py-1 rounded bg-accent text-white text-xs disabled:opacity-50">Simpan</button>
                              <button onClick={() => setEditNomor(null)} className="px-2 py-1 rounded border border-border text-xs">Batal</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {item.phone_valid
                                ? item.phone
                                : <span className="text-danger-600">{item.nomor_tersimpan || '(kosong)'}</span>}
                              <button
                                onClick={() => setEditNomor({ key: `${item.kind}:${item.key}`, draft: item.nomor_tersimpan || '' })}
                                title="Perbaiki nomor HP konsumen"
                                className="p-0.5 text-faint hover:text-accent"
                              >
                                <Pencil size={11} />
                              </button>
                            </span>
                          )}
                          {item.model && <span className="flex items-center gap-1"><Bike size={12} />{item.model}</span>}
                          {item.area && <span className="flex items-center gap-1"><MapPin size={12} />{item.area}</span>}
                          {item.kind === 'KPB' && item.kpb_label && (
                            <span>{item.kpb_label} • jatuh tempo {tanggal(item.due_date)}</span>
                          )}
                          {item.kind !== 'KPB' && (
                            <span>siap sejak {tanggal(item.ready_date)} • menunggu {item.waiting_days} hari</span>
                          )}
                        </div>
                        <p className="text-xs text-accent">{item.alasan_prioritas}</p>
                        {!item.phone_valid && (
                          <p className="text-xs text-danger-600 flex items-center gap-1">
                            <AlertTriangle size={12} className="shrink-0" />
                            {alasanLabel[item.alasan_nomor] || 'Nomor HP tidak bisa dihubungi'} — klik ikon pensil untuk memperbaiki
                          </p>
                        )}
                        {item.tertunda_lain?.length > 0 && (
                          <p className="text-xs text-muted">
                            Konsumen ini juga punya {item.tertunda_lain.map((t) => t.kind).join(', ')} tertunda —
                            akan muncul setelah kontak ini selesai
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => bukaRiwayat(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-panel border border-border rounded-lg text-xs font-medium text-muted hover:bg-hover"
                      >
                        <History size={14} /> Riwayat
                      </button>
                      <button
                        onClick={() => jadwalkan(item)}
                        disabled={sibuk}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-panel border border-border rounded-lg text-xs font-medium text-muted hover:bg-hover disabled:opacity-50"
                      >
                        <CalendarClock size={14} /> Jadwalkan
                      </button>
                      <button
                        onClick={() => kirim(item)}
                        disabled={sibuk || !item.wa_url || daily?.sisa === 0}
                        title={daily?.sisa === 0 ? 'Jatah hubungi hari ini sudah habis' : 'Buka draf di WhatsApp Web — Anda yang menekan Kirim'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-medium"
                      >
                        {sibuk ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} Buka WA
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Halaman {pagination.page} dari {pagination.totalPages} • {pagination.total.toLocaleString('id-ID')} target
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 px-3 py-2 bg-panel border border-border rounded-lg disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 bg-panel border border-border rounded-lg disabled:opacity-40"
            >
              Berikutnya <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-panel border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-panel">
              <div>
                <h2 className="font-bold text-text-strong">Riwayat Follow-up</h2>
                <p className="text-xs text-muted">{detail.item.customer_name} • {detail.item.kind}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 text-muted hover:text-text-strong"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              {detail.loading ? (
                <p className="text-sm text-muted text-center py-6"><Loader2 className="mx-auto animate-spin" size={20} /></p>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase mb-2">Kontak ({detail.data.length})</h3>
                    {detail.data.length === 0 ? (
                      <p className="text-sm text-muted">Belum pernah dihubungi.</p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.data.map((f) => (
                          <li key={f.id} className="text-sm border border-border rounded-lg p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${warnaStatus[f.status] || warnaStatus.belum_dihubungi}`}>
                                {labelStatus[f.status] || f.status}
                              </span>
                              <span className="text-xs text-muted">{tanggal(f.followup_at)}</span>
                            </div>
                            {f.note && <p className="text-xs text-muted mt-1.5">{f.note}</p>}
                            {f.next_followup_at && (
                              <p className="text-xs text-warning-600 mt-1">Dijadwalkan ulang: {tanggal(f.next_followup_at)}</p>
                            )}
                            <p className="text-xs text-muted mt-1">oleh {f.creator?.name || f.creator?.username || '-'}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase mb-2">Pengiriman WhatsApp ({detail.pengiriman.length})</h3>
                    {detail.pengiriman.length === 0 ? (
                      <p className="text-sm text-muted">Belum ada pesan terkirim.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {detail.pengiriman.map((k) => (
                          <li key={k.id} className="text-xs text-muted flex items-center justify-between gap-2 border border-border rounded-lg p-2">
                            <span>{k.module.replace('_', ' + ')} → {k.phone}</span>
                            <span>{tanggal(k.sent_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
