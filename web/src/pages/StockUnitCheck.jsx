import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Bike, Sun, Moon, ArrowLeft, Loader2, AlertCircle,
  ChevronDown, MapPin, Clock, PackageCheck, Tag, CalendarClock, X,
} from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const STATUS_STYLE = {
  ready: 'bg-success-soft text-success',
  reserved: 'bg-warning-soft text-warning',
  not_ready: 'bg-danger-soft text-danger',
  other: 'bg-hover text-muted',
}

function formatRp(n) {
  if (!n) return '—'
  return `Rp ${Number(n).toLocaleString('id-ID')}`
}

// Format ringkas untuk badge model: "Rp 25,4 jt" atau rentang "Rp 25,4–26,3 jt".
function formatOtrRange(min, max) {
  if (!min) return null
  const jt = (n) => (n / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return min === max ? `Rp ${jt(min)} jt` : `Rp ${jt(min)}–${jt(max)} jt`
}

function formatShortDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

async function createBooking(engineNumber, payload) {
  const res = await fetch(`${API_BASE}/public/stock-units/${engineNumber}/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Gagal booking unit')
  return json
}

async function cancelBooking(engineNumber, salesmanPhone) {
  const res = await fetch(`${API_BASE}/public/stock-units/${engineNumber}/booking`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salesman_phone: salesmanPhone }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Gagal membatalkan booking')
  return json
}

// Modal booking: dua mode berbagi satu komponen karena bentuknya mirip
// (form pendek + submit + pesan error), hanya field & aksi yang beda.
function BookingModal({ engineNumber, mode, currentBookingName, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [duration, setDuration] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await createBooking(engineNumber, { salesman_name: name, salesman_phone: phone, duration_days: duration })
      } else {
        await cancelBooking(engineNumber, phone)
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-panel p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-text-strong">
            {mode === 'create' ? 'Booking Unit' : 'Batalkan Booking'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-faint hover:bg-hover" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {mode === 'cancel' && (
          <p className="mb-3 text-xs font-semibold text-muted">
            Sedang dibooking oleh <span className="text-text-strong">{currentBookingName}</span>. Masukkan nomor HP yang dipakai saat booking untuk membatalkan.
          </p>
        )}

        {mode === 'create' && (
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-faint">Nama Sales</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-medium text-text outline-none focus:border-accent"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-faint">Nomor HP</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="08xxxxxxxxxx"
            className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-medium text-text outline-none focus:border-accent"
          />
        </div>

        {mode === 'create' && (
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-faint">Durasi Booking</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-medium text-text outline-none focus:border-accent"
            >
              <option value={1}>1 hari</option>
              <option value={3}>3 hari</option>
              <option value={7}>7 hari</option>
            </select>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Booking Unit Ini' : 'Batalkan Booking'}
        </button>
      </form>
    </div>
  )
}

function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] || STATUS_STYLE.other}`}>
      {label}
    </span>
  )
}

