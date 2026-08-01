import { prisma } from '../config/db.js'

/**
 * Parse 'YYYY-MM-DD' jadi Date tengah malam waktu lokal.
 * Sengaja tidak memakai new Date(str) — string itu dibaca sebagai UTC dan
 * bisa menggeser tanggal satu hari bagi pengguna WIB.
 */
function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

/**
 * GET /showroom/label-buku-service
 * Query params:
 *   - date_from, date_to: YYYY-MM-DD (default: hari ini)
 *   - date: bentuk lama, artinya from = to (tetap didukung)
 *
 * Response: daftar transaksi penjualan untuk cetak label buku service,
 * lengkap dengan status cetak. Filter yang didukung: SCO & Salesman —
 * keduanya tercatat langsung di report penjualan, tanpa perlu join tebakan
 * ke master data seperti Team Leader.
 */
export async function getServiceBookLabels(req, res, next) {
  try {
    const today = new Date()
    const legacy = req.query.date ? parseLocalDate(req.query.date) : null
    if (req.query.date && !legacy) throw badRequest('Format tanggal tidak valid (pakai YYYY-MM-DD)')

    let fromDate = legacy
    let toDate = legacy

    if (!legacy) {
      fromDate = req.query.date_from ? parseLocalDate(req.query.date_from) : today
      if (!fromDate) throw badRequest('Format date_from tidak valid (pakai YYYY-MM-DD)')
      toDate = req.query.date_to ? parseLocalDate(req.query.date_to) : fromDate
      if (!toDate) throw badRequest('Format date_to tidak valid (pakai YYYY-MM-DD)')
    }

    const from = new Date(fromDate)
    from.setHours(0, 0, 0, 0)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)

    if (from > to) throw badRequest('Tanggal "dari" tidak boleh melewati tanggal "sampai"')

    const records = await prisma.customers.findMany({
      where: {
        branch_code: 'DXK',
        so_date: { gte: from, lte: to },
      },
      orderBy: [{ so_date: 'asc' }, { so_number: 'asc' }],
      select: {
        id: true,
        so_number: true,
        so_date: true,
        customer_name: true,
        no_engine: true,
        no_frame: true,
        type: true,
        color: true,
        model: true,
        kecamatan: true,
        kabupaten: true,
        salesman: true,
        sales_coord_name: true,
        sales_type: true,
        label_printed_at: true,
        label_printed_user: { select: { name: true } },
      },
    })

    const items = records.map((r, i) => {
      const alamatParts = [r.kecamatan, r.kabupaten].filter(Boolean)
      const alamat = alamatParts.length > 0 ? alamatParts.join(', ').toUpperCase() : '-'

      return {
        no: i + 1,
        so_number: r.so_number,
        so_date: r.so_date ? new Date(r.so_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-',
        customer_name: r.customer_name || '-',
        no_engine: r.no_engine || '-',
        no_frame: r.no_frame || '-',
        type: r.type || '-',
        color: r.color || '-',
        model: r.model || '-',
        alamat,
        salesman: r.salesman || '-',
        sales_coord_name: r.sales_coord_name || '-',
        sales_type: r.sales_type || '-',
        printed_at: r.label_printed_at,
        printed_by_name: r.label_printed_user?.name || null,
      }
    })

    res.json({
      date_from: formatLocalDate(from),
      date_to: formatLocalDate(to),
      count: items.length,
      items,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /showroom/label-buku-service/print-status
 * Body: { so_numbers: string[], printed: boolean }
 *
 * Menandai atau membatalkan tanda "sudah dicetak". Penandaan dilakukan setelah
 * jendela cetak dibuka — browser tidak memberi tahu apakah kertas benar-benar
 * keluar, sehingga pembatalan harus tersedia.
 */
export async function updateLabelPrintStatus(req, res, next) {
  try {
    const { so_numbers: soNumbers, printed } = req.body || {}

    if (!Array.isArray(soNumbers) || soNumbers.length === 0) {
      throw badRequest('so_numbers wajib diisi (array nomor SO)')
    }
    if (typeof printed !== 'boolean') {
      throw badRequest('printed wajib bernilai true atau false')
    }

    const cleaned = [...new Set(soNumbers.map((s) => String(s ?? '').trim()).filter(Boolean))]
    if (cleaned.length === 0) throw badRequest('so_numbers tidak berisi nomor SO yang valid')

    const result = await prisma.customers.updateMany({
      where: { so_number: { in: cleaned }, branch_code: 'DXK' },
      data: printed
        ? { label_printed_at: new Date(), label_printed_by: req.user.userId }
        : { label_printed_at: null, label_printed_by: null },
    })

    res.json({ updated: result.count })
  } catch (error) {
    next(error)
  }
}
