/**
 * Mapping nama panjang finance company → singkatan.
 * Sumber kebenaran: api/src/controllers/showroomUtils.js → FINANCE_COMPANY_SHORT_MAP
 * Update kedua file saat ada nama leasing baru.
 */
export const FINANCE_COMPANY_SHORT_MAP = {
  'PT FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'PT. FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'FEDERAL INTERNATIONAL FINANCE': 'FIF',
  'FIF': 'FIF',
  'PT SUMMIT OTO FINANCE': 'SOF',
  'PT. SUMMIT OTO FINANCE': 'SOF',
  'SUMMIT OTO FINANCE': 'SOF',
  'SOF': 'SOF',
  'PT CENTRAL SANTOSA FINANCE': 'CSF',
  'PT. CENTRAL SANTOSA FINANCE': 'CSF',
  'CENTRAL SANTOSA FINANCE': 'CSF',
  'CSF': 'CSF',
  'PT ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'PT. ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'ADIRA DINAMIKA MULTIFINANCE TBK': 'ADIRA',
  'ADIRA': 'ADIRA',
  'PT. BCA MULTI FINANCE': 'BCA MF',
  'PT BCA MULTI FINANCE': 'BCA MF',
  'BCA MULTI FINANCE': 'BCA MF',
  'BCA MF': 'BCA MF',
  'PT. INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'PT INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'INDOMOBIL FINANCE INDONESIA': 'IMFI',
  'IMFI': 'IMFI',
}

export function financeShortName(name) {
  if (!name) return null
  const normalized = String(name).trim().toUpperCase()
  return FINANCE_COMPANY_SHORT_MAP[normalized] || String(name).trim()
}

export function customerType(financeCompany) {
  if (!financeCompany || !String(financeCompany).trim()) return 'CASH'
  return 'KREDIT'
}
