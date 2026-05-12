import test from 'node:test'
import assert from 'node:assert/strict'

// Must set test DB before importing app (top-level Prisma initialization)
process.env.DATABASE_URL = 'file:./test.db'

import { request, app } from './helpers.js'
import { prismaTest, seedKnownUsers } from './helpers.js'

// Seed before running all tests
test.before(async () => {
  await seedKnownUsers()
})

test.after(async () => {
  await prismaTest.$disconnect()
})

test('auth flow: login success sets httpOnly cookie', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test_admin', password: 'password123' })

  assert.equal(res.status, 200)
  assert.equal(res.body.user.username, 'test_admin')
  assert.equal(res.body.user.role, 'Admin')

  const cookies = res.headers['set-cookie']
  assert.ok(cookies, 'Set-Cookie header must exist')
  const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies
  assert.ok(cookieStr.toLowerCase().includes('httponly'), 'Cookie should be httpOnly')
})

test('auth flow: login with invalid credentials returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test_admin', password: 'wrongpassword' })

  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Username atau password salah')
})

test('auth flow: /me returns user after login', async () => {
  const agent = request.agent(app)
  let res = await agent
    .post('/api/auth/login')
    .send({ username: 'test_admin', password: 'password123' })

  assert.equal(res.status, 200)

  res = await agent.get('/api/auth/me')

  assert.equal(res.status, 200)
  assert.equal(res.body.user.username, 'test_admin')
  assert.equal(res.body.user.role, 'Admin')
})

test('auth flow: /me without cookie returns 401', async () => {
  const res = await request(app)
    .get('/api/auth/me')

  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Token tidak ditemukan')
})

test('auth flow: logout clears cookie and makes /me 401', async () => {
  const agent = request.agent(app)

  let res = await agent
    .post('/api/auth/login')
    .send({ username: 'test_admin', password: 'password123' })
  assert.equal(res.status, 200)

  res = await agent.post('/api/auth/logout')
  assert.equal(res.status, 200)
  assert.equal(res.body.message, 'Logout berhasil')

  // With cookie agent, the cookie is now expired/cleared
  res = await agent.get('/api/auth/me')
  assert.equal(res.status, 401)
})
