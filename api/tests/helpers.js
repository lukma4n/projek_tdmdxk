import request from 'supertest'
import { app } from '../src/app.js'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const TEST_DB_URL = 'file:./prisma/test.db'

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

// Ensure test DB has some known seeded users for integration tests
export async function seedKnownUsers() {
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
