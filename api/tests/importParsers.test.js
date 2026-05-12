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
    const { records, errors } = parseSalesFile(filePath)
    assert.equal(errors.length, 0)
    assert.equal(records.length, 1)
    assert.equal(records[0].so_number, 'SO001')
    assert.equal(records[0].branch_code, 'DXK')
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
