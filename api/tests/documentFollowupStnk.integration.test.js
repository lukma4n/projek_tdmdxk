import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers, loginAs, callAuthenticated } from './helpers.js'

// Regresi temuan audit: daftar follow-up STNK dulu ikut menarik stnk_status
// SUDAH_DIAMBIL. Di produksi 14.503 dari 15.565 baris adalah dokumen yang sudah
// dibawa pulang konsumen, semuanya berlabel "Belum Dihubungi", padahal template
// WhatsApp-nya menyuruh konsumen datang mengambil.
const PREFIX = 'DOCFU-'
const ENG_BELUM = `${PREFIX}BELUM-001`
const ENG_SUDAH = `${PREFIX}SUDAH-001`
const ENG_BELUM_JADI = `${PREFIX}BELUMJADI-001`
const ENG_BPKB = `${PREFIX}BPKB-001`

let crmCookie

async function cleanup() {
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: { startsWith: PREFIX } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
  crmCookie = (await loginAs('test_crm', 'password123')).cookie

  const dasar = { branch_code: 'DXK', branch_name: 'DXK', lokasi_stnk: 'DEALER', lokasi_bpkb: 'DEALER' }
  await prismaTest.showroom_stnk_bpkb_tracks.createMany({
    data: [
      // STNK jadi, belum diserahkan → memang perlu ditagih
      { ...dasar, engine_number: ENG_BELUM, stnk_status: 'BELUM_DIAMBIL', bpkb_status: 'BELUM_JADI', stnk_name: 'Konsumen Belum Ambil', series: 'SCOOPY', category_name: 'MATIC LOW END', no_polisi: 'KB4216GAC', mobile: '081255500011', tgl_terima_stnk: new Date() },
      // STNK sudah diserahkan → tidak boleh muncul
      { ...dasar, engine_number: ENG_SUDAH, stnk_status: 'SUDAH_DIAMBIL', bpkb_status: 'SUDAH_DIAMBIL', stnk_name: 'Konsumen Sudah Ambil' },
      // STNK belum jadi → juga tidak boleh muncul
      { ...dasar, engine_number: ENG_BELUM_JADI, stnk_status: 'BELUM_JADI', bpkb_status: 'BELUM_JADI', stnk_name: 'Konsumen STNK Belum Jadi' },
      // BPKB cash siap diambil → untuk memastikan sisi BPKB tidak ikut berubah
      { ...dasar, engine_number: ENG_BPKB, stnk_status: 'SUDAH_DIAMBIL', bpkb_status: 'BELUM_DIAMBIL', finance_company: null, tgl_jadi_bpkb: new Date(), stnk_name: 'Konsumen BPKB Cash', series: 'VARIO125', category_name: 'MATIC MID END', no_polisi: 'KB7788ZZ', mobile: '081255500022' },
    ],
  })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('follow-up STNK hanya menampilkan yang sudah jadi tapi belum diserahkan', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/STNK?limit=100', crmCookie)
  assert.equal(res.status, 200)

  const punyaKita = res.body.data.filter((r) => String(r.engine_number).startsWith(PREFIX))
  const nomorMesin = punyaKita.map((r) => r.engine_number)

  assert.deepEqual(nomorMesin, [ENG_BELUM])
  assert.ok(!nomorMesin.includes(ENG_SUDAH), 'STNK yang sudah diambil tidak boleh ikut ditagih')
  assert.ok(!nomorMesin.includes(ENG_BELUM_JADI), 'STNK yang belum jadi tidak boleh ditagih')
})

test('follow-up BPKB cash tidak terpengaruh perubahan filter STNK', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/BPKB?limit=100', crmCookie)
  assert.equal(res.status, 200)

  const nomorMesin = res.body.data
    .filter((r) => String(r.engine_number).startsWith(PREFIX))
    .map((r) => r.engine_number)

  assert.deepEqual(nomorMesin, [ENG_BPKB])
})

// ── Filter usia dokumen ────────────────────────────────────────────────────
const HARI = 24 * 60 * 60 * 1000
const umur = (hari) => new Date(Date.now() - hari * HARI)

test('setiap baris membawa usia dan rentangnya, untuk STNK maupun BPKB', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/STNK?limit=100', crmCookie)
  const baris = res.body.data.find((r) => r.engine_number === ENG_BELUM)
  assert.equal(typeof baris.waiting_days, 'number')
  assert.ok('aging_bucket' in baris)

  const bpkb = await callAuthenticated('get', '/api/showroom/document-followups/BPKB?limit=100', crmCookie)
  const barisBpkb = bpkb.body.data.find((r) => r.engine_number === ENG_BPKB)
  assert.equal(typeof barisBpkb.waiting_days, 'number')
})

test('dokumen dikelompokkan ke rentang usia yang benar', async () => {
  const kasus = [
    [`${PREFIX}AGE-10`, 10, '1-30'],
    [`${PREFIX}AGE-45`, 45, '31-60'],
    [`${PREFIX}AGE-75`, 75, '61-90'],
    [`${PREFIX}AGE-120`, 120, '91-180'],
    [`${PREFIX}AGE-250`, 250, '181-365'],
    [`${PREFIX}AGE-500`, 500, '365+'],
  ]
  await prismaTest.showroom_stnk_bpkb_tracks.createMany({
    data: kasus.map(([eng, hari]) => ({
      branch_code: 'DXK', branch_name: 'DXK', engine_number: eng, stnk_name: `Umur ${hari}`,
      stnk_status: 'BELUM_DIAMBIL', lokasi_stnk: 'DEALER', tgl_terima_stnk: umur(hari),
      bpkb_status: 'BELUM_JADI',
    })),
  })

  const res = await callAuthenticated('get', '/api/showroom/document-followups/STNK?limit=200', crmCookie)
  for (const [eng, hari, harapan] of kasus) {
    const baris = res.body.data.find((r) => r.engine_number === eng)
    assert.ok(baris, `${eng} harus ada`)
    assert.equal(baris.aging_bucket, harapan, `${hari} hari harus masuk ${harapan}`)
  }
})

