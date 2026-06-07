import { prisma } from '../config/db.js'

/**
 * GET /showroom/label-buku-service
 * Query params:
 *   - date: YYYY-MM-DD (default: hari ini)
 *
 * Response: daftar transaksi penjualan harian untuk cetak label buku service.
 */
export async function getServiceBookLabels(req, res, next) {
  try {
    const dateParam = req.query.date
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    // Set from = 00:00:00, to = 23:59:59.999
    const from = new Date(targetDate)
    from.setHours(0, 0, 0, 0)
    const to = new Date(targetDate)
    to.setHours(23, 59, 59, 999)

    const records = await prisma.customers.findMany({
      where: {
        branch_code: 'DXK',
        so_date: { gte: from, lte: to },
      },
      orderBy: { so_number: 'asc' },
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
        sales_type: true,
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
        sales_type: r.sales_type || '-',
      }
    })

    res.json({
      date: targetDate.toISOString().split('T')[0],
      count: items.length,
      items,
    })
  } catch (error) {
    next(error)
  }
}
