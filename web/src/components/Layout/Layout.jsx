import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useThemeStore } from '../../stores/themeStore'

export default function Layout() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const bgClass = isDark ? 'bg-[radial-gradient(circle_at_top_left,#1d4ed8_0%,transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]' : 'bg-slate-100'

  return (
    <div className={`flex h-[100dvh] w-full overflow-hidden ${bgClass}`}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0 h-full">
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50 flex h-full w-72 max-w-[80%] flex-col shadow-2xl">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
