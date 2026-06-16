import { useState, useEffect, useMemo } from 'react'
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
  ShieldCheck,
  Contact,
  DatabaseBackup,
  MessageCircle,
  Bike,
  FileText,
  FileBadge,
  BadgeDollarSign,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import {
  displayRole as displayRoleImpl,
  HOTLINE_ROLES,
  STOCK_ROLES,
  WORKSHOP_ROLES,
  PROGRAM_ROLES,
  CUSTOMER_ROLES,
  FOLLOWUP_ROLES,
  OPNAME_ROLES,
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  DASHBOARD_BENGKEL_ROLES,
  SHOWROOM_ROLES,
  SHOWROOM_WITH_LEAD_ROLES,
  SHOWROOM_STNK_BPKB_MONITORING_ROLES,
  SHOWROOM_STNK_BPKB_GROUP_ROLES,
  SHOWROOM_DOCUMENT_STOCK_ROLES,
  SHOWROOM_DOCUMENT_STOCK_WITH_LEAD_ROLES,
  SHOWROOM_LABEL_BUKU_SERVICE_ROLES,
  SHOWROOM_OPNAME_ROLES,
  SHOWROOM_PIC_USERS_ROLES,
  DOCUMENT_FOLLOWUP_ROLES,
} from '../../config/roles'

// Skydash Admin design tokens
const C = {
  primary: '#4B49AC',
  primaryLight: '#B9B8EE',
  textPrimary: '#1F1F1F',
  textSecondary: '#6C7383',
  border: '#CED4DA',
  surface: '#F8F9FA',
}

