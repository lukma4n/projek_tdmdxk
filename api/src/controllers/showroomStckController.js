import { prisma } from '../config/db.js'

/**
 * Lookup data penjualan (tabel customers) untuk fitur Cetak STCK.
 * Petugas memilih unit berdasarkan no mesin → data konsumen terisi otomatis.
 *
 * Query: GET /showroom/stck/sales-lookup?period=today|yesterday|all&search=
 * - period today    : penjualan hari ini
 * - period yesterday: penjualan kemarin
 * - period all      : semua (tanpa filter tanggal)
 * - search          : cocokkan no mesin / no rangka / nama / no SO
 */
export async function getStckSalesLookup(req, res, next) {
  try {
    const { period = 'today', search } = req.query

    const where = { branch_code: 'DXK' }

    // Filter tanggal pakai midnight lokal (hindari toISOString — gotcha timezone)
    if (period === 'today' || period === 'yesterday') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (period === 'today') {
        where.so_date = { gte: today }
      } else {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        where.so_date = { gte: yesterday, lt: today }
      }
    }

    if (search && search.trim()) {
      const term = search.trim()
      where.OR = [
        { no_engine: { contains: term } },
        { no_frame: { contains: term } },
        { customer_name: { contains: term } },
        { so_number: { contains: term } },
      ]
    }

    const items = await prisma.customers.findMany({
      where,
      orderBy: { so_date: 'desc' },
      take: 100,
      select: {
        id: true,
        customer_name: true,
        alamat_konsumen: true,
        no_engine: true,
        no_frame: true,
        type: true,
        model: true,
        color: true,
        so_date: true,
        so_number: true,
      },
    })

    res.json({ items })
  } catch (err) {
    next(err)
  }
}
