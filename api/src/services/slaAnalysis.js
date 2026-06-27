/**
 * Analisa SLA STNK & BPKB — perhitungan dari snapshot showroom_stnk_bpkb_tracks.
 *
 * Acuan: SLA IM per-area (lihat docs/superpowers/specs/2026-06-27-analisa-sla-stnk-bpkb-design.md).
 * Lead-time (lt_*) bersifat kumulatif: jumlah hari sejak tanggal Penjualan/SO ke tiap milestone.
 */

const DAY_MS = 24 * 60 * 60 * 1000

// Area jauh (kode kabupaten) dengan SLA BPKB IM 210 hari; selain ini 180 hari.
const REMOTE_KAB_CODES = new Set(['6102', '6103', '6108', '6110']) // Bengkayang, Landak, Kapuas Hulu, Melawi

// Target SLA IM per tahap (kumulatif sejak SO, kecuali penyerahan = durasi tahap itu sendiri).
export const STAGE_SLA_IM = {
  mohon_faktur: 3,
  terima_faktur: 6,
  berkas_birojasa: 7,
  terima_stnk: 60,
  terima_bpkb: 180, // override per-area (210) lewat getAreaSlaTarget
  penyerahan_stnk: 180, // dari terima STNK
  penyerahan_bpkb_cash: 90, // dari terima BPKB
  penyerahan_bpkb_kredit: 7,
}

// Ekstrak kode kabupaten dari nilai area "[6106]KAB. KETAPANG".
function areaKabCode(area) {
  const m = String(area || '').match(/\[(\d+)\]/)
  return m ? m[1] : null
}

// Nama area tanpa prefix kode, untuk grouping/display.
export function areaDisplayName(area) {
  if (!area) return 'Tanpa Area'
  return String(area).replace(/^\[\d+\]\s*/, '').trim() || 'Tanpa Area'
}

// Target SLA per-area: STNK selalu 60; BPKB 180 (atau 210 area jauh).
export function getAreaSlaTarget(area) {
  const code = areaKabCode(area)
  return { stnk: 60, bpkb: REMOTE_KAB_CODES.has(code) ? 210 : 180 }
}

