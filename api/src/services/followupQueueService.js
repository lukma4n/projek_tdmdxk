import { prisma } from '../config/db.js'
import { KPB_LEVELS, addMonths } from '../controllers/customerController.js'
import { normalizePhone } from './wablasService.js'
import { hitungSkor, terlaluBaruDihubungi } from './followupPriority.js'

// Antrean follow-up terpadu: KPB + STNK + BPKB dalam satu daftar berurut
// prioritas. Menggantikan tiga daftar terpisah yang tidak saling tahu padahal
// berbagi satu jatah kirim harian.
const OVERDUE_WINDOW_DAYS = 90
const HARI_MS = 24 * 60 * 60 * 1000

const selisihHari = (a, b) => Math.floor((a - b) / HARI_MS)

function awalHariIni() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Sumber 1: KPB ──────────────────────────────────────────────────────────
async function ambilTargetKpb(hariIni) {
  const maxMonths = Math.max(...KPB_LEVELS.map((l) => l.months))
  const minMonths = Math.min(...KPB_LEVELS.map((l) => l.months))
  const tertua = new Date(hariIni)
  tertua.setDate(tertua.getDate() - OVERDUE_WINDOW_DAYS)
  const termuda = new Date(hariIni)
  termuda.setDate(termuda.getDate() + 7)

  const customers = await prisma.customers.findMany({
    where: {
      branch_code: 'DXK',
      so_date: { gte: addMonths(tertua, -(maxMonths + 1)), lte: addMonths(termuda, -(minMonths - 1)) },
    },
  })

  const wos = await prisma.work_orders.findMany({
    where: {
      type: 'KPB', workshop_category: 'Service', state: 'done',
      category_name: { in: KPB_LEVELS.map((l) => l.label) },
    },
    select: { engine_number: true, category_name: true },
  })
  const sudahServis = {}
  for (const w of wos) {
    if (!w.engine_number) continue
    ;(sudahServis[w.engine_number] ??= new Set()).add(w.category_name)
  }

  const target = []
  for (const c of customers) {
    if (!c.so_date) continue
    const selesai = sudahServis[c.no_engine]
    for (const level of KPB_LEVELS) {
      if (selesai?.has(level.label)) continue
      const due = addMonths(c.so_date, level.months)
      const daysRemaining = Math.ceil((due - hariIni) / HARI_MS)
      if (daysRemaining < -OVERDUE_WINDOW_DAYS || daysRemaining > 7) continue

      target.push({
        kind: 'KPB',
        key: String(c.id),
        customer_id: c.id,
        engine_number: c.no_engine,
        customer_name: c.customer_name,
        phone_raw: c.customer_mobile,
        model: c.model,
        area: c.kecamatan || c.kabupaten || null,
        salesman: c.salesman || null,
        kpb_label: level.label,
        due_date: due,
        days_remaining: daysRemaining,
        waiting_days: Math.max(0, -daysRemaining),
      })
      break // satu konsumen cukup diwakili level KPB paling mendesak
    }
  }
  return target
}

// ── Sumber 2 & 3: STNK / BPKB ──────────────────────────────────────────────
async function ambilTargetDokumen(hariIni) {
  const tracks = await prisma.showroom_stnk_bpkb_tracks.findMany({
    where: {
      branch_code: 'DXK',
      OR: [
        { stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: { not: null } },
        { bpkb_status: 'BELUM_DIAMBIL', finance_company: null },
      ],
    },
  })

  const target = []
  for (const t of tracks) {
    const dasar = {
      key: t.engine_number,
      engine_number: t.engine_number,
      customer_name: t.stnk_name,
      phone_raw: t.mobile,
      model: t.series || t.category_name || null,
      area: t.area_kecamatan || t.area || null,
      salesman: null,
      no_polisi: t.no_polisi,
    }

    if (t.stnk_status === 'BELUM_DIAMBIL' && t.lokasi_stnk) {
      const siap = t.tgl_terima_stnk
      target.push({
        ...dasar, kind: 'STNK', lokasi: t.lokasi_stnk, ready_date: siap,
        waiting_days: siap ? Math.max(0, selisihHari(hariIni, new Date(siap))) : 0,
        days_remaining: null,
      })
    }
    if (t.bpkb_status === 'BELUM_DIAMBIL' && t.finance_company === null) {
      const siap = t.tgl_jadi_bpkb
      target.push({
        ...dasar, kind: 'BPKB', lokasi: t.lokasi_bpkb, ready_date: siap, no_bpkb: t.no_bpkb,
        waiting_days: siap ? Math.max(0, selisihHari(hariIni, new Date(siap))) : 0,
        days_remaining: null,
      })
    }
  }
  return target
}

