import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'

// Lazy-load semua halaman non-kritis
const Hotline = lazy(() => import('./pages/Hotline'))
const Stock = lazy(() => import('./pages/Stock'))
const Workshop = lazy(() => import('./pages/Workshop'))
const KpbLcrMonitor = lazy(() => import('./pages/KpbLcrMonitor'))
const Customers = lazy(() => import('./pages/Customers'))
const FollowupKpb = lazy(() => import('./pages/FollowupKpb'))
const MechanicPerformance = lazy(() => import('./pages/MechanicPerformance'))
const Users = lazy(() => import('./pages/Users'))
const Opname = lazy(() => import('./pages/Opname'))
const Backups = lazy(() => import('./pages/Backups'))
const ShowroomDashboard = lazy(() => import('./pages/ShowroomDashboard'))
const ShowroomStockUnit = lazy(() => import('./pages/ShowroomStockUnit'))
const ShowroomStnk = lazy(() => import('./pages/ShowroomStnk'))
const ShowroomBpkb = lazy(() => import('./pages/ShowroomBpkb'))
const ShowroomOtrPrice = lazy(() => import('./pages/ShowroomOtrPrice'))
const ShowroomBbnPrice = lazy(() => import('./pages/ShowroomBbnPrice'))
const ShowroomProgram = lazy(() => import('./pages/ShowroomProgram'))
const ShowroomTacLeasing = lazy(() => import('./pages/ShowroomTacLeasing'))
const ShowroomKsuMaster = lazy(() => import('./pages/ShowroomKsuMaster'))
const ShowroomOpname = lazy(() => import('./pages/ShowroomOpname'))
const SalesOrderMargin = lazy(() => import('./pages/SalesOrderMargin'))
const ShowroomDocumentFollowup = lazy(() => import('./pages/ShowroomDocumentFollowup'))
import {
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
  SHOWROOM_SALES_ORDER_ROLES,
  SHOWROOM_OPNAME_ROLES,
  SHOWROOM_DOCUMENT_STOCK_ROLES,
  DOCUMENT_FOLLOWUP_ROLES,
  ROLES,
} from './config/roles'

function RoleGuard({ children, allowedRoles }) {
  const { user } = useAuthStore()

  if (!user?.role || !allowedRoles.includes(user.role)) {
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
  return (
    <RoleGuard allowedRoles={DASHBOARD_BENGKEL_ROLES}>
      <Dashboard />
    </RoleGuard>
  )
}

// Fallback loading sederhana saat chunk lazy-load
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
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<DefaultRoute />} />
        <Route
          path="hotline"
          element={
            <RoleGuard allowedRoles={HOTLINE_ROLES}>
              <LazyPage><Hotline /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="stock"
          element={
            <RoleGuard allowedRoles={STOCK_ROLES}>
              <LazyPage><Stock /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="workshop"
          element={
            <RoleGuard allowedRoles={WORKSHOP_ROLES}>
              <LazyPage><Workshop /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="monitor-kpb-lcr"
          element={
            <RoleGuard allowedRoles={PROGRAM_ROLES}>
              <LazyPage><KpbLcrMonitor /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="customers"
          element={
            <RoleGuard allowedRoles={CUSTOMER_ROLES}>
              <LazyPage><Customers /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-kpb"
          element={
            <RoleGuard allowedRoles={FOLLOWUP_ROLES}>
              <LazyPage><FollowupKpb /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="mechanics"
          element={
            <RoleGuard allowedRoles={ADMIN_ROLES}>
              <LazyPage><MechanicPerformance /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="users"
          element={
            <RoleGuard allowedRoles={MANAGEMENT_ROLES}>
              <LazyPage><Users /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="backups"
          element={
            <RoleGuard allowedRoles={MANAGEMENT_ROLES}>
              <LazyPage><Backups /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="opname"
          element={
            <RoleGuard allowedRoles={OPNAME_ROLES}>
              <LazyPage><Opname /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/dashboard"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomDashboard /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/stock-unit"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomStockUnit /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/stnk"
          element={
            <RoleGuard allowedRoles={SHOWROOM_DOCUMENT_STOCK_ROLES}>
              <LazyPage><ShowroomStnk /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/bpkb"
          element={
            <RoleGuard allowedRoles={SHOWROOM_DOCUMENT_STOCK_ROLES}>
              <LazyPage><ShowroomBpkb /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/harga-otr"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomOtrPrice /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/bbn"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomBbnPrice /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/program"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomProgram /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/tac-leasing"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomTacLeasing /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/ksu"
          element={
            <RoleGuard allowedRoles={SHOWROOM_ROLES}>
              <LazyPage><ShowroomKsuMaster /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/sales-order-margin"
          element={
            <RoleGuard allowedRoles={SHOWROOM_SALES_ORDER_ROLES}>
              <LazyPage><SalesOrderMargin /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-unit"
          element={
            <RoleGuard allowedRoles={SHOWROOM_OPNAME_ROLES}>
              <LazyPage><ShowroomOpname type="unit" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-stnk"
          element={
            <RoleGuard allowedRoles={SHOWROOM_OPNAME_ROLES}>
              <LazyPage><ShowroomOpname type="stnk" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/opname-bpkb"
          element={
            <RoleGuard allowedRoles={SHOWROOM_OPNAME_ROLES}>
              <LazyPage><ShowroomOpname type="bpkb" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="showroom/pic-users"
          element={
            <RoleGuard allowedRoles={['Lead PIC Stock opname']}>
              <LazyPage><Users /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-stnk"
          element={
            <RoleGuard allowedRoles={DOCUMENT_FOLLOWUP_ROLES}>
              <LazyPage><ShowroomDocumentFollowup type="stnk" /></LazyPage>
            </RoleGuard>
          }
        />
        <Route
          path="follow-up-bpkb"
          element={
            <RoleGuard allowedRoles={DOCUMENT_FOLLOWUP_ROLES}>
              <LazyPage><ShowroomDocumentFollowup type="bpkb" /></LazyPage>
            </RoleGuard>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
