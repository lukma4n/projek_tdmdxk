import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
})

export async function connectDB() {
  try {
    await prisma.$connect()
    const dbUrl = process.env.DATABASE_URL || ''
    const dbType = dbUrl.startsWith('file:') || dbUrl.includes('sqlite') ? 'SQLite' : 'PostgreSQL'
    console.log(`✅ ${dbType} connected`)
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    process.exit(1)
  }
}
