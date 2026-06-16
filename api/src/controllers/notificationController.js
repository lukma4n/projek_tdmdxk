import { prisma } from '../config/db.js'

function showroomPath(type) {
  return `/showroom/opname-${type}`
}

function showroomLabel(type) {
  return { unit: 'Opname Unit', stnk: 'Opname STNK', bpkb: 'Opname BPKB' }[type] || 'Opname Showroom'
}

function mapShowroomTask(session, action, priority = 'normal') {
  return {
    id: `showroom-${session.id}-${action}`,
    area: 'showroom',
    title: `${showroomLabel(session.opname_type)} menunggu tindakan`,
    description: `${session.session_code} / ${session.pic_so_name || 'PIC belum diisi'}`,
    status: session.status,
    action,
    priority,
    path: showroomPath(session.opname_type),
    created_at: session.created_at,
  }
}

function mapPartTask(session, action, priority = 'normal') {
  return {
    id: `part-${session.id}-${action}`,
    area: 'part',
    title: 'Stock Opname Part menunggu tindakan',
    description: `${session.session_name} / ${session.pic_opname_name || 'PIC belum diisi'}`,
    status: session.status,
    action,
    priority,
    path: '/opname',
    created_at: session.created_at,
  }
}

function mapSyncTask(item, action, priority = 'normal') {
  return {
    id: `sync-${item.id}-${action}`,
    area: 'sync',
    title: item.title,
    description: item.description,
    status: item.status || 'info',
    action,
    priority,
    path: '/backups',
    created_at: item.created_at || new Date(),
  }
}

function mapFollowupTask(item, action, priority = 'normal') {
  return {
    id: item.id,
    area: 'followup',
    title: item.title,
    description: item.description,
    status: item.status || 'overdue',
    action,
    priority,
    path: item.path,
    created_at: item.created_at || new Date(),
  }
}

async function getSyncTasksForManagement(role) {
  if (!['Kepala Bengkel', 'Kepala Cabang'].includes(role)) return []

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [failedImports, operationalAudits] = await Promise.all([
    prisma.sync_logs.findMany({
      where: { synced_at: { gte: last24h }, rows_error: { gt: 0 } },
      orderBy: { synced_at: 'desc' },
      take: 5,
    }),
    prisma.audit_logs.findMany({
      where: {
        changed_at: { gte: last24h },
        table_name: { in: ['database_backup', 'database_restore'] },
      },
      orderBy: { changed_at: 'desc' },
      take: 5,
    }),
  ])

  const tasks = []

  for (const item of failedImports) {
    tasks.push(mapSyncTask({
      id: item.id,
      title: `Import ${item.module} punya baris gagal`,
      description: `${item.filename} / sukses ${item.rows_success} / gagal ${item.rows_error}`,
      status: 'import_warning',
      created_at: item.synced_at,
    }, 'Review sync log', 'high'))
  }

  for (const log of operationalAudits) {
    const isRestore = log.table_name === 'database_restore'
    tasks.push(mapSyncTask({
      id: log.id,
      title: isRestore ? 'Aktivitas restore database tercatat' : 'Aktivitas backup database tercatat',
      description: `${log.record_id} / ${log.field_name}`,
      status: isRestore ? 'restore' : 'backup',
      created_at: log.changed_at,
    }, isRestore ? 'Verifikasi hasil restore' : 'Verifikasi backup terbaru', isRestore ? 'high' : 'normal'))
  }

  return tasks
}

async function getKpbFollowupSnapshot(limit = 300) {
  const now = new Date()
  const warningDays = 7

  const customers = await prisma.customers.findMany({
    where: {
      branch_code: 'DXK',
      so_date: { lte: now },
      no_engine: { not: null },
    },
    orderBy: { so_date: 'desc' },
    take: limit,
    select: {
      id: true,
      customer_name: true,
      no_engine: true,
      so_date: true,
    },
  })

  if (customers.length === 0) return { overdue: 0, warning: 0 }

  const engines = [...new Set(customers.map((c) => c.no_engine).filter(Boolean))]
  const wos = await prisma.work_orders.findMany({
    where: {
      state: 'done',
      engine_number: { in: engines },
      category_name: { in: ['KPB1', 'KPB2', 'KPB3', 'KPB4'] },
    },
    select: { engine_number: true, category_name: true },
  })

  const woMap = {}
  for (const row of wos) {
    const key = row.engine_number
    if (!woMap[key]) woMap[key] = new Set()
    woMap[key].add(row.category_name)
  }

  const levels = [
    { key: 'KPB1', months: 2 },
    { key: 'KPB2', months: 4 },
    { key: 'KPB3', months: 6 },
    { key: 'KPB4', months: 8 },
  ]

  let overdue = 0
  let warning = 0

  for (const customer of customers) {
    const doneSet = woMap[customer.no_engine] || new Set()

    for (const level of levels) {
      if (doneSet.has(level.key)) continue
      const dueDate = new Date(customer.so_date)
      dueDate.setMonth(dueDate.getMonth() + level.months)
      const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))

      if (diffDays < 0 && diffDays >= -90) overdue += 1
      else if (diffDays >= 0 && diffDays <= warningDays) warning += 1
      break
    }
  }

  return { overdue, warning }
}

