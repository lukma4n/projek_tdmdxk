import { prisma } from '../config/db.js'
import { clampLimit } from '../utils/pagination.js'

export async function getStock(req, res, next) {
  try {
    const { page = 1, limit = 50, kategori, ranking, lokasi, min_aging, max_aging, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}

    if (ranking && ranking !== 'all') {
      where.ranking = ranking
    }

    if (min_aging || max_aging) {
      where.aging_days = {}
      if (min_aging) where.aging_days.gte = parseInt(min_aging)
      if (max_aging) where.aging_days.lte = parseInt(max_aging)
    }

    if (lokasi && lokasi !== 'all') {
      where.location = lokasi
    }

    const [stock, total] = await Promise.all([
      prisma.stock_part_locations.findMany({
        where,
        skip,
        take: clampLimit(limit, 50),
        orderBy: { aging_days: 'desc' },
      }),
      prisma.stock_part_locations.count({ where }),
    ])

    let result = stock
    if (search) {
      result = result.filter((item) =>
        item.product_code.toLowerCase().includes(search.toLowerCase()) ||
        item.product_name.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (kategori && kategori !== 'all') {
      result = result.filter((item) => item.kategori === kategori)
    }

    res.json({
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getCategories(req, res, next) {
  try {
    const categories = await prisma.stock_part_locations.groupBy({
      by: ['kategori'],
      _count: { kategori: true },
      orderBy: { kategori: 'asc' },
    })

    res.json({ data: categories.map((c) => c.kategori) })
  } catch (error) {
    next(error)
  }
}

export async function getStockByCode(req, res, next) {
  try {
    const { code } = req.params
    const stock = await prisma.stock_parts.findUnique({
      where: { product_code: code },
      include: { locations: true },
    })
    if (!stock) return res.status(404).json({ error: 'Part tidak ditemukan' })
    res.json({ data: stock })
  } catch (error) {
    next(error)
  }
}

export async function getLocations(req, res, next) {
  try {
    const locations = await prisma.stock_part_locations.groupBy({
      by: ['location'],
      _sum: {
        qty_available: true,
        total_stock_qty: true,
        total_stock_amt: true,
      },
      _count: { product_code: true },
      orderBy: { location: 'asc' },
    })

    res.json({
      data: locations.map((l) => ({
        location: l.location,
        total_parts: l._count.product_code,
        total_qty_available: l._sum.qty_available || 0,
        total_stock_qty: l._sum.total_stock_qty || 0,
        total_stock_amt: l._sum.total_stock_amt || 0,
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function getStockByLocation(req, res, next) {
  try {
    const { location } = req.params
    const { page = 1, limit = 50, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = { location }
    if (search) {
      where.OR = [
        { product_code: { contains: search } },
      ]
    }

    const [stock, total] = await Promise.all([
      prisma.stock_part_locations.findMany({
        where,
        skip,
        take: clampLimit(limit, 50),
        orderBy: { qty_available: 'desc' },
        include: {
          part: { select: { product_name: true, kategori: true, lokasi: true } },
        },
      }),
      prisma.stock_part_locations.count({ where }),
    ])

    // Flatten supaya frontend tidak perlu ubah struktur tabel
    const flat = stock.map((s) => ({
      ...s,
      product_name: s.part?.product_name || '-',
      kategori: s.part?.kategori || '-',
      lokasi: s.location || s.part?.lokasi || '-',
    }))

    res.json({
      data: flat,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
}
