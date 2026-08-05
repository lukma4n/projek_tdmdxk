import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { normalizePhone, isWablasConfigured, sendWhatsappText, getDeviceInfo, resetDeviceCache, WablasError } from '../src/services/wablasService.js'

const fetchAsli = globalThis.fetch
const envAsli = {
  host: process.env.WABLAS_HOST,
  token: process.env.WABLAS_TOKEN,
  secret: process.env.WABLAS_SECRET,
}

function pasangEnv({ host = 'https://texas.wablas.com', token = 'tok', secret = 'sec' } = {}) {
  process.env.WABLAS_HOST = host
  process.env.WABLAS_TOKEN = token
  process.env.WABLAS_SECRET = secret
}

function palsukanFetch(handler) {
  globalThis.fetch = handler
}

// Sebagian besar tes hanya peduli pada /api/send-message, tapi service kini
// mengecek status device lebih dulu. Helper ini menjawab device/info sebagai
// "connected" lalu meneruskan sisanya ke handler asli tes.
function palsukanFetchTersambung(handlerSend) {
  palsukanFetch(async (url, opsi) => {
    if (String(url).includes('/api/device/info')) {
      return { ok: true, status: 200, json: async () => ({ status: true, data: { status: 'connected', active: true, quota: 4998 } }) }
    }
    return handlerSend(url, opsi)
  })
}

afterEach(() => {
  globalThis.fetch = fetchAsli
  resetDeviceCache()
  for (const [key, nilai] of Object.entries({ WABLAS_HOST: envAsli.host, WABLAS_TOKEN: envAsli.token, WABLAS_SECRET: envAsli.secret })) {
    if (nilai === undefined) delete process.env[key]
    else process.env[key] = nilai
  }
})

test('normalizePhone menyeragamkan format nomor Indonesia', () => {
  assert.equal(normalizePhone('081234567890'), '6281234567890')
  assert.equal(normalizePhone('+62 812-3456-7890'), '6281234567890')
  assert.equal(normalizePhone('6281234567890'), '6281234567890')
  assert.equal(normalizePhone('81234567890'), '6281234567890')
})

test('normalizePhone menolak nomor sampah supaya tidak memakan kuota', () => {
  assert.equal(normalizePhone(''), '')
  assert.equal(normalizePhone(null), '')
  assert.equal(normalizePhone('-'), '')
  assert.equal(normalizePhone('0812'), '') // terlalu pendek
  assert.equal(normalizePhone('0812345678901234'), '') // terlalu panjang
})

test('isWablasConfigured false kalau salah satu env kosong', () => {
  pasangEnv({ token: '' })
  assert.equal(isWablasConfigured(), false)
  pasangEnv()
  assert.equal(isWablasConfigured(), true)
})

test('menolak kirim saat gateway belum dikonfigurasi', async () => {
  pasangEnv({ host: '', token: '', secret: '' })
  await assert.rejects(
    () => sendWhatsappText({ phone: '081234567890', message: 'halo' }),
    (err) => err instanceof WablasError && err.status === 503,
  )
})

test('menolak nomor tidak valid sebelum memanggil gateway', async () => {
  pasangEnv()
  let terpanggil = false
  palsukanFetch(async () => { terpanggil = true })

  await assert.rejects(
    () => sendWhatsappText({ phone: '0812', message: 'halo' }),
    (err) => err instanceof WablasError && err.status === 422,
  )
  assert.equal(terpanggil, false, 'gateway tidak boleh dipanggil untuk nomor sampah')
})

test('mengirim dengan header auth token.secret dan nomor ternormalisasi', async () => {
  pasangEnv({ token: 'TOKEN123', secret: 'SECRET9' })
  let dilihat = null
  palsukanFetchTersambung(async (url, opsi) => {
    dilihat = { url, opsi }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        data: { quota: 97, messages: [{ id: 'uuid-1', phone: '6281234567890', status: 'pending' }] },
      }),
    }
  })

  const hasil = await sendWhatsappText({ phone: '081234567890', message: 'halo', refId: 'kpb-1-KPB1' })

  assert.equal(dilihat.url, 'https://texas.wablas.com/api/send-message')
  assert.equal(dilihat.opsi.headers.Authorization, 'TOKEN123.SECRET9')
  const body = JSON.parse(dilihat.opsi.body)
  assert.equal(body.phone, '6281234567890')
  assert.equal(body.ref_id, 'kpb-1-KPB1')
  assert.deepEqual(hasil, { phone: '6281234567890', messageId: 'uuid-1', deliveryStatus: 'pending', quota: 97 })
})

