/**
 * Utilitas parsing data dari Excel dan format umum.
 * Dipakai bersama oleh berbagai controller import data.
 */

export function excelDateToJSDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const date = new Date(value)
    return isNaN(date) ? null : date
  }
  if (isNaN(value)) return null
  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
}

export function parseDays(value) {
  if (!value) return 0
  const match = String(value).match(/(\d+)\s+days?/) || String(value).match(/^(\d+)/)
  return match ? parseInt(match[1]) : 0
}

export function parseIntOrZero(value) {
  const parsed = parseInt(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function stringOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

export function formatForExcel(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function parsePrice(value) {
  if (!value) return 0
  return parseFloat(String(value).replace(/,/g, '')) || 0
}
