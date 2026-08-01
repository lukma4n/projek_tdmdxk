import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { prisma } from '../config/db.js'
import { isTokenUsed, markTokenUsed } from '../services/usedTokenStore.js'
import { PRODUCT_CODE_ALIASES, getAgingFifoDays, getAgingTagByIncomingDate, normalizePhone, mapUnitState } from './showroomUtils.js'
import { getActiveBookingsMap } from './unitBookingController.js'

// Umur token permintaan ambil dokumen yang dikeluarkan /check setelah verifikasi.
// Konsumen sudah terverifikasi identitasnya saat /check — token ini hanya
// membuktikan bahwa permintaan pickup datang dari sesi verifikasi yang valid,
// tanpa perlu OTP/gateway WhatsApp terpisah.
const PICKUP_TOKEN_TTL = '15m'

/**
 * Daftar dokumen yang siap diambil konsumen (sudah jadi, belum diserahkan,
 * dan untuk konsumen — BPKB leasing dikeluarkan). Konsisten dengan logika
 * banner "Dokumen Siap Diambil" di halaman /cek (frontend).
 */
function eligiblePickupDocs(track) {
  const docs = []
  if (track.tgl_terima_stnk && !track.tgl_penyerahan_stnk) docs.push('STNK')
  if (track.tgl_terima_plat && !track.tgl_penyerahan_plat) docs.push('PLAT')
  const forConsumer = !(track.finance_company && String(track.finance_company).trim())
  // Kesiapan BPKB memakai tgl_jadi_bpkb, sama seperti getAvailableDocuments
  // dan seluruh modul BPKB lain (tgl_terima_bpkb = tanggal terima berkas,
  // bukan tanda BPKB siap serah). Pada data sekarang keduanya selalu terisi
  // bersamaan, tapi kalau suatu saat berbeda, konsumen tidak boleh diundang
  // mengambil BPKB yang di sisi internal belum muncul sebagai siap.
  if (forConsumer && track.tgl_jadi_bpkb && !track.tgl_penyerahan_bpkb) docs.push('BPKB')
  return docs
}

// Warna tersimpan format "HM-HITAM MERAH" (kode-nama). Ambil bagian nama agar
// enak dibaca; bila tak ada pemisah, pakai apa adanya.
function prettyColor(color) {
  if (!color) return 'Lainnya'
  const s = String(color).trim()
  const dash = s.indexOf('-')
  return dash > 0 && dash <= 4 ? s.slice(dash + 1).trim() : s
}

/**
 * Publik: cek ketersediaan unit (browse per model/warna) untuk sales & kontrol
 * movement unit oleh PIC POS. Dikelompokkan per series (model). Menampilkan
 * no. mesin, no. rangka, dan harga OTR (keputusan dealer — halaman publik).
 * Tetap TIDAK mengembalikan cost/HPP/harga beli dealer (data internal).
 * Query: ?q=<kata kunci model> & ?location=<lokasi> (opsional).
 */
