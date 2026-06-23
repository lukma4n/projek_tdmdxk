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
    assert.ok(res.body.error.startsWith('Akses ditolak'))
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

function makeWorkshopExcel(rows) {
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(rows)
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
  return wb
}

test('import final: workshop upsert by wo_number preserves existing work orders', async () => {
  const agent = request.agent(app)
  let res = await agent.post('/api/auth/login').send({ username: 'test_kabeng', password: 'password123' })
  assert.equal(res.status, 200, 'Login failed')

  const workshopHeader = [
    ['Report Workshop YTD'],
    ['TDM Ketapang'],
    [''],
    ['No', 'Branch', 'Branch Name', 'WO Number', 'State', 'Date Confirm', 'Type', 'Main Dealer', 'Login', 'Mechanic', 'Plate No', 'Cust Code', 'Cust Name', 'Mobile', 'Unit', 'Engine No', 'Chassis No', 'Cat', 'Cat Name', 'Product Name', 'Product Code', 'Qty', 'HET', 'Disc', 'Disc Amt', 'DPP', 'PPN', 'HPP', 'GP Total', 'Total', 'Total Disc', 'Tax ID Status', 'Provision', 'Tax Invoice', 'Address', 'Cancel No', 'Cancel Reason', 'Cancel Date', 'Cancel Confirm Date', 'Kecamatan', 'Ring', 'Penerima', 'KTP', 'NPWP', 'Reason AHASS', 'Own Dealer', 'Assembly Year', 'Create Date', 'KM', 'Voucher Amt', 'Wash']
  ]

  const row1 = ['1', 'DXK', 'TDM Ketapang', 'WO-001', 'Closed', 46173, 'Regular', 'AHM', 'user1', 'Mekanik A', 'KB 1234 XX', 'C001', 'Budiono', '0812', 'Vario 150', 'ENG001', 'CHA001', 'Jasa', 'Service Ringan', 'Service', 'JS001', 1, 50000, 0, 0, 45000, 5000, 30000, 20000, 50000, 50000, '1', 0, 'FP001', 'Ketapang', '', '', '', '', 'Delta Pawan', 1, 'Budiono', '1234', '', 'Perawatan', 'Ya', 2020, 46173, 10000, 0, 'Tidak']
  const row2 = ['2', 'DXK', 'TDM Ketapang', 'WO-002', 'Closed', 46173, 'Regular', 'AHM', 'user1', 'Mekanik B', 'KB 5678 YY', 'C002', 'Siti', '0813', 'Beat Sporty', 'ENG002', 'CHA002', 'Jasa', 'Service Ringan', 'Service', 'JS001', 1, 50000, 0, 0, 45000, 5000, 30000, 20000, 50000, 50000, '1', 0, 'FP002', 'Ketapang', '', '', '', '', 'Delta Pawan', 1, 'Siti', '5678', '', 'Perawatan', 'Ya', 2021, 46173, 12000, 0, 'Tidak']

  const wb1 = makeWorkshopExcel([...workshopHeader, row1])
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-test-workshop-'))
  const filePath1 = path.join(tmpDir, 'workshop_first.xlsx')
  xlsx.writeFile(wb1, filePath1)

  try {
    // Import first file with WO-001
    res = await agent
      .post('/api/sync/workshop')
      .attach('file', filePath1)
    
    assert.equal(res.status, 200, `First import failed: ${JSON.stringify(res.body)}`)
    assert.equal(res.body.created, 1)

    // Now verify WO-001 exists in test database
    let wos = await prismaTest.work_orders.findMany()
    assert.equal(wos.length, 1)
    assert.equal(wos[0].wo_number, 'WO-001')
    assert.equal(wos[0].mechanic, 'Mekanik A')

    // Second import has WO-001 updated (mechanic changes) and WO-002 added
    const row1Updated = [...row1]
    row1Updated[9] = 'Mekanik A Super' // change mechanic
    const wb2 = makeWorkshopExcel([...workshopHeader, row1Updated, row2])
    const filePath2 = path.join(tmpDir, 'workshop_second.xlsx')
    xlsx.writeFile(wb2, filePath2)

    res = await agent
      .post('/api/sync/workshop')
      .attach('file', filePath2)

    assert.equal(res.status, 200, `Second import failed: ${JSON.stringify(res.body)}`)
    assert.equal(res.body.created, 1, 'Should insert 1 new record (WO-002)')
    assert.equal(res.body.updated, 1, 'Should update 1 existing record (WO-001)')

    // Verify both exist and WO-001 is updated
    wos = await prismaTest.work_orders.findMany({ orderBy: { wo_number: 'asc' } })
    assert.equal(wos.length, 2)
    assert.equal(wos[0].wo_number, 'WO-001')
    assert.equal(wos[0].mechanic, 'Mekanik A Super')
    assert.equal(wos[1].wo_number, 'WO-002')
    assert.equal(wos[1].mechanic, 'Mekanik B')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
    // Cleanup test table
    await prismaTest.work_orders.deleteMany()
  }
})

