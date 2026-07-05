import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import PublicLanding from './pages/PublicLanding'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'

// Lazy-load semua halaman non-kritis
const Hotline = lazy(() => import('./pages/Hotline'))
const Stock = lazy(() => import('./pages/Stock'))
const Workshop = lazy(() => import('./pages/Workshop'))
const WorkshopTarget = lazy(() => import('./pages/WorkshopTarget'))
const WorkshopReportDashboard = lazy(() => import('./pages/WorkshopReportDashboard'))
const WorkshopSalesAnalysis = lazy(() => import('./pages/WorkshopSalesAnalysis'))
const WorkshopClosingDaily = lazy(() => import('./pages/WorkshopClosingDaily'))
const KpbLcrMonitor = lazy(() => import('./pages/KpbLcrMonitor'))
const Customers = lazy(() => import('./pages/Customers'))
const FollowupKpb = lazy(() => import('./pages/FollowupKpb'))
const MechanicPerformance = lazy(() => import('./pages/MechanicPerformance'))
const Users = lazy(() => import('./pages/Users'))
const Opname = lazy(() => import('./pages/Opname'))
const Backups = lazy(() => import('./pages/Backups'))
const RoleManagement = lazy(() => import('./pages/RoleManagement'))
const ShowroomDashboard = lazy(() => import('./pages/ShowroomDashboard'))
const ShowroomStockUnit = lazy(() => import('./pages/ShowroomStockUnit'))
const ShowroomStnk = lazy(() => import('./pages/ShowroomStnk'))
const ShowroomBpkb = lazy(() => import('./pages/ShowroomBpkb'))
const ShowroomStnkBpkbMonitoring = lazy(() => import('./pages/ShowroomStnkBpkbMonitoring'))
const ShowroomPickupRequests = lazy(() => import('./pages/ShowroomPickupRequests'))
const ShowroomOtrPrice = lazy(() => import('./pages/ShowroomOtrPrice'))
const ShowroomBbnPrice = lazy(() => import('./pages/ShowroomBbnPrice'))
const ShowroomProgram = lazy(() => import('./pages/ShowroomProgram'))
const ShowroomDiscountTable = lazy(() => import('./pages/ShowroomDiscountTable'))
const ShowroomTacLeasing = lazy(() => import('./pages/ShowroomTacLeasing'))
const ShowroomDealerBurden = lazy(() => import('./pages/ShowroomDealerBurden'))
const ShowroomSalespeople = lazy(() => import('./pages/ShowroomSalespeople'))
const ShowroomTeamLeader = lazy(() => import('./pages/ShowroomTeamLeader'))
const ShowroomKsuMaster = lazy(() => import('./pages/ShowroomKsuMaster'))
const ShowroomOpname = lazy(() => import('./pages/ShowroomOpname'))
const SalesOrderMargin = lazy(() => import('./pages/SalesOrderMargin'))
const ShowroomSalesAnalysis = lazy(() => import('./pages/ShowroomSalesAnalysis'))
const ShowroomClosingDaily = lazy(() => import('./pages/ShowroomClosingDaily'))
const ShowroomMarketingTarget = lazy(() => import('./pages/ShowroomMarketingTarget'))
const ShowroomLabelBukuService = lazy(() => import('./pages/ShowroomLabelBukuService'))
const ShowroomCetakStck = lazy(() => import('./pages/ShowroomCetakStck'))
const ShowroomDocumentFollowup = lazy(() => import('./pages/ShowroomDocumentFollowup'))
const ShowroomDocumentHandover = lazy(() => import('./pages/ShowroomDocumentHandover'))
const StnkBpkbCheck = lazy(() => import('./pages/StnkBpkbCheck'))
const StockUnitCheck = lazy(() => import('./pages/StockUnitCheck'))
const DataFreshness = lazy(() => import('./pages/DataFreshness'))
const SecurityAudit = lazy(() => import('./pages/SecurityAudit'))

import { ROLES } from './config/roles'

