import { useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import {
  Search,
  Check,
  Loader2,
  Compass,
  FileText,
  CheckCircle2,
  Award,
  ShieldAlert,
  Sun,
  Moon,
  Calendar,
  ArrowRight,
  Lock,
  AlertCircle,
  User,
  Info
} from 'lucide-react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function StnkBpkbCheck() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const [engineNumber, setEngineNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!engineNumber || !phone) {
      setError('Nomor Mesin dan Nomor HP wajib diisi')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const queryParams = new URLSearchParams({
        engine_number: engineNumber.trim(),
        phone: phone.trim()
      })
      const res = await fetch(`${API_BASE}/public/stnk-bpkb/check?${queryParams.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan sistem')
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Data tidak ditemukan. Silakan periksa kembali Nomor Mesin dan Nomor HP Anda.')
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Header */}
      <nav className={`border-b transition-colors duration-300 ${isDark ? 'border-white/10 bg-slate-900/80' : 'border-slate-200 bg-white'} sticky top-0 z-50 backdrop-blur-md`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30`}>
              DXK
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">TDM KETAPANG</h1>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-semibold`}>Self Check STNK & BPKB</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all duration-300 ${isDark ? 'border-white/10 bg-white/5 text-amber-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
              title={isDark ? 'Tema Terang' : 'Tema Gelap'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/login"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl transition ${isDark ? 'text-slate-300 bg-white/5 hover:bg-white/10' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
            >
              Area Karyawan <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Banner Hero */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Lacak Status STNK & BPKB Anda
          </h2>
          <p className={`mx-auto mt-3 max-w-xl text-sm sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Masukkan Nomor Mesin motor Honda Anda dan Nomor HP yang terdaftar untuk memantau pengurusan dokumen secara real-time.
          </p>
        </div>

        {/* Form Search Card */}
        <div className={`mb-10 p-6 rounded-3xl border shadow-xl ${isDark ? 'border-white/10 bg-slate-900 shadow-slate-950/50' : 'border-slate-200 bg-white shadow-slate-200/50'}`}>
          <form onSubmit={handleSearch} className="grid gap-5 md:grid-cols-2 md:items-end">
            <div>
              <label htmlFor="engine" className="mb-2 block text-xs font-bold uppercase tracking-wider text-indigo-500">
                Nomor Mesin
              </label>
              <input
                id="engine"
                type="text"
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value)}
                placeholder="Contoh: MH1JM1111..."
                className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all duration-300 focus:outline-none ${isDark ? 'border-white/10 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10'}`}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block text-xs font-bold uppercase tracking-wider text-indigo-500">
                Nomor Handphone Terdaftar
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567..."
                className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all duration-300 focus:outline-none ${isDark ? 'border-white/10 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10'}`}
              />
            </div>
            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white transition-all shadow-md ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}`}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Mencari Data Dokumen...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Periksa Status Pengurusan
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Privacy Disclaimer */}
          <div className={`mt-4 flex gap-2.5 rounded-xl p-3 text-xs leading-relaxed ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <Lock size={16} className="shrink-0 text-indigo-500" />
            <p>
              <strong>Kebijakan Privasi:</strong> Data pribadi Anda disamarkan demi keamanan. Nomor Mesin dan Nomor Handphone harus sesuai dengan data transaksi saat pembelian unit di TDM Ketapang.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-10 flex gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-500">
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Pencarian Gagal</p>
              <p className="mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Result Area */}
        {result && (
          <div className="space-y-8 animate-fadeIn">
            {/* Info Unit */}
            <div className={`rounded-3xl border p-6 shadow-lg ${isDark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2.5 pb-4 border-b border-dashed border-slate-200 dark:border-white/10">
                <User size={18} className="text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Informasi Pembelian</h3>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nama Pemilik (STNK)</p>
                  <p className="font-bold text-base mt-0.5">{result.stnk_name || '-'}</p>
                </div>
                <div>
                  <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Seri Motor</p>
                  <p className="font-bold text-base mt-0.5">{result.series || '-'}</p>
                </div>
                <div>
                  <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nomor Mesin / Rangka</p>
                  <p className="font-mono font-medium mt-0.5">{result.engine_number} / {result.chassis_number || '-'}</p>
                </div>
                <div>
                  <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nomor Polisi</p>
                  <p className="font-bold text-base mt-0.5 text-indigo-600 dark:text-indigo-400">{result.no_polisi || 'Belum Terbit'}</p>
                </div>
                <div>
                  <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Dealer Cabang</p>
                  <p className="font-semibold mt-0.5">{result.branch_name || 'TDM KETAPANG'}</p>
                </div>
              </div>
            </div>

            {/* Status Penjemputan / Callout Banner */}
            {((result.stnk.is_done && !result.stnk.is_delivered) || (result.bpkb.is_done && !result.bpkb.is_delivered)) && (
              <div className="flex gap-4 rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-6 shadow-md shadow-indigo-600/5">
                <Info size={24} className="shrink-0 text-indigo-500 mt-1" />
                <div>
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400 text-base">Dokumen Siap Diambil!</h4>
                  <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Silakan mengunjungi dealer <strong>TDM Ketapang</strong> untuk mengambil dokumen Anda yang telah terbit:
                  </p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold">
                    {result.stnk.is_done && !result.stnk.is_delivered && (
                      <li className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        STNK & Plat Nomor (Lokasi: {result.stnk.lokasi || 'Kassa/Frontdesk'})
                      </li>
                    )}
                    {result.bpkb.is_done && !result.bpkb.is_delivered && (
                      <li className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        BPKB (Lokasi: {result.bpkb.lokasi || 'Admin BPKB'})
                      </li>
                    )}
                  </ul>
                  <p className={`text-xs mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    * Catatan: Harap membawa KTP asli pemilik sesuai nama STNK dan nota serah terima atau Sales Order asli.
                  </p>
                </div>
              </div>
            )}

            {/* Stepper Timeline */}
            <div className={`rounded-3xl border p-6 shadow-lg ${isDark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2.5 pb-4 border-b border-dashed border-slate-200 dark:border-white/10 mb-6">
                <Compass size={18} className="text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Timeline Pengurusan</h3>
              </div>

              {/* Steps Layout */}
              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[11px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                {/* 1. Faktur */}
                <TimelineStep
                  title="Permohonan Faktur"
                  description={
                    result.faktur.is_done
                      ? `Faktur selesai diterbitkan (No. ${result.faktur.no_faktur})`
                      : result.faktur.tgl_mohon
                      ? 'Sedang diajukan ke Main Dealer'
                      : 'Menunggu proses pengajuan'
                  }
                  date={result.faktur.tgl_terima || result.faktur.tgl_mohon}
                  isDone={result.faktur.is_done}
                  isActive={!result.faktur.is_done}
                  icon={<FileText size={16} />}
                  isDark={isDark}
                />

                {/* 2. STNK */}
                <TimelineStep
                  title="Pengurusan STNK"
                  description={
                    result.stnk.is_delivered
                      ? 'STNK telah diserahkan ke Konsumen'
                      : result.stnk.is_done
                      ? `STNK telah selesai dicetak (No. ${result.stnk.no_stnk})`
                      : result.stnk.tgl_proses
                      ? 'Sedang diproses pendaftaran di Samsat'
                      : 'Menunggu proses pengajuan Samsat'
                  }
                  date={result.stnk.tgl_penyerahan || result.stnk.tgl_selesai || result.stnk.tgl_proses}
                  isDone={result.stnk.is_done}
                  isActive={result.faktur.is_done && !result.stnk.is_done}
                  icon={<Compass size={16} />}
                  isDark={isDark}
                />

                {/* 3. Plat Nomor */}
                <TimelineStep
                  title="Plat Nomor (TNKB)"
                  description={
                    result.plat.is_delivered
                      ? 'Plat nomor telah diserahkan ke Konsumen'
                      : result.plat.is_done
                      ? `Plat nomor selesai dicetak (${result.no_polisi || ''})`
                      : 'Sedang dicetak oleh Samsat'
                  }
                  date={result.plat.tgl_penyerahan || result.plat.tgl_selesai}
                  isDone={result.plat.is_done}
                  isActive={result.stnk.is_done && !result.plat.is_done}
                  icon={<Award size={16} />}
                  isDark={isDark}
                />

                {/* 4. BPKB */}
                <TimelineStep
                  title="Penerbitan BPKB"
                  description={
                    result.bpkb.is_delivered
                      ? `BPKB diserahkan kepada ${result.bpkb.penerima || 'Konsumen'}`
                      : result.bpkb.is_done
                      ? `BPKB telah selesai diterbitkan (No. ${result.bpkb.no_bpkb})`
                      : 'Sedang diproses pendaftaran di Polda'
                  }
                  date={result.bpkb.tgl_penyerahan || result.bpkb.tgl_selesai}
                  isDone={result.bpkb.is_done}
                  isActive={result.faktur.is_done && !result.bpkb.is_done}
                  icon={<ShieldAlert size={16} />}
                  isDark={isDark}
                />

                {/* 5. Serah Terima */}
                <TimelineStep
                  title="Selesai / Serah Terima"
                  description={
                    result.stnk.is_delivered && result.bpkb.is_delivered
                      ? 'Seluruh berkas dokumen (STNK, Plat & BPKB) telah lengkap diserahkan'
                      : result.stnk.is_delivered
                      ? 'STNK & Plat telah diserahkan. BPKB masih diproses.'
                      : 'Menunggu dokumen diserahkan kepada konsumen'
                  }
                  date={result.stnk.tgl_penyerahan && result.bpkb.tgl_penyerahan ? result.bpkb.tgl_penyerahan : null}
                  isDone={result.stnk.is_delivered && result.bpkb.is_delivered}
                  isActive={(result.stnk.is_done || result.bpkb.is_done) && !(result.stnk.is_delivered && result.bpkb.is_delivered)}
                  icon={<CheckCircle2 size={16} />}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`mt-20 py-8 border-t transition-colors duration-300 ${isDark ? 'border-white/10 bg-slate-900/40 text-slate-500' : 'border-slate-200 bg-white text-slate-400'} text-center text-xs font-semibold`}>
        <div className="mx-auto max-w-6xl px-4">
          <p>© {new Date().getFullYear()} TDM Ketapang - Honda Authorized Dealer.</p>
          <p className="mt-1">DXK Operation System v1.0 • All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function TimelineStep({ title, description, date, isDone, isActive, icon, isDark }) {
  // Helpers formatting date inside component
  const formatDateLocal = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formattedDate = formatDateLocal(date)

  let nodeColorClass
  let bgClass
  let textTitleClass

  if (isDone) {
    nodeColorClass = 'bg-indigo-600 text-white shadow-indigo-600/30'
    bgClass = isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'
    textTitleClass = isDark ? 'text-slate-100' : 'text-slate-950'
  } else if (isActive) {
    nodeColorClass = 'bg-indigo-500 text-white animate-pulse shadow-indigo-500/20'
    bgClass = isDark ? 'bg-indigo-950/20 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100'
    textTitleClass = 'text-indigo-600 dark:text-indigo-400 font-bold'
  } else {
    nodeColorClass = isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-400'
    bgClass = 'opacity-60'
    textTitleClass = isDark ? 'text-slate-400' : 'text-slate-500'
  }

  return (
    <div className="relative group transition-all duration-300">
      {/* Icon Node */}
      <div className={`absolute -left-6 sm:-left-8 top-1 flex h-[24px] w-[24px] sm:h-[32px] sm:w-[32px] items-center justify-center rounded-full border-4 ${isDark ? 'border-slate-900' : 'border-white'} text-xs font-semibold shadow-md transition-all duration-300 ${nodeColorClass} z-10`}>
        {isDone ? <Check size={14} className="sm:h-4 sm:w-4" /> : icon}
      </div>

      {/* Content Box */}
      <div className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${bgClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h4 className={`text-sm font-bold tracking-tight ${textTitleClass}`}>{title}</h4>
          {formattedDate && (
            <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Calendar size={12} className="shrink-0 text-slate-400" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
        <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>
      </div>
    </div>
  )
}