// Target penyerahan BPKB: cash (tanpa finance_company) 90 hari, kredit 7 hari.
function bpkbHandoverTarget(financeCompany) {
  const isKredit = financeCompany && String(financeCompany).trim()
  return isKredit ? STAGE_SLA_IM.penyerahan_bpkb_kredit : STAGE_SLA_IM.penyerahan_bpkb_cash
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

function ageDays(row, today) {
  const base = row.tgl_so || row.tgl_mohon_faktur
  if (!base) return null
  const d = Math.floor((today - new Date(base)) / DAY_MS)
  return d >= 0 ? d : null
}

// Rata-rata dibulatkan 1 desimal dari array angka.
function avg(nums) {
  if (nums.length === 0) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function watchlistRow(row, target, age) {
  return {
    engine_number: row.engine_number,
    stnk_name: row.stnk_name,
    mobile: row.mobile,
    series: row.series,
    area: areaDisplayName(row.area),
    birojasa: row.birojasa,
    no_so: row.no_so,
    age,
    target,
    over_by: age - target,
  }
}

/**
 * Hitung seluruh blok analisa SLA dari array baris track (sudah difilter).
 * @param {Array} rows
 * @param {Date} [now]
 */
export function computeSlaAnalysis(rows, now = new Date()) {
  const today = now

  // ---- Headline (unit selesai) ----
  const stnkDone = rows.filter((r) => r.lt_terima_stnk > 0)
  const bpkbDone = rows.filter((r) => r.lt_terima_bpkb > 0)
  const stnkOnTime = stnkDone.filter((r) => r.lt_terima_stnk <= STAGE_SLA_IM.terima_stnk).length
  const bpkbOnTime = bpkbDone.filter((r) => r.lt_terima_bpkb <= getAreaSlaTarget(r.area).bpkb).length

  // In-progress yang sudah lewat SLA (belum terima dokumen, umur > target)
  let stnkBreachCount = 0
  let bpkbBreachCount = 0
  const stnkBreachRows = []
  const bpkbBreachRows = []
  const stnkAtRiskRows = []
  const bpkbAtRiskRows = []
  const AT_RISK_WINDOW = 14

  for (const r of rows) {
    const age = ageDays(r, today)
    if (age === null) continue
    const target = getAreaSlaTarget(r.area)
    if (r.stnk_status === 'BELUM_JADI') {
      if (age > target.stnk) { stnkBreachCount++; stnkBreachRows.push(watchlistRow(r, target.stnk, age)) }
      else if (target.stnk - age <= AT_RISK_WINDOW) stnkAtRiskRows.push(watchlistRow(r, target.stnk, age))
    }
    if (r.bpkb_status === 'BELUM_JADI') {
      if (age > target.bpkb) { bpkbBreachCount++; bpkbBreachRows.push(watchlistRow(r, target.bpkb, age)) }
      else if (target.bpkb - age <= AT_RISK_WINDOW) bpkbAtRiskRows.push(watchlistRow(r, target.bpkb, age))
    }
  }

  const sortDesc = (a, b) => b.over_by - a.over_by
  const sortAsc = (a, b) => (a.target - a.age) - (b.target - b.age)

  const headline = {
    stnk: { completed: stnkDone.length, onTime: stnkOnTime, onTimePct: pct(stnkOnTime, stnkDone.length), avgDays: avg(stnkDone.map((r) => r.lt_terima_stnk)), target: STAGE_SLA_IM.terima_stnk },
    bpkb: { completed: bpkbDone.length, onTime: bpkbOnTime, onTimePct: pct(bpkbOnTime, bpkbDone.length), avgDays: avg(bpkbDone.map((r) => r.lt_terima_bpkb)) },
    inProgressBreached: { stnk: stnkBreachCount, bpkb: bpkbBreachCount },
    completedVolume: bpkbDone.length,
  }

  // ---- Pipeline per tahap ----
  const stageDef = [
    { key: 'mohon_faktur', label: 'Permohonan Faktur', field: 'lt_mohon_faktur', target: STAGE_SLA_IM.mohon_faktur },
    { key: 'terima_faktur', label: 'Penerimaan Faktur', field: 'lt_terima_faktur', target: STAGE_SLA_IM.terima_faktur },
    { key: 'berkas_birojasa', label: 'Berkas ke Biro Jasa', field: 'lt_proses_stnk', target: STAGE_SLA_IM.berkas_birojasa },
    { key: 'terima_stnk', label: 'Terima STNK', field: 'lt_terima_stnk', target: STAGE_SLA_IM.terima_stnk },
    { key: 'terima_bpkb', label: 'Terima BPKB', field: 'lt_terima_bpkb', target: STAGE_SLA_IM.terima_bpkb, perArea: true },
  ]
  const pipeline = stageDef.map((s) => {
    const vals = rows.filter((r) => r[s.field] > 0)
    const onTime = s.perArea
      ? vals.filter((r) => r[s.field] <= getAreaSlaTarget(r.area).bpkb).length
      : vals.filter((r) => r[s.field] <= s.target).length
    return { key: s.key, label: s.label, target: s.target, perArea: !!s.perArea, count: vals.length, avgActual: avg(vals.map((r) => r[s.field])), onTimePct: pct(onTime, vals.length), gap: Math.round((avg(vals.map((r) => r[s.field])) - s.target) * 10) / 10 }
  })

  // Penyerahan (durasi tahap = penyerahan kumulatif - terima kumulatif)
  const penyerahanStnk = rows.filter((r) => r.lt_penyerahan_stnk > 0 && r.lt_terima_stnk > 0).map((r) => r.lt_penyerahan_stnk - r.lt_terima_stnk).filter((d) => d >= 0)
  const penyerahanStnkOnTime = penyerahanStnk.filter((d) => d <= STAGE_SLA_IM.penyerahan_stnk).length
  pipeline.push({ key: 'penyerahan_stnk', label: 'Penyerahan STNK→Konsumen', target: STAGE_SLA_IM.penyerahan_stnk, perArea: false, count: penyerahanStnk.length, avgActual: avg(penyerahanStnk), onTimePct: pct(penyerahanStnkOnTime, penyerahanStnk.length), gap: Math.round((avg(penyerahanStnk) - STAGE_SLA_IM.penyerahan_stnk) * 10) / 10 })

  const penyerahanBpkbRows = rows.filter((r) => r.lt_penyerahan_bpkb > 0 && r.lt_terima_bpkb > 0)
  const penyerahanBpkbDur = penyerahanBpkbRows.map((r) => ({ d: r.lt_penyerahan_bpkb - r.lt_terima_bpkb, target: bpkbHandoverTarget(r.finance_company) })).filter((x) => x.d >= 0)
  const penyerahanBpkbOnTime = penyerahanBpkbDur.filter((x) => x.d <= x.target).length
  pipeline.push({ key: 'penyerahan_bpkb', label: 'Penyerahan BPKB→Konsumen/Leasing', target: STAGE_SLA_IM.penyerahan_bpkb_cash, perArea: false, count: penyerahanBpkbDur.length, avgActual: avg(penyerahanBpkbDur.map((x) => x.d)), onTimePct: pct(penyerahanBpkbOnTime, penyerahanBpkbDur.length), gap: null, note: 'cash H+90 / kredit H+7' })

  // ---- Tren bulanan (kohort bulan SO) ----
  const trendMap = new Map()
  for (const r of rows) {
    if (!r.tahun || !r.bulan) continue
    const key = `${r.tahun}-${String(r.bulan).padStart(2, '0')}`
    if (!trendMap.has(key)) trendMap.set(key, { period: key, tahun: r.tahun, bulan: r.bulan, volume: 0, stnkDone: 0, stnkOnTime: 0, bpkbDone: 0, bpkbOnTime: 0 })
    const e = trendMap.get(key)
    e.volume++
    if (r.lt_terima_stnk > 0) { e.stnkDone++; if (r.lt_terima_stnk <= STAGE_SLA_IM.terima_stnk) e.stnkOnTime++ }
    if (r.lt_terima_bpkb > 0) { e.bpkbDone++; if (r.lt_terima_bpkb <= getAreaSlaTarget(r.area).bpkb) e.bpkbOnTime++ }
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const trend = Array.from(trendMap.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-18)
    // Persentase null (bukan 0) bila belum ada unit selesai di kohort itu —
    // bulan terbaru biasanya belum lewat SLA, jadi tidak adil dinilai 0%.
    .map((e) => ({ period: e.period, label: `${MONTHS[e.bulan - 1] || e.bulan} ${e.tahun}`, volume: e.volume, stnkOnTimePct: e.stnkDone ? pct(e.stnkOnTime, e.stnkDone) : null, bpkbOnTimePct: e.bpkbDone ? pct(e.bpkbOnTime, e.bpkbDone) : null }))

  // ---- Perbandingan per Biro Jasa ----
  const byBirojasa = groupSla(rows, (r) => r.birojasa || 'TIDAK DIKETAHUI').sort((a, b) => b.count - a.count).slice(0, 20)

  // ---- Perbandingan per Area ----
  const byArea = groupSla(rows, (r) => areaDisplayName(r.area), (r) => getAreaSlaTarget(r.area).bpkb)
    .sort((a, b) => b.count - a.count)

  // ---- Lokasi dokumen (yang belum diserahkan) ----
  const lokasi = {
    stnk: groupCount(rows.filter((r) => r.stnk_status !== 'SUDAH_DIAMBIL'), (r) => r.lokasi_stnk),
    bpkb: groupCount(rows.filter((r) => r.bpkb_status !== 'SUDAH_DIAMBIL'), (r) => r.lokasi_bpkb),
  }

  return {
    headline,
    pipeline,
    trend,
    byBirojasa,
    byArea,
    watchlist: {
      stnkBreach: { count: stnkBreachRows.length, rows: stnkBreachRows.sort(sortDesc).slice(0, 100) },
      bpkbBreach: { count: bpkbBreachRows.length, rows: bpkbBreachRows.sort(sortDesc).slice(0, 100) },
      stnkAtRisk: { count: stnkAtRiskRows.length, rows: stnkAtRiskRows.sort(sortAsc).slice(0, 100) },
      bpkbAtRisk: { count: bpkbAtRiskRows.length, rows: bpkbAtRiskRows.sort(sortAsc).slice(0, 100) },
    },
    lokasi,
  }
}

// Agregat on-time STNK & BPKB per grup.
function groupSla(rows, keyFn, bpkbTargetFn) {
  const map = new Map()
  for (const r of rows) {
    const key = keyFn(r)
    if (!map.has(key)) map.set(key, { name: key, count: 0, stnkDone: 0, stnkOnTime: 0, stnkSum: 0, bpkbDone: 0, bpkbOnTime: 0, bpkbSum: 0, bpkbTarget: bpkbTargetFn ? bpkbTargetFn(r) : null })
    const e = map.get(key)
    e.count++
    if (r.lt_terima_stnk > 0) { e.stnkDone++; e.stnkSum += r.lt_terima_stnk; if (r.lt_terima_stnk <= STAGE_SLA_IM.terima_stnk) e.stnkOnTime++ }
    if (r.lt_terima_bpkb > 0) { e.bpkbDone++; e.bpkbSum += r.lt_terima_bpkb; if (r.lt_terima_bpkb <= getAreaSlaTarget(r.area).bpkb) e.bpkbOnTime++ }
  }
  return Array.from(map.values()).map((e) => ({
    name: e.name,
    count: e.count,
    bpkbTarget: e.bpkbTarget,
    stnkOnTimePct: e.stnkDone ? pct(e.stnkOnTime, e.stnkDone) : null,
    stnkAvg: e.stnkDone ? Math.round((e.stnkSum / e.stnkDone) * 10) / 10 : 0,
    bpkbOnTimePct: e.bpkbDone ? pct(e.bpkbOnTime, e.bpkbDone) : null,
    bpkbAvg: e.bpkbDone ? Math.round((e.bpkbSum / e.bpkbDone) * 10) / 10 : 0,
  }))
}

function groupCount(rows, keyFn) {
  const map = new Map()
  for (const r of rows) {
    const k = keyFn(r) || 'Tanpa Lokasi'
    map.set(k, (map.get(k) || 0) + 1)
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}
