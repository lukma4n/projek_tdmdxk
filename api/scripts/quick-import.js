import request from 'supertest'
import { app } from './src/app.js'
import fs from 'fs'

async function run() {
  const login = await request(app).post('/api/auth/login').send({ username: 'danu', password: 'password123' })
  if (login.status !== 200) {
    console.log('Login failed', login.status, login.body)
    process.exit(1)
  }
  const cookie = login.headers['set-cookie']
  console.log('Login OK:', login.body.name)

  const upload = await request(app)
    .post('/api/sync/stock')
    .set('Cookie', cookie)
    .attach('file', '/Users/lukma4n/Downloads/Report Stock Sparepart 2026-05-08 11_21_05.xlsx')

  console.log('Upload status:', upload.status)
  console.log('Response:', JSON.stringify(upload.body, null, 2))
}

run().catch((e) => { console.error(e); process.exit(1) })