function RoleGuard({ children, menuKey, roles }) {
  const { user, permissions, permissionsLoaded, permissionsError } = useAuthStore()

  if (!user?.role) {
    return <Navigate to="/" replace />
  }

  // IT Master bypass semua guard
  if (user.role === ROLES.MASTER_IT) return children

  // Gate berbasis roles eksplisit (mis. menu "Layanan Publik" yang bukan menuKey DB).
  if (roles) {
    if (roles.includes(user.role)) return children
    return <Navigate to="/" replace />
  }

  // Tunggu hingga permissions selesai dimuat sebelum memberi akses
  if (!permissionsLoaded) return <PageLoader />

  // Jika permissions gagal dimuat, tampilkan error daripada memberi akses kosong
  if (permissionsError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <p>Gagal memuat izin akses. Silakan muat ulang halaman.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
        >
          Muat Ulang
        </button>
      </div>
    )
  }

  // menuKey wajib ada — route tanpa menuKey dianggap salah konfigurasi
  if (!menuKey) {
    return <Navigate to="/" replace />
  }

  const allowedRoles = permissions[menuKey] || []
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function DefaultRoute() {
  const { user } = useAuthStore()

  if (user?.role === ROLES.ADMIN_SHOWROOM) return <Navigate to="/showroom/dashboard" replace />
  if (user?.role === ROLES.ADMIN_CRM) return <Navigate to="/follow-up-kpb" replace />
  if (user?.role === ROLES.ADH) return <Navigate to="/showroom/opname-unit" replace />
  if (user?.role === ROLES.PIC_STOCK_OPNAME) return <Navigate to="/showroom/opname-unit" replace />
  if (user?.role === ROLES.SALESMAN) return <Navigate to="/showroom/document-handover" replace />
  
  return (
    <RoleGuard menuKey="DASHBOARD_BENGKEL">
      <Dashboard />
    </RoleGuard>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800" />
    </div>
  )
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function App() {
  const { isAuthenticated, login, permissionsLoaded, permissionsError, fetchPermissions, retryPermissions } = useAuthStore()
  // Pulihkan sesi dari cookie httpOnly saat app dimuat (mis. refresh deep-link).
  // Tanpa ini, reload halaman terproteksi akan jatuh ke landing/guest.
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    const apiBase = import.meta.env.VITE_API_URL || '/api'
    // Probe sesi langsung (bukan via fetchWithAuth) supaya 401 untuk guest TIDAK
    // memicu redirect global ke /login — halaman publik (/, /cek) harus tetap terbuka.
    fetch(`${apiBase}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data?.user) login(data.user) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAuthChecked(true) })
    return () => { cancelled = true }
  }, [login])

  useEffect(() => {
    if (isAuthenticated && !permissionsLoaded && !permissionsError) {
      fetchPermissions()
    }
  }, [isAuthenticated, permissionsLoaded, permissionsError, fetchPermissions])

  if (isAuthenticated && !permissionsLoaded && !permissionsError) return <PageLoader />

  if (isAuthenticated && permissionsError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <p>Gagal memuat izin akses. Periksa koneksi jaringan dan coba lagi.</p>
        <button
          onClick={() => { retryPermissions(); fetchPermissions() }}
          className="rounded bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      {/* Self-check publik: alias pendek /cek + path lama (backward compat) */}
      <Route path="/cek" element={<LazyPage><StnkBpkbCheck /></LazyPage>} />
      <Route path="/public/stnk-bpkb-check" element={<LazyPage><StnkBpkbCheck /></LazyPage>} />
      {/* Cek ketersediaan unit (publik) — untuk sales di lapangan */}
      <Route path="/cek-unit" element={<LazyPage><StockUnitCheck /></LazyPage>} />
      {/* Root: tunggu cek sesi → user login: app shell; guest: landing 2 pintu */}
      <Route path="/" element={!authChecked ? <PageLoader /> : isAuthenticated ? <Layout /> : <PublicLanding />}>

        <Route index element={<DefaultRoute />} />
        <Route
          path="hotline"
          element={
            <RoleGuard menuKey="HOTLINE">
              <LazyPage><Hotline /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="stock"
          element={
            <RoleGuard menuKey="STOCK">
              <LazyPage><Stock /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="workshop"
          element={
            <RoleGuard menuKey="WORKSHOP">
              <LazyPage><Workshop /></LazyPage>
            </RoleGuard>
          }
        />
        <Route 
          path="workshop-target" 
          element={
            <RoleGuard menuKey="WORKSHOP_REPORT">
              <LazyPage><WorkshopTarget /></LazyPage>
            </RoleGuard>
          } 
        />
        <Route 
          path="workshop-dashboard" 
          element={
            <RoleGuard menuKey="WORKSHOP_REPORT">
              <LazyPage><WorkshopReportDashboard /></LazyPage>
            </RoleGuard>
          } 
        />
        <Route 
          path="workshop-sales-analysis" 
          element={
            <RoleGuard menuKey="WORKSHOP_REPORT">
              <LazyPage><WorkshopSalesAnalysis /></LazyPage>
            </RoleGuard>
          } 
        />
        <Route 
          path="workshop-closing-daily" 
          element={
            <RoleGuard menuKey="WORKSHOP_REPORT">
              <LazyPage><WorkshopClosingDaily /></LazyPage>
            </RoleGuard>
          } 
        />
        <Route
          path="monitor-kpb-lcr"
          element={
            <RoleGuard menuKey="PROGRAM">
              <LazyPage><KpbLcrMonitor /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="customers"
          element={
            <RoleGuard menuKey="CUSTOMER">
              <LazyPage><Customers /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-kpb"
          element={
            <RoleGuard menuKey="FOLLOWUP">
              <LazyPage><FollowupKpb /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="mechanics"
          element={
            <RoleGuard menuKey="ADMIN">
              <LazyPage><MechanicPerformance /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="users"
          element={
            <RoleGuard menuKey="MANAGEMENT">
              <LazyPage>
                <Users />
              </LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="roles"
          element={
            <RoleGuard menuKey="MANAGEMENT">
              <LazyPage>
                <RoleManagement />
              </LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="backups"
          element={
            <RoleGuard menuKey="MANAGEMENT">
              <LazyPage><Backups /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="opname"
          element={
            <RoleGuard menuKey="OPNAME">
              <LazyPage><Opname /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/dashboard"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomDashboard /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/stock-unit"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomStockUnit /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/stnk"
          element={
            <RoleGuard menuKey="SHOWROOM_DOCUMENT_STOCK">
              <LazyPage><ShowroomStnk /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/bpkb"
          element={
            <RoleGuard menuKey="SHOWROOM_DOCUMENT_STOCK">
              <LazyPage><ShowroomBpkb /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/stnk-bpkb-monitoring"
          element={
              <RoleGuard menuKey="SHOWROOM_STNK_BPKB_MONITORING">
              <LazyPage><ShowroomStnkBpkbMonitoring /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/pickup-requests"
          element={
            <RoleGuard roles={[ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM]}>
              <LazyPage><ShowroomPickupRequests /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/harga-otr"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomOtrPrice /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/bbn"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomBbnPrice /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/program"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomProgram /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/tabel-diskon"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomDiscountTable /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/tac-leasing"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomTacLeasing /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/dealer-burden"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomDealerBurden /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/salespeople"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomSalespeople /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/team-leader"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomTeamLeader /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/ksu"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomKsuMaster /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/sales-order-margin"
          element={
            <RoleGuard menuKey="SHOWROOM_SALES_ORDER">
              <LazyPage><SalesOrderMargin /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/dashboard-penjualan"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomSalesAnalysis /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/closing-harian"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomClosingDaily /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/marketing-target"
          element={
            <RoleGuard menuKey="SHOWROOM">
              <LazyPage><ShowroomMarketingTarget /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/label-buku-service"
          element={
              <RoleGuard menuKey="SHOWROOM_LABEL_BUKU_SERVICE">
              <LazyPage><ShowroomLabelBukuService /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/cetak-stck"
          element={
            <RoleGuard menuKey="SHOWROOM_LABEL_BUKU_SERVICE">
              <LazyPage><ShowroomCetakStck /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-unit"
          element={
            <RoleGuard menuKey="SHOWROOM_OPNAME">
              <LazyPage><ShowroomOpname type="unit" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-stnk"
          element={
            <RoleGuard menuKey="SHOWROOM_OPNAME">
              <LazyPage><ShowroomOpname type="stnk" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-bpkb"
          element={
            <RoleGuard menuKey="SHOWROOM_OPNAME">
              <LazyPage><ShowroomOpname type="bpkb" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/pic-users"
          element={
              <RoleGuard menuKey="SHOWROOM_PIC_USERS">
              <LazyPage><Users /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-stnk"
          element={
            <RoleGuard menuKey="DOCUMENT_FOLLOWUP">
              <LazyPage><ShowroomDocumentFollowup type="stnk" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-bpkb"
          element={
            <RoleGuard menuKey="DOCUMENT_FOLLOWUP">
              <LazyPage><ShowroomDocumentFollowup type="bpkb" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/document-handover"
          element={
            <RoleGuard menuKey="DOCUMENT_HANDOVER">
              <LazyPage><ShowroomDocumentHandover /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="data-freshness"
          element={
            <RoleGuard menuKey="DATA_FRESHNESS">
              <LazyPage><DataFreshness /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="security-audit"
          element={
            <RoleGuard roles={[ROLES.MASTER_IT]}>
              <LazyPage><SecurityAudit /></LazyPage>
            </RoleGuard>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
