import { logger } from '../utils/logger.js'

// Integrasi WhatsApp gateway Wablas.
//
// PENTING — mekanisme auth Wablas BERBEDA per endpoint (diverifikasi langsung ke
// texas.wablas.com, 2026-08-04):
//   /api/send-message  -> header `Authorization: {token}.{secret}`
//                         (dikirim lewat query param ditolak "token is null")
//   /api/device/info   -> query param `?token={token}`
//                         (dikirim lewat header ditolak "token invalid")
// Jangan diseragamkan; menyalin pola satu endpoint ke endpoint lain akan gagal
// dengan pesan yang menyesatkan seolah-olah tokennya salah.
//
// Host berbeda per akun (texas/solo/jogja/...) dan token TIDAK berlaku lintas
// host, jadi ketiganya wajib datang dari .env — tidak ada default yang di-hardcode.
const WABLAS_TIMEOUT_MS = 20000

function getConfig() {
  return {
    host: (process.env.WABLAS_HOST || '').trim().replace(/\/+$/, ''),
    token: (process.env.WABLAS_TOKEN || '').trim(),
    secret: (process.env.WABLAS_SECRET || '').trim(),
  }
}

export function isWablasConfigured() {
  const { host, token, secret } = getConfig()
  return Boolean(host && token && secret)
}

// 08xx / +62xx / 62xx / spasi & strip → 62xx. Mengembalikan '' kalau tidak layak
// kirim, supaya nomor sampah tidak memakan kuota.
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''

  let msisdn = digits
  if (msisdn.startsWith('0')) msisdn = `62${msisdn.slice(1)}`
  else if (!msisdn.startsWith('62')) msisdn = `62${msisdn}`

  // Nomor Indonesia: 62 + 9..13 digit. Di luar itu hampir pasti salah input.
  if (msisdn.length < 11 || msisdn.length > 15) return ''
  return msisdn
}

export class WablasError extends Error {
  constructor(message, { status = 502, detail = null } = {}) {
    super(message)
    this.name = 'WablasError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Status device & sisa kuota. Read-only, tidak mengirim pesan apa pun.
 * Perhatikan: endpoint ini pakai query param, BUKAN header (lihat catatan di atas).
 */
export async function getDeviceInfo() {
  const { host, token } = getConfig()
  if (!host || !token) {
    throw new WablasError('WhatsApp gateway belum dikonfigurasi (WABLAS_HOST/TOKEN/SECRET).', { status: 503 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WABLAS_TIMEOUT_MS)
  let payload
  try {
    const response = await fetch(`${host}/api/device/info?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
    payload = await response.json().catch(() => null)
  } catch (error) {
    const pesan = error.name === 'AbortError' ? 'timeout' : error.message
    throw new WablasError(`Tidak bisa menghubungi gateway WhatsApp: ${pesan}`, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }

  if (!payload || payload.status !== true) {
    throw new WablasError(`Gagal membaca status device: ${payload?.message || 'balasan tidak dikenal'}`, { status: 502 })
  }

  const d = payload.data || {}
  return {
    name: d.name || null,
    sender: d.sender || null,
    quota: d.quota ?? null,
    expiredDate: d.expired_date || null,
    // `data.status` (bukan `payload.status`) yang menyatakan koneksi device.
    connected: d.status === 'connected' && d.active === true,
    delayMessage: d.delay_message || null,
  }
}

// Cache status device supaya pengiriman beruntun tidak menambah satu HTTP call
// per pesan. Pendek saja — device bisa putus kapan pun.
const DEVICE_CACHE_MS = 60000
let deviceCache = null

export function resetDeviceCache() {
  deviceCache = null
}

// Wablas tetap membalas `status:true` DAN memotong kuota walau device sedang
// putus — pesannya cuma mengantre dan bisa tidak pernah sampai. Tanpa cek ini,
// sistem mencatat "sudah dihubungi" untuk pesan yang tidak pernah diterima
// konsumen. Terbukti terjadi saat uji 2026-08-04 (nomor gateway dibatasi
// WhatsApp, device disconnected, kuota tetap terpotong).
async function pastikanDeviceSiap() {
  if (deviceCache && Date.now() - deviceCache.waktu < DEVICE_CACHE_MS) {
    if (!deviceCache.info.connected) {
      throw new WablasError('Device WhatsApp sedang tidak terhubung. Sambungkan ulang di dashboard Wablas sebelum mengirim.', { status: 503 })
    }
    return deviceCache.info
  }

  const info = await getDeviceInfo()
  deviceCache = { waktu: Date.now(), info }
  if (!info.connected) {
    throw new WablasError('Device WhatsApp sedang tidak terhubung. Sambungkan ulang di dashboard Wablas sebelum mengirim.', { status: 503 })
  }
  return info
}

/**
 * Kirim satu pesan teks. Melempar WablasError kalau gagal — pemanggil yang
 * memutuskan apakah follow-up tetap dicatat atau tidak.
 */
export async function sendWhatsappText({ phone, message, refId = null }) {
  const { host, token, secret } = getConfig()
  if (!host || !token || !secret) {
    throw new WablasError('WhatsApp gateway belum dikonfigurasi (WABLAS_HOST/TOKEN/SECRET).', { status: 503 })
  }

  const msisdn = normalizePhone(phone)
  if (!msisdn) {
    throw new WablasError('Nomor HP konsumen tidak valid atau kosong.', { status: 422 })
  }
  if (!String(message || '').trim()) {
    throw new WablasError('Isi pesan kosong.', { status: 422 })
  }

  // Dicek setelah validasi lokal supaya nomor/pesan sampah tidak memicu HTTP call.
  await pastikanDeviceSiap()

  const body = { phone: msisdn, message: String(message) }
  if (refId) body.ref_id = String(refId)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WABLAS_TIMEOUT_MS)

  let response
  let payload
  try {
    response = await fetch(`${host}/api/send-message`, {
      method: 'POST',
      headers: {
        Authorization: `${token}.${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    payload = await response.json().catch(() => null)
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new WablasError('Gateway WhatsApp tidak merespons (timeout).', { status: 504 })
    }
    throw new WablasError(`Tidak bisa menghubungi gateway WhatsApp: ${error.message}`, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }

  // Wablas membalas HTTP 200 dengan status:false untuk kegagalan logis
  // (token invalid, kuota habis, device disconnect), jadi HTTP status saja
  // tidak cukup untuk menyimpulkan berhasil.
  if (!response.ok || !payload || payload.status !== true) {
    const detail = payload?.message || `HTTP ${response.status}`
    logger.error(null, 'Wablas gagal mengirim pesan', { phone: msisdn, detail })
    throw new WablasError(`Gagal mengirim WhatsApp: ${detail}`, { status: 502, detail: payload })
  }

  const first = payload.data?.messages?.[0] || null
  return {
    phone: msisdn,
    messageId: first?.id || null,
    deliveryStatus: first?.status || 'pending',
    quota: payload.data?.quota ?? null,
  }
}
