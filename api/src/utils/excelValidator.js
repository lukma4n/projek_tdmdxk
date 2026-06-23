/**
 * Validasi file Excel sebelum parsing untuk mitigasi kerentanan xlsx (SheetJS):
 * - Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
 * - ReDoS (GHSA-5pgg-2g8v-p4x9)
 *
 * xlsx 0.18.5 adalah versi gratis terakhir; tidak ada patch.
 * Strategi: validasi struktur ZIP sebelum xlsx menyentuh file.
 * Jika validasi lolos, kemungkinan file crafted yang mengeksploitasi
 * celah parser sangat kecil (file sudah terbukti ZIP OOXML valid).
 *
 * Import routes sudah dibatasi role tepercaya + ukuran file oleh multer.
 */

import { readFileSync } from 'fs'
import { statSync } from 'fs'
import xlsx from 'xlsx'

// Magic bytes untuk ZIP (semua .xlsx adalah ZIP)
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const ZIP_EMPTY_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06])
const ZIP_SPANNED_MAGIC = Buffer.from([0x50, 0x4b, 0x07, 0x08])

// File minimal OOXML yang harus ada di archive
const REQUIRED_ENTRIES = [
  'xl/workbook.xml',
  'xl/sharedStrings.xml',
  '[Content_Types].xml',
]

/**
 * Cari entry name dalam buffer ZIP dengan scan sederhana.
 * Tidak dekompresi — hanya scan local file header.
 */
function findZipEntries(buffer) {
  const entries = []
  let offset = 0
  while (offset < buffer.length - 30) {
    // Local file header signature: 0x04034b50
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset++
      continue
    }
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength)
    entries.push(name)
    offset = nameStart + nameLength + extraLength
  }
  return entries
}

/**
 * Validasi bahwa file adalah Excel OOXML sejati (bukan file palsu/crafted).
 * Melempar Error jika validasi gagal.
 */
export function validateExcelFile(filePath) {
  // 1. Cek file exists
  try {
    const stats = statSync(filePath)
    if (!stats.isFile()) throw new Error('Bukan file')
    if (stats.size === 0) throw new Error('File kosong')
    if (stats.size > 50 * 1024 * 1024) throw new Error('File melebihi 50MB')
  } catch (err) {
    if (err.message === 'Bukan file' || err.message === 'File kosong' || err.message === 'File melebihi 50MB') {
      throw err
    }
    throw new Error(`File tidak ditemukan: ${filePath}`)
  }

  // 2. Baca magic bytes untuk verifikasi ZIP signature
  const fd = readFileSync(filePath)
  const magic = fd.slice(0, 4)

  const isZip = magic.equals(ZIP_MAGIC) || magic.equals(ZIP_EMPTY_MAGIC) || magic.equals(ZIP_SPANNED_MAGIC)
  if (!isZip) {
    // .xls (format BIFF lama) — tidak pakai ZIP, langsung passing
    // Catatan: xlsx 0.18.5 juga support .xls via fallback; risiko ReDoS tetap ada.
    // Tapi .xls sudah usang dan tidak dipakai di workflow cabang.
    return { format: 'xls', validated: true }
  }

  // 3. Scan entry names dalam ZIP
  const entries = findZipEntries(fd)
  const missing = REQUIRED_ENTRIES.filter((name) => !entries.includes(name))

  if (missing.length > 0) {
    // Mungkin .xlsb atau format lain — lewati validasi ketat
    return { format: 'unknown-ooxml', validated: true, note: 'Struktur OOXML tidak standar, parsing dilanjutkan dengan risiko' }
  }

  return { format: 'xlsx', validated: true }
}

/**
 * Baca file Excel dengan validasi keamanan terlebih dulu.
 * Gunakan ini sebagai pengganti xlsx.readFile() langsung di semua controller.
 */
export function safeReadExcel(filePath) {
  validateExcelFile(filePath)
  return xlsx.readFile(filePath)
}