export async function checkStockUnits(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    const locationFilter = String(req.query.location || '').trim()

    // Unit cabang DXK saja (parser memang hanya impor DXK).
    const units = await prisma.showroom_stock_units.findMany({
      where: { branch_code: 'DXK' },
      select: {
        series: true,
        product_type: true,
        category_name: true,
        parent_category: true,
        color: true,
        location: true,
        incoming_date: true,
        stock_aging_days: true,
        movement_aging_days: true,
        year: true,
        engine_state: true,
        engine_number: true,
        chassis_number: true,
      },
    })

    // Petakan harga OTR per product_type (konsisten dgn enrichStockUnitsWithPrices).
    const productCodes = [...new Set(units.map((u) => PRODUCT_CODE_ALIASES[u.product_type] || u.product_type).filter(Boolean))]
    const otrRows = productCodes.length
      ? await prisma.showroom_otr_prices.findMany({
          where: { product_code: { in: productCodes } },
          select: { product_code: true, otr_price: true },
        })
      : []
    const otrByCode = new Map(otrRows.map((r) => [r.product_code, r.otr_price]))
    const otrOf = (u) => otrByCode.get(PRODUCT_CODE_ALIASES[u.product_type] || u.product_type) ?? null

    // Booking aktif per unit -- hanya nama & batas waktu yang publik, nomor
    // HP tidak pernah dikirim ke response ini.
    const bookingByEngine = await getActiveBookingsMap(units.map((u) => u.engine_number).filter(Boolean))

    // Daftar lokasi (selalu semua, tidak terpengaruh filter) untuk dropdown.
    const availableLocations = [...new Set(units.map((u) => u.location || 'Lainnya'))].sort((a, b) => a.localeCompare(b))

    // Terapkan filter lokasi untuk agregasi & statistik.
    const working = locationFilter
      ? units.filter((u) => (u.location || 'Lainnya') === locationFilter)
      : units

    // Statistik keseluruhan (mengikuti filter lokasi) untuk ringkasan header.
    const overall = { total: working.length, ready: 0, reserved: 0, not_ready: 0 }
    for (const u of working) {
      const st = mapUnitState(u.engine_state)
      if (st.key === 'ready') overall.ready++
      else if (st.key === 'reserved') overall.reserved++
      else if (st.key === 'not_ready') overall.not_ready++
    }

    // Kelompokkan per series (model), terapkan filter q bila ada.
    const groups = new Map()
    for (const u of working) {
      const series = (u.series || 'LAINNYA').trim()
      const haystack = `${series} ${u.category_name || ''} ${u.parent_category || ''}`.toLowerCase()
      if (q && !haystack.includes(q)) continue

      if (!groups.has(series)) {
        groups.set(series, {
          series,
          category_name: u.category_name || null,
          parent_category: u.parent_category || null,
          total: 0, ready: 0, reserved: 0, not_ready: 0,
          _colors: new Map(),
          _locations: new Map(),
          _otrs: new Set(),
          units: [],
        })
      }
      const g = groups.get(series)
      const st = mapUnitState(u.engine_state)
      g.total++
      if (st.key === 'ready') g.ready++
      else if (st.key === 'reserved') g.reserved++
      else if (st.key === 'not_ready') g.not_ready++

      const color = prettyColor(u.color)
      const c = g._colors.get(color) || { color, count: 0, ready: 0 }
      c.count++
      if (st.key === 'ready') c.ready++
      g._colors.set(color, c)

      const loc = u.location || 'Lainnya'
      g._locations.set(loc, (g._locations.get(loc) || 0) + 1)

      const otr = otrOf(u)
      if (otr) g._otrs.add(otr)

      g.units.push({
        color,
        product_code: u.product_type || null,
        location: loc,
        engine_number: u.engine_number || null,
        chassis_number: u.chassis_number || null,
        otr_price: otr,
        // Aging FIFO (POS/Pameran pakai movement_aging_days; lain sejak incoming_date)
        // + Tag aging huruf A–L — konsisten dgn halaman Stock Unit Showroom.
        aging_days: getAgingFifoDays(u),
        aging_tag: getAgingTagByIncomingDate(u.incoming_date),
        year: u.year || null,
        status: st.key,
        status_label: st.label,
        booking: bookingByEngine.has(u.engine_number)
          ? {
              salesman_name: bookingByEngine.get(u.engine_number).salesman_name,
              expires_at: bookingByEngine.get(u.engine_number).expires_at,
            }
          : null,
      })
    }

    const models = [...groups.values()].map((g) => {
      const otrs = [...g._otrs]
      return {
        series: g.series,
        category_name: g.category_name,
        parent_category: g.parent_category,
        total: g.total,
        ready: g.ready,
        reserved: g.reserved,
        not_ready: g.not_ready,
        otr_min: otrs.length ? Math.min(...otrs) : null,
        otr_max: otrs.length ? Math.max(...otrs) : null,
        colors: [...g._colors.values()].sort((a, b) => b.count - a.count),
        locations: [...g._locations.entries()]
          .map(([location, count]) => ({ location, count }))
          .sort((a, b) => b.count - a.count),
        units: g.units.sort((a, b) => b.aging_days - a.aging_days),
      }
    }).sort((a, b) => b.ready - a.ready || b.total - a.total || a.series.localeCompare(b.series))

    res.json({ overall, available_locations: availableLocations, location: locationFilter || null, model_count: models.length, models })
  } catch (err) {
    next(err)
  }
}

