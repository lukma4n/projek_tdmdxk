// Helper format & warna untuk zona Analisa SLA (non-komponen).

export function fmtPct(v) {
  return v === null || v === undefined ? '—' : `${v}%`
}

export function fmtDays(v) {
  return v === null || v === undefined ? '—' : `${Number(v).toLocaleString('id-ID')} hari`
}

// Warna teks berdasarkan capaian on-time % (semakin tinggi semakin hijau).
export function pctColorClass(v) {
  if (v === null || v === undefined) return 'text-faint'
  if (v >= 90) return 'text-success'
  if (v >= 75) return 'text-warning'
  return 'text-danger'
}