// Struktur menu: top-level item bisa punya `children` (sub-menu ala Skydash)
// Kalau ada `children`, parent hanya jadi label collapsible (tidak punya path sendiri)
// Kecuali parent juga punya `path` → clickable + expandable (typical Skydash pattern)
const navStructure = [
  // Bengkel — flat (CRM = label alternatif)
  {
    type: 'group', id: 'bengkel',
    items: [
      { path: '/', label: 'Dashboard Bengkel', icon: LayoutDashboard, roles: DASHBOARD_BENGKEL_ROLES },
      { path: '/hotline', label: 'Part Hotline', icon: Phone, roles: HOTLINE_ROLES },
      { path: '/stock', label: 'Stok Sparepart', icon: Package, roles: STOCK_ROLES },
      { path: '/workshop', label: 'Workshop', icon: Wrench, roles: WORKSHOP_ROLES },
      { path: '/monitor-kpb-lcr', label: 'Program AHM', icon: ShieldCheck, roles: PROGRAM_ROLES },
      { path: '/customers', label: 'Data Konsumen', icon: Contact, roles: CUSTOMER_ROLES },
      { path: '/follow-up-kpb', label: 'Follow-up KPB', icon: MessageCircle, roles: FOLLOWUP_ROLES },
      { path: '/follow-up-stnk', label: 'Follow-up STNK', icon: FileText, roles: DOCUMENT_FOLLOWUP_ROLES },
      { path: '/follow-up-bpkb', label: 'Follow-up BPKB', icon: FileBadge, roles: DOCUMENT_FOLLOWUP_ROLES },
      { path: '/mechanics', label: 'Performa Mekanik', icon: Award, roles: ADMIN_ROLES },
      { path: '/opname', label: 'Stock Opname', icon: ScanBarcode, roles: OPNAME_ROLES },
    ],
  },

  // Showroom — nested (Penjualan / Marketing / Unit / STNK & BPKB / Opname)
  {
    type: 'group', id: 'showroom', label: 'Showroom',
    items: [
      {
        id: 'penjualan', label: 'Penjualan', icon: TrendingUp,
        roles: SHOWROOM_ROLES,
        children: [
          { path: '/showroom/marketing-target', label: 'Target Marketing', roles: SHOWROOM_ROLES },
          { path: '/showroom/dashboard-penjualan', label: 'Laporan Analisis Penjualan', roles: SHOWROOM_ROLES },
          { path: '/showroom/closing-harian', label: 'Laporan Closing Harian', roles: SHOWROOM_ROLES },
        ],
      },
      {
        id: 'marketing', label: 'Marketing', icon: BadgeDollarSign,
        roles: SHOWROOM_ROLES,
        children: [
          { path: '/showroom/tabel-diskon', label: 'Tabel Diskon', roles: SHOWROOM_ROLES },
          { path: '/showroom/tac-leasing', label: 'Master TAC', roles: SHOWROOM_ROLES },
          { path: '/showroom/sales-order-margin', label: 'Kalkulator Margin', roles: SHOWROOM_ROLES },
          { path: '/showroom/harga-otr', label: 'Master Harga', roles: SHOWROOM_ROLES },
          { path: '/showroom/salespeople', label: 'Master Sales', roles: SHOWROOM_ROLES },
          { path: '/showroom/team-leader', label: 'Master Team Leader', roles: SHOWROOM_ROLES },
          { path: '/showroom/dealer-burden', label: 'Master Beban Dealer', roles: SHOWROOM_ROLES },
          { path: '/showroom/program', label: 'Master Program', roles: SHOWROOM_ROLES },
          { path: '/showroom/bbn', label: 'Master BBN', roles: SHOWROOM_ROLES },
        ],
      },
      {
        id: 'unit', label: 'Unit', icon: Bike,
        roles: SHOWROOM_WITH_LEAD_ROLES,
        children: [
          { path: '/showroom/dashboard', label: 'Dashboard Unit', roles: SHOWROOM_WITH_LEAD_ROLES },
          { path: '/showroom/stock-unit', label: 'Stock Unit', roles: SHOWROOM_WITH_LEAD_ROLES },
          { path: '/showroom/ksu', label: 'Master KSU', roles: SHOWROOM_ROLES },
        ],
      },
      {
        id: 'stnk-bpkb', label: 'STNK & BPKB', icon: FileText,
        roles: SHOWROOM_STNK_BPKB_GROUP_ROLES,
        children: [
          { path: '/showroom/stnk', label: 'Stock STNK', roles: SHOWROOM_DOCUMENT_STOCK_WITH_LEAD_ROLES },
          { path: '/showroom/bpkb', label: 'Stock BPKB', roles: SHOWROOM_DOCUMENT_STOCK_WITH_LEAD_ROLES },
          { path: '/showroom/stnk-bpkb-monitoring', label: 'Monitoring STNK & BPKB', roles: SHOWROOM_STNK_BPKB_MONITORING_ROLES },
          { path: '/showroom/label-buku-service', label: 'Label Buku Service', roles: SHOWROOM_LABEL_BUKU_SERVICE_ROLES },
        ],
      },
      {
        id: 'opname', label: 'Opname', icon: ScanBarcode,
        roles: SHOWROOM_OPNAME_ROLES,
        children: [
          { path: '/showroom/opname-unit', label: 'Opname Unit', roles: SHOWROOM_OPNAME_ROLES },
          { path: '/showroom/opname-stnk', label: 'Opname STNK', roles: SHOWROOM_OPNAME_ROLES },
          { path: '/showroom/opname-bpkb', label: 'Opname BPKB', roles: SHOWROOM_OPNAME_ROLES },
          { path: '/showroom/pic-users', label: 'PIC Opname Users', roles: SHOWROOM_PIC_USERS_ROLES },
        ],
      },
    ],
  },

  // Administrasi — flat
  {
    type: 'group', id: 'administrasi',
    items: [
      { path: '/users', label: 'Manajemen User', icon: Users, roles: MANAGEMENT_ROLES },
      { path: '/backups', label: 'Backup & Restore', icon: DatabaseBackup, roles: MANAGEMENT_ROLES },
    ],
  },
]

const CRM_LABEL_OVERRIDE = { bengkel: 'CRM' }

function filterByRole(items, userRole) {
  if (!userRole) return []
  return items.filter((item) => !item.roles || item.roles.includes(userRole))
}

function isPathActive(location, item) {
  if (!item.path) return false
  // Exact match OR prefix match (untuk nested routes)
  return location.pathname === item.path
}

