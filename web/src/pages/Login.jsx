import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { api } from '../services/api'
import { Eye, EyeOff, Loader2, Shield, LogIn, Sun, Moon } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { login, isAuthenticated } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    let cancelled = false
    api.me()
      .then((data) => {
        if (cancelled) return
        if (data?.user) {
          login(data.user)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingAuth(false)
      })
    return () => { cancelled = true }
  }, [login])

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
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-accent" size={32} />
        <span className="ml-3 text-sm font-semibold text-muted">
          Memeriksa sesi...
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 bg-bg">
      <div className="w-full max-w-md overflow-hidden bg-panel rounded-2xl shadow-lg border border-border">
        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center border-b border-border">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-sm">
            <LogIn size={26} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-strong">
            DXK Operation System
          </h1>
          <p className="mt-2 text-sm font-medium text-muted">
            Masuk untuk melanjutkan ke sistem operasional
          </p>
        </div>

        {/* Theme Toggle */}
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition border-border bg-panel text-muted hover:bg-hover"
            title={isDark ? 'Mode Terang' : 'Mode Gelap'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="w-full rounded-xl border border-border bg-hover px-4 py-3 text-sm text-text placeholder:text-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full rounded-xl border border-border bg-hover px-4 py-3 pr-12 text-sm text-text placeholder:text-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-text transition rounded-lg"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-soft border border-danger/20 px-4 py-3 text-sm text-danger">
              <Shield size={16} />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="animate-spin" size={17} />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 text-center border-t border-border bg-hover/50">
          <p className="text-xs font-medium text-faint">
            DXK Operation System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
