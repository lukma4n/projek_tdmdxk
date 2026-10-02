import request from 'supertest'
import { app } from '../src/app.js'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Prisma me-resolve path SQLite relatif terhadap lokasi schema.prisma (api/prisma/),
// jadi 'file:./test.db' → api/prisma/test.db (BUKAN nested api/prisma/prisma/).
const TEST_DB_URL = 'file:./test.db'

// Helper to point Prisma to test DB
// Note: Prisma caches the env var, so we patch process.env before tests run
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DB_URL
}

// Reuse Prisma client connected to test DB
export const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DB_URL,
    },
  },
})

// Current static roles logic mapped to menu keys for testing
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

const permissionSeedData = [
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
  // Validasi Nomor HP Konsumen
  { menu_key: 'VALIDASI_NOMOR_HP', roles: [ROLES.ADMIN_CRM, ROLES.ADMIN_SHOWROOM] },
  // Pusat Follow-up terpadu
  { menu_key: 'FOLLOWUP_CENTER', roles: [ROLES.ADMIN_CRM, ROLES.FRONDESK, ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL, ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  // Follow-up KPB
  { menu_key: 'FOLLOWUP', roles: [ROLES.KEPALA_BENGKEL, ROLES.ADMIN_CRM, ROLES.SERVICE_ADVISOR, ROLES.FRONDESK] },
  // Follow-up STNK/BPKB
  // Kartu Cek Dokumen (QR self-check) — dipisah dari Follow-up STNK/BPKB karena
  // pekerjaannya berbeda: ini membagikan alat cek mandiri ke konsumen.
  // Template pesan WhatsApp — hak ubah sengaja seluas akses follow-up
  // (keputusan pemilik sistem); pengamannya lewat audit log + riwayat versi.
  { menu_key: 'WHATSAPP_TEMPLATE', roles: [ROLES.ADMIN_CRM, ROLES.FRONDESK, ROLES.SERVICE_ADVISOR, ROLES.KEPALA_BENGKEL, ROLES.KEPALA_CABANG, ROLES.ADMIN_SHOWROOM] },
  { menu_key: 'SELF_CHECK_CARD', roles: [ROLES.ADMIN_SHOWROOM, ROLES.ADMIN_CRM, ROLES.KEPALA_CABANG] },
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

// Ensure test DB has some known seeded users for integration tests
export async function seedKnownUsers() {
  // Only seed if not already seeded to avoid race conditions during parallel test execution
  const existingCount = await prismaTest.role_permissions.count()
  if (existingCount < 71) {
    try {
      for (const group of permissionSeedData) {
        for (const role of group.roles) {
          await prismaTest.role_permissions.upsert({
            where: {
              role_name_menu_key: {
                role_name: role,
                menu_key: group.menu_key,
              }
            },
            update: {},
            create: {
              role_name: role,
              menu_key: group.menu_key,
            }
          })
        }
      }
    } catch (err) {
      // Ignore database locks or conflicts from parallel seeding
    }
  }

  const users = [
    { username: 'test_admin', password: 'password123', name: 'Test Admin', role: 'Admin' },
    { username: 'test_crm', password: 'password123', name: 'Test CRM', role: 'CRM' },
    { username: 'test_kabeng', password: 'password123', name: 'Test Kabeng', role: 'Kepala Bengkel' },
    { username: 'test_frondesk', password: 'password123', name: 'Test Frondesk', role: 'Frondesk' },
    { username: 'test_serviceadv', password: 'password123', name: 'Test Service Advisor', role: 'Service Advisor' },
    { username: 'test_partman', password: 'password123', name: 'Test Partman', role: 'Partman' },
    { username: 'test_pico', password: 'password123', name: 'Test PIC Opname', role: 'PIC Stock opname' },
    { username: 'test_adh', password: 'password123', name: 'Test ADH', role: 'ADH' },
    { username: 'test_kacab', password: 'password123', name: 'Test Kepala Cabang', role: 'Kepala Cabang' },
    { username: 'test_itmaster', password: 'password123', name: 'Test IT Master', role: 'IT Master' },
  ]

  for (const user of users) {
    const password_hash = await bcrypt.hash(user.password, 10)
    await prismaTest.users.upsert({
      where: { username: user.username },
      update: {},
      create: {
        username: user.username,
        password_hash,
        name: user.name,
        role: user.role,
      },
    })
  }
}

export async function loginAs(username, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200)

  const cookie = res.headers['set-cookie']
  const body = res.body
  return { cookie, body }
}

export async function callAuthenticated(method, path, cookie, sendBody = null) {
  let req = request(app)[method](path)
  if (cookie) {
    if (Array.isArray(cookie)) {
      for (const c of cookie) req = req.set('Cookie', c)
    } else {
      req = req.set('Cookie', cookie)
    }
  }
  if (sendBody !== null) {
    req = req.send(sendBody)
  }
  return req
}

export { request }
export { app }
