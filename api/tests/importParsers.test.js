import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import xlsx from 'xlsx'
import { parseSalesFile, parseStockFile } from '../src/services/importParsers.js'

async function writeWorkbook(rows) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-parser-'))
  const filePath = path.join(dir, 'sample.xlsx')
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(rows)
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
  xlsx.writeFile(wb, filePath)
  return { dir, filePath }
}

test('parseSalesFile filters DXK rows and deduplicates SO number', async () => {
  const dxkRow = []
  dxkRow[0] = 1
  dxkRow[1] = 'DXK'
  dxkRow[4] = 'SO001'
  dxkRow[6] = 45000
  dxkRow[15] = 'Budi'
  dxkRow[19] = 'ENG001'
  dxkRow[51] = 'BEAT'

  const otherBranchRow = [...dxkRow]
  otherBranchRow[1] = 'ABC'
  otherBranchRow[4] = 'SO002'

  const duplicateRow = [...dxkRow]
  duplicateRow[15] = 'Duplicate'

  const headerRows = Array.from({ length: 6 }, () => ['header'])
  const { dir, filePath } = await writeWorkbook([...headerRows, dxkRow, otherBranchRow, duplicateRow])
  try {
    const { records, errors } = await parseSalesFile(filePath)
    assert.equal(errors.length, 0)
    assert.equal(records.length, 1)
    assert.equal(records[0].so_number, 'SO001')
    assert.equal(records[0].branch_code, 'DXK')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('parseSalesFile menolak baris tanpa tanggal SO valid, bukan meloloskan so_date null', async () => {
  // customers.so_date wajib di schema; baris ber-so_date null dulu lolos preview
  // lalu membuat createMany gagal dan membatalkan seluruh import dengan 500.
  const validRow = []
  validRow[0] = 1
  validRow[1] = 'DXK'
  validRow[4] = 'SO001'
  validRow[6] = 45000
  validRow[15] = 'Budi'

  const textDateRow = [...validRow]
  textDateRow[0] = 2
  textDateRow[4] = 'SO002'
  textDateRow[6] = '13/07/2026'

  const emptyDateRow = [...validRow]
  emptyDateRow[0] = 3
  emptyDateRow[4] = 'SO003'
  emptyDateRow[6] = undefined

  const headerRows = Array.from({ length: 6 }, () => ['header'])
  const { dir, filePath } = await writeWorkbook([...headerRows, validRow, textDateRow, emptyDateRow])
  try {
    const { records, errors } = await parseSalesFile(filePath)
    assert.equal(records.length, 1, 'hanya baris bertanggal valid yang diterima')
    assert.equal(records[0].so_number, 'SO001')
    assert.ok(records.every((record) => record.so_date instanceof Date))
    assert.equal(errors.length, 2, 'dua baris bermasalah dilaporkan sebagai error baris')
    assert.match(errors[0].error, /Tanggal SO tidak valid/)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('parseStockFile aggregates duplicate product codes', async () => {
  const rowA = []
  rowA[1] = 'DXK'
  rowA[2] = 'DXK'
  rowA[4] = 'PART'
  rowA[5] = 'ABC123'
  rowA[6] = 'OIL'
  rowA[7] = '10 days'
  rowA[8] = 'R1'
  rowA[17] = 2
  rowA[18] = 20000
  rowA[19] = 2
  rowA[20] = 20000

  const rowB = [...rowA]
  rowB[8] = 'R2'
  rowB[17] = 3
  rowB[18] = 30000
  rowB[19] = 3
  rowB[20] = 30000

  const headerRows = Array.from({ length: 4 }, () => ['header'])
  const { dir, filePath } = await writeWorkbook([...headerRows, rowA, rowB])
  try {
    const { records, errors } = parseStockFile(filePath)
    assert.equal(errors.length, 0)
    assert.equal(records.length, 1)
    assert.equal(records[0].qty_available, 5)
    assert.equal(records[0].lokasi, 'R1 | R2')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
