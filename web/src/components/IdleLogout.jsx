import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

// Auto-logout setelah tidak ada aktivitas (idle) demi keamanan komputer bersama.
const IDLE_LIMIT_MS = 60 * 60 * 1000 // 60 menit tanpa aktivitas → logout
const WARN_MS = 60 * 1000            // peringatan 60 detik sebelum logout
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export default function IdleLogout() {
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const lastActivityRef = useRef(0) // diisi Date.now() saat efek mulai
  const [secondsLeft, setSecondsLeft] = useState(null) // null = belum ada peringatan

  useEffect(() => {
    if (!isAuthenticated) return

    lastActivityRef.current = Date.now()
    let lastBump = 0
    const bump = () => {
      const now = Date.now()
      if (now - lastBump > 1000) { // throttle update maks 1x/detik
        lastBump = now
        lastActivityRef.current = now
      }
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current
      if (idle >= IDLE_LIMIT_MS) {
        clearInterval(tick)
        try { sessionStorage.setItem('logoutReason', 'idle') } catch { /* ignore */ }
        logout()
      } else if (idle >= IDLE_LIMIT_MS - WARN_MS) {
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idle) / 1000))
      } else {
        setSecondsLeft((prev) => (prev === null ? prev : null))
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(tick)
    }
  }, [isAuthenticated, logout])

  const stayLoggedIn = () => {
    lastActivityRef.current = Date.now()
    setSecondsLeft(null)
  }

  if (secondsLeft === null) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <LogOut size={26} />
        </div>
        <h2 className="text-lg font-bold text-text-strong">Sesi akan berakhir</h2>
        <p className="mt-2 text-sm text-muted">
          Tidak ada aktivitas selama 60 menit. Demi keamanan, sesi akan ditutup otomatis dalam{' '}
          <b className="text-text-strong">{secondsLeft} detik</b>.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => { try { sessionStorage.setItem('logoutReason', 'manual') } catch { /* ignore */ } ; logout() }}
            className="flex-1 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-muted hover:bg-hover"
          >
            Keluar Sekarang
          </button>
          <button
            onClick={stayLoggedIn}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:brightness-110"
          >
            Tetap Masuk
          </button>
        </div>
      </div>
    </div>
  )
}
