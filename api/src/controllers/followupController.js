import { prisma } from '../config/db.js'
import { clampLimit } from '../utils/pagination.js'
import { buildFollowupQueue } from '../services/followupQueueService.js'
import { getDailyUsage, pastikanJatahHarianCukup, catatPengiriman, BatasHarianError } from '../services/whatsappLimitService.js'
import { muatPerenderMassal } from '../services/templateService.js'
import { documentTemplateKey } from '../services/followupMessages.js'
import { waMeUrl, normalizePhone, ALASAN_NOMOR } from '../utils/phone.js'
import { KPB_LEVELS } from './customerController.js'

const JENIS_VALID = ['KPB', 'STNK', 'BPKB']

/**
 * Lampirkan teks pesan + tautan wa.me ke tiap baris.
 *
 * Pesan disusun di server (bukan di browser) supaya isinya tetap mengikuti
 * template aktif yang bisa diubah dari UI, dan tidak bisa dikarang sembarangan
 * atas nama dealer lewat request langsung.
 */
async function lampirkanDraf(items) {
  if (items.length === 0) return items
  const render = await muatPerenderMassal()

  return items.map((item) => {
    const pesan = item.kind === 'KPB'
      ? render.kpb({
          customerName: item.customer_name, model: item.model,
          kpbLabel: item.kpb_label, dueDate: item.due_date, daysRemaining: item.days_remaining,
        })
      : render.dokumen(item.kebutuhan || [item.kind], { engineNumber: item.engine_number })

    return { ...item, draft_message: pesan, wa_url: waMeUrl(item.phone, pesan) }
  })
}

/**
 * Antrean follow-up terpadu, berurut prioritas.
 * Menggantikan tiga daftar terpisah yang berbagi satu jatah kirim harian
 * tanpa saling tahu.
 */
export async function getFollowupQueue(req, res, next) {
  try {
    const { page = 1, limit = 50, kind = 'all', area = 'all', search = '', include_invalid_phone, nomor } = req.query
    const pageInt = Math.max(1, parseInt(page) || 1)
    const limitInt = clampLimit(limit, 50)

    const { data, ringkasan, tersaring } = await buildFollowupQueue({
      kind: kind === 'all' ? null : String(kind).toUpperCase(),
      area,
      search,
      includeInvalidPhone: include_invalid_phone === 'true',
      onlyInvalidPhone: nomor === 'bermasalah',
    })

    // Draf hanya disiapkan untuk baris yang benar-benar tampil. Merendernya
    // untuk seluruh 2.300 target berarti ~2 MB teks yang 98%-nya tak terpakai.
    const skip = (pageInt - 1) * limitInt
    const halaman = await lampirkanDraf(data.slice(skip, skip + limitInt))

    res.json({
      data: halaman,
      ringkasan,
      tersaring,
      // Kamus alasan dikirim dari server supaya kalimatnya tidak ditulis ulang
      // (dan lama-lama berbeda) di frontend.
      alasan_nomor_label: ALASAN_NOMOR,
      daily: await getDailyUsage(),
      pagination: {
        page: pageInt,
        limit: limitInt,
        total: data.length,
        totalPages: Math.ceil(data.length / limitInt),
      },
    })
  } catch (error) {
    next(error)
  }
}

/** Daftar area untuk dropdown filter, diambil dari data yang benar-benar ada. */
export async function getFollowupAreas(req, res, next) {
  try {
    const [customers, tracks] = await Promise.all([
      prisma.customers.findMany({ where: { branch_code: 'DXK' }, select: { kecamatan: true }, distinct: ['kecamatan'] }),
      prisma.showroom_stnk_bpkb_tracks.findMany({ where: { branch_code: 'DXK' }, select: { area_kecamatan: true }, distinct: ['area_kecamatan'] }),
    ])
    // Dua sumber memakai kapitalisasi berbeda untuk kecamatan yang sama
    // ("AIR UPAS" di tracks vs "Air Upas" di customers), jadi digabung apa
    // adanya dropdown-nya berisi duplikat. Disamakan lewat kunci huruf besar,
    // tampilkan bentuk pertama yang ditemui.
    const peta = new Map()
    const tambah = (nilai) => {
      const bersih = String(nilai || '').trim()
      if (!bersih) return
      const kunci = bersih.toUpperCase()
      if (!peta.has(kunci)) peta.set(kunci, bersih)
    }
    for (const c of customers) tambah(c.kecamatan)
    for (const t of tracks) tambah(t.area_kecamatan)
    res.json({ data: [...peta.values()].sort((a, b) => a.localeCompare(b, 'id')) })
  } catch (error) {
    next(error)
  }
}

