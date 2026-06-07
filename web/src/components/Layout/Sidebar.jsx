import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Phone, 
  Package, 
  Wrench, 
  Award,
  Users,
  ScanBarcode, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  Contact,
  DatabaseBackup,
  MessageCircle,
  Bike,
  FileText,
  FileBadge,
  BadgeDollarSign,
  Calculator,
  BatteryCharging,
  TrendingUp,
  BookOpen,
  Table2,
  ClipboardList
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'

const navItems = [
  { path: '/', label: 'Dashboard Bengkel', icon: LayoutDashboard, group: 'Bengkel', roles: ['Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman'] },
  { path: '/hotline', label: 'Part Hotline', icon: Phone, group: 'Bengkel', roles: ['Service Advisor', 'Kepala Bengkel', 'Partman'] },
  { path: '/stock', label: 'Stok Sparepart', icon: Package, group: 'Bengkel', roles: ['Service Advisor', 'Kepala Bengkel', 'Partman'] },
  { path: '/workshop', label: 'Workshop', icon: Wrench, group: 'Bengkel', roles: ['Frondesk', 'Service Advisor', 'Kepala Bengkel'] },
  { path: '/monitor-kpb-lcr', label: 'Program AHM', icon: ShieldCheck, group: 'Bengkel', roles: ['Service Advisor', 'Kepala Bengkel'] },
  { path: '/customers', label: 'Data Konsumen', icon: Contact, group: 'Bengkel', roles: ['CRM', 'Service Advisor', 'Kepala Bengkel'] },
  { path: '/follow-up-kpb', label: 'Follow-up KPB', icon: MessageCircle, group: 'Bengkel', roles: ['CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel'] },
  { path: '/follow-up-stnk', label: 'Follow-up STNK', icon: FileText, group: 'Bengkel', roles: ['CRM'] },
  { path: '/follow-up-bpkb', label: 'Follow-up BPKB', icon: FileBadge, group: 'Bengkel', roles: ['CRM'] },
  { path: '/showroom/dashboard', label: 'Dashboard Unit', icon: Bike, group: 'Showroom', roles: ['Admin', 'Kepala Cabang', 'Lead PIC Stock opname'] },
  { path: '/showroom/dashboard-penjualan', label: 'Dashboard Penjualan', icon: TrendingUp, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/label-buku-service', label: 'Label Buku Service', icon: BookOpen, group: 'Showroom', roles: ['Admin'] },
  { path: '/showroom/stock-unit', label: 'Stock Unit Showroom', icon: Bike, group: 'Showroom', roles: ['Admin', 'Kepala Cabang', 'Lead PIC Stock opname'] },
  { path: '/showroom/harga-otr', label: 'Master Harga', icon: BadgeDollarSign, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/bbn', label: 'Master BBN', icon: FileText, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/program', label: 'Master Program', icon: BadgeDollarSign, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/tabel-diskon', label: 'Tabel Diskon', icon: Table2, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/tac-leasing', label: 'Master TAC Leasing', icon: BadgeDollarSign, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/dealer-burden', label: 'Master Beban Dealer', icon: BadgeDollarSign, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/salespeople', label: 'Master Sales', icon: Users, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/ksu', label: 'Master KSU', icon: BatteryCharging, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/sales-order-margin', label: 'Kalkulator Margin', icon: Calculator, group: 'Showroom', roles: ['Admin', 'Kepala Cabang'] },
  { path: '/showroom/opname-unit', label: 'Opname Unit', icon: ScanBarcode, group: 'Showroom', roles: ['Lead PIC Stock opname', 'ADH', 'Kepala Cabang'] },
  { path: '/showroom/opname-stnk', label: 'Opname STNK', icon: FileText, group: 'Showroom', roles: ['Lead PIC Stock opname', 'ADH', 'Kepala Cabang'] },
  { path: '/showroom/opname-bpkb', label: 'Opname BPKB', icon: FileBadge, group: 'Showroom', roles: ['Lead PIC Stock opname', 'ADH', 'Kepala Cabang'] },
  { path: '/showroom/pic-users', label: 'PIC Opname Users', icon: Users, group: 'Showroom', roles: ['Lead PIC Stock opname'] },
  { path: '/showroom/stnk', label: 'Stock STNK', icon: FileText, group: 'Showroom', roles: ['Admin', 'Lead PIC Stock opname'] },
  { path: '/showroom/bpkb', label: 'Stock BPKB', icon: FileBadge, group: 'Showroom', roles: ['Admin', 'Lead PIC Stock opname'] },
  { path: '/showroom/stnk-bpkb-monitoring', label: 'Monitoring STNK & BPKB', icon: ClipboardList, group: 'Showroom', roles: ['Admin', 'CRM', 'Kepala Cabang'] },
  { path: '/mechanics', label: 'Performa Mekanik', icon: Award, group: 'Bengkel', roles: ['Kepala Bengkel'] },
  { path: '/opname', label: 'Stock Opname', icon: ScanBarcode, group: 'Bengkel', roles: ['Partman', 'Kepala Bengkel', 'Kepala Cabang'] },
  { path: '/users', label: 'Manajemen User', icon: Users, group: 'Administrasi', roles: ['Kepala Bengkel', 'Kepala Cabang'] },
  { path: '/backups', label: 'Backup & Restore', icon: DatabaseBackup, group: 'Administrasi', roles: ['Kepala Bengkel', 'Kepala Cabang'] },
]

export default function Sidebar() {
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true
    // Lead PIC Stock opname mengikuti roles array biasa
    if (item.roles.includes(user?.role)) return true
    return false
  })
  const getGroupLabel = (item) => (user?.role === 'CRM' && item.group === 'Bengkel' ? 'CRM' : item.group)
  const displayRole = (role) => {
    if (role === 'Admin') return 'Admin Showroom'
    if (role === 'ADH') return 'ADH'
    if (role === 'CRM') return 'Admin CRM'
    if (role === 'PIC Stock opname') return 'PIC Stock Opname'
    return role || 'Guest'
  }

  return (
    <aside className={`relative flex w-72 shrink-0 flex-col overflow-hidden ${isDark ? 'bg-slate-950 text-white shadow-2xl shadow-slate-950/30' : 'border-r border-slate-200 bg-white text-slate-900 shadow-sm'}`}>
      {isDark && <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.28),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)]" />}
      {isDark && <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:34px_34px]" />}
      {/* Logo */}
      <div className={`relative border-b p-5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${isDark ? 'bg-white text-slate-950 shadow-blue-950/20' : 'bg-blue-600 text-white'}`}>
            <Bike size={22} />
          </div>
          <div>
            <h1 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
              TDM Ketapang
            </h1>
            <p className={isDark ? 'mt-0.5 text-xs text-slate-400' : 'mt-0.5 text-xs text-slate-500'}>Operation System</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="relative p-4">
        <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.07] backdrop-blur' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{user?.name || 'User'}</p>
          <p className={isDark ? 'mt-0.5 text-xs text-slate-400 capitalize' : 'mt-0.5 text-xs text-slate-500 capitalize'}>{displayRole(user?.role)}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {visibleItems
          .map((item, index) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            const groupLabel = getGroupLabel(item)
            const showGroup = groupLabel !== (visibleItems[index - 1] ? getGroupLabel(visibleItems[index - 1]) : null)
            return (
              <div key={item.path}>
                {showGroup && <p className={`px-3 pb-1 pt-4 text-[10px] font-black uppercase tracking-[0.18em] first:pt-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{groupLabel}</p>}
                <Link
                  to={item.path}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? isDark ? 'bg-white text-slate-950 shadow-xl shadow-blue-950/20' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                      : isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-blue-600 text-white' : isDark ? 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900'}`}>
                    <Icon size={17} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className={isDark ? 'text-slate-400' : 'text-blue-500'} />}
                </Link>
              </div>
            )
          })}
      </nav>

      {/* Logout */}
      <div className={`relative border-t p-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all ${isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'}`}
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
