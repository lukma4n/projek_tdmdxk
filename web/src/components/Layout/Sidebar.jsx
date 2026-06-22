import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  DatabaseBackup,
  TrendingUp,
  BadgeDollarSign,
  Bike,
  FileText,
  FileBadge,
  LogOut,
  ShieldCheck,
  MessageCircle,
  ChevronRight,
  BarChart3,
  Contact,
  QrCode,
  Inbox,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { displayRole as displayRoleImpl, ROLES } from '../../config/roles'
import { PUBLIC_URL } from '../../config/selfCheck'

// Struktur menu: top-level item bisa punya `children` (sub-menu)
// Kalau ada `children`, parent hanya jadi label collapsible (tidak punya path sendiri)
// Kecuali parent juga punya `path` → clickable + expandable
const navStructure = [
  // Bengkel — nested
  {
    type: 'group', id: 'bengkel', label: 'Workshop',
    items: [
      {
        id: 'operasional', label: 'Operasional', icon: LayoutDashboard,
        menuKey: 'DASHBOARD_BENGKEL',
        children: [
          { path: '/', label: 'Dashboard Bengkel', menuKey: 'DASHBOARD_BENGKEL' },
          { path: '/workshop', label: 'Workshop', menuKey: 'WORKSHOP' },
          { path: '/monitor-kpb-lcr', label: 'Program AHM', menuKey: 'PROGRAM' },
        ],
      },
      {
        id: 'sparepart', label: 'Sparepart', icon: Package,
        menuKey: 'STOCK',
        children: [
          { path: '/stock', label: 'Stok Sparepart', menuKey: 'STOCK' },
          { path: '/hotline', label: 'Part Hotline', menuKey: 'HOTLINE' },
        ],
      },
      {
        id: 'laporan-target', label: 'Laporan & Target', icon: BarChart3,
        menuKey: 'WORKSHOP_REPORT',
        children: [
          { path: '/workshop-target', label: 'Target Bengkel', menuKey: 'WORKSHOP_REPORT' },
          { path: '/workshop-dashboard', label: 'Dashboard Laporan & Target', menuKey: 'WORKSHOP_REPORT' },
          { path: '/workshop-sales-analysis', label: 'Analisa Penjualan', menuKey: 'WORKSHOP_REPORT' },
          { path: '/workshop-closing-daily', label: 'Laporan Harian', menuKey: 'WORKSHOP_REPORT' },
          { path: '/mechanics', label: 'Performa Mekanik', menuKey: 'ADMIN' },
        ],
      },
    ],
  },

  // CRM & Layanan — flat
  {
    type: 'group', id: 'crm', label: 'CRM & Layanan',
    items: [
      { path: '/customers', label: 'Data Konsumen', icon: Contact, menuKey: 'CUSTOMER' },
      { path: '/follow-up-kpb', label: 'Follow-up KPB', icon: MessageCircle, menuKey: 'FOLLOWUP' },
      { path: '/follow-up-stnk', label: 'Follow-up STNK', icon: FileText, menuKey: 'DOCUMENT_FOLLOWUP' },
      { path: '/follow-up-bpkb', label: 'Follow-up BPKB', icon: FileBadge, menuKey: 'DOCUMENT_FOLLOWUP' },
    ],
  },

  // Showroom — nested
  {
    type: 'group', id: 'showroom', label: 'Showroom',
    items: [
      {
        id: 'penjualan', label: 'Penjualan', icon: TrendingUp,
        menuKey: 'SHOWROOM',
        children: [
          { path: '/showroom/marketing-target', label: 'Target Marketing', menuKey: 'SHOWROOM' },
          { path: '/showroom/dashboard-penjualan', label: 'Laporan Analisis Penjualan', menuKey: 'SHOWROOM' },
          { path: '/showroom/closing-harian', label: 'Laporan Closing Harian', menuKey: 'SHOWROOM' },
        ],
      },
      {
        id: 'marketing', label: 'Marketing', icon: BadgeDollarSign,
        menuKey: 'SHOWROOM',
        children: [
          { path: '/showroom/tabel-diskon', label: 'Tabel Diskon', menuKey: 'SHOWROOM' },
          { path: '/showroom/tac-leasing', label: 'Master TAC', menuKey: 'SHOWROOM' },
          { path: '/showroom/sales-order-margin', label: 'Kalkulator Margin', menuKey: 'SHOWROOM' },
          { path: '/showroom/harga-otr', label: 'Master Harga', menuKey: 'SHOWROOM' },
          { path: '/showroom/salespeople', label: 'Master Sales', menuKey: 'SHOWROOM' },
          { path: '/showroom/team-leader', label: 'Master Team Leader', menuKey: 'SHOWROOM' },
          { path: '/showroom/dealer-burden', label: 'Master Beban Dealer', menuKey: 'SHOWROOM' },
          { path: '/showroom/program', label: 'Master Program', menuKey: 'SHOWROOM' },
          { path: '/showroom/bbn', label: 'Master BBN', menuKey: 'SHOWROOM' },
        ],
      },
      {
        id: 'unit', label: 'Unit', icon: Bike,
        menuKey: 'SHOWROOM',
        children: [
          { path: '/showroom/dashboard', label: 'Dashboard Unit', menuKey: 'SHOWROOM' },
          { path: '/showroom/stock-unit', label: 'Stock Unit', menuKey: 'SHOWROOM' },
          { path: '/showroom/ksu', label: 'Master KSU', menuKey: 'SHOWROOM' },
        ],
      },
      {
        id: 'stnk-bpkb', label: 'STNK & BPKB', icon: FileText,
        menuKey: 'SHOWROOM_STNK_BPKB_GROUP',
        children: [
          { path: '/showroom/stnk', label: 'Stock STNK', menuKey: 'SHOWROOM_DOCUMENT_STOCK' },
          { path: '/showroom/bpkb', label: 'Stock BPKB', menuKey: 'SHOWROOM_DOCUMENT_STOCK' },
          { path: '/showroom/stnk-bpkb-monitoring', label: 'Monitoring STNK & BPKB', menuKey: 'SHOWROOM_STNK_BPKB_MONITORING' },
          { path: '/showroom/label-buku-service', label: 'Label Buku Service', menuKey: 'SHOWROOM_LABEL_BUKU_SERVICE' },
          { path: '/showroom/document-handover', label: 'Document Handling', menuKey: 'DOCUMENT_HANDOVER' },
        ],
      },
    ],
  },

  // Stock Opname — flat
  {
    type: 'group', id: 'stock_opname', label: 'Stock Opname',
    items: [
      { path: '/opname', label: 'Opname Sparepart', icon: Package, menuKey: 'OPNAME' },
      { path: '/showroom/opname-unit', label: 'Opname Unit', icon: Bike, menuKey: 'SHOWROOM_OPNAME' },
      { path: '/showroom/opname-stnk', label: 'Opname STNK', icon: FileText, menuKey: 'SHOWROOM_OPNAME' },
      { path: '/showroom/opname-bpkb', label: 'Opname BPKB', icon: FileBadge, menuKey: 'SHOWROOM_OPNAME' },
      { path: '/showroom/pic-users', label: 'PIC Opname Users', icon: Users, menuKey: 'SHOWROOM_PIC_USERS' },
    ],
  },

  // Administrasi — flat
  {
    type: 'group', id: 'administrasi', label: 'Administrasi',
    items: [
      { path: '/users', label: 'Manajemen User', icon: Users, menuKey: 'MANAGEMENT' },
      { path: '/roles', label: 'Manajemen Akses', icon: ShieldCheck, menuKey: 'MANAGEMENT' },
      { path: '/backups', label: 'Backup & Restore', icon: DatabaseBackup, menuKey: 'MANAGEMENT' },
    ],
  },

  // Layanan Publik — link halaman konsumen (buka tab baru). Gate via `roles`
  // (bukan menuKey DB) karena ini hanya pintasan ke halaman publik.
  {
    type: 'group', id: 'publik', label: 'Layanan Publik',
    items: [
      {
        id: 'self-check-publik',
        label: 'Self-Check Publik',
        icon: QrCode,
        external: true,
        href: `${PUBLIC_URL}/cek`,
        roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM],
      },
      {
        id: 'pickup-requests',
        label: 'Permintaan Ambil Dokumen',
        icon: Inbox,
        path: '/showroom/pickup-requests',
        roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM],
      },
    ],
  },
]


