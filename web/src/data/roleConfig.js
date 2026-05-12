export const ROLES = ['Admin', 'ADH', 'Kepala Cabang', 'CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman', 'PIC Stock opname']

export const ROLE_LABELS = {
  Admin: 'Admin Showroom',
  ADH: 'ADH',
  'Kepala Cabang': 'Kepala Cabang',
  CRM: 'Admin CRM',
  Frondesk: 'Frondesk',
  'Service Advisor': 'Service Advisor',
  'Kepala Bengkel': 'Kepala Bengkel',
  Partman: 'Partman',
  'PIC Stock opname': 'PIC Stock opname',
}

export function displayRole(role) {
  return ROLE_LABELS[role] || role
}

export const IMPORT_ROLES = ['Admin', 'Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman']

export const DASHBOARD_BENGKEL_ROLES = ['Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman']
export const WORKSHOP_ROLES = ['Frondesk', 'Service Advisor', 'Kepala Bengkel']
export const KPB_LCR_ROLES = ['Service Advisor', 'Kepala Bengkel']
export const STOCK_ROLES = ['Service Advisor', 'Partman', 'Kepala Bengkel']
export const HOTLINE_ROLES = ['Service Advisor', 'Partman', 'Kepala Bengkel']
export const OPNAME_ROLES = ['Partman', 'Kepala Bengkel', 'Kepala Cabang']
export const CUSTOMERS_ROLES = ['CRM', 'Service Advisor', 'Kepala Bengkel']
export const FOLLOWUP_KPB_ROLES = ['CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel']
export const MECHANICS_ROLES = ['Kepala Bengkel']
export const USERS_ROLES = ['Kepala Bengkel', 'Kepala Cabang']
export const BACKUPS_ROLES = ['Kepala Bengkel', 'Kepala Cabang']
export const SHOWROOM_DASHBOARD_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_STOCK_UNIT_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_HARGA_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_STNK_ROLES = ['Admin']
export const SHOWROOM_BPKB_ROLES = ['Admin']
export const SHOWROOM_BBN_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_PROGRAM_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_TAC_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_KSU_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_MARGIN_ROLES = ['Admin', 'Kepala Cabang']
export const SHOWROOM_OPNAME_ROLES = ['PIC Stock opname', 'ADH', 'Kepala Cabang']
export const FOLLOWUP_STNK_ROLES = ['CRM']
export const FOLLOWUP_BPKB_ROLES = ['CRM']