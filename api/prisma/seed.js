import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
      create: {
        username: user.username,
        password_hash,
        name: user.name,
        role: user.role,
      },
    })
    
    console.log(`✅ User ${user.username} seeded`)
  }

  console.log('🌱 Seeding completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