/**
 * public check for STNK / BPKB status
 * Query params: engine_number + (phone OR chassis = 4 digit terakhir No. Rangka)
 */
export async function checkStnkBpkb(req, res, next) {
  try {
    const { engine_number, phone, chassis } = req.query

    // Verifikasi: Nomor Mesin + salah satu dari (Nomor HP) ATAU (4 digit terakhir Nomor Rangka).
    if (!engine_number || (!phone && !chassis)) {
      return res.status(400).json({ error: 'Nomor Mesin dan (Nomor HP atau 4 digit terakhir Nomor Rangka) wajib diisi' })
    }

    // Normalisasi input
    const cleanEngine = String(engine_number).trim().toUpperCase()
    const cleanPhone = normalizePhone(phone)
    const cleanChassis = String(chassis || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

    // Cari track berdasarkan nomor mesin (unique)
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: cleanEngine }
    })

    const NOT_FOUND = 'Data tidak ditemukan atau data verifikasi tidak sesuai. Periksa kembali Nomor HP / 4 digit terakhir Nomor Rangka, atau hubungi dealer.'

    if (!track) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Cocok bila 6 digit terakhir Nomor HP cocok (toleran +62/08/62) ATAU 4 digit
    // terakhir Nomor Rangka cocok (fallback bila nomor HP konsumen sudah berganti).
    let verified = false

    if (cleanPhone.length >= 6) {
      const dbPhone = normalizePhone(track.mobile)
      if (dbPhone) {
        const len = Math.min(6, cleanPhone.length, dbPhone.length)
        if (cleanPhone.slice(-len) === dbPhone.slice(-len)) verified = true
      }
    }

    if (!verified && cleanChassis.length >= 4) {
      const dbChassis = String(track.chassis_number || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (dbChassis.length >= 4 && cleanChassis.slice(-4) === dbChassis.slice(-4)) verified = true
    }

    if (!verified) {
      return res.status(404).json({ error: NOT_FOUND })
    }

    // Response — data ditampilkan penuh (tanpa masking), sesuai keputusan dealer.
    const responseData = {
      engine_number: track.engine_number,
      chassis_number: track.chassis_number || null,
      stnk_name: track.stnk_name || null,
      branch_name: track.branch_name,
      no_polisi: track.no_polisi || null,
      series: track.series || null,

      // Faktur Milestone
      faktur: {
        tgl_mohon: track.tgl_mohon_faktur,
        tgl_terima: track.tgl_terima_faktur,
        no_faktur: track.no_faktur || null,
        is_done: !!track.tgl_terima_faktur
      },

      // STNK & Plat Milestone
      stnk: {
        status: track.stnk_status || 'PROSES',
        tgl_proses: track.tgl_proses_stnk,
        tgl_selesai: track.tgl_terima_stnk,
        tgl_penyerahan: track.tgl_penyerahan_stnk,
        no_stnk: track.no_stnk || null,
        lokasi: track.lokasi_stnk || null,
        is_done: !!track.tgl_terima_stnk,
        is_delivered: !!track.tgl_penyerahan_stnk
      },

      // Plat Milestone
      plat: {
        tgl_selesai: track.tgl_terima_plat,
        tgl_penyerahan: track.tgl_penyerahan_plat,
        no_plat: track.no_plat || null,
        is_done: !!track.tgl_terima_plat,
        is_delivered: !!track.tgl_penyerahan_plat
      },

      // BPKB Milestone
      // BPKB hanya untuk konsumen CASH. Bila ada finance_company (leasing/finance
      // company apa pun: FIF, Adira, IMFI, OTO, dll), BPKB diserahkan cabang ke
      // leasing → bukan untuk diambil konsumen.
      bpkb: {
        status: track.bpkb_status || 'PROSES',
        tgl_selesai: track.tgl_terima_bpkb,
        tgl_penyerahan: track.tgl_penyerahan_bpkb,
        no_bpkb: track.no_bpkb || null,
        lokasi: track.lokasi_bpkb || null,
        penerima: track.nama_penerima_bpkb || null,
        finance_company: track.finance_company || null,
        for_consumer: !(track.finance_company && String(track.finance_company).trim()),
        is_done: !!track.tgl_terima_bpkb,
        is_delivered: !!track.tgl_penyerahan_bpkb
      }
    }

    // FASE 2: keluarkan token pickup + daftar dokumen yang siap diambil.
    // Hanya bila ada dokumen eligible (sudah jadi, belum diserahkan, untuk
    // konsumen). Frontend menampilkan form permintaan ambil dokumen bila
    // pickup_eligible true. Token berumur pendek, signed JWT_SECRET.
    const pickupDocs = eligiblePickupDocs(track)
    if (pickupDocs.length) {
      responseData.pickup_eligible = true
      responseData.pickup_docs = pickupDocs
      responseData.pickup_token = jwt.sign(
        { engine_number: track.engine_number, purpose: 'pickup' },
        process.env.JWT_SECRET,
        { expiresIn: PICKUP_TOKEN_TTL, jwtid: randomUUID() }
      )
    } else {
      responseData.pickup_eligible = false
      responseData.pickup_docs = []
    }

    // Status pengiriman via ekspedisi (kalau ada) -- supaya konsumen bisa cek
    // ulang tanpa perlu token/login, cukup dengan Nomor Mesin + HP/rangka yang
    // sudah lolos verifikasi di atas.
    const shipmentRows = await prisma.document_handovers.findMany({
      where: { engine_number: track.engine_number, handover_mode: 'ekspedisi' },
      select: {
        document_type: true,
        status: true,
        tracking_number: true,
        updated_at: true,
        assigned_courier: { select: { name: true } },
      },
      orderBy: { updated_at: 'desc' },
    })
    const SHIPMENT_DOC_LABEL = { STNK: 'STNK', BPKB: 'BPKB', PLAT: 'Plat Nomor', BUKU_SERVICE: 'Buku Service' }
    responseData.shipments = shipmentRows.map((row) => ({
      document_type: row.document_type,
      document_label: SHIPMENT_DOC_LABEL[row.document_type] || row.document_type,
      status: row.status, // tersedia | dikirim_ekspedisi | selesai
      tracking_number: row.tracking_number || null,
      courier_name: row.assigned_courier?.name || null,
      updated_at: row.updated_at,
    }))

    res.json(responseData)
  } catch (err) {
    next(err)
  }
}

