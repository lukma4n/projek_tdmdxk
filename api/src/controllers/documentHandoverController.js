import { prisma } from '../config/db.js'

export async function getDocumentHandovers(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      document_type,
      status,
      salesman_name,
    } = req.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(parseInt(limit) || 50, 200)

    const where = {}
    if (document_type) where.document_type = document_type
    if (status) where.status = status

    if (req.user.role === 'Salesman') {
      if (search) {
        where.AND = [
          { salesman_name: req.user.name },
          { OR: [{ engine_number: { contains: search } }, { consumer_name: { contains: search } }] },
        ]
      } else {
        where.salesman_name = req.user.name
      }
    } else if (salesman_name) {
      where.salesman_name = salesman_name
      if (search) {
        where.OR = [
          { engine_number: { contains: search } },
          { consumer_name: { contains: search } },
          { salesman_name: { contains: search } },
        ]
      }
    } else if (search) {
      where.OR = [
        { engine_number: { contains: search } },
        { consumer_name: { contains: search } },
        { salesman_name: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.document_handovers.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          steps: {
            orderBy: { performed_at: 'desc' },
            take: 1,
            include: { performer: { select: { id: true, name: true } } },
          },
        },
        orderBy: { updated_at: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.document_handovers.count({ where }),
    ])

    // Batch-fetch track data to avoid N+1
    const engineNumbers = [...new Set(items.map((i) => i.engine_number).filter(Boolean))]
    const tracks = engineNumbers.length > 0
      ? await prisma.showroom_stnk_bpkb_tracks.findMany({
          where: { engine_number: { in: engineNumbers } },
          select: {
            engine_number: true,
            stnk_name: true,
            chassis_number: true,
            no_polisi: true,
            series: true,
            finance_company: true,
            mobile: true,
            no_stnk: true,
            no_bpkb: true,
          },
        })
      : []
    const trackMap = new Map(tracks.map((t) => [t.engine_number, t]))

    const enriched = items.map((item) => ({
      ...item,
      track: trackMap.get(item.engine_number) || null,
      last_step: item.steps[0] || null,
      steps: undefined,
    }))

    res.json({
      data: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getDocumentHandoverSummary(req, res, next) {
  try {
    const { document_type } = req.query

    const where = {}
    if (document_type) where.document_type = document_type
    if (req.user.role === 'Salesman') {
      where.salesman_name = req.user.name
    }

    const [byStatusRaw, byDocTypeRaw, completedThisMonth] = await Promise.all([
      prisma.document_handovers.groupBy({ by: ['status'], where, _count: true }),
      prisma.document_handovers.groupBy({ by: ['document_type'], where, _count: true }),
      prisma.document_handovers.count({
        where: {
          ...where,
          status: 'selesai',
          updated_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])

    const byStatus = Object.fromEntries(byStatusRaw.map((r) => [r.status, r._count]))
    const byDocType = Object.fromEntries(byDocTypeRaw.map((r) => [r.document_type, r._count]))
    const total = byStatusRaw.reduce((sum, r) => sum + r._count, 0)

    res.json({ total, byStatus, byDocType, completedThisMonth })
  } catch (err) {
    next(err)
  }
}

export async function getHandoverSalespeople(req, res, next) {
  try {
    const salespeople = await prisma.users.findMany({
      where: { role: 'Salesman' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    res.json(salespeople)
  } catch (err) {
    next(err)
  }
}

export async function getAvailableDocuments(req, res, next) {
  try {
    const { search, document_type } = req.query

    const trackWhere = { branch_code: 'DXK' }
    if (search) {
      trackWhere.OR = [
        { engine_number: { contains: search } },
        { stnk_name: { contains: search } },
        { partner_name: { contains: search } },
        { no_polisi: { contains: search } },
      ]
    }

    const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
      where: trackWhere,
      orderBy: { synced_at: 'desc' },
      take: 200,
    })

    if (tracks.length === 0) return res.json([])

    const engineNumbers = tracks.map((t) => t.engine_number)
    const existingHandovers = await prisma.document_handovers.findMany({
      where: { engine_number: { in: engineNumbers } },
      select: { engine_number: true, document_type: true },
    })
    const existingKeys = new Set(existingHandovers.map((h) => `${h.engine_number}:${h.document_type}`))
    const bukuServiceExists = new Set(
      existingHandovers.filter((h) => h.document_type === 'BUKU_SERVICE').map((h) => h.engine_number)
    )

    const available = []
    for (const track of tracks) {
      const types = []
      if (!document_type || document_type === 'STNK') {
        if (track.tgl_terima_stnk && !track.tgl_penyerahan_stnk) types.push('STNK')
      }
      if (!document_type || document_type === 'BPKB') {
        if (track.tgl_jadi_bpkb && !track.tgl_penyerahan_bpkb) types.push('BPKB')
      }
      if (!document_type || document_type === 'PLAT') {
        if (track.tgl_terima_plat && !track.tgl_penyerahan_plat) types.push('PLAT')
      }

      for (const docType of types) {
        if (!existingKeys.has(`${track.engine_number}:${docType}`)) {
          available.push({
            engine_number: track.engine_number,
            document_type: docType,
            stnk_name: track.stnk_name,
            partner_name: track.partner_name,
            chassis_number: track.chassis_number,
            no_polisi: track.no_polisi,
            series: track.series,
            finance_company: track.finance_company,
            mobile: track.mobile,
            // Track tidak menyimpan nama salesman (partner_name = leasing/finance).
            // Salesman dipilih manual oleh admin via daftar getHandoverSalespeople.
            salesman: null,
            no_stnk: track.no_stnk,
            no_bpkb: track.no_bpkb,
            buku_service_exists: bukuServiceExists.has(track.engine_number),
          })
        }
      }
    }

    res.json(available)
  } catch (err) {
    next(err)
  }
}

export async function createDocumentHandover(req, res, next) {
  try {
    const { engine_number, document_type, handover_mode, salesman_name, consumer_name, consumer_phone, notes, include_buku_service } = req.body

    if (!engine_number || !document_type) {
      return res.status(400).json({ error: 'engine_number dan document_type wajib diisi' })
    }

    const validTypes = ['STNK', 'BPKB', 'BUKU_SERVICE', 'PLAT']
    if (!validTypes.includes(document_type)) {
      return res.status(400).json({ error: `document_type harus salah satu dari: ${validTypes.join(', ')}` })
    }

    const handover = await prisma.document_handovers.create({
      data: {
        engine_number,
        document_type,
        handover_mode: handover_mode || 'langsung',
        status: 'tersedia',
        salesman_name: salesman_name || null,
        consumer_name: consumer_name || null,
        consumer_phone: consumer_phone || null,
        notes: notes || null,
        created_by: req.user.userId,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    })

    // Bundling Buku Service: sengaja ditahan sampai STNK/BPKB/Plat siap
    // diserahkan, supaya konsumen yang STNK-nya lambat jadi (slow moving)
    // tetap punya alasan kembali ke dealer -- bukan cuma kemudahan input.
    // Dibuat terpisah dari transaksi di atas: kalau ini gagal (mis. sudah
    // ada), handover utama yang memang diminta admin tidak boleh ikut batal.
    let bukuServiceHandover = null
    if (include_buku_service && document_type !== 'BUKU_SERVICE') {
      const existing = await prisma.document_handovers.findUnique({
        where: { engine_number_document_type: { engine_number, document_type: 'BUKU_SERVICE' } },
      })
      if (!existing) {
        bukuServiceHandover = await prisma.document_handovers.create({
          data: {
            engine_number,
            document_type: 'BUKU_SERVICE',
            handover_mode: handover_mode || 'langsung',
            status: 'tersedia',
            salesman_name: salesman_name || null,
            consumer_name: consumer_name || null,
            consumer_phone: consumer_phone || null,
            notes: 'Dibundel otomatis saat menambah ' + document_type,
            created_by: req.user.userId,
          },
          include: {
            creator: { select: { id: true, name: true } },
          },
        })
      }
    }

    res.status(201).json({ ...handover, buku_service_handover: bukuServiceHandover })
  } catch (err) {
    next(err)
  }
}

export async function addHandoverStep(req, res, next) {
  try {
    const { id } = req.params
    const { step_type, given_by_name, received_by_name, notes } = req.body

    const handover = await prisma.document_handovers.findUnique({
      where: { id: parseInt(id) },
    })
    if (!handover) {
      return res.status(404).json({ error: 'Record serah terima tidak ditemukan' })
    }

    const validStepTypes = ['admin_ke_sales', 'sales_terima', 'serah_ke_konsumen']
    if (!validStepTypes.includes(step_type)) {
      return res.status(400).json({ error: `step_type harus salah satu: ${validStepTypes.join(', ')}` })
    }

    const transitions = {
      admin_ke_sales: { from: ['tersedia'], to: 'diserahkan_ke_sales' },
      sales_terima: { from: ['diserahkan_ke_sales'], to: 'diterima_sales' },
      serah_ke_konsumen: { from: ['tersedia', 'diterima_sales', 'diserahkan_ke_sales'], to: 'selesai' },
    }

    const transition = transitions[step_type]
    if (!transition.from.includes(handover.status)) {
      return res.status(400).json({
        error: `Tidak bisa melakukan "${step_type}" saat status "${handover.status}". Status harus: ${transition.from.join(' / ')}`,
      })
    }

    if (req.user.role === 'Salesman') {
      if (!handover.salesman_name || handover.salesman_name.toLowerCase() !== req.user.name.toLowerCase()) {
        return res.status(403).json({ error: 'Akses ditolak. Dokumen ini tidak ditugaskan kepada Anda.' })
      }
      if (step_type !== 'serah_ke_konsumen') {
        return res.status(403).json({ error: 'Salesman hanya diizinkan untuk menyerahkan dokumen ke konsumen.' })
      }
    }

    let photo_url = null
    let photo_handover_url = null
    if (req.files) {
      if (req.files.photo_doc && req.files.photo_doc[0]) {
        photo_url = `/uploads/handovers/${req.files.photo_doc[0].filename}`
      }
      if (req.files.photo_handover && req.files.photo_handover[0]) {
        photo_handover_url = `/uploads/handovers/${req.files.photo_handover[0].filename}`
      }
    }

    const newStatus = transition.to
    const handoverMode = step_type === 'admin_ke_sales' ? 'via_sales' : handover.handover_mode

    const [step] = await prisma.$transaction([
      prisma.document_handover_steps.create({
        data: {
          handover_id: parseInt(id),
          step_type,
          given_by_name: req.user.name || null,
          received_by_name: received_by_name || null,
          photo_url,
          photo_handover_url,
          notes: notes || null,
          performed_by: req.user.userId,
        },
        include: { performer: { select: { id: true, name: true } } },
      }),
      prisma.document_handovers.update({
        where: { id: parseInt(id) },
        data: {
          status: newStatus,
          handover_mode: handoverMode,
          ...(step_type === 'admin_ke_sales' && received_by_name ? { salesman_name: received_by_name } : {}),
          ...(step_type === 'serah_ke_konsumen' && received_by_name ? { consumer_name: received_by_name } : {}),
        },
      }),
    ])

    res.status(201).json(step)
  } catch (err) {
    next(err)
  }
}

export async function getHandoverSteps(req, res, next) {
  try {
    const { id } = req.params

    const handover = await prisma.document_handovers.findUnique({
      where: { id: parseInt(id) },
      include: {
        creator: { select: { id: true, name: true } },
        steps: {
          orderBy: { performed_at: 'asc' },
          include: { performer: { select: { id: true, name: true } } },
        },
      },
    })

    if (!handover) {
      return res.status(404).json({ error: 'Record serah terima tidak ditemukan' })
    }

    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: handover.engine_number },
      select: {
        stnk_name: true,
        chassis_number: true,
        no_polisi: true,
        series: true,
        finance_company: true,
        mobile: true,
        no_stnk: true,
        no_bpkb: true,
      },
    })

    res.json({ ...handover, track: track || null })
  } catch (err) {
    next(err)
  }
}

export async function getHandoverPhoto(req, res, next) {
  try {
    const { stepId } = req.params
    const { type = 'doc' } = req.query

    const step = await prisma.document_handover_steps.findUnique({
      where: { id: parseInt(stepId) },
    })

    if (!step) {
      return res.status(404).json({ error: 'Langkah serah terima tidak ditemukan' })
    }

    const pathField = type === 'handover' ? step.photo_handover_url : step.photo_url
    if (!pathField) {
      return res.status(404).json({ error: 'Foto tidak ditemukan' })
    }

    const filePath = pathField.replace(/^\//, '')
    res.sendFile(filePath, { root: process.cwd() })
  } catch (err) {
    next(err)
  }
}

export async function updateDocumentHandover(req, res, next) {
  try {
    const { id } = req.params
    const { salesman_name, consumer_name, consumer_phone, notes } = req.body

    const existing = await prisma.document_handovers.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      return res.status(404).json({ error: 'Record serah terima tidak ditemukan' })
    }

    if (req.user.role === 'Salesman') {
      if (!existing.salesman_name || existing.salesman_name.toLowerCase() !== req.user.name.toLowerCase()) {
        return res.status(403).json({ error: 'Akses ditolak. Dokumen ini tidak ditugaskan kepada Anda.' })
      }
    }

    const handover = await prisma.document_handovers.update({
      where: { id: parseInt(id) },
      data: {
        salesman_name: salesman_name || null,
        consumer_name: consumer_name || null,
        consumer_phone: consumer_phone || null,
        notes: notes || null,
      },
    })
    res.json(handover)
  } catch (err) {
    next(err)
  }
}

export async function deleteDocumentHandover(req, res, next) {
  try {
    const { id } = req.params

    const handover = await prisma.document_handovers.findUnique({
      where: { id: parseInt(id) },
    })
    if (!handover) {
      return res.status(404).json({ error: 'Record serah terima tidak ditemukan' })
    }

    // Steps ter-hapus otomatis via FK onDelete: Cascade.
    await prisma.document_handovers.delete({ where: { id: parseInt(id) } })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