// ── Riwayat follow-up terakhir per target ──────────────────────────────────
async function ambilRiwayat(targetKpb, targetDokumen) {
  const customerIds = [...new Set(targetKpb.map((t) => t.customer_id))]
  const engines = [...new Set(targetDokumen.map((t) => t.engine_number))]

  const [kpbFollowups, docFollowups] = await Promise.all([
    customerIds.length
      ? prisma.kpb_followups.findMany({
          where: { customer_id: { in: customerIds } },
          orderBy: { followup_at: 'desc' },
          include: { creator: { select: { id: true, username: true, name: true } } },
        })
      : [],
    engines.length
      ? prisma.showroom_document_followups.findMany({
          where: { engine_number: { in: engines } },
          orderBy: { followup_at: 'desc' },
          include: { creator: { select: { id: true, username: true, name: true } } },
        })
      : [],
  ])

  const peta = new Map()
  for (const f of kpbFollowups) {
    const k = `KPB:${f.customer_id}`
    if (!peta.has(k)) peta.set(k, f)
  }
  for (const f of docFollowups) {
    const k = `${f.document_type}:${f.engine_number}`
    if (!peta.has(k)) peta.set(k, f)
  }
  return peta
}

/**
 * Gabungkan STNK+BPKB pada unit yang sama jadi satu baris. 80 konsumen di data
 * produksi butuh keduanya — dikirim terpisah berarti 2 pesan dan 2 jatah untuk
 * satu perjalanan ke dealer yang sama.
 */
function gabungDokumenSeunit(items) {
  const perUnit = new Map()
  const hasil = []

  for (const item of items) {
    if (item.kind !== 'STNK' && item.kind !== 'BPKB') {
      hasil.push(item)
      continue
    }
    const sudah = perUnit.get(item.engine_number)
    if (!sudah) {
      perUnit.set(item.engine_number, item)
      hasil.push(item)
      continue
    }
    // Pertahankan yang skornya lebih tinggi, catat keduanya sebagai kebutuhan.
    const utama = item.skor > sudah.skor ? item : sudah
    const lain = utama === item ? sudah : item
    utama.kebutuhan = [utama.kind, lain.kind]
    utama.gabungan = true
    const idx = hasil.indexOf(sudah)
    if (utama === item) hasil[idx] = utama
    perUnit.set(item.engine_number, utama)
  }
  return hasil
}

/**
 * Satu orang = satu baris per hari. Dua kebutuhan berbeda (mis. KPB untuk motor
 * A dan STNK untuk motor B) tetap satu pesan; sisanya disimpan sebagai info.
 */
function satukanPerNomor(items) {
  const perNomor = new Map()
  for (const item of items) {
    const kunci = item.phone || `tanpa-hp:${item.kind}:${item.key}`
    const sudah = perNomor.get(kunci)
    if (!sudah) {
      perNomor.set(kunci, { ...item, tertunda_lain: [] })
      continue
    }
    const utama = item.skor > sudah.skor ? { ...item, tertunda_lain: sudah.tertunda_lain } : sudah
    const lain = utama.key === item.key && utama.kind === item.kind ? sudah : item
    utama.tertunda_lain = [...(utama.tertunda_lain || []), { kind: lain.kind, key: lain.key }]
    perNomor.set(kunci, utama)
  }
  return [...perNomor.values()]
}

