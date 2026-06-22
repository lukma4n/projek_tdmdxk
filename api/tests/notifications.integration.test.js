import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./prisma/test.db'

import { request, app, prismaTest, seedKnownUsers } from './helpers.js'

test.before(async () => {
  await seedKnownUsers()
})

test.after(async () => {
  await prismaTest.$disconnect()
})

async function loginAs(agent, username, password = 'password123') {
  const res = await agent.post('/api/auth/login').send({ username, password })
  assert.equal(res.status, 200, `Login failed for ${username}`)
  return agent
}

// Regresi: endpoint feed "tugas saya" dipanggil Header untuk SEMUA user.
// Sebelumnya route dibatasi ke 2 role saja sehingga role lain (Admin, ADH,
// Partman, CRM, ...) mendapat 403 di setiap halaman. Controller sudah
// memfilter per-role, jadi semua user terautentikasi harus 200.
test('approvals: semua role terautentikasi mendapat 200 (bukan 403)', async () => {
  const roles = [
    'test_admin',      // dulu 403
    'test_crm',        // dulu 403
    'test_adh',        // dulu 403 — padahal controller melayani ADH
    'test_partman',    // dulu 403
    'test_frondesk',   // dulu 403
    'test_serviceadv', // dulu 403
    'test_pico',       // dulu 403
    'test_kabeng',     // sudah 200 sebelumnya
    'test_kacab',      // sudah 200 sebelumnya
  ]

  for (const username of roles) {
    const agent = request.agent(app)
    await loginAs(agent, username)
    const res = await agent.get('/api/notifications/approvals')
    assert.equal(res.status, 200, `${username} harus 200 di /notifications/approvals (dapat ${res.status})`)
    assert.ok(Array.isArray(res.body.data), `${username}: body.data harus array`)
    assert.equal(typeof res.body.summary.total, 'number', `${username}: summary.total harus number`)
  }
})

test('approvals: tanpa autentikasi → 401', async () => {
  const res = await request(app).get('/api/notifications/approvals')
  assert.equal(res.status, 401, `tanpa login harus 401 (dapat ${res.status})`)
})
