import { prisma } from '../config/db.js'
import { clampLimit, clampPage } from '../utils/pagination.js'
import { periksaNomor, ALASAN_NOMOR } from '../utils/phone.js'
import xlsx from 'xlsx'

function applySearch(rows, search) {
  if (!search) return rows
  const term = String(search).toLowerCase()
  return rows.filter((r) => r.name.toLowerCase().includes(term) || r.reference.toLowerCase().includes(term))
}

function buildSummary(rows) {
  const by_reason = {}
  for (const key of Object.keys(ALASAN_NOMOR)) by_reason[key] = 0
  for (const r of rows) {
    if (by_reason[r.alasan] === undefined) by_reason[r.alasan] = 0
    by_reason[r.alasan] += 1
  }
  return { total_invalid: rows.length, by_reason }
}

async function loadInvalidCustomerRows() {
  const rows = await prisma.customers.findMany({
    where: { branch_code: 'DXK' },
    select: { id: true, customer_name: true, customer_mobile: true, so_number: true },
    orderBy: { so_date: 'desc' },
  })
  return rows
    .map((r) => {
      const cek = periksaNomor(r.customer_mobile)
      return {
        id: r.id,
        name: r.customer_name || '',
        reference: r.so_number,
        raw_phone: r.customer_mobile || '',
        alasan: cek.alasan,
        valid: cek.valid,
      }
    })
    .filter((r) => !r.valid)
}

async function loadInvalidHandoverRows() {
  const rows = await prisma.document_handovers.findMany({
    select: { id: true, consumer_name: true, consumer_phone: true, engine_number: true, document_type: true },
    orderBy: { created_at: 'desc' },
  })
  return rows
    .map((r) => {
      const cek = periksaNomor(r.consumer_phone)
      return {
        id: r.id,
        name: r.consumer_name || '',
        reference: `${r.engine_number} (${r.document_type})`,
        raw_phone: r.consumer_phone || '',
        alasan: cek.alasan,
        valid: cek.valid,
      }
    })
    .filter((r) => !r.valid)
}

async function loadInvalidRows(source) {
  return source === 'handovers' ? loadInvalidHandoverRows() : loadInvalidCustomerRows()
}

export async function getInvalidPhones(req, res, next) {
  try {
    const source = req.query.source === 'handovers' ? 'handovers' : 'customers'
    const page = clampPage(req.query.page)
    const limit = clampLimit(req.query.limit, 50)

    const invalidRows = await loadInvalidRows(source)
    const filtered = applySearch(invalidRows, req.query.search)
    const summary = buildSummary(filtered)

    const skip = (page - 1) * limit
    const data = filtered.slice(skip, skip + limit)

    res.json({
      data,
      summary,
      pagination: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
    })
  } catch (error) {
    next(error)
  }
}

export async function exportInvalidPhonesExcel(req, res, next) {
  try {
    const source = req.query.source === 'handovers' ? 'handovers' : 'customers'
    const invalidRows = applySearch(await loadInvalidRows(source), req.query.search)

    const sheetData = invalidRows.map((r, i) => ({
      No: i + 1,
      Nama: r.name,
      Referensi: r.reference,
      'Nomor Asli': r.raw_phone,
      'Alasan Tidak Valid': ALASAN_NOMOR[r.alasan] || r.alasan,
    }))

    const ws = xlsx.utils.json_to_sheet(sheetData)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Nomor Tidak Valid')
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const today = new Date().toISOString().split('T')[0]
    const filename = `Validasi_Nomor_HP_${source}_${today}.xlsx`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    next(error)
  }
}
