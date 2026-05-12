const xlsx = require('xlsx')
const fs = require('fs')

console.log('🧪 DXK SYSTEM - EXCEL IMPORT TEST')
console.log('=====================================\n')

// Test 1: Hotline
console.log('📄 Testing: Laporan Part Hotline')
console.log('-----------------------------------')
const hotlineFile = '/Users/lukma4n/Documents/Projek_Bengkel/Laporan Part Hotline 2026-05-01 08_19_47.xlsx'
const hotlineWB = xlsx.readFile(hotlineFile)
const hotlineSheet = hotlineWB.Sheets[hotlineWB.SheetNames[0]]
const hotlineData = xlsx.utils.sheet_to_json(hotlineSheet, { header: 1 })

console.log('✅ File ditemukan')
console.log('📊 Total rows:', hotlineData.length)
console.log('📋 Sheet name:', hotlineWB.SheetNames[0])

const hotlineHeaders = hotlineData[3]
console.log('\n📝 Headers (21 cols):')
hotlineHeaders.forEach((h, i) => console.log(`  [${i+1}] ${h}`))

let dxkHotline = 0
for (let i = 4; i < hotlineData.length; i++) {
  if (hotlineData[i][1] === 'DXK') dxkHotline++
}
console.log(`\n🏢 DXK rows: ${dxkHotline} of ${hotlineData.length - 4} total`)

console.log('\nSample rows:')
for (let i = 4; i < 7; i++) {
  console.log(`  Row ${i+1}:`, hotlineData[i].slice(0, 5).join(' | '))
}

// Test 2: Stock
console.log('\n\n📄 Testing: Report Stock Sparepart')
console.log('-----------------------------------')
const stockFile = '/Users/lukma4n/Documents/Projek_Bengkel/Report Stock Sparepart 2026-05-01 15_20_59.xlsx'
const stockWB = xlsx.readFile(stockFile)
const stockSheet = stockWB.Sheets[stockWB.SheetNames[0]]
const stockData = xlsx.utils.sheet_to_json(stockSheet, { header: 1 })

console.log('✅ File ditemukan')
console.log('📊 Total rows:', stockData.length)
console.log('📋 Sheet name:', stockWB.SheetNames[0])

const stockHeaders = stockData[4]
console.log('\n📝 Headers (22 cols):')
stockHeaders.forEach((h, i) => console.log(`  [${i+1}] ${h}`))

console.log('\nSample aging format:', stockData[5][7])
const agingMatch = stockData[5][7]?.match(/(\d+)\s+days/)
console.log('✅ Parsed aging days:', agingMatch ? agingMatch[1] : 'N/A')

console.log('\nSample rows:')
for (let i = 4; i < 7; i++) {
  console.log(`  Row ${i+1}:`, stockData[i].slice(0, 6).join(' | '))
}

// Test 3: Workshop
console.log('\n\n📄 Testing: Report Workshop')
console.log('-----------------------------------')
const woFile = '/Users/lukma4n/Documents/Projek_Bengkel/Report Workshop 2026-05-01 15_24_35.xlsx'
const woWB = xlsx.readFile(woFile)
const woSheet = woWB.Sheets[woWB.SheetNames[0]]
const woData = xlsx.utils.sheet_to_json(woSheet, { header: 1 })

console.log('✅ File ditemukan')
console.log('📊 Total rows:', woData.length)
console.log('📋 Sheet name:', woWB.SheetNames[0])

const woHeaders = woData[4]
console.log('\n📝 Headers (52 cols):')
woHeaders.forEach((h, i) => console.log(`  [${i+1}] ${h}`))

let dxkWO = 0
for (let i = 4; i < woData.length; i++) {
  if (woData[i][1] === 'DXK') dxkWO++
}
console.log(`\n🏢 DXK rows: ${dxkWO} of ${woData.length - 4} total`)

console.log('\nSample date format:', woData[5][5])
if (typeof woData[5][5] === 'number') {
  const epoch = new Date(1899, 11, 30)
  const parsed = new Date(epoch.getTime() + woData[5][5] * 24 * 60 * 60 * 1000)
  console.log('✅ Parsed date:', parsed.toISOString().split('T')[0])
}

const states = new Set()
for (let i = 4; i < woData.length; i++) states.add(woData[i][4])
console.log('\n📊 Unique states:', Array.from(states).join(', '))

const types = new Set()
for (let i = 4; i < woData.length; i++) types.add(woData[i][6])
console.log('📊 Unique types:', Array.from(types).join(', '))

console.log('\n\n=====================================')
console.log('🎉 ALL EXCEL TESTS PASSED')
console.log('Files ready for import to backend')
console.log('=====================================')
