// Shared role definitions — single source of truth for frontend routing and guards.
// Backend authorization uses these same role strings.

export const ROLES = Object.freeze({
  ADMIN_SHOWROOM: 'Admin',
  PIC_STOCK_OPNAME: 'PIC Stock opname',
  LEAD_PIC_STOCK_OPNAME: 'Lead PIC Stock opname',
  ADH: 'ADH',
  KEPALA_CABANG: 'Kepala Cabang',
  KEPALA_BENGKEL: 'Kepala Bengkel',
  FRONDESK: 'Frondesk',
  SERVICE_ADVISOR: 'Service Advisor',
  PARTMAN: 'Partman',
  ADMIN_CRM: 'CRM',
})

// UI labels (database value -> display label)
export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN_SHOWROOM]: 'Admin Showroom',
  [ROLES.PIC_STOCK_OPNAME]: 'PIC Stock Opname',
  [ROLES.LEAD_PIC_STOCK_OPNAME]: 'Lead PIC Stock Opname',
  [ROLES.ADH]: 'ADH',
  [ROLES.KEPALA_CABANG]: 'Kepala Cabang',
  [ROLES.KEPALA_BENGKEL]: 'Kepala Bengkel',
  [ROLES.FRONDESK]: 'Frondesk',
  [ROLES.SERVICE_ADVISOR]: 'Service Advisor',
  [ROLES.PARTMAN]: 'Partman',
  [ROLES.ADMIN_CRM]: 'Admin CRM',
})

// UI label resolver
export function displayRole(role) {
  return ROLE_LABELS[role] || role || 'Guest'
}

// Flat list of every role value (handy for selects, seeders, etc.)
export const ALL_ROLES = Object.values(ROLES)

// Roles allowed to perform destructive Excel imports
export const IMPORT_ROLES = [
  ROLES.ADMIN_SHOWROOM,
  ROLES.KEPALA_CABANG,
  ROLES.FRONDESK,
  ROLES.SERVICE_ADVISOR,
  ROLES.KEPALA_BENGKEL,
  ROLES.PARTMAN,
]

// Bengkel / workshop side
export const HOTLINE_ROLES = [ROLES.SERVICE_ADVISOR, ROLES.PARTMAN, ROLES.KEPALA_BENGKEL]
export const STOCK_ROLES = [ROLES.SERVICE_ADVISOR, ROLES.PARTMAN, ROLES.KEPALA_BENGKEL]
export const WORKSHOP_ROLES = [ROLES.FRONDESK, ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL]
export const PROGRAM_ROLES = [ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL]
export const CUSTOMER_ROLES = [ROLES.ADMIN_CRM, ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL]
export const FOLLOWUP_ROLES = [ROLES.ADMIN_CRM, ROLES.FRONDESK, ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL]
export const OPNAME_ROLES = [ROLES.PARTMAN, ROLES.KEPALA_BENGKEL, ROLES.KEPALA_CABANG]
export const ADMIN_ROLES = [ROLES.KEPALA_BENGKEL]
export const MANAGEMENT_ROLES = [ROLES.KEPALA_BENGKEL, ROLES.KEPALA_CABANG]
export const DASHBOARD_BENGKEL_ROLES = [
  ROLES.KEPALA_CABANG,
  ROLES.FRONDESK,
  ROLES.SERVICE_ADVISOR,
  ROLES.KEPALA_BENGKEL,
  ROLES.PARTMAN,
]

// Showroom side
export const SHOWROOM_ROLES = [ROLES.ADMIN_SHOWROOM, ROLES.KEPALA_CABANG]
export const SHOWROOM_WITH_LEAD_ROLES = [ROLES.ADMIN_SHOWROOM, ROLES.KEPALA_CABANG, ROLES.LEAD_PIC_STOCK_OPNAME]
export const SHOWROOM_SALES_ORDER_ROLES = [ROLES.ADMIN_SHOWROOM, ROLES.KEPALA_CABANG]
export const SHOWROOM_OPNAME_ROLES = [
  ROLES.PIC_STOCK_OPNAME,
  ROLES.LEAD_PIC_STOCK_OPNAME,
  ROLES.ADH,
  ROLES.KEPALA_CABANG,
]
export const SHOWROOM_DOCUMENT_STOCK_ROLES = [ROLES.ADMIN_SHOWROOM]
// Lead PIC Stock opname hanya bisa akses Stock STNK/BPKB (untuk opname),
// sedangkan Admin Showroom full akses. CRM/Kepala Cabang bisa monitoring saja.
export const SHOWROOM_DOCUMENT_STOCK_WITH_LEAD_ROLES = [
  ROLES.ADMIN_SHOWROOM,
  ROLES.LEAD_PIC_STOCK_OPNAME,
]
export const SHOWROOM_LABEL_BUKU_SERVICE_ROLES = [ROLES.ADMIN_SHOWROOM]
export const SHOWROOM_STNK_BPKB_MONITORING_ROLES = [ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM, ROLES.KEPALA_CABANG]
// Lead PIC Stock opname bisa masuk ke grup STNK & BPKB untuk akses Stock STNK/BPKB
export const SHOWROOM_STNK_BPKB_GROUP_ROLES = [
  ROLES.ADMIN_SHOWROOM,
  ROLES.ADMIN_CRM,
  ROLES.KEPALA_CABANG,
  ROLES.LEAD_PIC_STOCK_OPNAME,
]
export const SHOWROOM_PIC_USERS_ROLES = [ROLES.LEAD_PIC_STOCK_OPNAME]

// Document follow-up (STNK/BPKB)
export const DOCUMENT_FOLLOWUP_ROLES = [ROLES.ADMIN_CRM]

// Default redirects after login
export function getDefaultRoute(role) {
  if (role === ROLES.ADMIN_SHOWROOM) return '/showroom/dashboard'
  if (role === ROLES.ADMIN_CRM) return '/follow-up-kpb'
  if (role === ROLES.ADH || role === ROLES.PIC_STOCK_OPNAME || role === ROLES.LEAD_PIC_STOCK_OPNAME) {
    return '/showroom/opname-unit'
  }
  return '/'
}