/**
 * Jadwalkan hubungi ulang. Selama tanggal itu belum tiba, target disembunyikan
 * dari antrean — inilah yang membuat janji konsumen ("Sabtu saya datang")
 * tidak hilang sekaligus tidak dikirimi ulang besoknya.
 */
export async function scheduleFollowup(req, res, next) {
  try {
    const kind = String(req.params.kind || '').toUpperCase()
    if (!JENIS_VALID.includes(kind)) return res.status(400).json({ error: 'Jenis follow-up tidak valid' })

    const { key } = req.params
    const { next_followup_at, status, note } = req.body

    let tanggal = null
    if (next_followup_at) {
      tanggal = new Date(next_followup_at)
      if (Number.isNaN(tanggal.getTime())) return res.status(400).json({ error: 'Tanggal hubungi ulang tidak valid' })
    }

    if (kind === 'KPB') {
      const customerId = parseInt(key)
      const customer = await prisma.customers.findUnique({ where: { id: customerId } })
      if (!customer) return res.status(404).json({ error: 'Konsumen tidak ditemukan' })

      const terakhir = await prisma.kpb_followups.findFirst({
        where: { customer_id: customerId },
        orderBy: { followup_at: 'desc' },
      })

      const data = await prisma.kpb_followups.create({
        data: {
          customer_id: customerId,
          kpb_level: terakhir?.kpb_level || req.body.kpb_level || 'KPB1',
          status: status || terakhir?.status || 'sudah_dihubungi',
          note: note || null,
          next_followup_at: tanggal,
          created_by: req.user.userId,
        },
        include: { creator: { select: { id: true, username: true, name: true, role: true } } },
      })
      return res.status(201).json({ message: 'Jadwal follow-up disimpan', data })
    }

    const engineNumber = String(key).trim()
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({ where: { engine_number: engineNumber } })
    if (!track) return res.status(404).json({ error: 'Dokumen tidak ditemukan' })

    const data = await prisma.showroom_document_followups.create({
      data: {
        document_type: kind,
        engine_number: engineNumber,
        status: status || 'sudah_dihubungi',
        note: note || null,
        next_followup_at: tanggal,
        created_by: req.user.userId,
      },
      include: { creator: { select: { id: true, username: true, name: true, role: true } } },
    })
    res.status(201).json({ message: 'Jadwal follow-up disimpan', data })
  } catch (error) {
    next(error)
  }
}

/**
 * Catat satu konsumen sebagai sudah dihubungi via WhatsApp.
 *
 * Pengirimannya sendiri MANUAL: browser membuka wa.me, staf menekan Kirim di
 * WhatsApp Web miliknya. Endpoint ini tidak mengirim apa pun — ia hanya
 * memotong jatah harian dan mencatat kontaknya, supaya jeda 7 hari, riwayat,
 * dan urutan antrean tetap jalan.
 *
 * Dipanggil SETELAH draf dibuka. Kalau staf batal menekan Kirim, konsumen tetap
 * tercatat terhubungi — disengaja: menghitung lebih lebih aman daripada
 * mengirimi orang yang sama dua kali.
 */