test('gagal saat Wablas balas status:false walau HTTP 200', async () => {
  // Wablas memakai HTTP 200 untuk kegagalan logis (token invalid, kuota habis),
  // jadi status HTTP saja tidak cukup untuk menyimpulkan pesan terkirim.
  pasangEnv()
  palsukanFetchTersambung(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: false, message: 'token invalid' }),
  }))

  await assert.rejects(
    () => sendWhatsappText({ phone: '081234567890', message: 'halo' }),
    (err) => err instanceof WablasError && /token invalid/.test(err.message),
  )
})

test('gagal rapi saat gateway tidak bisa dihubungi', async () => {
  pasangEnv()
  palsukanFetchTersambung(async () => { throw new Error('ECONNREFUSED') })

  await assert.rejects(
    () => sendWhatsappText({ phone: '081234567890', message: 'halo' }),
    (err) => err instanceof WablasError && err.status === 502,
  )
})

// Wablas memakai mekanisme auth BERBEDA per endpoint: send-message lewat header,
// device/info lewat query param. Menyeragamkannya membuat salah satu selalu gagal
// dengan pesan menyesatkan "token invalid" — tes ini mengunci perbedaan itu.
test('getDeviceInfo memakai query param token, bukan header', async () => {
  pasangEnv({ token: 'TOKEN123', secret: 'SECRET9' })
  let dilihat = null
  palsukanFetch(async (url, opsi) => {
    dilihat = { url, opsi }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        data: {
          name: 'Tunas Honda Ketapang', sender: '6289504400622', quota: 4999,
          expired_date: '2026-09-03', active: true, status: 'connected',
          delay_message: '15 seconds',
        },
      }),
    }
  })

  const info = await getDeviceInfo()
  assert.equal(dilihat.url, 'https://texas.wablas.com/api/device/info?token=TOKEN123')
  assert.equal(dilihat.opsi.headers, undefined, 'device/info tidak memakai header Authorization')
  assert.deepEqual(info, {
    name: 'Tunas Honda Ketapang', sender: '6289504400622', quota: 4999,
    expiredDate: '2026-09-03', connected: true, delayMessage: '15 seconds',
  })
})

test('getDeviceInfo menandai device tidak terhubung', async () => {
  pasangEnv()
  palsukanFetch(async () => ({
    ok: true, status: 200,
    json: async () => ({ status: true, data: { status: 'disconnected', active: true, quota: 10 } }),
  }))
  const info = await getDeviceInfo()
  assert.equal(info.connected, false)
})

// Wablas tetap membalas status:true dan MEMOTONG KUOTA walau device putus —
// pesannya hanya mengantre. Tanpa cek ini sistem mencatat "sudah dihubungi"
// untuk pesan yang tidak pernah sampai (terjadi sungguhan saat uji 2026-08-04).
test('menolak kirim saat device WhatsApp putus, sebelum kuota terpakai', async () => {
  pasangEnv()
  resetDeviceCache()
  let sendDipanggil = false
  palsukanFetch(async (url) => {
    if (String(url).includes('/api/device/info')) {
      return { ok: true, status: 200, json: async () => ({ status: true, data: { status: 'disconnected', active: true, quota: 4998 } }) }
    }
    sendDipanggil = true
    return { ok: true, status: 200, json: async () => ({ status: true, data: { quota: 4997, messages: [{ id: 'x', status: 'pending' }] } }) }
  })

  await assert.rejects(
    () => sendWhatsappText({ phone: '081234567890', message: 'halo' }),
    (err) => err instanceof WablasError && err.status === 503 && /tidak terhubung/.test(err.message),
  )
  assert.equal(sendDipanggil, false, 'send-message tidak boleh dipanggil saat device putus')
})

test('tetap mengirim saat device terhubung', async () => {
  pasangEnv()
  resetDeviceCache()
  palsukanFetch(async (url) => {
    if (String(url).includes('/api/device/info')) {
      return { ok: true, status: 200, json: async () => ({ status: true, data: { status: 'connected', active: true, quota: 4998 } }) }
    }
    return { ok: true, status: 200, json: async () => ({ status: true, data: { quota: 4997, messages: [{ id: 'uuid-9', phone: '6281234567890', status: 'pending' }] } }) }
  })

  const hasil = await sendWhatsappText({ phone: '081234567890', message: 'halo' })
  assert.equal(hasil.messageId, 'uuid-9')
})
