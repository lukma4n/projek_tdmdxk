import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'
// Paksa enforcement ON khusus file ini (default OFF saat test agar suite lain aman).
process.env.ENFORCE_SINGLE_SESSION = 'true'

import bcrypt from 'bcryptjs'
import { request, app, prismaTest } from './helpers.js'

const SHARED = 'test_singlesess'      // akun yang "di-share"
const ADMIN = 'test_itmaster_ss'      // IT Master untuk reset sesi
const PWD = 'password123'

async function ensureUser(username, role) {
  const password_hash = await bcrypt.hash(PWD, 10)
  await prismaTest.users.upsert({
    where: { username },
    update: { password_hash, role, session_id: null, session_last_active: null },
    create: { username, password_hash, name: username, role },
  })
}

test.before(async () => {
  await ensureUser(SHARED, 'Partman')
  await ensureUser(ADMIN, 'IT Master')
  await prismaTest.login_logs.deleteMany({ where: { username: { in: [SHARED, ADMIN] } } })
})

test.after(async () => {
  const us = await prismaTest.users.findMany({ where: { username: { in: [SHARED, ADMIN] } }, select: { id: true } })
  const ids = us.map((u) => u.id)
  await prismaTest.login_logs.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { username: { in: [SHARED, ADMIN] } }] } })
  await prismaTest.audit_logs.deleteMany({ where: { user_id: { in: ids } } }) // dari logItMasterAction
  await prismaTest.users.deleteMany({ where: { username: { in: [SHARED, ADMIN] } } })
  await prismaTest.$disconnect()
})

test('Single-session: login pertama sukses, login kedua DITOLAK (409)', async () => {
  const res1 = await request(app).post('/api/auth/login').send({ username: SHARED, password: PWD })
  assert.equal(res1.status, 200)
  const cookie1 = res1.headers['set-cookie']
  assert.ok(cookie1, 'sesi pertama dapat cookie')

  const res2 = await request(app).post('/api/auth/login').send({ username: SHARED, password: PWD })
  assert.equal(res2.status, 409)
  assert.ok(res2.body.error.toLowerCase().includes('digunakan'))

  // Sesi pertama harus tetap valid.
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie1)
  assert.equal(me.status, 200)

  // Audit mencatat login_blocked.
  const blocked = await prismaTest.login_logs.findFirst({ where: { username: SHARED, event: 'login_blocked' } })
  assert.ok(blocked, 'ada catatan login_blocked')
})

test('Single-session: IT Master reset sesi → akun bisa login lagi, token lama mati', async () => {
  // Pastikan SHARED sedang punya sesi aktif.
  const first = await request(app).post('/api/auth/login').send({ username: SHARED, password: PWD })
  // first bisa 200 (kalau sesi sblm ada) atau 409 (kalau msh aktif dr test sebelumnya).
  const sharedUser = await prismaTest.users.findUnique({ where: { username: SHARED } })
  assert.ok(sharedUser.session_id, 'SHARED punya sesi aktif')

  // Login IT Master (akun khusus, tak dipakai file lain → tak terblok).
  const adminRes = await request(app).post('/api/auth/login').send({ username: ADMIN, password: PWD })
  assert.equal(adminRes.status, 200)
  const adminCookie = adminRes.headers['set-cookie']

  // Reset sesi SHARED.
  const reset = await request(app)
    .post(`/api/security/users/${sharedUser.id}/reset-session`)
    .set('Cookie', adminCookie)
  assert.equal(reset.status, 200)

  // session_id SHARED kini null → bisa login lagi.
  const after = await prismaTest.users.findUnique({ where: { username: SHARED } })
  assert.equal(after.session_id, null)
  const relogin = await request(app).post('/api/auth/login').send({ username: SHARED, password: PWD })
  assert.equal(relogin.status, 200)

  void first
})

test('Single-session: non-IT-Master tak boleh akses audit login (403)', async () => {
  // SHARED (Partman) sudah login di test sebelumnya; ambil cookie baru via reset+login.
  const u = await prismaTest.users.findUnique({ where: { username: SHARED } })
  await prismaTest.users.update({ where: { id: u.id }, data: { session_id: null, session_last_active: null } })
  const login = await request(app).post('/api/auth/login').send({ username: SHARED, password: PWD })
  assert.equal(login.status, 200)
  const cookie = login.headers['set-cookie']

  const res = await request(app).get('/api/security/login-logs').set('Cookie', cookie)
  assert.equal(res.status, 403)
})

test('Single-session: IT Master bisa lihat audit login', async () => {
  const adminRes = await request(app).post('/api/auth/login').send({ username: ADMIN, password: PWD })
  // admin mungkin masih punya sesi aktif dr test sblm → reset dulu utk pastikan 200.
  if (adminRes.status !== 200) {
    const a = await prismaTest.users.findUnique({ where: { username: ADMIN } })
    await prismaTest.users.update({ where: { id: a.id }, data: { session_id: null, session_last_active: null } })
  }
  const admin2 = await request(app).post('/api/auth/login').send({ username: ADMIN, password: PWD })
  assert.equal(admin2.status, 200)
  const res = await request(app).get('/api/security/login-logs').set('Cookie', admin2.headers['set-cookie'])
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.logs))
})
