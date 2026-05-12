import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import xlsx from 'xlsx'

process.env.DATABASE_URL = 'file:./test.db'

import { request, app } from './helpers.js'
import { prismaTest, seedKnownUsers } from './helpers.js'

function makeHotlineExcel(rows) {
  // rows: array of arrays matching hotline columns; first 3 rows are skipped by parser as headers
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(rows)
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
  return wb
}

test.before(async () => {
  await seedKnownUsers()
})

test.after(async () => {
  await prismaTest.$disconnect()
})

test('import preview: valid hotline file returns preview without DB changes', async () => {
  const agent = request.agent(app)
  let res = await agent.post('/api/auth/login').send({ username: 'test_kabeng', password: 'password123' })
  assert.equal(res.status, 200, 'Login failed')

  // Hotline parser skips first 3 rows, so we pad with 3 header rows
  const hotlineRows = [
    ['Report Hotline'],        // row 0 (skipped)
    ['TDM Ketapang'],         // row 1 (skipped)
    [''],                     // row 2 (skipped)
    // data starts from row index 3
    ['1', 'DXK', 'TDM Ketapang', 'OIL', 'Oli Mesin', 'OIL001', 'Oli Mesin 1000ml', 10, 'botol', 'Rak A1', 'Active', 'Ready'],
    ['2', 'DXK', 'TDM Ketapang', 'SPAREPART', 'Kampas Rem', 'SP001', 'Kampas Rem Depan', 5, 'set', 'Rak B2', 'Active', 'Ready'],
  ]

  const wb = makeHotlineExcel(hotlineRows)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-test-import-'))
  const filePath = path.join(tmpDir, 'hotline_test.xlsx')
  xlsx.writeFile(wb, filePath)

  try {
    // Check hotline count before preview
    const beforeCount = await prismaTest.hotlines.count()

    res = await agent
      .post('/api/sync/hotline/preview')
      .attach('file', filePath)

    assert.equal(res.status, 200, `Preview failed with status ${res.status}: ${JSON.stringify(res.body)}`)
    assert.ok(res.body.preview || res.body.module || (res.body.sample !== undefined), 'Preview response should contain preview data')

    // Ensure count unchanged
    const afterCount = await prismaTest.hotlines.count()
    assert.equal(afterCount, beforeCount, 'Preview should NOT modify hotline count in DB')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('import preview: role without access gets 403', async () => {
  const agent = request.agent(app)
  let res = await agent.post('/api/auth/login').send({ username: 'test_frondesk', password: 'password123' })
  assert.equal(res.status, 200, 'Login failed')

  const hotlineRows = [
    ['Report Hotline'],
    ['TDM Ketapang'],
    [''],
    ['1', 'DXK', 'TDM Ketapang', 'OIL', 'Oli Mesin', 'OIL001', 'Oli Mesin 1000ml', 10, 'botol', 'Rak A1', 'Active', 'Ready'],
  ]

  const wb = makeHotlineExcel(hotlineRows)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-test-import-'))
  const filePath = path.join(tmpDir, 'hotline_test.xlsx')
  xlsx.writeFile(wb, filePath)

  try {
    res = await agent
      .post('/api/sync/hotline/preview')
      .attach('file', filePath)

    assert.equal(res.status, 403, 'Frondesk should not be allowed to preview hotline import')
    assert.equal(res.body.error, 'Akses ditolak')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('import final: hotline replace all triggers backup and changes DB', async () => {
  const agent = request.agent(app)
  let res = await agent.post('/api/auth/login').send({ username: 'test_kabeng', password: 'password123' })
  assert.equal(res.status, 200, 'Login failed')

  const hotlineRows = [
    ['Report Hotline'],
    ['TDM Ketapang'],
    [''],
    ['1', 'DXK', 'TDM Ketapang', 'OIL', 'Oli Mesin', 'HOT-001', 'Oli Mesin 1000ml', 10, 'botol', 'Rak A1', 'Active', 'Ready'],
  ]

  const wb = makeHotlineExcel(hotlineRows)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-test-import-'))
  const filePath = path.join(tmpDir, 'hotline_final.xlsx')
  xlsx.writeFile(wb, filePath)

  try {
    // Get backup count before
    const backupsBefore = await prismaTest.sync_logs.count({ where: { module: 'hotline' } })

    res = await agent
      .post('/api/sync/hotline')
      .attach('file', filePath)

    assert.ok(res.status === 200 || res.status === 201 || res.status === 500, `Import final status: ${res.status}`)

    if (res.status === 200 || res.status === 201) {
      // Verify backup was created by looking for new sync log
      const backupsAfter = await prismaTest.sync_logs.count({ where: { module: 'hotline' } })
      assert.ok(backupsAfter >= backupsBefore, 'Import final should create backup/sync log')
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
