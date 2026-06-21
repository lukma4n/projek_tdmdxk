import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PERMISSION_SEED = [
  { menu_key: 'DASHBOARD_BENGKEL', roles: ['Kepala Cabang', 'Kepala Bengkel', 'Service Advisor', 'Frondesk', 'Partman'] },
  { menu_key: 'HOTLINE', roles: ['Kepala Bengkel', 'Service Advisor', 'Partman'] },
  { menu_key: 'STOCK', roles: ['Kepala Bengkel', 'Service Advisor', 'Partman'] },
  { menu_key: 'WORKSHOP', roles: ['Kepala Bengkel', 'Service Advisor', 'Frondesk'] },
  { menu_key: 'WORKSHOP_REPORT', roles: ['Kepala Cabang', 'Kepala Bengkel'] },
  { menu_key: 'PROGRAM', roles: ['Kepala Bengkel', 'Service Advisor'] },
  { menu_key: 'CUSTOMER', roles: ['Kepala Bengkel', 'CRM', 'Service Advisor'] },
  { menu_key: 'FOLLOWUP', roles: ['Kepala Bengkel', 'CRM', 'Service Advisor', 'Frondesk'] },
  { menu_key: 'DOCUMENT_FOLLOWUP', roles: ['CRM'] },
  { menu_key: 'OPNAME', roles: ['Kepala Cabang', 'Kepala Bengkel', 'Partman'] },
  { menu_key: 'SHOWROOM', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'SHOWROOM_SALES_ORDER', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'SHOWROOM_OPNAME', roles: ['Kepala Cabang', 'PIC Stock opname', 'ADH'] },
  { menu_key: 'SHOWROOM_DOCUMENT_STOCK', roles: ['Admin'] },
  { menu_key: 'SHOWROOM_LABEL_BUKU_SERVICE', roles: ['Admin'] },
  { menu_key: 'SHOWROOM_STNK_BPKB_MONITORING', roles: ['Kepala Cabang', 'Admin', 'CRM', 'ADH'] },
  { menu_key: 'SHOWROOM_STNK_BPKB_GROUP', roles: ['Kepala Cabang', 'Admin', 'CRM', 'ADH'] },
  { menu_key: 'SHOWROOM_PIC_USERS', roles: ['Kepala Cabang'] },
  { menu_key: 'ADMIN', roles: ['Kepala Bengkel'] },
  { menu_key: 'MANAGEMENT', roles: [] },
  { menu_key: 'IMPORT_HOTLINE', roles: ['Kepala Bengkel', 'Service Advisor', 'Partman'] },
  { menu_key: 'IMPORT_STOCK', roles: ['Kepala Bengkel', 'Partman'] },
  { menu_key: 'IMPORT_WORKSHOP', roles: ['Kepala Bengkel', 'Service Advisor', 'Frondesk'] },
  { menu_key: 'IMPORT_SALES', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_STOCK_UNIT', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_OTR_PRICE', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_OFF_PURCHASE_PRICE', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_BBN', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_PROGRAM', roles: ['Kepala Cabang', 'Admin'] },
  { menu_key: 'IMPORT_SHOWROOM_STNK_BPKB_TRACK', roles: ['Admin'] },
]

async function main() {
  const users = [
    { username: 'roni', password: 'password', name: 'Roni', role: 'Frondesk' },
    { username: 'dina', password: 'password', name: 'Dina', role: 'Service Advisor' },
    { username: 'pakhendra', password: 'password', name: 'Pak Hendra', role: 'Kepala Bengkel' },
    { username: 'busari', password: 'password', name: 'Bu Sari', role: 'Partman' },
  ]

  for (const user of users) {
    const password_hash = await bcrypt.hash(user.password, 10)
    await prisma.users.upsert({
      where: { username: user.username },
      update: {},
      create: { username: user.username, password_hash, name: user.name, role: user.role },
    })
    console.log(`User ${user.username} seeded`)
  }

  let permCount = 0
  for (const group of PERMISSION_SEED) {
    for (const role of group.roles) {
      await prisma.role_permissions.upsert({
        where: { role_name_menu_key: { role_name: role, menu_key: group.menu_key } },
        update: {},
        create: { role_name: role, menu_key: group.menu_key },
      })
      permCount++
    }
  }
  console.log(`Seeded ${permCount} role permissions`)
  console.log('Seeding completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