/**
 * FASE 2: permintaan ambil dokumen yang diajukan konsumen dari /cek.
 * Multipart form: field { engine_number, pickup_token, consumer_phone, preferred_time?, notes? }
 * + file `ktp_photo` (WAJIB, JPEG/PNG, max 10MB).
 * Token harus valid (dikeluarkan /check untuk engine_number yang sama, belum kedaluwarsa).
 * Membuat baris showroom_pickup_requests berstatus PENDING — masuk feed notifikasi staf.
 */
export async function requestPickup(req, res, next) {
  try {
    const { engine_number, pickup_token, consumer_phone, preferred_time, notes, delivery_method, shipping_address } = req.body || {}

    if (!engine_number || !pickup_token) {
      return res.status(400).json({ error: 'Nomor Mesin dan token permintaan wajib diisi' })
    }

    const cleanDeliveryMethod = delivery_method === 'EKSPEDISI' ? 'EKSPEDISI' : 'AMBIL_SENDIRI'
    if (cleanDeliveryMethod === 'EKSPEDISI' && !String(shipping_address || '').trim()) {
      return res.status(400).json({ error: 'Alamat pengiriman wajib diisi untuk pengiriman via ekspedisi.' })
    }

    // Verifikasi token DULU — pastikan dikeluarkan /check untuk engine yang sama.
    // (File sudah tersimpan via multer; tolak token invalid sebelum memproses lebih jauh.)
    let payload
    try {
      payload = jwt.verify(pickup_token, process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ error: 'Token permintaan tidak valid atau kedaluwarsa. Silakan periksa ulang status dokumen Anda.' })
    }

    if (payload.purpose !== 'pickup' || payload.engine_number !== String(engine_number).trim().toUpperCase()) {
      return res.status(401).json({ error: 'Token permintaan tidak sesuai dengan Nomor Mesin.' })
    }

    // One-time-use: tolak token yang sudah pernah dipakai (cegah replay).
    if (isTokenUsed(payload.jti)) {
      return res.status(409).json({ error: 'Permintaan ini sudah dikirim sebelumnya. Silakan periksa ulang status dokumen Anda jika ingin mengajukan lagi.' })
    }

    // Foto KTP wajib dilampirkan — staf memverifikasi identitas saat pengambilan.
    if (!req.file) {
      return res.status(400).json({ error: 'Foto KTP wajib dilampirkan (format JPG/PNG, maks 10MB).' })
    }

    const cleanEngine = String(engine_number).trim().toUpperCase()
    const cleanPhone = normalizePhone(consumer_phone)

    // Ambil data track untuk nama konsumen + cabang + dokumen eligible saat ini
    // (status bisa berubah sejak token dikeluarkan). Jika tidak ada dokumen
    // eligible lagi, tolak — tidak ada yang bisa diambil.
    const track = await prisma.showroom_stnk_bpkb_tracks.findUnique({
      where: { engine_number: cleanEngine }
    })
    if (!track) {
      return res.status(404).json({ error: 'Data unit tidak ditemukan.' })
    }

    const eligibleDocs = eligiblePickupDocs(track)
    if (!eligibleDocs.length) {
      return res.status(409).json({ error: 'Saat ini tidak ada dokumen yang siap diambil. Status dokumen mungkin sudah berubah — silakan periksa ulang.' })
    }

    // Gunakan daftar dokumen dari server (eligibleDocs) sebagai sumber kebenaran;
    // abaikan requested_docs dari klien untuk mencegah permintaan dokumen yang
    // belum siap / di luar eligible.
    const request = await prisma.showroom_pickup_requests.create({
      data: {
        engine_number: cleanEngine,
        branch_code: track.branch_code || null,
        branch_name: track.branch_name || null,
        consumer_name: track.stnk_name || null,
        consumer_phone: cleanPhone || track.mobile || null,
        requested_docs: eligibleDocs.join(', '),
        preferred_time: preferred_time ? String(preferred_time).slice(0, 120) : null,
        notes: notes ? String(notes).slice(0, 1000) : null,
        ktp_photo_url: `/uploads/pickup-ktp/${req.file.filename}`,
        status: 'PENDING',
        delivery_method: cleanDeliveryMethod,
        shipping_address: cleanDeliveryMethod === 'EKSPEDISI' ? String(shipping_address).trim().slice(0, 500) : null,
      }
    })

    // Tandai token terpakai setelah request berhasil dibuat (one-time-use).
    // TTL = sisa umur token agar entri dibersihkan saat token kedaluwarsa.
    const ttlMs = (payload.exp ? payload.exp * 1000 : Date.now()) - Date.now()
    markTokenUsed(payload.jti, ttlMs)

    res.status(201).json({
      id: request.id,
      status: request.status,
      requested_docs: request.requested_docs,
      message: 'Permintaan ambil dokumen berhasil dikirim. Staf kami akan menghubungi Anda untuk penjadwalan pengambilan.'
    })
  } catch (err) {
    next(err)
  }
}
