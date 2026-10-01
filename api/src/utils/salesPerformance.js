/**
 * Normalisasi nama sales untuk pencocokan (trim + uppercase).
 * SQLite + Prisma tidak mendukung `mode: 'insensitive'`, dan nama di
 * `customers.salesman` sering beda huruf/spasi dengan master
 * (mis. "Gunawan" vs "GUNAWAN", "WAWAN SETIAWAN " vs "WAWAN SETIAWAN").
 *
 * Pengelompokan per tim ada di services/teamStructureService.js.
 */
export function normalizeKey(value = '') {
  return String(value || '').trim().toUpperCase()
}
