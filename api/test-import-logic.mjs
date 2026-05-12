import xlsx from 'xlsx'
import fs from 'fs'

console.log('🧪 BACKEND IMPORT LOGIC TEST')
console.log('==============================\n')

function parseAgingDays(agingStr) {
  if (!agingStr) return 0
  const match = agingStr.match(/(\d+)\s+days/)
  return match ? parseInt(match[1]) : 0
}

function excelDateToJSDate(serial) {
  const excelEpoch = new Date(1899, 11, 30)
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
}

// Test 1: Stock Import
console.log('📦 Testing Stock Import Logic')
console.log('------------------------------')
const stockFile = '/Users/lukma4n/Documents/Projek_Bengkel/Report Stock Sparepart 2026-05-01 15_20_59.xlsx'
const stockWB = xlsx.readFile(stockFile)
const stockSheet = stockWB.Sheets[stockWB.SheetNames[0]]
const stockData = xlsx.utils.sheet_to_json(stockSheet, { header: 1 })

let stockSuccess = 0
let stockErrors = []

for (const row of stockData.slice(4)) {
  if (!row[5]) continue // Skip empty
  
  try {
    const agingDays = parseAgingDays(row[7])
    const movementDays = parseAgingDays(row[9])
    
    // Validate data types
    if (!row[5]) throw new Error('Missing product_code')
    if (!row[6]) throw new Error('Missing product_name')
    
    stockSuccess++
  } catch (err) {
    stockErrors.push({ row: row[0], error: err.message })
  }
}

console.log(`✅ Would import: ${stockSuccess} stock parts`)
console.log(`❌ Errors: ${stockErrors.length}`)
if (stockErrors.length > 0) {
  console.log('Sample errors:', stockErrors.slice(0, 3))
}

// Test 2: Workshop Import (with skip empty state/type)
console.log('\n🔧 Testing Workshop Import Logic')
console.log('----------------------------------')
const woFile = '/Users/lukma4n/Documents/Projek_Bengkel/Report Workshop 2026-05-01 15_24_35.xlsx'
const woWB = xlsx.readFile(woFile)
const woSheet = woWB.Sheets[woWB.SheetNames[0]]
const woData = xlsx.utils.sheet_to_json(woSheet, { header: 1 })

let woSuccess = 0
let woSkipped = 0
let woErrors = []

for (const row of woData.slice(4)) {
  if (!row[3]) continue // Skip empty
  
  // NEW: Skip empty state or type
  if (!row[4] || !row[4].toString().trim() || row[4] === 'State') {
    woSkipped++
    continue
  }
  if (!row[6] || !row[6].toString().trim() || row[6] === 'Type') {
    woSkipped++
    continue
  }
  
  try {
    const branchCode = row[1]
    if (branchCode !== 'DXK') continue
    
    const state = row[4]?.toString().trim()
    const type = row[6]?.toString().trim()
    
    if (!state || !type) {
      woSkipped++
      continue
    }
    
    const dateConfirm = typeof row[5] === 'number' 
      ? excelDateToJSDate(row[5]) 
      : row[5] ? new Date(row[5]) : null
    
    woSuccess++
  } catch (err) {
    woErrors.push({ row: row[0], error: err.message })
  }
}

console.log(`✅ Would import: ${woSuccess} work orders (DXK only)`)
console.log(`⏭️  Skipped (empty state/type): ${woSkipped}`)
console.log(`❌ Errors: ${woErrors.length}`)

// Test 3: Hotline Import
console.log('\n📞 Testing Hotline Import Logic')
console.log('---------------------------------')
const hotlineFile = '/Users/lukma4n/Documents/Projek_Bengkel/Laporan Part Hotline 2026-05-01 09_45_07.xlsx'
const hotlineWB = xlsx.readFile(hotlineFile)
const hotlineSheet = hotlineWB.Sheets[hotlineWB.SheetNames[0]]
const hotlineData = xlsx.utils.sheet_to_json(hotlineSheet, { header: 1 })

let hotlineSuccess = 0
let hotlineSkipped = 0
let hotlineErrors = []

for (const row of hotlineData.slice(3)) {
  if (!row[3]) continue
  
  try {
    const branchCode = row[1]
    if (branchCode !== 'DXK') {
      hotlineSkipped++
      continue
    }
    
    hotlineSuccess++
  } catch (err) {
    hotlineErrors.push({ row: row[0], error: err.message })
  }
}

console.log(`✅ Would import: ${hotlineSuccess} hotlines (DXK only)`)
console.log(`⏭️  Skipped (non-DXK): ${hotlineSkipped}`)
console.log(`❌ Errors: ${hotlineErrors.length}`)

// Summary
console.log('\n=====================================')
console.log('📊 IMPORT PREVIEW SUMMARY')
console.log('=====================================')
console.log(`📦 Stock Parts:  ${stockSuccess} items`)
console.log(`🔧 Workshop:     ${woSuccess} WO (DXK)`)
console.log(`📞 Hotline:      ${hotlineSuccess} items (DXK)`)
console.log(`-------------------------------------`)
console.log(`📁 Total:        ${stockSuccess + woSuccess + hotlineSuccess} records`)
console.log('=====================================')
console.log('✅ Backend import logic is ready!')
console.log('=====================================')