/**
 * Antrean follow-up terpadu, sudah berurut prioritas.
 *
 * Yang disaring keluar (dan alasannya dilaporkan lewat `tersaring`):
 *  - nomor HP tidak valid  → tidak mungkin dikirimi, hanya memenuhi layar
 *  - baru dihubungi <7 hari → mencegah pola kirim berulang yang memicu blokir
 *  - dijadwalkan hubungi ulang di masa depan → hormati janji konsumen
 */
export async function buildFollowupQueue({ kind, area, search, includeInvalidPhone = false } = {}) {
  const hariIni = new Date()
  const batasHari = awalHariIni()

  const [targetKpb, targetDokumen] = await Promise.all([ambilTargetKpb(hariIni), ambilTargetDokumen(hariIni)])
  const riwayat = await ambilRiwayat(targetKpb, targetDokumen)

  const tersaring = { nomor_tidak_valid: 0, baru_dihubungi: 0, dijadwalkan_nanti: 0 }
  const items = []

  for (const t of [...targetKpb, ...targetDokumen]) {
    const phone = normalizePhone(t.phone_raw)
    if (!phone && !includeInvalidPhone) {
      tersaring.nomor_tidak_valid++
      continue
    }

    const followup = riwayat.get(`${t.kind}:${t.key}`) || null
    const lastContactDays = followup ? selisihHari(hariIni, new Date(followup.followup_at)) : null

    const dijadwalkan = followup?.next_followup_at ? new Date(followup.next_followup_at) : null
    if (dijadwalkan && dijadwalkan > hariIni) {
      tersaring.dijadwalkan_nanti++
      continue
    }
    // Jadwal yang tanggalnya SUDAH TIBA mengalahkan jeda 7 hari. Tanpa
    // pengecualian ini, janji "hubungi saya Sabtu" yang dibuat hari Rabu tetap
    // disembunyikan sampai hari ke-7 — target justru hilang tepat pada hari
    // yang dijanjikan, yang persis kebalikan dari gunanya tombol Jadwalkan.
    // Jeda 7 hari tetap berlaku untuk kontak biasa tanpa jadwal eksplisit.
    if (!dijadwalkan && terlaluBaruDihubungi(lastContactDays)) {
      tersaring.baru_dihubungi++
      continue
    }

    const { skor, alasan } = hitungSkor({
      kind: t.kind,
      daysRemaining: t.days_remaining,
      waitingDays: t.waiting_days,
      lastContactDays,
    })

    items.push({
      ...t,
      phone,
      phone_valid: Boolean(phone),
      skor,
      alasan_prioritas: alasan,
      status: followup?.status || 'belum_dihubungi',
      followup,
      last_contact_days: lastContactDays,
    })
  }

  let hasil = satukanPerNomor(gabungDokumenSeunit(items))

  if (kind && kind !== 'all') hasil = hasil.filter((i) => i.kind === kind || i.kebutuhan?.includes(kind))
  // Tidak peka huruf: kecamatan yang sama ditulis berbeda di dua sumber
  // ("AIR UPAS" vs "Air Upas"), jadi pencocokan persis akan menghasilkan nol.
  if (area && area !== 'all') {
    const target = String(area).trim().toUpperCase()
    hasil = hasil.filter((i) => String(i.area || '').trim().toUpperCase() === target)
  }
  if (search) {
    const q = String(search).toLowerCase().trim()
    hasil = hasil.filter((i) =>
      [i.customer_name, i.phone, i.engine_number, i.no_polisi, i.model]
        .some((v) => String(v || '').toLowerCase().includes(q)))
  }

  // Kunci stabil di akhir supaya urutan tidak berubah-ubah tiap refresh saat
  // skor dan lama tunggu sama persis (sering terjadi: dokumen datang berkelompok).
  hasil.sort((a, b) =>
    b.skor - a.skor ||
    b.waiting_days - a.waiting_days ||
    String(a.key).localeCompare(String(b.key)))

  return {
    data: hasil,
    tersaring,
    ringkasan: {
      total: hasil.length,
      per_jenis: hasil.reduce((acc, i) => { acc[i.kind] = (acc[i.kind] || 0) + 1; return acc }, {}),
      belum_dihubungi: hasil.filter((i) => i.status === 'belum_dihubungi').length,
    },
    batas_hari: batasHari,
  }
}
