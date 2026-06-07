import xlsx from 'xlsx'

function parseAgingDays(agingStr) {
  if (!agingStr) return 0
  const match = String(agingStr).match(/(\d+)\s+days/)
  return match ? parseInt(match[1]) : 0
}

export function excelDateToJSDate(serial) {
  if (serial === null || serial === undefined) return null
  if (isNaN(serial)) return new Date(serial)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
}

function isValidDate(date) {
  return date instanceof Date && !isNaN(date)
}

function readRows(filePath) {
  const workbook = xlsx.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return xlsx.utils.sheet_to_json(sheet, { header: 1 })
}

function preview(module, records, errors, extra = {}) {
  return {
    module,
    validRows: records.length,
    errorRows: errors.length,
    sample: records.slice(0, 5),
    errorDetails: errors.slice(0, 10),
    ...extra,
  }
}

function dateOnly(date) {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

function summarizeWorkshopYearToDate(records) {
  const dates = records.map((record) => record.date_confirm).filter(isValidDate)
  const byState = {}
  for (const record of records) {
    byState[record.state] = (byState[record.state] || 0) + 1
  }

  if (dates.length === 0) {
    return {
      importMode: 'workshop_year_to_date_snapshot',
      dateRange: { min: null, max: null },
      byState,
      warnings: ['File workshop tidak memiliki tanggal confirm valid untuk validasi rentang tahun berjalan.'],
    }
  }

  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())))
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())))
  const now = new Date()
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const warnings = []

  if (minDate.getUTCFullYear() !== now.getUTCFullYear() || minDate.getTime() > startOfYear.getTime() + 7 * 24 * 60 * 60 * 1000) {
    warnings.push('Tanggal WO paling awal bukan awal tahun berjalan. Pastikan file ditarik dari 1 Januari sampai hari ini.')
  }
  if (maxDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    warnings.push('Tanggal WO paling akhir berada di masa depan. Periksa kembali filter tanggal file.')
  }
  if ((maxDate.getTime() - minDate.getTime()) <= 3 * 24 * 60 * 60 * 1000 && records.length > 0) {
    warnings.push('Rentang tanggal file terlihat sangat pendek. File mungkin hanya harian, bukan year-to-date.')
  }

  return {
    importMode: 'workshop_year_to_date_snapshot',
    dateRange: { min: dateOnly(minDate), max: dateOnly(maxDate) },
    byState,
    warnings,
  }
}

