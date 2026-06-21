// Sanitasi parameter pagination dari query string.
// Mencegah request menarik baris dalam jumlah ekstrem (mis. ?limit=9999999)
// yang bisa membebani memori/CPU, tanpa merusak view list besar yang sah.
const MAX_LIMIT = 5000

export function clampLimit(value, def = 50) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(n, MAX_LIMIT)
}

export function clampPage(value) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}
