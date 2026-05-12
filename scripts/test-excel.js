import xlsx from 'xlsx'
import fs from 'fs'

const files = {
  hotline: '/Users/lukma4n/Documents/Projek_Bengkel/Laporan Part Hotline 2026-05-01 08_19_47.xlsx',
  stock: '/Users/lukma4n/Documents/Projek_Bengkel/Report Stock Sparepart 2026-05-01 15_20_59.xlsx',
  workshop: '/Users/lukma4n/Documents/Projek_Bengkel/Report Workshop 2026-05-01 15_24_35.xlsx',
}

function testFile(name, filepath, expectedHeaders, headerRowIndex) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📄 Testing: ${name}`)
  console.log(`${'='.repeat(60)}`)
  
  if (!fs.existsSync(filepath)) {
    console.log(`❌ File tidak ditemukan: ${filepath}`)
    return
  }

  const workbook = xlsx.readFile(filepath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 })
  
  console.log(`✅ File ditemukan`)
  console.log(`📊 Total rows: ${data.length}`)
  console.log(`📋 Sheet name: ${workbook.SheetNames[0]}`)
  
  // Check headers
  const headers = data[headerRowIndex] || []
  console.log(`\n📝 Headers (row ${headerRowIndex + 1}):`)
  headers.forEach((h, i) => {
    const expected = expectedHeaders[i]
    const match = h === expected ? '✅' : '⚠️'
    console.log(`  ${match} [${String.fromCharCode(65 + i)}] ${h} ${expected ? `(expected: ${expected})` : ''}`)
  })
  
  // Check sample data rows
  const sampleRows = data.slice(headerRowIndex + 1, headerRowIndex + 4)
  console.log(`\n📋 Sample Data (first 3 rows):`)
  sampleRows.forEach((row, idx) => {
    console.log(`  Row ${headerRowIndex + idx + 2}:`, row.slice(0, 5).join(' | '))
  })
  
  // Count DXK rows for workshop and hotline
  if (name === 'Workshop' || name === 'Hotline') {
    let dxkCount = 0
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i]
      if (row[1] === 'DXK') dxkCount++
    }
    console.log(`\n🏢 Total rows with branch_code = 'DXK': ${dxkCount}`)
  }
  
  // Specific validations
  if (name === 'Stock') {
    const agingCol = 7 // H column
    const sampleAging = data[headerRowIndex + 1]?.[agingCol]
    console.log(`\n🕐 Sample Aging format: "${sampleAging}"`)
    const daysMatch = sampleAging?.match(/(\d+)\s+days/)
    if (daysMatch) {
      console.log(`✅ Parsed aging days: ${daysMatch[1]}`)
    }
  }
  
  if (name === 'Workshop') {
    const dateCol = 5 // F column
    const sampleDate = data[headerRowIndex + 1]?.[dateCol]
    console.log(`\n📅 Sample Date Confirm (raw): "${sampleDate}"`)
    if (typeof sampleDate === 'number') {
      const epoch = new Date(1899, 11, 30)
      const parsed = new Date(epoch.getTime() + sampleDate * 24 * 60 * 60 * 1000)
      console.log(`✅ Parsed date: ${parsed.toISOString().split('T')[0]}`)
    }
    
    // Check unique states
    const states = new Set()
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      states.add(data[i][4])
    }
    console.log(`\n📊 Unique states: ${Array.from(states).join(', ')}`)
    
    // Check unique types
    const types = new Set()
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      types.add(data[i][6])
    }
    console.log(`📊 Unique types: ${Array.from(types).join(', ')}`)
  }
  
  console.log(`\n✅ ${name} test completed`)
}

// Expected headers according to our backend mapping
const hotlineHeaders = [
  'No', 'Code', 'Cabang', 'No Hotline', 'Tgl Hotline', 'No Engine', 'No Chassis', 
  'No Polisi', 'Customer', 'Pembawa', 'No Telp', 'Jenis PO', 'Qty Hotline', 
  'Qty Available', 'Amount Hotline', 'Qty PO', 'Qty WO', 'Total DP', 'Sisa DP', 
  'Tgl PO MD', 'State'
]

const stockHeaders = [
  'No', 'Branch Code', 'Branch Name', 'Profit Center', 'Kategori', 'Kode Product', 
  'Nama Barang', 'Aging', 'Lokasi', 'Movement Aging', 'Quantity Titipan', 
  'Amount Titipan', 'Qty RFA / Approved', 'Amount RFA / Approved', 
  'Quantity Reserved', 'Amount Reserved', 'Harga Satuan', 'Quantity Available', 
  'Amount Available', 'Total Stock (Qty)', 'Total Stock (Amt)', 'Rangking part'
]

const workshopHeaders = [
  'No', 'Branch Code', 'Branch Name', 'Workshop Number', 'State', 'Date Confirm', 
  'Type', 'Main Dealer', 'Login', 'Mechanic', 'No Polisi', 'Customer Code', 
  'Customer Name', 'Customer Mobile', 'Unit Name', 'Engine Number', 'Cassis Number', 
  'Workshop Category', 'Category Name', 'Product Name', 'Product Code', 'Quantity', 
  'HET', 'Discount', 'Discount Amount', 'DPP', 'PPN', 'Hpp', 'GP Total', 'Total', 
  'Total (dengan diskon)', 'Status ID Pajak', 'Nilai Penyisihan', 'Faktur Pajak', 
  'Alamat Konsumen', 'Nomor Batal', 'Alasan Batal', 'Tanggal Batal', 
  'Tanggal Confirm Batal', 'Kecamatan', 'Ring', 'Pembawa', 'No KTP', 'NPWP', 
  'Alasan Ke Ahass', 'Dealer Sendiri', 'Tahun Perakitan', 'Create Date', 'Km', 
  'No Service Advisor', 'Cuci', 'Amount Voucher'
]

console.log('🧪 DXK SYSTEM - EXCEL IMPORT TEST')
console.log('=====================================\n')

testFile('Hotline', files.hotline, hotlineHeaders, 3) // Header row 4 (0-indexed: 3)
testFile('Stock', files.stock, stockHeaders, 4) // Header row 5 (0-indexed: 4)
testFile('Workshop', files.workshop, workshopHeaders, 4) // Header row 5 (0-indexed: 4)

console.log('\n' + '='.repeat(60))
console.log('🎉 ALL TESTS COMPLETED')
console.log('='.repeat(60))