function filterByPermission(items, userRole, permissionsMap) {
  if (!userRole) return []
  if (userRole === 'IT Master') return items
  return items.filter((item) => {
    if (item.roles) return item.roles.includes(userRole)
    if (!item.menuKey) return true
    const allowedRoles = permissionsMap[item.menuKey] || []
    return allowedRoles.includes(userRole)
  })
}

function isPathActive(location, item) {
  if (!item.path) return false
  return location.pathname === item.path
}

function hasActiveChild(location, item) {
  if (!item.children) return false
  return item.children.some((c) => isPathActive(location, c))
}

function SubMenuItem({ child, isActive, onNavigate }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute left-5 top-1/2 h-1.5 w-1.5 -mt-[3px] rounded-full transition-colors duration-200"
        style={{ background: isActive ? 'var(--accent)' : 'var(--text-faint)' }}
      />
      <Link
        to={child.path}
        onClick={onNavigate}
        className={`block py-[0.65rem] pl-10 pr-4 text-sm leading-none transition-colors duration-150 ${
          isActive
            ? 'font-bold text-accent'
            : 'text-muted hover:text-text-strong'
        }`}
      >
        {child.label}
      </Link>
    </li>
  )
}

function ParentNavItem({ item, isActive, isExpanded, onToggle }) {
  const Icon = item.icon
  return (
    <li className="px-4">
      <button
        type="button"
        onClick={onToggle}
        className={`group mb-[0.2rem] flex w-full items-center gap-3 px-3 py-[0.8125rem] text-left text-sm transition-colors duration-200 rounded-lg ${
          isActive
            ? 'bg-accent-soft text-accent font-semibold'
            : 'text-muted hover:bg-hover hover:text-text-strong'
        }`}
        aria-expanded={isExpanded}
      >
        <span className="flex shrink-0 items-center justify-center transition-colors" style={{ fontSize: '1rem' }}>
          <Icon size={17} />
        </span>
        <span className="menu-title flex-1 leading-none">{item.label}</span>
        <ChevronRight
          size={14}
          className="transition-transform duration-200"
          style={{
            color: isActive ? 'var(--accent)' : 'var(--text-faint)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      </button>
    </li>
  )
}

function GroupLabel({ label, withBorder }) {
  return (
    <p
      className={`mb-2 mt-5 px-6 text-[10px] font-black uppercase tracking-[0.18em] first:mt-2 text-faint ${
        withBorder ? 'border-t border-border pt-[14px]' : ''
      }`}
    >
      {label}
    </p>
  )
}

export default function Sidebar({ onNavigate }) {
  const location = useLocation()
  const { logout, user, permissions } = useAuthStore()

  // Active parent per current route (derived)
  const activeParentIds = useMemo(
    () => new Set(
      navStructure
        .flatMap((g) => g.items || [])
        .filter((it) => it.children)
        .filter((p) => hasActiveChild(location, p))
        .map((p) => p.id)
    ),
    [location],
  )

  // Lazy initial state. Reset HANYA saat route berubah (bukan tiap render),
  // supaya grup yang dibuka manual oleh user tidak langsung ter-reset.
  const [openIds, setOpenIds] = useState(() => new Set(activeParentIds))
  const [prevActive, setPrevActive] = useState(activeParentIds)
  if (prevActive !== activeParentIds) {
    setPrevActive(activeParentIds)
    setOpenIds(new Set(activeParentIds))
  }

  // Accordion: klik parent baru → tutup semua, buka hanya yang diklik
  const toggleParent = (id) => {
    setOpenIds((prev) => {
      if (prev.has(id)) return new Set()
      return new Set([id])
    })
  }

  const displayRole = displayRoleImpl

  return (
    <aside className="relative flex h-full w-72 shrink-0 flex-col overflow-hidden bg-sidebar text-text border-r border-border">
      {/* Logo */}
      <div className="relative border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-sm">
            <Bike size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-text-strong">
              TDM Ketapang
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              Operation System
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="relative p-4">
        <div className="rounded-2xl border border-border bg-hover p-3">
          <p className="text-sm font-bold text-text-strong">
            {user?.name || 'User'}
          </p>
          <p className="mt-0.5 text-xs capitalize text-muted">
            {displayRole(user?.role)}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto pb-4">
        {navStructure.map((group) => {
          const visibleItems = filterByPermission(group.items || [], user?.role, permissions)
          if (visibleItems.length === 0) return null

          const groupLabel = group.label
          const showGroupLabel = !!groupLabel
          const withBorder = group.id === 'showroom'

          return (
            <div key={group.id}>
              {showGroupLabel && <GroupLabel label={groupLabel} withBorder={withBorder} />}
              <ul className="m-0 flex list-none flex-col p-0">
                {visibleItems.map((item) => {
                  // Sub-menu parent (collapsible)
                  if (item.children) {
                    const visibleChildren = filterByPermission(item.children, user?.role, permissions)
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
                        />
                        {isOpen && (
                          <ul className="m-0 mb-1 list-none p-0">
                            {visibleChildren.map((child) => {
                              const childActive = isPathActive(location, child)
                              return (
                                <SubMenuItem
                                  key={child.path}
                                  child={child}
                                  isActive={childActive}
                                  onNavigate={onNavigate}
                                />
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  }

                  // Flat nav item — internal Link, atau external (buka tab baru)
                  const isActive = isPathActive(location, item)
                  const Icon = item.icon
                  const flatClass = `group mb-[0.2rem] flex items-center gap-3 px-3 py-[0.8125rem] text-sm transition-colors duration-200 rounded-lg ${
                    isActive
                      ? 'bg-accent-soft text-accent font-semibold'
                      : 'text-muted hover:bg-hover hover:text-text-strong'
                  }`
                  const flatInner = (
                    <>
                      <span className="flex shrink-0 items-center justify-center transition-colors" style={{ fontSize: '1rem' }}>
                        <Icon size={17} />
                      </span>
                      <span className="menu-title inline-block leading-none">{item.label}</span>
                    </>
                  )
                  return (
                    <li key={item.path || item.id} className="px-4">
                      {item.external ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={flatClass}>
                          {flatInner}
                        </a>
                      ) : (
                        <Link to={item.path} onClick={onNavigate} className={flatClass}>
                          {flatInner}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="relative border-t border-border p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all text-muted hover:bg-hover hover:text-text-strong"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
