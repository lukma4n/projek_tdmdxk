import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE } from '../services/api'
import {
  AlertTriangle,
  Bike,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react'

const statuses = [
  { value: 'all', label: 'Semua' },
  { value: 'belum_dihubungi', label: 'Belum Dihubungi' },
  { value: 'sudah_dihubungi', label: 'Sudah Dihubungi' },
  { value: 'booking', label: 'Booking' },
  { value: 'datang', label: 'Datang' },
  { value: 'batal', label: 'Batal' },
]

const statusColors = {
  belum_dihubungi: 'bg-hover text-muted border-border',
  sudah_dihubungi: 'bg-accent-soft text-accent border-accent-soft',
  booking: 'bg-warning-50 text-warning-600 border-warning-200',
  datang: 'bg-success-50 text-success-600 border-success-200',
  batal: 'bg-danger-50 text-danger-600 border-danger-200',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDays(days) {
  if (days < 0) return `${Math.abs(days)} hari lewat`
  if (days === 0) return 'Hari ini'
  return `${days} hari lagi`
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

// Template pesan kini disusun backend (api/src/services/followupMessages.js)
// karena pengiriman dilakukan server lewat gateway WhatsApp.

function getFollowupStatus(item) {
  return item.followup?.status || 'belum_dihubungi'
}

export default function FollowupKpb() {
  const [alerts, setAlerts] = useState([])
  const [daily, setDaily] = useState(null)
  const [summary, setSummary] = useState({ overdue: 0, warning: 0 })
  const [days, setDays] = useState('7')
  const [status, setStatus] = useState('all')
  const [level, setLevel] = useState('all')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getCustomerAlerts({ days })
      setAlerts(response.data || [])
      setSummary(response.summary || { overdue: 0, warning: 0 })
      if (response.daily) setDaily(response.daily)
    } catch (err) {
      setError(err.message || 'Gagal memuat follow-up KPB')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const filtered = useMemo(() => {
    return alerts.filter((item) => {
      if (status !== 'all' && getFollowupStatus(item) !== status) return false
      if (level !== 'all' && item.kpb_label !== level) return false
      return true
    })
  }, [alerts, status, level])

  const counts = useMemo(() => {
    const result = Object.fromEntries(statuses.map((item) => [item.value, 0]))
    result.all = alerts.length
    for (const item of alerts) {
      result[getFollowupStatus(item)] = (result[getFollowupStatus(item)] || 0) + 1
    }
    return result
  }, [alerts])

  const saveStatus = async (item, nextStatus, note = '') => {
    if (!item.id) return
    const key = `${item.id}:${item.kpb_label}:${nextStatus}`
    setSavingKey(key)

    try {
      await api.createCustomerFollowup(item.id, {
        kpb_level: item.kpb_label,
        status: nextStatus,
        note,
      })
      await loadData()
    } catch (err) {
      alert('Gagal menyimpan follow-up: ' + err.message)
    } finally {
      setSavingKey('')
    }
  }

  // Dikirim server via gateway WhatsApp. Isi pesan disusun backend, jadi tidak
  // ada lagi tab wa.me yang harus ditekan kirim manual.
  const openWhatsapp = async (item) => {
    if (!item.id) return
    const phone = normalizePhone(item.customer_mobile)
    if (!phone) return

    // Dulu tombol ini hanya membuka draf wa.me — staf masih bisa membaca dan
    // membatalkan sebelum menekan kirim. Sekarang pesannya langsung terkirim dan
    // tidak bisa ditarik kembali, jadi salah klik harus punya satu pintu tolak.
    if (!window.confirm(`Kirim WhatsApp pengingat ${item.kpb_label} ke ${item.customer || 'konsumen ini'} (${phone})?`)) return

    const key = `${item.id}:${item.kpb_label}:sudah_dihubungi`
    setSavingKey(key)

    try {
      const res = await api.sendCustomerFollowupWhatsapp(item.id, { kpb_level: item.kpb_label })
      if (res.daily) setDaily(res.daily)
      await loadData()
      alert(`${res.message || 'WhatsApp terkirim.'}\nSisa jatah hari ini: ${res.daily?.sisa ?? '-'} dari ${res.daily?.limit ?? '-'} konsumen.`)
    } catch (err) {
      alert('Gagal mengirim WhatsApp: ' + err.message)
    } finally {
      setSavingKey('')
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        days,
        status,
        kpb_level: level,
      }).toString()

      const response = await fetch(`${API_BASE}/customers/followups/export?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export gagal' }))
        throw new Error(error.error || 'Export gagal')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href = url
      a.download = `Followup_KPB_DXK_${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal export follow-up: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Follow-up KPB</h1>
          <p className="text-sm text-muted">Daftar konsumen yang KPB-nya overdue atau mendekati tenggat</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="px-3 py-2 bg-panel border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="7">7 hari ke depan</option>
            <option value="14">14 hari ke depan</option>
            <option value="30">30 hari ke depan</option>
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 bg-panel border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">Semua KPB</option>
            <option value="KPB1">KPB1</option>
            <option value="KPB2">KPB2</option>
            <option value="KPB3">KPB3</option>
            <option value="KPB4">KPB4</option>
          </select>
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
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-panel border border-border rounded-lg text-sm font-medium text-muted hover:bg-hover"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-green-600/20"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-danger-200 bg-danger-50 text-danger-700">
          <p className="text-xs font-medium opacity-80">Lewat Tenggat</p>
          <p className="text-2xl font-bold mt-1">{summary.overdue || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-700">
          <p className="text-xs font-medium opacity-80">Dalam Periode</p>
          <p className="text-2xl font-bold mt-1">{summary.warning || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-accent-soft bg-accent-soft text-accent-text">
          <p className="text-xs font-medium opacity-80">Sudah Dihubungi</p>
          <p className="text-2xl font-bold mt-1">{counts.sudah_dihubungi || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <p className="text-xs font-medium opacity-80">Booking / Datang</p>
          <p className="text-2xl font-bold mt-1">{(counts.booking || 0) + (counts.datang || 0)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item.value}
            onClick={() => setStatus(item.value)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              status === item.value
                ? 'bg-accent border-accent text-white'
                : 'bg-panel border-border text-muted hover:bg-hover'
            }`}
          >
            {item.label} ({counts[item.value] || 0})
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>
      )}

      <div className="bg-panel rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-accent" size={26} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto text-success-400 mb-2" size={32} />
            <p className="text-sm text-muted">Tidak ada data follow-up sesuai filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const currentStatus = getFollowupStatus(item)
              const waUrl = normalizePhone(item.customer_mobile)
              return (
                <div key={`${item.id}-${item.kpb_label}`} className="p-4 hover:bg-hover/60 transition-colors">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-accent-soft text-accent border-accent-soft">
                          <Calendar size={11} />
                          {item.kpb_label}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[currentStatus] || statusColors.belum_dihubungi}`}>
                          {statuses.find((s) => s.value === currentStatus)?.label || currentStatus}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${item.days_remaining < 0 ? 'bg-danger-50 text-danger-600 border-danger-200' : 'bg-warning-50 text-warning-600 border-warning-200'}`}>
                          {formatDays(item.days_remaining)}
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <User size={15} className="text-faint shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text truncate">{item.customer}</p>
                            <p className="text-xs text-faint truncate">SO: {item.so_number || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone size={15} className="text-faint shrink-0" />
                          <p className="text-sm text-muted truncate">{item.customer_mobile || '-'}</p>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Bike size={15} className="text-faint shrink-0" />
                          <p className="text-sm text-muted truncate">{item.model || '-'} {item.color ? `(${item.color})` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock size={15} className="text-faint shrink-0" />
                          <p className="text-sm text-muted truncate">Tenggat {formatDate(item.kpb_due_date)}</p>
                        </div>
                      </div>
                      {item.followup?.note && <p className="text-xs text-muted">Catatan terakhir: {item.followup.note}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => openWhatsapp(item)}
                        disabled={!waUrl || savingKey !== ''}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        {savingKey === `${item.id}:${item.kpb_label}:sudah_dihubungi` ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        WhatsApp
                      </button>
                      <button
                        onClick={() => saveStatus(item, 'booking', 'Ditandai booking dari halaman Follow-up KPB')}
                        disabled={savingKey !== ''}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-warning-50 border border-warning-200 text-warning-700 rounded-lg text-xs font-medium hover:bg-warning-100 disabled:opacity-50"
                      >
                        Booking
                      </button>
                      <button
                        onClick={() => saveStatus(item, 'datang', 'Ditandai datang dari halaman Follow-up KPB')}
                        disabled={savingKey !== ''}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-success-50 border border-success-200 text-success-700 rounded-lg text-xs font-medium hover:bg-success-100 disabled:opacity-50"
                      >
                        Datang
                      </button>
                      <button
                        onClick={() => saveStatus(item, 'batal', 'Ditandai batal dari halaman Follow-up KPB')}
                        disabled={savingKey !== ''}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-xs font-medium hover:bg-danger-100 disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 p-4 bg-warning-soft border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          Tombol WhatsApp membuka template pesan dan otomatis mencatat status sebagai Sudah Dihubungi.
          Pastikan nomor HP konsumen valid sebelum mengirim pesan.
        </p>
      </div>
    </div>
  )
}
