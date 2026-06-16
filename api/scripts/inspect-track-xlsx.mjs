import xlsx from 'xlsx'
const filePath = '/Users/lukma4n/Documents/projek_tdmdxk/file/Report Track STNK BPKB 2026-06-07 21_37_40.xlsx'
const wb = xlsx.readFile(filePath)
const ws = wb.Sheets[wb.SheetNames[0]]
const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })

// Distribution: count rows with various statuses
const stats = {
  total: 0,
  dxk: 0,
  stnk_done: 0,    // Col 27 Tgl Terima STNK
  stnk_pending: 0,
  bpkb_done: 0,    // Col 34 Tgl Terima BPKB
  bpkb_pending: 0,
  plat_done: 0,    // Col 31 Tgl Terima Plat
  plat_pending: 0,
  notice_done: 0,  // Col 23 Tgl Terima Notice
  notice_pending: 0,
  faktur_done: 0,  // Col 14 Tgl Terima Faktur
  faktur_pending: 0,
}
const seriesCount = {}
const yearCount = {}
const areaCount = {}

for (let i = 6; i < data.length; i++) {
  const r = data[i]
  if (!r[1]) continue
  stats.total++
  if (r[1] === 'DXK') stats.dxk++
  if (r[27]) stats.stnk_done++; else stats.stnk_pending++
  if (r[34]) stats.bpkb_done++; else stats.bpkb_pending++
  if (r[31]) stats.plat_done++; else stats.plat_pending++
  if (r[23]) stats.notice_done++; else stats.notice_pending++
  if (r[14]) stats.faktur_done++; else stats.faktur_pending++
  const series = r[57] || 'UNKNOWN'
  seriesCount[series] = (seriesCount[series] || 0) + 1
  const year = r[51] || 'UNKNOWN'
  yearCount[year] = (yearCount[year] || 0) + 1
  const area = r[3] || 'UNKNOWN'
  areaCount[area] = (areaCount[area] || 0) + 1
}
console.log('=== STATS ===')
console.log(JSON.stringify(stats, null, 2))
console.log('\n=== SERIES ===')
console.log(JSON.stringify(seriesCount, null, 2))
console.log('\n=== YEAR ===')
console.log(JSON.stringify(yearCount, null, 2))
console.log('\n=== AREA (top 10) ===')
const topArea = Object.entries(areaCount).sort((a,b)=>b[1]-a[1]).slice(0,10)
console.log(JSON.stringify(topArea, null, 2))