function hasActiveChild(location, item) {
  if (!item.children) return false
  return item.children.some((c) => isPathActive(location, c))
}

function SubMenuItem({ child, isActive, isDark, primaryColor }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute"
        style={{
          left: '20px',
          top: '50%',
          width: '6px',
          height: '6px',
          marginTop: '-3px',
          borderRadius: '50%',
          background: isActive ? primaryColor : '#CBD5E1',
          transition: 'background 0.2s',
        }}
      />
      <Link
        to={child.path}
        className={`block py-[0.65rem] pl-10 pr-4 text-sm leading-none transition-colors duration-150 ${
          isActive
            ? isDark
              ? 'text-white font-bold'
              : 'font-bold'
            : isDark
              ? 'text-slate-300 hover:text-white'
              : 'text-slate-500 hover:text-slate-800'
        }`}
        style={{
          color: isActive && !isDark ? primaryColor : undefined,
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {child.label}
      </Link>
    </li>
  )
}

function ParentNavItem({ item, isActive, isExpanded, onToggle, isDark, primaryColor }) {
  const Icon = item.icon
  return (
    <li className="px-4">
      <button
        type="button"
        onClick={onToggle}
        className={`group mb-[0.2rem] flex w-full items-center gap-3 px-3 py-[0.8125rem] text-left text-sm transition-colors duration-300 ${
          isActive
            ? 'text-white'
            : isDark
              ? 'text-slate-300'
              : 'text-[#6C7383]'
        }`}
        style={{
          borderRadius: '8px',
          backgroundColor: isActive ? primaryColor : 'transparent',
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = primaryColor
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
        }}
        aria-expanded={isExpanded}
      >
        <span
          className={`flex shrink-0 items-center justify-center transition-colors ${
            isActive ? 'text-white' : isDark ? 'text-slate-300 group-hover:text-white' : 'text-[#6C7383] group-hover:text-white'
          }`}
          style={{ fontSize: '1rem' }}
        >
          <Icon size={17} />
        </span>
        <span className="menu-title flex-1 leading-none">{item.label}</span>
        <ChevronRight
          size={14}
          className="transition-transform duration-200"
          style={{
            color: isActive ? '#FFFFFF' : isDark ? '#cbd5e1' : '#6C7383',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      </button>
    </li>
  )
}

function GroupLabel({ label, isDark, withBorder }) {
  return (
    <p
      className={`mb-2 mt-5 px-6 text-[10px] font-black uppercase tracking-[0.18em] first:mt-2 ${
        isDark ? 'text-slate-500' : 'text-slate-400'
      }`}
      style={withBorder ? { borderTop: `1px solid ${C.border}`, paddingTop: '14px' } : undefined}
    >
      {label}
    </p>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { logout, user } = useAuthStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  // Build list of "expandable" parent IDs (have children + user has access)
  const expandableParents = navStructure
    .flatMap((g) => g.items || [])
    .filter((it) => it.children && filterByRole([it], user?.role).length > 0)

  // Active children per current route — derived during render (no setState-in-effect).
  // On first render after a route change, we ensure those parents are open.
  // We track user-collapsed parents in a ref so the auto-expand respects manual close.
  const activeParentIds = useMemo(
    () => new Set(expandableParents.filter((p) => hasActiveChild(location, p)).map((p) => p.id)),
    [expandableParents, location],
  )

  // Lazy initial state: include active parents at mount.
  const [openIds, setOpenIds] = useState(() => new Set(activeParentIds))

  // On route change, ensure active parents are open (multi-open: never auto-close).
  // Legitimate "synchronize with external system" use case (react-router).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenIds((prev) => {
      let changed = false
      const next = new Set(prev)
      activeParentIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [location.pathname, activeParentIds])

  const toggleParent = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const displayRole = displayRoleImpl

  return (
    <aside
      className={`relative flex w-72 shrink-0 flex-col overflow-hidden ${
        isDark
          ? 'bg-slate-950 text-white shadow-2xl shadow-slate-950/30'
          : 'border-r border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      {isDark && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.28),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)]" />
      )}
      {isDark && (
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:34px_34px]" />
      )}

      {/* Logo */}
      <div className={`relative border-b p-5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${
              isDark ? 'bg-white text-slate-950 shadow-blue-950/20' : 'bg-blue-600 text-white'
            }`}
          >
            <Bike size={22} />
          </div>
          <div>
            <h1 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>
              TDM Ketapang
            </h1>
            <p className={isDark ? 'mt-0.5 text-xs text-slate-400' : 'mt-0.5 text-xs text-slate-500'}>
              Operation System
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="relative p-4">
        <div
          className={`rounded-2xl border p-3 ${
            isDark ? 'border-white/10 bg-white/[0.07] backdrop-blur' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {user?.name || 'User'}
          </p>
          <p
            className={`mt-0.5 text-xs capitalize ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {displayRole(user?.role)}
          </p>
        </div>
      </div>

      {/* Navigation — Skydash pattern: nested sub-menu dengan dot indicator, solid purple bg */}
      <nav
        className="relative flex-1 overflow-y-auto pb-4"
        style={{ fontFamily: '"Nunito", sans-serif' }}
      >
        {navStructure.map((group) => {
          const visibleItems = filterByRole(group.items || [], user?.role)
          if (visibleItems.length === 0) return null

          const groupLabel = CRM_LABEL_OVERRIDE[group.id] || group.label
          const showGroupLabel = !!groupLabel
          // Separator untuk group Showroom saja (bukan Bengkel/Administrasi)
          const withBorder = group.id === 'showroom'

          return (
            <div key={group.id}>
              {showGroupLabel && <GroupLabel label={groupLabel} isDark={isDark} withBorder={withBorder} />}
              <ul className="m-0 flex list-none flex-col p-0">
                {visibleItems.map((item) => {
                  // === Sub-menu parent (collapsible) ===
                  if (item.children) {
                    const visibleChildren = filterByRole(item.children, user?.role)
                    if (visibleChildren.length === 0) return null
                    const isOpen = openIds.has(item.id)
                    const isActive = hasActiveChild(location, item)
                    return (
                      <div key={item.id}>
                        <ParentNavItem
                          item={item}
                          isActive={isActive}
                          isExpanded={isOpen}
                          onToggle={() => toggleParent(item.id)}
                          isDark={isDark}
                          primaryColor={C.primary}
                        />
                        {isOpen && (
                          <ul
                            className="m-0 mb-1 list-none p-0"
                            style={{
                              background: 'transparent',
                              padding: '2px 0 4px 0',
                            }}
                          >
                            {visibleChildren.map((child) => {
                              const childActive = isPathActive(location, child)
                              return (
                                <SubMenuItem
                                  key={child.path}
                                  child={child}
                                  isActive={childActive}
                                  isDark={isDark}
                                  primaryColor={C.primary}
                                />
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  }

                  // === Flat nav item ===
                  const isActive = isPathActive(location, item)
                  const Icon = item.icon
                  return (
                    <li key={item.path} className="px-4">
                      <Link
                        to={item.path}
                        className={`group mb-[0.2rem] flex items-center gap-3 px-3 py-[0.8125rem] text-sm transition-colors duration-300 ${
                          isActive
                            ? 'text-white'
                            : isDark
                              ? 'text-slate-300'
                              : 'text-[#6C7383]'
                        }`}
                        style={{
                          borderRadius: '8px',
                          backgroundColor: isActive ? C.primary : 'transparent',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = C.primary
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <span
                          className={`flex shrink-0 items-center justify-center transition-colors ${
                            isActive
                              ? 'text-white'
                              : isDark
                                ? 'text-slate-300 group-hover:text-white'
                                : 'text-[#6C7383] group-hover:text-white'
                          }`}
                          style={{ fontSize: '1rem' }}
                        >
                          <Icon size={17} />
                        </span>
                        <span className="menu-title inline-block leading-none">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className={`relative border-t p-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all ${
            isDark
              ? 'text-slate-400 hover:bg-white/10 hover:text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
          }`}
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
