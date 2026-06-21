import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MENUS = [
  'DASHBOARD_BENGKEL',
  'HOTLINE',
  'STOCK',
  'WORKSHOP',
  'WORKSHOP_REPORT',
  'PROGRAM',
  'CUSTOMER',
  'FOLLOWUP',
  'DOCUMENT_FOLLOWUP',
  'OPNAME',
  'SHOWROOM',
  'SHOWROOM_SALES_ORDER',
  'SHOWROOM_OPNAME',
  'SHOWROOM_DOCUMENT_STOCK',
  'SHOWROOM_LABEL_BUKU_SERVICE',
  'SHOWROOM_STNK_BPKB_MONITORING',
  'SHOWROOM_STNK_BPKB_GROUP',
  'SHOWROOM_PIC_USERS',
  'ADMIN',
  'MANAGEMENT',
  'IMPORT_HOTLINE',
  'IMPORT_STOCK',
  'IMPORT_WORKSHOP',
  'IMPORT_SALES',
  'IMPORT_SHOWROOM_STOCK_UNIT',
  'IMPORT_SHOWROOM_OTR_PRICE',
  'IMPORT_SHOWROOM_OFF_PURCHASE_PRICE',
  'IMPORT_SHOWROOM_BBN',
  'IMPORT_SHOWROOM_PROGRAM',
  'IMPORT_SHOWROOM_STNK_BPKB_TRACK',
]

async function resetPermissions() {
  try {
    console.log('Menghapus semua hak akses...')
    await prisma.role_permissions.deleteMany()

    console.log('Memberikan full access ke IT Master...')
    const data = MENUS.map(menu => ({
      role_name: 'IT Master',
      menu_key: menu
    }))

    await prisma.role_permissions.createMany({
      data
    })

    console.log('Sukses! Semua akses telah direset dan IT Master mendapatkan akses penuh.')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetPermissions()
