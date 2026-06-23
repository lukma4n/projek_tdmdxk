import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { request, app } from './helpers.js'
import { prismaTest, seedKnownUsers } from './helpers.js'

test.before(async () => {
  await seedKnownUsers()
})

test.after(async () => {
  await prismaTest.$disconnect()
})

async function loginAs(agent, username, password) {
  const res = await agent
    .post('/api/auth/login')
    .send({ username, password })
  assert.equal(res.status, 200, `Login failed for ${username}`)
  return agent
}

test('RBAC: /api/users → allowed for IT Master, forbidden for Kepala Bengkel', async () => {
  const agentAllowed = request.agent(app)
  await loginAs(agentAllowed, 'test_itmaster', 'password123')
  const resAllowed = await agentAllowed.get('/api/users')
  assert.equal(resAllowed.status, 200, 'IT Master should access users list')

  const agentDenied = request.agent(app)
  await loginAs(agentDenied, 'test_kabeng', 'password123')
  const resDenied = await agentDenied.get('/api/users')
  assert.equal(resDenied.status, 403, 'Kepala Bengkel should NOT access users list')
  assert.ok(resDenied.body.error.startsWith('Akses ditolak'))
})

test('RBAC: /api/sync/stock → allowed for Partman, forbidden for Service Advisor', async () => {
  const agentAllowed = request.agent(app)
  await loginAs(agentAllowed, 'test_partman', 'password123')
  const resAllowed = await agentAllowed.post('/api/sync/stock')
  assert.ok(resAllowed.status === 200 || resAllowed.status === 400 || resAllowed.status === 500, `Partman should be allowed to attempt stock import (got ${resAllowed.status})`)

  const agentDenied = request.agent(app)
  await loginAs(agentDenied, 'test_serviceadv', 'password123')
  const resDenied = await agentDenied.post('/api/sync/stock')
  assert.equal(resDenied.status, 403, 'Service Advisor should NOT access stock import')
  assert.ok(resDenied.body.error.startsWith('Akses ditolak'))
})

test('RBAC: /api/showroom/stock-units → allowed for Admin, forbidden for CRM', async () => {
  const agentAllowed = request.agent(app)
  await loginAs(agentAllowed, 'test_admin', 'password123')
  const resAllowed = await agentAllowed.get('/api/showroom/stock-units')
  assert.equal(resAllowed.status, 200, 'Admin should access stock units list')

  const agentDenied = request.agent(app)
  await loginAs(agentDenied, 'test_crm', 'password123')
  const resDenied = await agentDenied.get('/api/showroom/stock-units')
  assert.equal(resDenied.status, 403, 'CRM should NOT access stock units list')
  assert.ok(resDenied.body.error.startsWith('Akses ditolak'))
})

test('RBAC: /api/auth/me → any authenticated user should pass', async () => {
  for (const cred of [
    { u: 'test_admin', r: 'Admin' },
    { u: 'test_crm', r: 'CRM' },
    { u: 'test_frondesk', r: 'Frondesk' },
    { u: 'test_partman', r: 'Partman' },
  ]) {
    const agent = request.agent(app)
    await loginAs(agent, cred.u, 'password123')
    const res = await agent.get('/api/auth/me')
    assert.equal(res.status, 200, `${cred.r} should access /api/auth/me`)
    assert.equal(res.body.user.role, cred.r)
  }
})
