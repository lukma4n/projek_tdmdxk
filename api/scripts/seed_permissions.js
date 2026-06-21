import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Current static roles logic mapped to menu keys
const ROLES = Object.freeze({
  ADMIN_SHOWROOM: 'Admin',
  PIC_STOCK_OPNAME: 'PIC Stock opname',
  ADH: 'ADH',
  KEPALA_CABANG: 'Kepala Cabang',
  KEPALA_BENGKEL: 'Kepala Bengkel',
  FRONDESK: 'Frondesk',
  SERVICE_ADVISOR: 'Service Advisor',
  PARTMAN: 'Partman',
  ADMIN_CRM: 'CRM',
})

const seedData = [
  // Dashboard Bengkel
  { menu_key: 'DASHBOARD_BENGKEL', roles: [ROLES.KEPALA_CABANG, ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.FRONDESK, ROLES.PARTMAN] },
  // Part Hotline
  { menu_key: 'HOTLINE', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.PARTMAN] },
  // Stock Sparepart
  { menu_key: 'STOCK', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.PARTMAN] },
  // Workshop
  { menu_key: 'WORKSHOP', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.FRONDESK] },
  // Laporan Bengkel
  { menu_key: 'WORKSHOP_REPORT', roles: [ROLES.KEPALA_CABANG, ROLES.KEPALA_BENGKEL] },
  // Master Program (AHM)
  { menu_key: 'PROGRAM', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR] },
  // Data Konsumen
  { menu_key: 'CUSTOMER', roles: [ROLES.KEPALA_BENGKEL, ROLES.ADMIN_CRM, ROLES.SERVICE_ADVISOR] },
  // Follow-up KPB
  { menu_key: 'FOLLOWUP', roles: [ROLES.KEPALA_BENGKEL, ROLES.ADMIN_CRM, ROLES.SERVICE_ADVISOR, ROLES.FRONDESK] },
  // Follow-up STNK/BPKB
  { menu_key: 'DOCUMENT_FOLLOWUP', roles: [ROLES.ADMIN_CRM] },
  // Opname Sparepart
  { menu_key: 'OPNAME', roles: [ROLES.KEPALA_CABANG, ROLES.KEPALA_BENGKEL, ROLES.PARTMAN] },
  
  // Showroom
  { menu_key: 'SHOWROOM', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'SHOWROOM_SALES_ORDER', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'SHOWROOM_OPNAME', roles: [ROLES.KEPALA_CABANG, ROLES.PIC_STOCK_OPNAME, ROLES.ADH] },
  { menu_key: 'SHOWROOM_DOCUMENT_STOCK', roles: [ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'SHOWROOM_LABEL_BUKU_SERVICE', roles: [ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'SHOWROOM_STNK_BPKB_MONITORING', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM, ROLES.ADH] },
  { menu_key: 'SHOWROOM_STNK_BPKB_GROUP', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM, ROLES.ADH] },
  { menu_key: 'SHOWROOM_PIC_USERS', roles: [ROLES.KEPALA_CABANG] },
  
  // Administrasi
  { menu_key: 'ADMIN', roles: [ROLES.KEPALA_BENGKEL] },
  { menu_key: 'MANAGEMENT', roles: [] },

  // Import modules
  { menu_key: 'IMPORT_HOTLINE', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.PARTMAN] },
  { menu_key: 'IMPORT_STOCK', roles: [ROLES.KEPALA_BENGKEL, ROLES.PARTMAN] },
  { menu_key: 'IMPORT_WORKSHOP', roles: [ROLES.KEPALA_BENGKEL, ROLES.SERVICE_ADVISOR, ROLES.FRONDESK] },
  { menu_key: 'IMPORT_SALES', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_STOCK_UNIT', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_OTR_PRICE', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_OFF_PURCHASE_PRICE', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_BBN', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_PROGRAM', roles: [ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'IMPORT_SHOWROOM_STNK_BPKB_TRACK', roles: [ROLES.ADMIN_SHOWROOM] },
]

async function seed() {
  console.log('Clearing existing role permissions...')
  await prisma.role_permissions.deleteMany()

  console.log('Seeding initial permissions based on SOP...')
  let count = 0
  for (const group of seedData) {
    for (const role of group.roles) {
      await prisma.role_permissions.create({
        data: {
          role_name: role,
          menu_key: group.menu_key,
        }
      })
      count++
    }
  }
  console.log(`Successfully seeded ${count} role permissions.`)
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
