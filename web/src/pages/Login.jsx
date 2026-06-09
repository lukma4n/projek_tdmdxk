import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import { Eye, EyeOff, Loader2, Shield, LogIn } from 'lucide-react'

// Skydash Admin design tokens (from DESIGN.md)
const C = {
  primary: '#4B49AC',
  primaryDark: '#27367F',
  primaryLight: '#B9B8EE',
  electricBlue: '#0D6EFD',
  success: '#57B657',
  warning: '#FFC100',
  error: '#FF4747',
  textPrimary: '#1F1F1F',
  textSecondary: '#6C7383',
  textTertiary: '#A3A4A5',
  border: '#CED4DA',
  surface: '#F8F9FA',
  card: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.05) 0px 2px 8px 0px',
  shadowMd: 'rgba(0, 0, 0, 0.1) 0px 4px 12px 0px',
  shadowLg: 'rgba(205, 209, 225, 1) 0px 5px 21px -5px',
  focusRing: 'rgba(75, 73, 172, 0.1)',
}

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
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: C.surface }}
      >
        <Loader2 className="animate-spin" size={32} style={{ color: C.primary }} />
        <span
          className="ml-3 text-sm font-semibold"
          style={{ color: C.textSecondary }}
        >
          Memeriksa sesi...
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: C.surface }}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          backgroundColor: C.card,
          borderRadius: '20px',
          border: 'none',
          boxShadow: C.shadow,
        }}
      >
        {/* Header: Logo + Title — Skydash: H4 18px/500 untuk title, body 14px/500 untuk subtitle */}
        <div
          className="px-6 pt-8 pb-6 text-center"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center"
            style={{
              backgroundColor: C.primary,
              color: C.card,
              borderRadius: '15px',
              boxShadow: C.shadow,
            }}
          >
            <LogIn size={26} />
          </div>
          <h1
            className="text-[24px] font-medium leading-[24px]"
            style={{ color: C.textPrimary }}
          >
            DXK Operation System
          </h1>
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: C.textSecondary }}
          >
            Masuk untuk melanjutkan ke sistem operasional
          </p>
        </div>

        {/* Form — Skydash inputs: 55px height, 4px radius, 1px solid #CED4DA */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: C.textPrimary }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="w-full text-sm transition focus:outline-none"
              style={{
                height: '55px',
                padding: '18px 22px',
                fontFamily: 'inherit',
                fontWeight: 400,
                color: C.textPrimary,
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: '4px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = `1px solid ${C.primary}`
                e.currentTarget.style.boxShadow = `0px 0px 0px 3px ${C.focusRing}`
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = `1px solid ${C.border}`
                e.currentTarget.style.boxShadow = 'none'
              }}
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: C.textPrimary }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full text-sm transition focus:outline-none"
                style={{
                  height: '55px',
                  padding: '18px 52px 18px 22px',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                  color: C.textPrimary,
                  backgroundColor: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: '4px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = `1px solid ${C.primary}`
                  e.currentTarget.style.boxShadow = `0px 0px 0px 3px ${C.focusRing}`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = `1px solid ${C.border}`
                  e.currentTarget.style.boxShadow = 'none'
                }}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 -translate-y-1/2 transition"
                style={{
                  right: '10px',
                  padding: '6px',
                  color: C.textSecondary,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.textPrimary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.textSecondary
                }}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 text-sm"
              style={{
                backgroundColor: 'rgba(255, 71, 71, 0.1)',
                color: C.error,
                border: `1px solid rgba(255, 71, 71, 0.3)`,
                borderRadius: '8px',
              }}
            >
              <Shield size={16} />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Primary Button: bg #4B49AC, text white, 14px/700, 15px radius, 55px height */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="flex w-full items-center justify-center gap-2 text-sm transition"
            style={{
              height: '55px',
              padding: '14px 24px',
              fontFamily: 'inherit',
              fontWeight: 700,
              color: C.card,
              backgroundColor: loading || !username || !password ? C.textTertiary : C.primary,
              border: 'none',
              borderRadius: '15px',
              boxShadow: C.shadow,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!loading && username && password) {
                e.currentTarget.style.backgroundColor = C.primaryDark
                e.currentTarget.style.boxShadow = C.shadowMd
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && username && password) {
                e.currentTarget.style.backgroundColor = C.primary
                e.currentTarget.style.boxShadow = C.shadow
              }
            }}
          >
            {loading && <Loader2 className="animate-spin" size={17} />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Footer */}
        <div
          className="px-6 py-4 text-center"
          style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: C.textTertiary }}
          >
            DXK Operation System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
