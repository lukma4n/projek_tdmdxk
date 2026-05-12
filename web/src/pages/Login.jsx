import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import { Bike, Eye, EyeOff, Loader2, Shield, Sparkles, Wrench } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { login, isAuthenticated } = useAuthStore()

  useEffect(() => {
    let cancelled = false
    api.me()
      .then((data) => {
        if (cancelled) return
        if (data?.user) {
          login(data.user)
        }
      })
      .catch(() => {
        // 401 or network error — stay on login page, no reload
      })
      .finally(() => {
        if (!cancelled) setCheckingAuth(false)
      })
    return () => { cancelled = true }
  }, [login])

  // If already authenticated, redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await api.login({ username, password })
      login(data.user)
    } catch (err) {
      const message = err.message?.includes('fetch') || err.message?.includes('Network')
        ? 'Server belum aktif atau koneksi terputus'
        : err.message || 'Username atau password tidak sesuai'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin" size={32} />
        <span className="ml-3 text-sm text-slate-400">Memeriksa sesi...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden h-screen p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(20,184,166,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_54%,#111827_100%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute left-16 top-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-blue-100 shadow-2xl shadow-blue-950/20 backdrop-blur">
            <Sparkles size={14} />
            Cabang DXK Operation Hub
          </div>
          <div className="mt-10 max-w-2xl">
            <h1 className="text-5xl font-black tracking-[-0.045em] text-white leading-[0.98] xl:text-6xl">
              Satu sistem untuk semua alur kerja TDM Ketapang.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Kerjaan harian bengkel, sparepart, showroom, dokumen kendaraan, sampai follow-up pelanggan jadi lebih mudah dipantau dari satu tempat.
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <div className="px-4">
              <div className="mb-3 inline-flex rounded-2xl bg-blue-500/15 p-3 text-blue-100"><Wrench size={22} /></div>
              <p className="text-sm font-bold">Bengkel</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">WO, KPB, hotline, sparepart.</p>
            </div>
            <div className="px-4">
              <div className="mb-3 inline-flex rounded-2xl bg-cyan-500/15 p-3 text-cyan-100"><Bike size={22} /></div>
              <p className="text-sm font-bold">Showroom</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Unit, harga, STNK, BPKB.</p>
            </div>
            <div className="px-4">
              <div className="mb-3 inline-flex rounded-2xl bg-emerald-500/15 p-3 text-emerald-100"><Shield size={22} /></div>
              <p className="text-sm font-bold">CRM</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Follow-up pelanggan.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 text-slate-900 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-100/60 to-transparent" />
        <div className="absolute right-10 top-16 hidden h-32 w-32 rounded-full bg-blue-300/20 blur-3xl sm:block" />
        <div className="w-full max-w-md">
          <div className="mb-4 text-center lg:hidden">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black tracking-[-0.08em] text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/70">
                DXK
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">DXK Operation System</h1>
            <p className="mt-1 text-sm text-slate-500">Workshop, Sparepart, Showroom & CRM</p>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-white bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-100 blur-2xl" />
            <div className="mb-5 hidden text-center lg:block">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-black tracking-[-0.08em] text-white shadow-xl shadow-blue-600/25 ring-1 ring-white/70">
                DXK
              </div>
              <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950">DXK Operation System</h2>
              <p className="mt-1 text-sm text-slate-500">Workshop, Sparepart, Showroom & CRM</p>
            </div>

            <div className="relative mb-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Secure Access</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">Masuk sesuai role operasional</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                  <Shield size={18} />
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Setiap user hanya melihat menu sesuai tugasnya.</p>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/70 p-1.5">
              {['Bengkel', 'Showroom', 'CRM'].map((item) => (
                <div key={item} className="rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-slate-600 shadow-sm shadow-slate-200/60 ring-1 ring-slate-100">
                  {item}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm shadow-inner shadow-slate-100/80 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-12 text-sm shadow-inner shadow-slate-100/80 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
                  <Shield size={16} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-700/20 active:scale-[0.99] disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
              >
                {loading && <Loader2 className="animate-spin" size={17} />}
                {loading ? 'Masuk...' : 'Masuk ke Sistem'}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-4 text-center">
              <p className="text-xs font-medium text-slate-400">Cabang TDM Ketapang | Sistem lokal operasional</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
