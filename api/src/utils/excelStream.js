/**
 * Pembaca Excel berbasis stream untuk file besar.
 *
 * xlsx.readFile() memuat seluruh workbook sebagai object graph di memori —
 * file workshop full-history (139k baris x 52 kolom) memakai ~1,4 GB RSS dan
 * membuat proses di VPS produksi kena OOM-kill di tengah import. Pembacaan
 * streaming lewat exceljs memproses baris satu per satu dengan puncak ~430 MB.
 *
 * Baris di-yield sebagai array 0-indexed agar identik dengan bentuk hasil
 * xlsx.utils.sheet_to_json(sheet, { header: 1 }) yang dipakai parser lama.
 */

import ExcelJS from 'exceljs'
import { validateExcelFile } from './excelValidator.js'

function cellValue(value) {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('')
  if ('result' in value) return cellValue(value.result)
  if ('text' in value) return value.text
  if ('error' in value) return undefined
  return value
}

/**
 * Yield baris sheet pertama sebagai array 0-indexed.
 * `fromRowNumber` memakai nomor baris Excel asli (1-based), bukan urutan baris
 * yang ter-emit — exceljs melewati baris kosong sehingga penghitung manual meleset.
 */
export async function* streamExcelRows(filePath, { fromRowNumber = 1 } = {}) {
  validateExcelFile(filePath)

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  })

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      if (row.number < fromRowNumber) continue
      // row.values 1-indexed dengan slot 0 kosong; buang agar jadi 0-indexed.
      yield row.values.slice(1).map(cellValue)
    }
    break
  }
}
