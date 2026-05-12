import { prisma } from '../config/db.js'
import { delCache } from '../config/redis.js'

export async function getHotlines(req, res, next) {
  try {
    const { page = 1, limit = 50, state, jenis_po, search } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    
    if (state && state !== 'all') {
      where.state = state
    }
    
    if (jenis_po && jenis_po !== 'all') {
      where.jenis_po = jenis_po
    }
    
    if (search) {
      where.OR = [
        { no_hotline: { contains: search } },
        { customer: { contains: search } },
      ]
    }

    const [hotlines, total] = await Promise.all([
      prisma.hotlines.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { tgl_hotline: 'desc' },
      }),
      prisma.hotlines.count({ where }),
    ])

    res.json({
      data: hotlines,
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

export async function getHotlineById(req, res, next) {
  try {
    const { id } = req.params
    
    const hotline = await prisma.hotlines.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    })

    if (!hotline) {
      return res.status(404).json({ error: 'Hotline tidak ditemukan' })
    }

    res.json({ data: hotline })
  } catch (error) {
    next(error)
  }
}

export async function updateState(req, res, next) {
  try {
    const { id } = req.params
    const { state } = req.body
    const userId = req.user.userId

    const validStates = ['Done', 'Approved', 'Waiting_For_Approval', 'Cancel']
    if (!validStates.includes(state)) {
      return res.status(400).json({ error: 'State tidak valid' })
    }

    const existing = await prisma.hotlines.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Hotline tidak ditemukan' })
    }

    const oldState = existing.state

    const hotline = await prisma.hotlines.update({
      where: { id: parseInt(id) },
      data: {
        state,
        state_updated_at: new Date(),
        state_updated_by: userId,
      },
    })

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        table_name: 'hotlines',
        record_id: String(id),
        field_name: 'state',
        old_value: oldState,
        new_value: state,
        user_id: userId,
      },
    })

    // Invalidate cache
    await delCache('dashboard:summary')
    await delCache('hotlines:*')

    res.json({ 
      message: 'State berhasil diupdate',
      data: hotline,
    })
  } catch (error) {
    next(error)
  }
}