function ModelCard({ model, onBookingChange }) {
  const [open, setOpen] = useState(false)
  const [bookingModal, setBookingModal] = useState(null) // { engineNumber, mode, currentBookingName }
  const otrLabel = formatOtrRange(model.otr_min, model.otr_max)

  const handleBookingSuccess = () => {
    setBookingModal(null)
    onBookingChange()
  }
  return (
    <div className="rounded-2xl border border-border bg-panel shadow-sm transition hover:border-border-strong">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Bike size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-text-strong">{model.series}</p>
          <p className="truncate text-[11px] font-semibold text-faint">
            {otrLabel ? <span className="text-accent">{otrLabel}</span> : (model.category_name || model.parent_category || 'Unit')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-lg font-black leading-none text-success">{model.ready}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">siap jual</span>
        </div>
        <ChevronDown
          size={18}
          className="shrink-0 text-faint transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Ringkasan warna (selalu tampil) */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {model.colors.slice(0, open ? model.colors.length : 6).map((c) => (
          <span
            key={c.color}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] font-semibold text-muted"
          >
            {c.color}
            <span className="font-black text-text-strong">{c.ready}</span>
          </span>
        ))}
        {!open && model.colors.length > 6 && (
          <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold text-faint">
            +{model.colors.length - 6} warna
          </span>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {/* Status + OTR ringkas */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
              <PackageCheck size={13} /> {model.ready} siap jual
            </span>
            {model.reserved > 0 && (
              <span className="inline-flex items-center rounded-lg bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">
                {model.reserved} dipesan
              </span>
            )}
            {model.not_ready > 0 && (
              <span className="inline-flex items-center rounded-lg bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">
                {model.not_ready} belum siap
              </span>
            )}
            {otrLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                <Tag size={13} /> OTR {otrLabel}
              </span>
            )}
          </div>

          {/* Lokasi */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
              <MapPin size={12} /> Lokasi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {model.locations.map((l) => (
                <span key={l.location} className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] font-semibold text-muted">
                  {l.location} <span className="font-black text-text-strong">{l.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Daftar unit — umur FIFO (POS/Pameran = sejak pergerakan terakhir),
              diurut terlama dulu untuk kontrol movement. */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
              <Clock size={12} /> Detail Unit · umur FIFO, terlama di atas
            </p>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[760px] text-left text-[12.5px]">
                <thead>
                  <tr className="bg-hover text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2 font-bold">Kode</th>
                    <th className="px-3 py-2 font-bold">Warna</th>
                    <th className="px-3 py-2 font-bold">No. Mesin</th>
                    <th className="px-3 py-2 font-bold">No. Rangka</th>
                    <th className="px-3 py-2 font-bold">Lokasi</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Booking</th>
                    <th className="px-3 py-2 text-right font-bold">OTR</th>
                    <th className="px-3 py-2 text-center font-bold">Tag</th>
                    <th className="px-3 py-2 text-right font-bold">Umur</th>
                  </tr>
                </thead>
                <tbody>
                  {model.units.map((u, i) => {
                    const old = u.aging_days >= 90
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-text">{u.product_code || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-text">{u.color}</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-muted">{u.engine_number || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-muted">{u.chassis_number || '—'}</td>
                        <td className="px-3 py-2 text-muted">{u.location}</td>
                        <td className="px-3 py-2"><StatusBadge status={u.status} label={u.status_label} /></td>
                        <td className="px-3 py-2">
                          {u.booking ? (
                            <button
                              type="button"
                              onClick={() => setBookingModal({ engineNumber: u.engine_number, mode: 'cancel', currentBookingName: u.booking.salesman_name })}
                              className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning hover:brightness-95"
                              title="Klik untuk batalkan booking"
                            >
                              <CalendarClock size={11} /> {u.booking.salesman_name} · s.d. {formatShortDate(u.booking.expires_at)}
                            </button>
                          ) : u.status === 'ready' ? (
                            <button
                              type="button"
                              onClick={() => setBookingModal({ engineNumber: u.engine_number, mode: 'create' })}
                              className="rounded-md bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold text-accent hover:brightness-95"
                            >
                              Booking
                            </button>
                          ) : <span className="text-faint">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted">{formatRp(u.otr_price)}</td>
                        <td className="px-3 py-2 text-center">
                          {u.aging_tag && u.aging_tag !== '-' ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-accent-soft px-1.5 text-[11px] font-black text-accent">
                              {u.aging_tag}
                            </span>
                          ) : <span className="text-faint">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${old ? 'text-danger' : 'text-muted'}`}>
                          {u.aging_days} hari
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {bookingModal && (
        <BookingModal
          engineNumber={bookingModal.engineNumber}
          mode={bookingModal.mode}
          currentBookingName={bookingModal.currentBookingName}
          onClose={() => setBookingModal(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  )
}

export default function StockUnitCheck() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')

  // Penanda permintaan terbaru — respons yang sudah usang (mis. filter lokasi
  // berubah lagi sebelum request lama selesai) diabaikan, tidak menimpa data.
  const requestIdRef = useRef(0)

  // silent=true dipakai setelah booking/cancel sukses — refresh data tanpa
  // menampilkan spinner layar penuh yang akan menutup kartu yang sedang terbuka.
  const loadData = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current
    if (!silent) setLoading(true)
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    try {
      const res = await fetch(`${API_BASE}/public/stock-units${params.toString() ? `?${params}` : ''}`)
      if (!res.ok) throw new Error('Gagal memuat data unit')
      const json = await res.json()
      if (requestIdRef.current !== requestId) return
      setData(json)
      setError('')
    } catch (err) {
      if (requestIdRef.current !== requestId) return
      setError(err.message)
    } finally {
      if (requestIdRef.current === requestId && !silent) setLoading(false)
    }
  }, [location])

  // Refetch saat filter lokasi berubah (agregat dihitung ulang di server).
  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [loadData])

  // Filter model (teks) di sisi klien — instan tanpa request ulang.
  const filteredModels = useMemo(() => {
    if (!data?.models) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.models
    return data.models.filter((m) =>
      `${m.series} ${m.category_name || ''} ${m.parent_category || ''}`.toLowerCase().includes(q)
    )
  }, [data, query])

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Brand bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-hover hover:text-text-strong" aria-label="Kembali">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <Bike size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-black tracking-tight text-text-strong">Cek Ketersediaan Unit</h1>
            <p className="text-[11px] font-semibold text-muted">TDM Ketapang — Honda</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-hover hover:text-text-strong"
            aria-label="Ganti tema"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6">
        {/* Search + filter lokasi */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari model, mis. BeAT, Scoopy, Vario..."
              className="w-full rounded-2xl border border-border bg-panel py-3 pl-11 pr-4 text-sm font-medium text-text outline-none transition focus:border-accent"
            />
          </div>
          <div className="relative sm:w-56">
            <MapPin size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-border bg-panel py-3 pl-10 pr-9 text-sm font-medium text-text outline-none transition focus:border-accent"
            >
              <option value="">Semua lokasi</option>
              {(data?.available_locations || []).map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          </div>
        </div>

        {/* Ringkasan */}
        {data?.overall && !loading && !error && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-1.5 font-bold text-success">
              <PackageCheck size={15} /> {data.overall.ready} unit siap jual
            </span>
            <span className="text-muted">dari total <b className="text-text-strong">{data.overall.total}</b> unit{location ? ` di ${location}` : ''}</span>
            {data.overall.reserved > 0 && (
              <span className="text-faint">· {data.overall.reserved} dipesan</span>
            )}
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-faint">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="mt-3 text-sm font-medium">Memuat ketersediaan unit...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-danger bg-danger-soft py-12 text-danger">
            <AlertCircle size={28} />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {!loading && !error && filteredModels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-faint">
            <Search size={28} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {query ? `Tidak ada model cocok dengan "${query}"` : 'Belum ada data unit'}
            </p>
          </div>
        )}

        {!loading && !error && filteredModels.length > 0 && (
          <div className="space-y-3">
            {filteredModels.map((m) => (
              <ModelCard key={m.series} model={m} onBookingChange={() => loadData(true)} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-panel py-4 text-center text-[11px] font-semibold text-faint">
        Ketersediaan diperbarui dari snapshot stok harian · © {new Date().getFullYear()} TDM Ketapang
      </footer>
    </div>
  )
}