export function parseHotlineFile(filePath) {
  const rows = readRows(filePath).slice(3)
  const validRecords = []
  const errors = []

  for (const row of rows) {
    if (!row || !row[3]) continue

    try {
      const branchCode = row[1]
      if (branchCode !== 'DXK') continue

      const tglHotline = excelDateToJSDate(row[4])
      if (!isValidDate(tglHotline)) {
        errors.push({ row: row[0], error: `Invalid date: ${row[4]}` })
        continue
      }

      validRecords.push({
        no_hotline: row[3],
        branch_code: row[1],
        branch_name: row[2],
        tgl_hotline: tglHotline,
        no_engine: row[5] || null,
        no_chassis: row[6] || null,
        no_polisi: row[7] || null,
        customer: row[8],
        pembawa: row[9] || null,
        no_telp: String(row[10] || ''),
        jenis_po: row[11],
        qty_hotline: parseInt(row[12]) || 0,
        qty_available: parseInt(row[13]) || 0,
        amount_hotline: parseInt(row[14]) || 0,
        qty_po: parseInt(row[15]) || 0,
        qty_wo: parseInt(row[16]) || 0,
        total_dp: parseInt(row[17]) || 0,
        sisa_dp: parseInt(row[18]) || 0,
        tgl_po_md: row[19] ? excelDateToJSDate(row[19]) : null,
        state: row[20] || 'Waiting_For_Approval',
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  return { records: validRecords, errors, preview: preview('hotline', validRecords, errors) }
}

const SPAREPART_LOCATION_MAP = {
  'Physical Locations / DXK / Stock': 'Gudang Bengkel',
  'Physical Locations / DXK / Stock / DXK-POSSV02 POS Service Sandai': 'Gudang Bengkel Sandai',
  'Physical Locations / DXK / Stock / DXK-CVSSV01 Service Kunjung Ketapang 01': 'Service Kunjung Bengkel',
  'Lokasi': null,
}

function normalizeSparepartLocation(value) {
  const trimmed = value ? String(value).trim() : null
  if (SPAREPART_LOCATION_MAP.hasOwnProperty(trimmed)) return SPAREPART_LOCATION_MAP[trimmed]
  return trimmed
}

export function parseStockFile(filePath) {
  const rows = readRows(filePath).slice(4)
  const aggregated = new Map()
  const errors = []

  for (const row of rows) {
    if (!row || !row[5]) continue

    try {
      const agingDays = parseAgingDays(row[7])
      const movementDays = parseAgingDays(row[9])
      const productCode = row[5]
      // Skip header rows (contain strings like 'Kode Product', 'Nama Barang', etc.)
      if (typeof productCode === 'string' && /product|kode|kategori|lokasi/i.test(productCode)) continue
      const rawLocation = row[8]
      const location = normalizeSparepartLocation(rawLocation) || 'Tidak Ditentukan'

      // Init aggregate per product
      if (!aggregated.has(productCode)) {
        aggregated.set(productCode, {
          aggregate: {
            branch_code: row[1],
            branch_name: row[2],
            profit_center: parseInt(row[3]) || 0,
            kategori: row[4],
            product_code: productCode,
            product_name: row[6],
            aging_raw: row[7],
            aging_days: agingDays,
            lokasi: new Set(location !== 'Tidak Ditentukan' ? [location] : []),
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
          locations: new Map(),
        })
      } else {
        const existing = aggregated.get(productCode)
        const a = existing.aggregate
        a.qty_titipan += parseFloat(row[10]) || 0
        a.amount_titipan += parseFloat(row[11]) || 0
        a.qty_rfa += parseFloat(row[12]) || 0
        a.amount_rfa += parseFloat(row[13]) || 0
        a.qty_reserved += parseFloat(row[14]) || 0
        a.amount_reserved += parseFloat(row[15]) || 0
        a.qty_available += parseFloat(row[17]) || 0
        a.amount_available += parseFloat(row[18]) || 0
        a.total_stock_qty += parseFloat(row[19]) || 0
        a.total_stock_amt += parseFloat(row[20]) || 0
        if (location !== 'Tidak Ditentukan') a.lokasi.add(location)
        if (agingDays > a.aging_days) a.aging_days = agingDays
        if (movementDays > a.movement_aging_days) a.movement_aging_days = movementDays
      }

      const entry = aggregated.get(productCode)
      // Aggregate per location
      if (!entry.locations.has(location)) {
        entry.locations.set(location, {
          product_code: productCode,
          product_name: row[6] || '',
          kategori: row[4] || '',
          location,
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
          aging_days: agingDays,
          ranking: row[21],
        })
      } else {
        const loc = entry.locations.get(location)
        loc.qty_titipan += parseFloat(row[10]) || 0
        loc.amount_titipan += parseFloat(row[11]) || 0
        loc.qty_rfa += parseFloat(row[12]) || 0
        loc.amount_rfa += parseFloat(row[13]) || 0
        loc.qty_reserved += parseFloat(row[14]) || 0
        loc.amount_reserved += parseFloat(row[15]) || 0
        loc.qty_available += parseFloat(row[17]) || 0
        loc.amount_available += parseFloat(row[18]) || 0
        loc.total_stock_qty += parseFloat(row[19]) || 0
        loc.total_stock_amt += parseFloat(row[20]) || 0
        if (agingDays > loc.aging_days) loc.aging_days = agingDays
      }
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  const records = Array.from(aggregated.values()).map((item) => ({
    branch_code: item.aggregate.branch_code,
    branch_name: item.aggregate.branch_name,
    profit_center: item.aggregate.profit_center,
    kategori: item.aggregate.kategori,
    product_code: item.aggregate.product_code,
    product_name: item.aggregate.product_name,
    aging_raw: item.aggregate.aging_raw,
    aging_days: item.aggregate.aging_days,
    lokasi: Array.from(item.aggregate.lokasi).join(' | '),
    movement_aging_raw: item.aggregate.movement_aging_raw,
    movement_aging_days: item.aggregate.movement_aging_days,
    qty_titipan: item.aggregate.qty_titipan,
    amount_titipan: item.aggregate.amount_titipan,
    qty_rfa: item.aggregate.qty_rfa,
    amount_rfa: item.aggregate.amount_rfa,
    qty_reserved: item.aggregate.qty_reserved,
    amount_reserved: item.aggregate.amount_reserved,
    harga_satuan: item.aggregate.harga_satuan,
    qty_available: item.aggregate.qty_available,
    amount_available: item.aggregate.amount_available,
    total_stock_qty: item.aggregate.total_stock_qty,
    total_stock_amt: item.aggregate.total_stock_amt,
    ranking: item.aggregate.ranking,
    synced_at: new Date(),
  }))

  const locationRecords = Array.from(aggregated.values()).flatMap((item) =>
    Array.from(item.locations.values()).map((loc) => ({
      ...loc,
      synced_at: new Date(),
    }))
  )

  return {
    records,
    locationRecords,
    errors,
    preview: preview('stock', records, errors, { duplicateProductRows: rows.length - records.length }),
  }
}

export function parseWorkshopFile(filePath) {
  const rows = readRows(filePath).slice(4)
  const parsedRecords = new Map()
  const errors = []

  for (const row of rows) {
    if (!row || !row[3]) continue
    if (!row[4] || row[4] === 'State') continue
    if (!row[6] || row[6] === 'Type') continue

    try {
      if (row[1] !== 'DXK') continue

      const dateConfirm = excelDateToJSDate(row[5])
      if (!isValidDate(dateConfirm) && row[5]) {
        errors.push({ row: row[0], error: `Invalid date: ${row[5]}` })
        continue
      }

      const state = row[4]?.toString().trim()
      const type = row[6]?.toString().trim()
      if (!state || !type) continue

      parsedRecords.set(row[3], {
        wo_number: row[3],
        branch_code: row[1],
        branch_name: row[2],
        state,
        date_confirm: dateConfirm,
        type,
        main_dealer: row[7] || null,
        login: row[8] || null,
        mechanic: row[9] || null,
        no_polisi: row[10] || null,
        customer_code: row[11] || null,
        customer_name: row[12] || null,
        customer_mobile: row[13] ? String(row[13]) : null,
        unit_name: row[14] || null,
        engine_number: row[15] || null,
        cassis_number: row[16] || null,
        workshop_category: row[17] || null,
        category_name: row[18] || null,
        product_name: row[19] || null,
        product_code: row[20] || null,
        quantity: parseFloat(row[21]) || 0,
        het: parseFloat(row[22]) || 0,
        discount: parseFloat(row[23]) || 0,
        discount_amount: parseFloat(row[24]) || 0,
        dpp: parseFloat(row[25]) || 0,
        ppn: parseFloat(row[26]) || 0,
        hpp: parseFloat(row[27]) || 0,
        gp_total: parseFloat(row[28]) || 0,
        total: parseFloat(row[29]) || 0,
        total_dengan_diskon: parseFloat(row[30]) || 0,
        status_id_pajak: row[31] || null,
        nilai_penyisihan: parseFloat(row[32]) || 0,
        faktur_pajak: row[33] || null,
        alamat_konsumen: row[34] || null,
        nomor_batal: row[35] || null,
        alasan_batal: row[36] || null,
        tanggal_batal: row[37] ? excelDateToJSDate(row[37]) : null,
        tanggal_confirm_batal: row[38] ? excelDateToJSDate(row[38]) : null,
        kecamatan: row[39] || null,
        ring: parseInt(row[40]) || 0,
        pembawa: row[41] || null,
        no_ktp: row[42] || null,
        npwp: row[43] || null,
        alasan_ke_ahass: row[44] || null,
        dealer_sendiri: row[45] || null,
        tahun_perakitan: parseInt(row[46]) || 0,
        create_date: row[47] ? excelDateToJSDate(row[47]) : null,
        km: parseInt(row[48]) || 0,
        amount_voucher: parseFloat(row[49]) || 0,
        cuci: row[50] || null,
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  const records = Array.from(parsedRecords.values())
  return {
    records,
    errors,
    preview: preview('workshop', records, errors, {
      dedupedWoRows: rows.length - records.length,
      ...summarizeWorkshopYearToDate(records),
    }),
  }
}

export function parseSalesFile(filePath) {
  const rows = readRows(filePath).slice(6)
  const records = []
  const errors = []
  const seenSONumbers = new Set()

  for (const row of rows) {
    if (!row[0]) continue
    if (row[1] !== 'DXK') continue
    if (!row[4]) continue

    try {
      const soNumber = String(row[4]).trim()
      if (seenSONumbers.has(soNumber)) continue
      seenSONumbers.add(soNumber)

      const kabupatenNama = String(row[55] || '').trim()
      const kecamatanNama = String(row[57] || '').trim()
      const alamatParts = [kecamatanNama, kabupatenNama].filter(Boolean)

      records.push({
        so_number: soNumber,
        state: String(row[5] || 'aktif'),
        so_date: row[6] && typeof row[6] === 'number' ? excelDateToJSDate(row[6]) : null,
        sales_type: String(row[7] || ''),
        payment_type: String(row[8] || ''),
        salesman: String(row[12] || ''),
        sales_coord_name: String(row[9] || ''),
        customer_name: String(row[15] || '').trim(),
        product_code: String(row[16] || ''),
        color: String(row[17] || ''),
        no_engine: String(row[19] || ''),
        no_frame: String(row[20] || ''),
        category: String(row[49] || ''),
        type: String(row[50] || ''),
        model: String(row[51] || ''),
        kabupaten: kabupatenNama,
        kecamatan: kecamatanNama,
        kelurahan: '',
        alamat_konsumen: alamatParts.length > 0 ? alamatParts.join(', ') : '',
        customer_mobile: String(row[67] || ''),
        tenor: String(row[68] || ''),
        no_ktp: String(row[78] || ''),
        leasing: String(row[80] || ''),
        dp: parseFloat(row[84]) || parseFloat(row[85]) || 0,
        harga_otr: parseFloat(row[86]) || 0,
        branch_code: 'DXK',
        synced_at: new Date(),
      })
    } catch (err) {
      errors.push({ row: row[0], error: err.message })
    }
  }

  return { records, errors, preview: preview('sales', records, errors, { dedupedSoRows: rows.length - records.length }) }
}

export function parseImportFile(module, filePath) {
  switch (module) {
    case 'hotline':
      return parseHotlineFile(filePath)
    case 'stock':
      return parseStockFile(filePath)
    case 'workshop':
      return parseWorkshopFile(filePath)
    case 'sales':
      return parseSalesFile(filePath)
    default:
      throw new Error('Modul import tidak dikenal')
  }
}
