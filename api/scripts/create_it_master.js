import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createITMaster() {
  const username = 'itmaster'
  const password = 'password123'
  const name = 'Admin IT Pusat'
  const role = 'IT Master'

  const password_hash = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.users.upsert({
      where: { username },
      update: {
        password_hash,
        name,
        role
      },
      create: {
        username,
        password_hash,
        name,
        role
      }
    })
    console.log(`Success! IT Master created.`)
    console.log(`Username: ${user.username}`)
    console.log(`Password: ${password}`)
  } catch (error) {
    console.error('Failed to create IT Master:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createITMaster()