async function getDocumentFollowupSnapshot() {
  const now = new Date()
  const stnkThreshold = new Date(now)
  stnkThreshold.setDate(stnkThreshold.getDate() - 14)

  const [stnkOverdue, bpkbOverdue] = await Promise.all([
    prisma.showroom_stnk_bpkb_tracks.count({
      where: {
        branch_code: 'DXK',
        stnk_status: 'BELUM_DIAMBIL',
        tgl_terima_stnk: { lte: stnkThreshold },
      },
    }),
    prisma.showroom_stnk_bpkb_tracks.count({
      where: {
        branch_code: 'DXK',
        bpkb_status: 'BELUM_DIAMBIL',
        // overdue_days adalah computed field; pakai tgl_jadi_bpkb < (now - 180 hari) untuk estimasi
        tgl_jadi_bpkb: { lte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) },
        finance_company: null,
      },
    }),
  ])

  return { stnkOverdue, bpkbOverdue }
}

async function getFollowupTasksByRole(role) {
  const tasks = []

  if (['CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel'].includes(role)) {
    const kpb = await getKpbFollowupSnapshot(300)
    if (kpb.overdue > 0 || kpb.warning > 0) {
      tasks.push(mapFollowupTask({
        id: `followup-kpb-${role}`,
        title: 'Pipeline KPB perlu ditindaklanjuti',
        description: `Overdue: ${kpb.overdue} / Warning 7 hari: ${kpb.warning}`,
        status: 'kpb_overdue',
        path: '/follow-up-kpb',
      }, 'Tindak lanjuti KPB', kpb.overdue > 0 ? 'high' : 'normal'))
    }
  }

  if (role === 'CRM') {
    const doc = await getDocumentFollowupSnapshot()
    if (doc.stnkOverdue > 0) {
      tasks.push(mapFollowupTask({
        id: 'followup-stnk-overdue',
        title: 'Follow-up STNK overdue',
        description: `${doc.stnkOverdue} dokumen STNK belum diambil > 14 hari`,
        status: 'stnk_overdue',
        path: '/follow-up-stnk',
      }, 'Hubungi konsumen STNK', 'high'))
    }
    if (doc.bpkbOverdue > 0) {
      tasks.push(mapFollowupTask({
        id: 'followup-bpkb-overdue',
        title: 'Follow-up BPKB overdue',
        description: `${doc.bpkbOverdue} dokumen BPKB cash overdue >= 180 hari`,
        status: 'bpkb_overdue',
        path: '/follow-up-bpkb',
      }, 'Hubungi konsumen BPKB', 'high'))
    }
  }

  return tasks
}

export async function getOpnameNotifications(req, res, next) {
  try {
    const role = req.user.role
    const tasks = []

    if (role === 'ADH') {
      const sessions = await prisma.showroom_opname_sessions.findMany({ where: { status: 'submitted' }, orderBy: { submitted_at: 'asc' } })
      tasks.push(...sessions.map((session) => mapShowroomTask(session, 'Approve 1 ADH', 'high')))
    }

    if (role === 'Kepala Cabang') {
      const [showroomSessions, partSessions] = await Promise.all([
        prisma.showroom_opname_sessions.findMany({ where: { status: 'sent_to_kacab' }, orderBy: { sent_to_kacab_at: 'asc' } }),
        prisma.opname_sessions.findMany({ where: { status: 'sent_to_kacab' }, orderBy: { sent_to_kacab_at: 'asc' } }),
      ])
      tasks.push(...showroomSessions.map((session) => mapShowroomTask(session, 'Approve 2 Kepala Cabang', 'high')))
      tasks.push(...partSessions.map((session) => mapPartTask(session, 'Approve 2 Kepala Cabang', 'high')))
    }

    if (role === 'PIC Stock opname') {
      const sessions = await prisma.showroom_opname_sessions.findMany({ where: { status: { in: ['approved_kacab', 'rejected'] } }, orderBy: { created_at: 'asc' } })
      tasks.push(...sessions.map((session) => mapShowroomTask(session, session.status === 'approved_kacab' ? 'Upload BASO signed' : 'Perbaiki hasil SO', session.status === 'rejected' ? 'high' : 'normal')))
    }

    if (role === 'Kepala Bengkel') {
      const sessions = await prisma.opname_sessions.findMany({ where: { status: 'submitted' }, orderBy: { submitted_at: 'asc' } })
      tasks.push(...sessions.map((session) => mapPartTask(session, 'Approve 1 Kepala Bengkel', 'high')))
    }

    if (role === 'Partman') {
      const sessions = await prisma.opname_sessions.findMany({ where: { status: { in: ['active', 'rejected'] } }, orderBy: { created_at: 'asc' } })
      tasks.push(...sessions.map((session) => mapPartTask(session, session.status === 'active' ? 'Selesaikan opname' : 'Perbaiki hasil opname', session.status === 'rejected' ? 'high' : 'normal')))
    }


    const [syncTasks, followupTasks] = await Promise.all([
      getSyncTasksForManagement(role),
      getFollowupTasksByRole(role),
    ])
    tasks.push(...syncTasks, ...followupTasks)

    tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    res.json({ data: tasks, summary: { total: tasks.length, high: tasks.filter((task) => task.priority === 'high').length } })
  } catch (error) { next(error) }
}

export const getApprovalNotifications = getOpnameNotifications
