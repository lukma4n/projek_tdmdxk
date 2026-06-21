import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
})

export async function connectDB() {
  try {
    await prisma.$connect()
    const dbUrl = process.env.DATABASE_URL || ''
    const isSqlite = dbUrl.startsWith('file:') || dbUrl.includes('sqlite')
    if (isSqlite) {
      // Hardening konkurensi SQLite untuk produksi single-site:
      // WAL = reader tidak terblok writer; busy_timeout = tunggu lock alih-alih langsung error;
      // foreign_keys = pastikan FK/cascade ditegakkan (mis. cascade handover saat hapus user).
      // queryRaw (bukan executeRaw): PRAGMA ini mengembalikan baris hasil.
      // journal_mode=WAL bersifat persisten di file DB (berlaku utk semua koneksi).
      await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
      await prisma.$queryRawUnsafe('PRAGMA foreign_keys=ON;')
    }
    console.log(`✅ ${isSqlite ? 'SQLite' : 'PostgreSQL'} connected`)
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    process.exit(1)
  }
}
