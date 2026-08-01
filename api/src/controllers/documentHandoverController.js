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
    } else if (req.user.role === 'Ekspedisi') {
      if (search) {
        where.AND = [
          { assigned_courier_id: req.user.userId },
          { OR: [{ engine_number: { contains: search } }, { consumer_name: { contains: search } }] },
        ]
      } else {
        where.assigned_courier_id = req.user.userId
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
          assigned_courier: { select: { id: true, name: true } },
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
    } else if (req.user.role === 'Ekspedisi') {
      where.assigned_courier_id = req.user.userId
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

export async function getCourierUsers(req, res, next) {
  try {
    const couriers = await prisma.users.findMany({
      where: { role: 'Ekspedisi' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    res.json(couriers)
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

/**
 * Bundling Buku Service: sengaja ditahan sampai STNK/BPKB/Plat siap
 * diserahkan (atau dikirim ekspedisi), supaya konsumen yang STNK-nya lambat
 * jadi (slow moving) tetap punya alasan kembali ke dealer -- bukan cuma
 * kemudahan input. Dipanggil terpisah dari pembuatan handover utama: kalau
 * ini gagal (mis. sudah ada), handover utama yang memang diminta tidak boleh
 * ikut batal. Dipakai baik oleh createDocumentHandover maupun
 * processShipmentFromPickupRequest supaya logikanya satu sumber kebenaran.
 */
async function createBukuServiceBundleIfNeeded({
  engineNumber, triggerDocType, handoverMode, consumerName, consumerPhone,
  shippingAddress, assignedCourierId, createdBy,
}) {
  if (triggerDocType === 'BUKU_SERVICE') return null
  const existing = await prisma.document_handovers.findUnique({
    where: { engine_number_document_type: { engine_number: engineNumber, document_type: 'BUKU_SERVICE' } },
  })
  if (existing) return null
  return prisma.document_handovers.create({
    data: {
      engine_number: engineNumber,
      document_type: 'BUKU_SERVICE',
      handover_mode: handoverMode,
      status: 'tersedia',
      consumer_name: consumerName || null,
      consumer_phone: consumerPhone || null,
      shipping_address: shippingAddress || null,
      assigned_courier_id: assignedCourierId || null,
      notes: 'Dibundel otomatis saat menambah ' + triggerDocType,
      created_by: createdBy,
    },
    include: { creator: { select: { id: true, name: true } } },
  })
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

    let bukuServiceHandover = null
    if (include_buku_service) {
      bukuServiceHandover = await createBukuServiceBundleIfNeeded({
        engineNumber: engine_number,
        triggerDocType: document_type,
        handoverMode: handover_mode || 'langsung',
        consumerName: consumer_name,
        consumerPhone: consumer_phone,
        createdBy: req.user.userId,
      })
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

    const validStepTypes = ['admin_ke_sales', 'sales_terima', 'serah_ke_konsumen', 'admin_ke_ekspedisi', 'ekspedisi_ke_konsumen']
    if (!validStepTypes.includes(step_type)) {
      return res.status(400).json({ error: `step_type harus salah satu: ${validStepTypes.join(', ')}` })
    }

    const transitions = {
      admin_ke_sales: { from: ['tersedia'], to: 'diserahkan_ke_sales' },
      sales_terima: { from: ['diserahkan_ke_sales'], to: 'diterima_sales' },
      serah_ke_konsumen: { from: ['tersedia', 'diterima_sales', 'diserahkan_ke_sales'], to: 'selesai' },
      admin_ke_ekspedisi: { from: ['tersedia'], to: 'dikirim_ekspedisi' },
      ekspedisi_ke_konsumen: { from: ['dikirim_ekspedisi'], to: 'selesai' },
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

    if (req.user.role === 'Ekspedisi') {
      if (!handover.assigned_courier_id || handover.assigned_courier_id !== req.user.userId) {
        return res.status(403).json({ error: 'Akses ditolak. Kiriman ini tidak ditugaskan kepada Anda.' })
      }
      if (step_type !== 'ekspedisi_ke_konsumen') {
        return res.status(403).json({ error: 'Ekspedisi hanya diizinkan untuk menandai dokumen sudah diterima konsumen.' })
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
    const handoverMode = step_type === 'admin_ke_sales' ? 'via_sales'
      : step_type === 'admin_ke_ekspedisi' ? 'ekspedisi'
      : handover.handover_mode

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
    const { salesman_name, consumer_name, consumer_phone, notes, shipping_address } = req.body

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
        consumer_name: consumer_name || null,
        consumer_phone: consumer_phone || null,
        notes: notes || null,
        // salesman_name/shipping_address cuma disentuh kalau memang dikirim --
        // form edit mode ekspedisi tidak mengirim salesman_name (tidak relevan
        // utk mode itu), dan mode lain tidak mengirim shipping_address.
        ...(salesman_name !== undefined ? { salesman_name: salesman_name || null } : {}),
        ...(shipping_address !== undefined ? { shipping_address: shipping_address || null } : {}),
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

/**
 * POST /showroom/pickup-requests/:id/process-shipment
 * Body: { document_types: string[], assigned_courier_id, include_buku_service? }
 *
 * Ubah permintaan pickup (delivery_method EKSPEDISI) jadi baris
 * document_handovers mode 'ekspedisi'. document_types adalah subset dari
 * requested_docs milik permintaan ini -- staf boleh memproses sebagian dulu
 * kalau tidak semua dokumen yang diminta konsumen sudah siap dikirim.
 */
export async function processShipmentFromPickupRequest(req, res, next) {
  try {
    const pickupId = parseInt(req.params.id)
    if (!Number.isInteger(pickupId) || pickupId <= 0) {
      return res.status(400).json({ error: 'ID tidak valid' })
    }

    const { document_types: documentTypesRaw, assigned_courier_id: assignedCourierIdRaw, include_buku_service: includeBukuService } = req.body || {}

    const pickupRequest = await prisma.showroom_pickup_requests.findUnique({ where: { id: pickupId } })
    if (!pickupRequest) {
      return res.status(404).json({ error: 'Permintaan tidak ditemukan' })
    }
    if (pickupRequest.delivery_method !== 'EKSPEDISI') {
      return res.status(400).json({ error: 'Permintaan ini bukan pengiriman via ekspedisi' })
    }
    if (!pickupRequest.shipping_address) {
      return res.status(400).json({ error: 'Permintaan ini belum punya alamat pengiriman' })
    }

    const requestedDocs = String(pickupRequest.requested_docs || '').split(',').map((s) => s.trim()).filter(Boolean)
    const typesToProcess = Array.isArray(documentTypesRaw)
      ? [...new Set(documentTypesRaw.map((t) => String(t).trim()).filter(Boolean))]
      : []

    if (typesToProcess.length === 0) {
      return res.status(400).json({ error: 'document_types wajib diisi' })
    }

    const invalidTypes = typesToProcess.filter((t) => !requestedDocs.includes(t))
    if (invalidTypes.length > 0) {
      return res.status(400).json({ error: `Tipe dokumen berikut tidak diminta di permintaan ini: ${invalidTypes.join(', ')}` })
    }

    const assignedCourierId = Number(assignedCourierIdRaw)
    if (!Number.isInteger(assignedCourierId) || assignedCourierId <= 0) {
      return res.status(400).json({ error: 'assigned_courier_id wajib diisi' })
    }
    const courier = await prisma.users.findUnique({ where: { id: assignedCourierId } })
    if (!courier || courier.role !== 'Ekspedisi') {
      return res.status(400).json({ error: 'Akun ekspedisi tidak valid' })
    }

    // Non-atomik per baris (pola sama seperti bundling Buku Service) --
    // kalau satu tipe sudah pernah punya handover, yang lain tetap diproses.
    const created = []
    const skipped = []
    for (const docType of typesToProcess) {
      const existing = await prisma.document_handovers.findUnique({
        where: { engine_number_document_type: { engine_number: pickupRequest.engine_number, document_type: docType } },
      })
      if (existing) {
        skipped.push(docType)
        continue
      }
      const handover = await prisma.document_handovers.create({
        data: {
          engine_number: pickupRequest.engine_number,
          document_type: docType,
          handover_mode: 'ekspedisi',
          status: 'tersedia',
          consumer_name: pickupRequest.consumer_name || null,
          consumer_phone: pickupRequest.consumer_phone || null,
          shipping_address: pickupRequest.shipping_address,
          assigned_courier_id: courier.id,
          created_by: req.user.userId,
        },
      })
      created.push(handover)
    }

    const bukuServiceHandover = includeBukuService
      ? await createBukuServiceBundleIfNeeded({
          engineNumber: pickupRequest.engine_number,
          triggerDocType: typesToProcess[0],
          handoverMode: 'ekspedisi',
          consumerName: pickupRequest.consumer_name,
          consumerPhone: pickupRequest.consumer_phone,
          shippingAddress: pickupRequest.shipping_address,
          assignedCourierId: courier.id,
          createdBy: req.user.userId,
        })
      : null

    if (created.length > 0 || bukuServiceHandover) {
      await prisma.showroom_pickup_requests.update({
        where: { id: pickupId },
        data: { status: 'DONE', handled_by: req.user.userId, handled_at: new Date() },
      })
    }

    res.status(201).json({ created, skipped, buku_service_handover: bukuServiceHandover })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /showroom/document-handovers/:id/tracking-number
 * Body: { tracking_number }
 *
 * Diisi/diupdate belakangan oleh akun Ekspedisi sendiri (atau Admin) --
 * nomor resi umumnya belum ada saat admin baru menyerahkan paket secara
 * fisik ke kurir, baru muncul setelah pihak ekspedisi memprosesnya di
 * sistem mereka. Sengaja bukan bagian dari langkah admin_ke_ekspedisi.
 * Hanya berlaku selama status masih dikirim_ekspedisi (dalam perjalanan).
 */
export async function updateTrackingNumber(req, res, next) {
  try {
    const id = parseInt(req.params.id)
    const trackingNumber = String(req.body?.tracking_number || '').trim()
    if (!trackingNumber) {
      return res.status(400).json({ error: 'Nomor resi wajib diisi' })
    }

    const handover = await prisma.document_handovers.findUnique({ where: { id } })
    if (!handover) {
      return res.status(404).json({ error: 'Record serah terima tidak ditemukan' })
    }
    if (handover.handover_mode !== 'ekspedisi') {
      return res.status(400).json({ error: 'Nomor resi hanya berlaku untuk pengiriman via ekspedisi' })
    }
    if (handover.status !== 'dikirim_ekspedisi') {
      return res.status(400).json({ error: 'Nomor resi hanya bisa diisi/diubah selama status "Dikirim Ekspedisi"' })
    }

    if (req.user.role === 'Ekspedisi') {
      if (!handover.assigned_courier_id || handover.assigned_courier_id !== req.user.userId) {
        return res.status(403).json({ error: 'Akses ditolak. Kiriman ini tidak ditugaskan kepada Anda.' })
      }
    }

    const updated = await prisma.document_handovers.update({
      where: { id },
      data: { tracking_number: trackingNumber },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}
