import xlsx from 'xlsx'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function parseAgingDays(agingStr) {
  if (!agingStr) return 0
  const match = agingStr.match(/(\d+)\s+days/)
  return match ? parseInt(match[1]) : 0
}

function excelDateToJSDate(serial) {
  const excelEpoch = new Date(1899, 11, 30)
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
}

async function importStock() {
  console.log('📦 Importing Stock...')
  const file = '/Users/lukma4n/Documents/Projek_Bengkel/Report Stock Sparepart 2026-05-01 15_20_59.xlsx'
  const wb = xlsx.readFile(file)
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  
  let count = 0
  for (const row of data.slice(4)) {
    if (!row[5]) continue
    
    const agingDays = parseAgingDays(row[7])
    const movementDays = parseAgingDays(row[9])
    
    await prisma.stock_parts.upsert({
      where: { product_code: row[5] },
      update: {
        branch_code: row[1],
        branch_name: row[2],
        profit_center: parseInt(row[3]) || 0,
        kategori: row[4],
        product_name: row[6],
        aging_raw: row[7],
        aging_days: agingDays,
        lokasi: row[8],
        movement_aging_raw: row[9],
        movement_aging_days: movementDays,
        qty_titipan: parseFloat(row[10]) || 0,
        amount_titipan: parseFloat(row[11]) || 0,
        qty_rfa: parseFloat(row[12]) || 0,
        amount_rfa: parseFloat(row[13]) || 0,
        qty_reserved: parseFloat(row[14]) || 0,
        amount_reserved: parseFloat(row[15]) || 0,
        harga_satuan: parseFloat(row[16]) || 0,
        qty_available: parseFloat(row[17]) || 0,
        amount_available: parseFloat(row[18]) || 0,
        total_stock_qty: parseFloat(row[19]) || 0,
        total_stock_amt: parseFloat(row[20]) || 0,
        ranking: row[21],
        synced_at: new Date(),
      },
      create: {
        branch_code: row[1],
        branch_name: row[2],
        profit_center: parseInt(row[3]) || 0,
        kategori: row[4],
        product_code: row[5],
        product_name: row[6],
        aging_raw: row[7],
        aging_days: agingDays,
        lokasi: row[8],
        movement_aging_raw: row[9],
        movement_aging_days: movementDays,
        qty_titipan: parseFloat(row[10]) || 0,
        amount_titipan: parseFloat(row[11]) || 0,
        qty_rfa: parseFloat(row[12]) || 0,
        amount_rfa: parseFloat(row[13]) || 0,
        qty_reserved: parseFloat(row[14]) || 0,
        amount_reserved: parseFloat(row[15]) || 0,
        harga_satuan: parseFloat(row[16]) || 0,
        qty_available: parseFloat(row[17]) || 0,
        amount_available: parseFloat(row[18]) || 0,
        total_stock_qty: parseFloat(row[19]) || 0,
        total_stock_amt: parseFloat(row[20]) || 0,
        ranking: row[21],
      },
    })
    count++
    if (count % 50 === 0) process.stdout.write(`\r  ${count} parts imported...`)
  }
  console.log(`\r  ✅ ${count} stock parts imported`)
}

async function importWorkshop() {
  console.log('🔧 Importing Workshop...')
  const file = '/Users/lukma4n/Documents/Projek_Bengkel/Report Workshop 2026-05-01 15_24_35.xlsx'
  const wb = xlsx.readFile(file)
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  
  let count = 0
  for (const row of data.slice(4)) {
    if (!row[3]) continue
    if (!row[4] || !row[4].toString().trim() || row[4] === 'State') continue
    if (!row[6] || !row[6].toString().trim() || row[6] === 'Type') continue
    if (row[1] !== 'DXK') continue
    
    const dateConfirm = typeof row[5] === 'number' 
      ? excelDateToJSDate(row[5]) 
      : row[5] ? new Date(row[5]) : null
    
    const state = row[4].toString().trim()
    const type = row[6].toString().trim()
    
    await prisma.work_orders.upsert({
      where: { wo_number: row[3] },
      update: {
        branch_code: row[1],
        branch_name: row[2],
        state,
        date_confirm: dateConfirm,
        type,
        mechanic: row[9],
        no_polisi: row[10],
        customer_code: row[11],
        customer_name: row[12],
        customer_mobile: row[13] ? String(row[13]) : null,
        unit_name: row[14],
        product_name: row[19],
        total: parseFloat(row[29]) || 0,
        alasan_batal: row[36],
        synced_at: new Date(),
      },
      create: {
        wo_number: row[3],
        branch_code: row[1],
        branch_name: row[2],
        state,
        date_confirm: dateConfirm,
        type,
        mechanic: row[9],
        no_polisi: row[10],
        customer_code: row[11],
        customer_name: row[12],
        customer_mobile: row[13] ? String(row[13]) : null,
        unit_name: row[14],
        product_name: row[19],
        total: parseFloat(row[29]) || 0,
        alasan_batal: row[36],
      },
    })
    count++
    if (count % 1000 === 0) process.stdout.write(`\r  ${count} WO imported...`)
  }
  console.log(`\r  ✅ ${count} work orders imported`)
}

async function importHotline() {
  console.log('📞 Importing Hotline...')
  const file = '/Users/lukma4n/Documents/Projek_Bengkel/Laporan Part Hotline 2026-05-01 09_45_07.xlsx'
  const wb = xlsx.readFile(file)
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  
  let count = 0
  for (const row of data.slice(3)) {
    if (!row[3]) continue
    if (row[1] !== 'DXK') continue
    
    await prisma.hotlines.upsert({
      where: { no_hotline: row[3] },
      update: {
        branch_code: row[1],
        branch_name: row[2],
        tgl_hotline: new Date(row[4]),
        no_engine: row[5],
        no_chassis: row[6],
        no_polisi: row[7],
        customer: row[8],
        pembawa: row[9],
        no_telp: String(row[10] || ''),
        jenis_po: row[11],
        state: row[20] || 'Waiting_For_Approval',
        synced_at: new Date(),
      },
      create: {
        no_hotline: row[3],
        branch_code: row[1],
        branch_name: row[2],
        tgl_hotline: new Date(row[4]),
        no_engine: row[5],
        no_chassis: row[6],
        no_polisi: row[7],
        customer: row[8],
        pembawa: row[9],
        no_telp: String(row[10] || ''),
        jenis_po: row[11],
        state: row[20] || 'Waiting_For_Approval',
      },
    })
    count++
  }
  console.log(`  ✅ ${count} hotlines imported`)
}

async function main() {
  console.log('🚀 DXK EXCEL IMPORT TO SQLITE')
  console.log('===============================\n')
  
  const startTime = Date.now()
  
  await importStock()
  await importWorkshop()
  await importHotline()
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  
  console.log('\n=============================')
  console.log('✅ IMPORT COMPLETE!')
  console.log(`⏱️  Time: ${elapsed}s`)
  console.log('=============================')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
