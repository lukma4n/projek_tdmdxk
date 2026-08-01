import { prisma } from '../config/db.js'
import { normalizePhone, mapUnitState } from './showroomUtils.js'

const ALLOWED_DURATIONS = new Set([1, 3, 7])
const MIN_PHONE_DIGITS = 9

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

/**
 * Ambil booking aktif (belum dibatalkan, belum kedaluwarsa) untuk sekumpulan
 * engine_number. Dipakai baik oleh GET publik maupun GET internal.
 */
export async function getActiveBookingsMap(engineNumbers) {
  if (!engineNumbers.length) return new Map()
  const rows = await prisma.showroom_unit_bookings.findMany({
    where: {
      engine_number: { in: engineNumbers },
      cancelled_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  })
  // Kalau ada >1 baris aktif untuk engine_number yang sama (seharusnya tidak
  // terjadi karena dicegah saat create), ambil yang terbaru saja.
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.engine_number)) map.set(row.engine_number, row)
  }
  return map
}

/**
 * Lampirkan info booking lengkap (termasuk nomor HP) ke daftar unit internal.
 * Untuk halaman admin -- nomor HP tampil supaya admin bisa langsung
 * menghubungi sales. Mengikuti pola attachKsuToStockUnits di showroomKsu.js.
 */
export async function attachBookingToStockUnits(units) {
  const bookingByEngine = await getActiveBookingsMap(units.map((unit) => unit.engine_number).filter(Boolean))
  return units.map((unit) => {
    const booking = bookingByEngine.get(unit.engine_number)
    return {
      ...unit,
      booking: booking
        ? { id: booking.id, salesman_name: booking.salesman_name, salesman_phone: booking.salesman_phone, expires_at: booking.expires_at }
        : null,
    }
  })
}

/**
 * POST /public/stock-units/:engineNumber/booking
 * Body: { salesman_name, salesman_phone, duration_days }
 *
 * Sales booking unit ready tanpa login. Nama & nomor HP diketik bebas, tidak
 * dicocokkan ke Master Sales -- untuk ukuran tim sales dealer ini penyalah-
 * gunaan akan cepat ketahuan secara sosial.
 */
export async function createUnitBooking(req, res, next) {
  try {
    const engineNumber = String(req.params.engineNumber || '').trim()
    const salesmanName = String(req.body?.salesman_name || '').trim()
    const salesmanPhone = normalizePhone(req.body?.salesman_phone)
    const durationDays = Number(req.body?.duration_days)

    if (!engineNumber) throw badRequest('Nomor mesin wajib diisi')
    if (!salesmanName) throw badRequest('Nama sales wajib diisi')
    if (salesmanPhone.length < MIN_PHONE_DIGITS) throw badRequest('Nomor HP tidak valid')
    if (!ALLOWED_DURATIONS.has(durationDays)) throw badRequest('Durasi booking harus 1, 3, atau 7 hari')

    const unit = await prisma.showroom_stock_units.findUnique({
      where: { engine_number: engineNumber },
      select: { branch_code: true, engine_state: true },
    })
    if (!unit || unit.branch_code !== 'DXK') throw badRequest('Unit tidak ditemukan')
    if (mapUnitState(unit.engine_state).key !== 'ready') {
      throw badRequest('Unit ini tidak berstatus Siap Jual, tidak bisa dibooking')
    }

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

    const booking = await prisma.$transaction(async (tx) => {
      const existing = await tx.showroom_unit_bookings.findFirst({
        where: { engine_number: engineNumber, cancelled_at: null, expires_at: { gt: new Date() } },
      })
      if (existing) {
        const err = new Error('Unit ini sudah dibooking sales lain')
        err.status = 409
        throw err
      }
      return tx.showroom_unit_bookings.create({
        data: { engine_number: engineNumber, salesman_name: salesmanName, salesman_phone: salesmanPhone, expires_at: expiresAt },
      })
    })

    res.status(201).json({
      engine_number: booking.engine_number,
      salesman_name: booking.salesman_name,
      expires_at: booking.expires_at,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /public/stock-units/:engineNumber/booking
 * Body: { salesman_phone }
 *
 * Sales membatalkan booking sendiri -- nomor HP jadi bukti kepemilikan,
 * bukan sesi login. Pesan gagal generik, tidak membocorkan siapa pemesan.
 */
export async function cancelUnitBookingSelf(req, res, next) {
  try {
    const engineNumber = String(req.params.engineNumber || '').trim()
    const salesmanPhone = normalizePhone(req.body?.salesman_phone)

    const booking = await prisma.showroom_unit_bookings.findFirst({
      where: { engine_number: engineNumber, cancelled_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    })

    if (!booking || booking.salesman_phone !== salesmanPhone) {
      const err = new Error('Nomor HP tidak cocok dengan booking ini')
      err.status = 403
      throw err
    }

    await prisma.showroom_unit_bookings.update({
      where: { id: booking.id },
      data: { cancelled_at: new Date() },
    })

    res.json({ cancelled: true })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /showroom/stock-units/:engineNumber/booking/cancel
 * Internal (Admin/Kepala Cabang) -- override tanpa verifikasi nomor HP,
 * untuk kasus sales lupa/tidak bisa akses lagi.
 */
export async function cancelUnitBookingAdmin(req, res, next) {
  try {
    const engineNumber = String(req.params.engineNumber || '').trim()

    const booking = await prisma.showroom_unit_bookings.findFirst({
      where: { engine_number: engineNumber, cancelled_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    })
    if (!booking) throw badRequest('Tidak ada booking aktif untuk unit ini')

    await prisma.showroom_unit_bookings.update({
      where: { id: booking.id },
      data: { cancelled_at: new Date(), cancelled_by_admin: req.user.userId },
    })

    res.json({ cancelled: true })
  } catch (error) {
    next(error)
  }
}