export async function recordFollowupContact(req, res, next) {
  try {
    const kind = String(req.params.kind || '').toUpperCase()
    if (!JENIS_VALID.includes(kind)) return res.status(400).json({ error: 'Jenis follow-up tidak valid' })
    const { key } = req.params

    await pastikanJatahHarianCukup()

    if (kind === 'KPB') {
      const customerId = parseInt(key)
      const customer = await prisma.customers.findUnique({ where: { id: customerId } })
      if (!customer) return res.status(404).json({ error: 'Konsumen tidak ditemukan' })

      const level = KPB_LEVELS.find((l) => l.label === req.body.kpb_level) || KPB_LEVELS[0]
      const phone = normalizePhone(customer.customer_mobile)
      if (!phone) return res.status(422).json({ error: 'Nomor HP konsumen tidak valid atau kosong.' })

      await catatPengiriman({ module: 'KPB', targetKey: customerId, phone, sentBy: req.user.userId })
      const data = await prisma.kpb_followups.create({
        data: {
          customer_id: customerId, kpb_level: level.label, status: 'sudah_dihubungi',
          note: `Pengingat ${level.label} dikirim manual via WhatsApp ke ${phone}`,
          created_by: req.user.userId,
        },
      })

      return res.status(201).json({ message: `Dicatat: ${phone} dihubungi`, data, daily: await getDailyUsage() })
    }

    // Dokumen — bisa satu jenis atau gabungan STNK+BPKB dalam satu pesan.
    const engineNumber = String(key).trim()
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({ where: { engine_number: engineNumber } })
    if (!track) return res.status(404).json({ error: 'Dokumen tidak ditemukan' })

    const diminta = Array.isArray(req.body.kebutuhan) && req.body.kebutuhan.length ? req.body.kebutuhan : [kind]
    const kebutuhan = [...new Set(diminta.map((k) => String(k).toUpperCase()))].filter((k) => k === 'STNK' || k === 'BPKB')
    if (kebutuhan.length === 0) return res.status(400).json({ error: 'Kebutuhan dokumen tidak valid' })

    const phone = normalizePhone(track.mobile)
    if (!phone) return res.status(422).json({ error: 'Nomor HP konsumen tidak valid atau kosong.' })

    // Satu pesan = satu baris log = satu jatah. Nilai module dibakukan lewat
    // documentTemplateKey ('STNK' | 'BPKB' | 'STNK_BPKB') — bukan digabung dari
    // urutan `kebutuhan` yang datang dari request, karena urutannya bisa terbalik
    // dan menghasilkan dua nilai berbeda untuk kontak yang sama.
    await catatPengiriman({
      module: documentTemplateKey(kebutuhan), targetKey: engineNumber, phone, sentBy: req.user.userId,
    })

    // Satu pesan, tapi tiap dokumen dicatat sendiri supaya daftar per jenis dan
    // riwayat per dokumen tetap akurat.
    const catatan = kebutuhan.length > 1
      ? `Pemberitahuan ${kebutuhan.join(' + ')} dikirim manual dalam satu WhatsApp ke ${phone}`
      : `Pemberitahuan ${kebutuhan[0]} dikirim manual via WhatsApp ke ${phone}`
    for (const jenis of kebutuhan) {
      await prisma.showroom_document_followups.create({
        data: {
          document_type: jenis, engine_number: engineNumber, status: 'sudah_dihubungi',
          note: catatan, created_by: req.user.userId,
        },
      })
    }

    res.status(201).json({
      message: `Dicatat: ${phone} dihubungi`,
      kebutuhan,
      daily: await getDailyUsage(),
    })
  } catch (error) {
    if (error instanceof BatasHarianError) {
      return res.status(error.status).json({ error: error.message })
    }
    next(error)
  }
}

/** Riwayat kontak lengkap satu target, untuk panel detail. */
export async function getFollowupHistory(req, res, next) {
  try {
    const kind = String(req.params.kind || '').toUpperCase()
    if (!JENIS_VALID.includes(kind)) return res.status(400).json({ error: 'Jenis follow-up tidak valid' })
    const { key } = req.params

    const pilih = { creator: { select: { id: true, username: true, name: true, role: true } } }
    const riwayat = kind === 'KPB'
      ? await prisma.kpb_followups.findMany({
          where: { customer_id: parseInt(key) }, orderBy: { followup_at: 'desc' }, include: pilih,
        })
      : await prisma.showroom_document_followups.findMany({
          where: { document_type: kind, engine_number: String(key).trim() },
          orderBy: { followup_at: 'desc' }, include: pilih,
        })

    // Kiriman gabungan tercatat satu baris ber-module 'STNK_BPKB', jadi riwayat
    // STNK maupun BPKB harus ikut mengambilnya. Kalau hanya dicocokkan persis,
    // panel riwayat berkata "belum ada pesan terkirim" untuk pesan yang justru
    // sudah sampai ke konsumen.
    const modul = kind === 'KPB' ? ['KPB'] : [kind, 'STNK_BPKB']
    const kirim = await prisma.whatsapp_send_logs.findMany({
      where: { module: { in: modul }, target_key: String(key) },
      orderBy: { sent_at: 'desc' },
      include: { sender: { select: { id: true, username: true, name: true } } },
    })

    res.json({ data: riwayat, pengiriman: kirim })
  } catch (error) {
    next(error)
  }
}
