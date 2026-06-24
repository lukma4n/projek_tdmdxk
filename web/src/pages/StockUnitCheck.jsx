import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Bike, Sun, Moon, ArrowLeft, Loader2, AlertCircle,
  ChevronDown, MapPin, Clock, Palette, PackageCheck,
} from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const STATUS_STYLE = {
  ready: 'bg-success-soft text-success',
  reserved: 'bg-warning-soft text-warning',
  not_ready: 'bg-danger-soft text-danger',
  other: 'bg-hover text-muted',
}

function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] || STATUS_STYLE.other}`}>
      {label}
    </span>
  )
}

function ModelCard({ model }) {
  const [open, setOpen] = useState(false)
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
            {model.category_name || model.parent_category || 'Unit'}
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
          {/* Status ringkas */}
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
            <span className="inline-flex items-center rounded-lg bg-hover px-2.5 py-1 text-xs font-bold text-muted">
              {model.total} total
            </span>
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

          {/* Daftar unit (anonim — tanpa nomor mesin) */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
              <Palette size={12} /> Detail Unit
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="bg-hover text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2 font-bold">Warna</th>
                    <th className="px-3 py-2 font-bold">Lokasi</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 text-right font-bold">
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> Umur</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.units.map((u, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold text-text">{u.color}</td>
                      <td className="px-3 py-2 text-muted">{u.location}</td>
                      <td className="px-3 py-2"><StatusBadge status={u.status} label={u.status_label} /></td>
                      <td className="px-3 py-2 text-right font-mono text-muted">{u.aging_days} hari</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/public/stock-units`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Gagal memuat data unit'))))
      .then((json) => { if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Filter di sisi klien (data kecil) — instan tanpa request ulang.
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
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari model, mis. BeAT, Scoopy, Vario..."
            className="w-full rounded-2xl border border-border bg-panel py-3 pl-11 pr-4 text-sm font-medium text-text outline-none transition focus:border-accent"
          />
        </div>

        {/* Ringkasan */}
        {data?.overall && !loading && !error && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-1.5 font-bold text-success">
              <PackageCheck size={15} /> {data.overall.ready} unit siap jual
            </span>
            <span className="text-muted">dari total <b className="text-text-strong">{data.overall.total}</b> unit</span>
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
              <ModelCard key={m.series} model={m} />
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
