import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useThemeStore } from '../../stores/themeStore'

export default function Layout() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div className={`flex h-screen ${isDark ? 'bg-[radial-gradient(circle_at_top_left,#1d4ed8_0%,transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]' : 'bg-slate-100'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