test('memilih satu rentang TIDAK meruntuhkan jumlah di rentang lain', async () => {
  // Kalau byAging dihitung setelah filter, semua chip selain yang dipilih jadi
  // 0 dan admin tidak bisa berpindah rentang.
  //
  // Sengaja diperiksa dalam SATU respons, bukan membandingkan dua request:
  // file tes lain menulis ke tabel yang sama secara bersamaan, jadi dua request
  // berurutan bisa melihat jumlah yang berbeda tanpa ada yang salah.
  const res = await callAuthenticated('get', '/api/showroom/document-followups/STNK?limit=1&aging=91-180', crmCookie)
  const byAging = res.body.summary.byAging

  assert.equal(res.body.pagination.total, byAging['91-180'], 'hasil filter harus sama dengan angka di chip')

  const rentangLain = Object.entries(byAging).filter(([k]) => k !== '91-180')
  assert.ok(
    rentangLain.some(([, jml]) => jml > 0),
    'rentang lain harus tetap punya angka, bukan runtuh jadi 0 semua',
  )
})

test('jumlah semua rentang menjumlah tepat ke total', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/STNK?limit=1', crmCookie)
  const jumlah = Object.values(res.body.summary.byAging).reduce((a, b) => a + b, 0)
  assert.equal(jumlah, res.body.summary.total)
})

test('daftar rentang ikut dikirim supaya frontend tidak perlu menghardcode', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/BPKB?limit=1', crmCookie)
  assert.equal(res.body.agingBuckets.length, 6)
  assert.deepEqual(res.body.agingBuckets.map((b) => b.value), ['1-30', '31-60', '61-90', '91-180', '181-365', '365+'])
})

test('draf STNK menyebut tipe motor dan nomor polisi yang sebenarnya', async () => {
  // Regresi: perender sempat membaca item.series/item.no_polisi, padahal baris
  // di sini hasil trackToFollowupRow yang memakai nama lain (model,
  // police_number). Salah baca tidak error — pesannya diam-diam berbunyi
  // "motor Honda Honda dengan nomor polisi -" dan itu terkirim ke konsumen.
  const res = await callAuthenticated('get', '/api/showroom/document-followups/stnk', crmCookie)
  assert.equal(res.status, 200)
  const baris = res.body.data.find((r) => r.engine_number === ENG_BELUM)
  assert.ok(baris, 'baris uji harus ada')

  assert.match(baris.draft_message, /motor Honda SCOOPY dengan nomor polisi KB4216GAC/)
  assert.doesNotMatch(baris.draft_message, /Honda Honda/)
  assert.doesNotMatch(baris.draft_message, /nomor polisi -/)
  assert.match(baris.wa_url, /^https:\/\/wa\.me\/6281255500011\?text=/)
})

test('draf BPKB juga menyebut tipe motor dan nomor polisi', async () => {
  // Baris BPKB dulu tidak memetakan police_number sama sekali.
  const res = await callAuthenticated('get', '/api/showroom/document-followups/bpkb', crmCookie)
  const baris = res.body.data.find((r) => r.engine_number === ENG_BPKB)
  assert.ok(baris, 'baris BPKB uji harus ada')
  assert.match(baris.draft_message, /motor Honda VARIO125 dengan nomor polisi KB7788ZZ/)
})

test('baris membawa jumlah kontak dan jarak kontak terakhir', async () => {
  // Penanda urutan garap: status saja tidak cukup untuk memutuskan siapa
  // berikutnya — yang menentukan adalah sudah berapa kali dan berapa lama lalu.
  const user = await prismaTest.users.findUnique({ where: { username: 'test_crm' } })
  const duaHariLalu = new Date()
  duaHariLalu.setDate(duaHariLalu.getDate() - 2)

  await prismaTest.showroom_document_followups.createMany({
    data: [
      { document_type: 'STNK', engine_number: ENG_BELUM, status: 'sudah_dihubungi', created_by: user.id, followup_at: new Date('2026-01-01') },
      { document_type: 'STNK', engine_number: ENG_BELUM, status: 'sudah_dihubungi', created_by: user.id, followup_at: duaHariLalu },
    ],
  })

  const res = await callAuthenticated('get', '/api/showroom/document-followups/stnk', crmCookie)
  const baris = res.body.data.find((r) => r.engine_number === ENG_BELUM)
  assert.equal(baris.followup_count, 2, 'dihitung semua kontak, bukan cuma yang terakhir')
  assert.equal(baris.last_contact_days, 2)

  await prismaTest.showroom_document_followups.deleteMany({ where: { engine_number: ENG_BELUM } })
})

test('yang belum pernah dihubungi ditandai jelas', async () => {
  const res = await callAuthenticated('get', '/api/showroom/document-followups/stnk', crmCookie)
  const baris = res.body.data.find((r) => r.engine_number === ENG_BELUM)
  assert.equal(baris.followup_count, 0)
  assert.equal(baris.last_contact_days, null, 'null, bukan 0 — belum pernah bukan berarti hari ini')
})
