import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'
import { DEFAULT_TEMPLATES } from '../src/services/followupMessages.js'

let cookie

async function cleanup() {
  await prismaTest.whatsapp_templates.deleteMany({})
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  cookie = (await loginAs('test_crm', 'password123')).cookie
})

beforeEach(cleanup)

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

const daftar = async () => (await callAuthenticated('get', '/api/whatsapp-templates', cookie)).body.data
const cari = (data, key) => data.find((t) => t.key === key)

test('semua template tampil, awalnya memakai teks bawaan', async () => {
  const data = await daftar()
  assert.deepEqual(data.map((t) => t.key), ['KPB', 'STNK', 'BPKB', 'STNK_BPKB'])
  for (const t of data) {
    assert.equal(t.is_default, true)
    assert.equal(t.content, DEFAULT_TEMPLATES[t.key])
    assert.ok(t.variables.length > 0)
  }
})

test('template tersimpan menggantikan bawaan', async () => {
  const isi = 'Halo {nama}, waktunya {kpb}.'
  const res = await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: isi })
  assert.equal(res.status, 200)

  const t = cari(await daftar(), 'KPB')
  assert.equal(t.content, isi)
  assert.equal(t.is_default, false)
  assert.ok(t.updated_by)
})

test('variabel salah ketik ditolak — kalau lolos akan terkirim mentah ke konsumen', async () => {
  const res = await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: 'Halo {nam}' })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /\{nam\}/)
  assert.equal(cari(await daftar(), 'KPB').is_default, true, 'tidak boleh tersimpan')
})

test('variabel milik template lain juga ditolak', async () => {
  // {link_cek} valid untuk STNK, tapi tidak tersedia di KPB.
  const res = await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: 'Halo {link_cek}' })
  assert.equal(res.status, 400)
})

test('melebihi 1024 karakter ditolak — gateway akan menolaknya saat kirim', async () => {
  const res = await callAuthenticated('put', '/api/whatsapp-templates/STNK', cookie, { content: 'A'.repeat(1100) })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /1024/)
})

test('isi kosong ditolak', async () => {
  const res = await callAuthenticated('put', '/api/whatsapp-templates/BPKB', cookie, { content: '   ' })
  assert.equal(res.status, 400)
})

test('kunci template tidak dikenal ditolak', async () => {
  const res = await callAuthenticated('put', '/api/whatsapp-templates/SIM', cookie, { content: 'apa saja' })
  assert.equal(res.status, 400)
})

test('menyimpan membuat versi baru, versi lama disimpan bukan ditimpa', async () => {
  await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: 'Versi satu {nama}' })
  await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: 'Versi dua {nama}' })

  const res = await callAuthenticated('get', '/api/whatsapp-templates/KPB/history', cookie)
  assert.equal(res.body.data.length, 2)
  assert.equal(res.body.data[0].content, 'Versi dua {nama}')
  assert.equal(res.body.data[0].is_active, true)
  assert.equal(res.body.data[1].is_active, false, 'hanya satu versi yang boleh aktif')
})

test('kembalikan ke bawaan tanpa menghapus riwayat', async () => {
  await callAuthenticated('put', '/api/whatsapp-templates/KPB', cookie, { content: 'Sementara {nama}' })
  const res = await callAuthenticated('post', '/api/whatsapp-templates/KPB/reset', cookie, {})
  assert.equal(res.status, 200)

  const t = cari(await daftar(), 'KPB')
  assert.equal(t.is_default, true)
  assert.equal(t.content, DEFAULT_TEMPLATES.KPB)

  const riwayat = await callAuthenticated('get', '/api/whatsapp-templates/KPB/history', cookie)
  assert.equal(riwayat.body.data.length, 1, 'versi lama tetap tersimpan')
  assert.equal(riwayat.body.data[0].is_active, false)
})

test('pratinjau merender contoh data tanpa menyimpan', async () => {
  const res = await callAuthenticated('post', '/api/whatsapp-templates/KPB/preview', cookie, {
    content: 'Halo {nama}, motor {tipe_motor} waktunya {kpb}.',
  })
  assert.equal(res.status, 200)
  assert.match(res.body.preview, /Halo BUDI SANTOSO, motor VARIO125 waktunya KPB1\./)
  assert.equal(res.body.batas, 1024)
  assert.equal(cari(await daftar(), 'KPB').is_default, true, 'pratinjau tidak boleh menyimpan')
})

test('pratinjau memakai aturan validasi yang sama dengan simpan', async () => {
  const res = await callAuthenticated('post', '/api/whatsapp-templates/KPB/preview', cookie, { content: 'Halo {salah}' })
  assert.equal(res.status, 400)
})
