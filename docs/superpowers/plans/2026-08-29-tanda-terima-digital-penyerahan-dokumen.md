# Tanda Terima Digital Penyerahan Dokumen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerbitkan tanda terima penyerahan STNK/BPKB yang ditandatangani digital oleh petugas dan konsumen di perangkat petugas, lalu diarsipkan sebagai PDF ber-hash bersama foto bukti — menggantikan berkas fisik.

**Architecture:** Memperluas langkah `serah_ke_konsumen` / `ekspedisi_ke_konsumen` di `addHandoverStep`, bukan alur baru. Nomor tanda terima diterbitkan di dalam transaksi bersama penyimpanan langkah; PDF disusun setelah transaksi commit lalu di-*update* balik ke baris langkah. PDF deterministik dari data tersimpan, jadi kegagalan penyusunan bisa dipulihkan dengan membangun ulang selama `receipt_pdf_sha256` masih null.

**Tech Stack:** Node.js + Express 5 + Prisma + SQLite, `pdfkit` (baru), React 19 + Tailwind v4, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-29-tanda-terima-digital-penyerahan-dokumen-design.md`

## Global Constraints

- **Branch `feat/tanda-terima-digital`. JANGAN merge ke `main` dan jangan push ke produksi** — produksi deploy dari `main`.
- Tanda terima hanya untuk **STNK dan BPKB**. `BUKU_SERVICE` dan `PLAT` tidak menerbitkan tanda terima.
- Kolom **"Mengetahui" (ADH) tidak ada** di form. Hanya dua tanda tangan: yang menyerahkan dan penerima.
- **Tidak ada langkah cetak** dalam alur. PDF hanya tersimpan.
- Format nomor: `TT-STNK/DXK/26/08/00001` dan `TT-BPKB/DXK/26/08/00001`. Awalan `TT-` wajib — membedakan dari nomor DMS `ENCS`/`ENCB`.
- Surat kuasa wajib **hanya untuk BPKB** bila penerima bukan konsumen. STNK tidak wajib.
- Tahun pembuatan yang tidak dikenali **dikosongkan, bukan ditebak**.
- Nama yang menyerahkan selalu `users.name` petugas yang login — tidak pernah diketik.
- **SQLite tidak punya `mode: 'insensitive'`** — pakai `LOWER()` raw SQL atau normalisasi di memori.
- **Jangan pakai `toISOString()` untuk tanggal lokal** — pakai `getFullYear`/`getMonth`/`getDate`.
- Perubahan skema pakai **`npx prisma db push`**, bukan `migrate dev/deploy` (migrate rusak di setup ini).
- **Setiap test integrasi WAJIB menyetel `process.env.DATABASE_URL = 'file:./test.db'` sebelum meng-import `helpers.js`.** Kalau tidak, app menembak `dev.db` (data kerja asli) sementara `prismaTest` menyemai `test.db`, dan `loginAs()` gagal dengan 401.
- Route statis harus dideklarasikan **sebelum** route ber-param `:id` (Express 5 strict routing).

## File Structure

**Sudah selesai sebelum plan ini ditulis (belum ada test):**

| File | Tanggung jawab |
|---|---|
| `api/prisma/schema.prisma` | 8 kolom tanda terima di `document_handover_steps` + model `unit_color_names`. Sudah `db push`. |
| `api/src/utils/vehicleIdentity.js` | `deriveProductionYear`, `formatMerkType`, `formatColorName` |
| `api/src/services/receiptNumberService.js` | `buildReceiptPrefix`, `issueReceiptNumber` |

**Dibuat oleh plan ini:**

| File | Tanggung jawab |
|---|---|
| `api/src/services/receiptDataService.js` | Kumpulkan seluruh field form dari `tracks` + `customers` + peta warna |
| `api/src/services/receiptPdfService.js` | Susun PDF A4, hitung SHA-256, simpan berkas |
| `api/src/controllers/unitColorController.js` | Baca & isi manual peta nama warna |
| `web/src/components/common/SignaturePad.jsx` | Canvas tanda tangan, tanpa dependensi |
| `web/src/pages/ShowroomUnitColors.jsx` | Halaman isi nama warna |
| `api/tests/vehicleIdentity.test.js` | Unit test turunan identitas |
| `api/tests/receiptNumber.test.js` | Unit test penerbit nomor |
| `api/tests/receiptData.integration.test.js` | Integrasi pengumpul data |
| `api/tests/receiptPdf.test.js` | Unit test penyusun PDF + hash |
| `api/tests/documentHandoverReceipt.integration.test.js` | Integrasi alur serah terima bertanda tangan |
| `api/tests/unitColors.integration.test.js` | Integrasi API peta warna |

**Dimodifikasi:**

| File | Perubahan |
|---|---|
| `api/src/services/importParsers.js:460` | `no_ktp` dari kolom 78 → 79 |
| `api/src/controllers/showroomImport.js` | Panen `unit_color_names` sebelum `deleteMany` |
| `api/src/controllers/documentHandoverController.js` | `addHandoverStep` diperluas + `getReceiptPdf` baru |
| `api/src/routes/showroomRoutes.js` | Field upload baru + 3 route baru |
| `api/src/services/backupService.js` | `createUploadsBackup` baru |
| `api/scripts/backup-db.js` | Panggil backup uploads + retensinya |
| `web/src/pages/ShowroomDocumentHandover.jsx` | Modal serah terima + riwayat |
| `web/src/services/api/showroom.js` | Fungsi API baru |
| `web/src/App.jsx` | Route halaman peta warna |

---

### Task 1: Test untuk utilitas identitas kendaraan

Kode `vehicleIdentity.js` sudah ada tapi belum punya test sama sekali. Turunan tahun adalah inti dari seluruh fitur — kalau salah, setiap tanda terima mencetak tahun yang keliru.

**Files:**
- Test: `api/tests/vehicleIdentity.test.js` (create)
- Read-only: `api/src/utils/vehicleIdentity.js`

**Interfaces:**
- Consumes: `deriveProductionYear(chassisNumber) -> number|null`, `formatMerkType(productCode, parentCategory) -> string|null`, `formatColorName(code, colorMap) -> string|null` dari `api/src/utils/vehicleIdentity.js`
- Produces: tidak ada; task ini hanya mengunci perilaku

- [ ] **Step 1: Tulis test yang gagal**

Buat `api/tests/vehicleIdentity.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveProductionYear,
  formatMerkType,
  formatColorName,
} from '../src/utils/vehicleIdentity.js'

// Dua nomor rangka ini diambil dari tanda terima DMS asli yang dipakai sebagai
// acuan format. Tahun harapannya sama persis dengan yang tercetak di form.
test('tahun pembuatan cocok dengan tanda terima DMS asli', () => {
  assert.equal(deriveProductionYear('KC0411SK036977'), 2025)
  assert.equal(deriveProductionYear('JMH11XTK409060'), 2026)
})

test('tahun pembuatan mendukung format 17 karakter berawalan MH1', () => {
  // Karakter ke-10 pada VIN penuh = karakter ke-7 setelah awalan MH1 dilepas.
  assert.equal(deriveProductionYear('MH1EF3114SK001246'), 2025)
  assert.equal(deriveProductionYear('MH1JBG119FK186305'), 2015)
})

test('tahun pembuatan memetakan seluruh kode VIN yang dipakai', () => {
  const harapan = {
    F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020,
    M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026,
  }
  for (const [kode, tahun] of Object.entries(harapan)) {
    // Rangka 14 karakter: kode tahun di indeks 6.
    const rangka = `ABCDEF${kode}K123456`
    assert.equal(deriveProductionYear(rangka), tahun, `kode ${kode}`)
  }
})

test('tahun pembuatan null bila tidak dikenali — tidak boleh menebak', () => {
  assert.equal(deriveProductionYear('ABCDEFIK123456'), null, 'huruf I bukan kode VIN')
  assert.equal(deriveProductionYear('ABCDEFOK123456'), null, 'huruf O bukan kode VIN')
  assert.equal(deriveProductionYear('PENDEK'), null, 'panjang tidak dikenal')
  assert.equal(deriveProductionYear(''), null)
  assert.equal(deriveProductionYear(null), null)
  assert.equal(deriveProductionYear(undefined), null)
  assert.equal(deriveProductionYear(12345), null)
})

test('tahun pembuatan menerima huruf kecil dan spasi berlebih', () => {
  assert.equal(deriveProductionYear('  jmh11xtk409060  '), 2026)
})

test('merk/type menggabungkan kode produk dan transmisi', () => {
  assert.equal(formatMerkType('ML2A', 'AT'), 'ML2A / A/T')
  assert.equal(formatMerkType('EG2', 'SPORT'), 'EG2 / M/T')
  assert.equal(formatMerkType('LP0B', 'CUB'), 'LP0B / M/T')
})

test('merk/type null bila kode produk kosong', () => {
  assert.equal(formatMerkType('', 'AT'), null)
  assert.equal(formatMerkType(null, 'AT'), null)
})

test('warna memakai nama lengkap bila kodenya dikenal', () => {
  const peta = new Map([['BK', 'BK-BLACK'], ['MH', 'MH-MERAH HITAM']])
  assert.equal(formatColorName('BK', peta), 'BK-BLACK')
  assert.equal(formatColorName('mh', peta), 'MH-MERAH HITAM')
})

test('warna jatuh ke kode apa adanya bila belum ada di peta', () => {
  const peta = new Map([['BK', 'BK-BLACK']])
  // Lebih baik mencetak "PH" daripada mengosongkan warna sama sekali.
  assert.equal(formatColorName('PH', peta), 'PH')
  assert.equal(formatColorName('PH', undefined), 'PH')
  assert.equal(formatColorName('', peta), null)
})
```

- [ ] **Step 2: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/vehicleIdentity.test.js`
Expected: PASS semua. Kode sudah ada, test ini mengunci perilakunya. Kalau ada yang gagal, perbaiki `vehicleIdentity.js` — bukan test-nya.

- [ ] **Step 3: Commit**

```bash
git add api/tests/vehicleIdentity.test.js
git commit -m "test: kunci turunan tahun VIN dan merk/type tanda terima"
```

---

### Task 2: Test untuk penerbit nomor tanda terima

**Files:**
- Test: `api/tests/receiptNumber.test.js` (create)
- Read-only: `api/src/services/receiptNumberService.js`

**Interfaces:**
- Consumes: `buildReceiptPrefix(documentType, branchCode?, now?) -> string`, `issueReceiptNumber(tx, documentType, { branchCode?, now? }) -> Promise<string>`
- Produces: tidak ada

- [ ] **Step 1: Tulis test yang gagal**

Buat `api/tests/receiptNumber.test.js`. Test ini memakai *stub* `tx`, bukan database — penerbit nomor hanya butuh satu query `findFirst`, jadi tidak perlu DB nyata dan test-nya jadi cepat serta deterministik.

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReceiptPrefix,
  issueReceiptNumber,
} from '../src/services/receiptNumberService.js'

// Stub minimal: hanya menyediakan findFirst yang dipakai issueReceiptNumber.
function stubTx(lastReceiptNumber) {
  const calls = []
  return {
    calls,
    document_handover_steps: {
      findFirst: async (args) => {
        calls.push(args)
        return lastReceiptNumber ? { receipt_number: lastReceiptNumber } : null
      },
    },
  }
}

test('awalan memakai TT- agar tidak tertukar dengan nomor DMS', () => {
  const agustus = new Date(2026, 7, 29)
  assert.equal(buildReceiptPrefix('STNK', 'DXK', agustus), 'TT-STNK/DXK/26/08/')
  assert.equal(buildReceiptPrefix('BPKB', 'DXK', agustus), 'TT-BPKB/DXK/26/08/')
})

test('awalan memakai tanggal lokal, bukan UTC', () => {
  // 1 Januari 2026 pukul 01.00 WIB masih 31 Desember 2025 di UTC.
  // toISOString akan menghasilkan bulan 12 tahun 25 — salah.
  const awalTahun = new Date(2026, 0, 1, 1, 0, 0)
  assert.equal(buildReceiptPrefix('STNK', 'DXK', awalTahun), 'TT-STNK/DXK/26/01/')
})

test('awalan menolak jenis dokumen selain STNK dan BPKB', () => {
  assert.throws(() => buildReceiptPrefix('BUKU_SERVICE'), /hanya untuk STNK dan BPKB/)
  assert.throws(() => buildReceiptPrefix('PLAT'), /hanya untuk STNK dan BPKB/)
})

test('nomor pertama di bulan itu mulai dari 00001', async () => {
  const tx = stubTx(null)
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00001')
})

test('nomor berikutnya melanjutkan urutan terakhir', async () => {
  const tx = stubTx('TT-STNK/DXK/26/08/00041')
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00042')
})

test('urutan STNK dan BPKB terpisah', async () => {
  const tx = stubTx(null)
  await issueReceiptNumber(tx, 'BPKB', { now: new Date(2026, 7, 29) })
  assert.equal(tx.calls[0].where.receipt_number.startsWith, 'TT-BPKB/DXK/26/08/')
})

test('urutan kembali ke 00001 saat bulan berganti', async () => {
  // Pencarian dibatasi awalan bulan berjalan, jadi nomor bulan lalu tak terlihat.
  const tx = stubTx(null)
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 8, 1) })
  assert.equal(nomor, 'TT-STNK/DXK/26/09/00001')
  assert.equal(tx.calls[0].where.receipt_number.startsWith, 'TT-STNK/DXK/26/09/')
})

test('nomor di-pad 5 digit agar urutan leksikografis sama dengan numerik', async () => {
  const tx = stubTx('TT-STNK/DXK/26/08/00009')
  const nomor = await issueReceiptNumber(tx, 'STNK', { now: new Date(2026, 7, 29) })
  assert.equal(nomor, 'TT-STNK/DXK/26/08/00010')
  assert.equal(tx.calls[0].orderBy.receipt_number, 'desc')
})
```

- [ ] **Step 2: Jalankan test**

Run: `cd api && node --test tests/receiptNumber.test.js`
Expected: PASS semua.

- [ ] **Step 3: Commit**

```bash
git add api/tests/receiptNumber.test.js
git commit -m "test: kunci format dan urutan nomor tanda terima"
```

---

### Task 3: Parser sales membaca KTP sesuai STNK

Report Penjualan punya dua kolom KTP: 78 `KTP Customer` dan 79 `KTP Customer STNK`. Parser sekarang membaca 78. Tanda terima mencantumkan KTP pemilik **sesuai STNK/BPKB**, jadi yang benar kolom 79. Biasanya sama, tapi tidak selalu — misalnya motor dibeli atas nama orang tua.

**Files:**
- Modify: `api/src/services/importParsers.js:460`
- Test: `api/tests/importParsers.test.js` (tambah test, jangan buat file baru)

**Interfaces:**
- Consumes: parser sales yang sudah ada
- Produces: `customers.no_ktp` kini berisi nilai kolom 79

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `api/tests/importParsers.test.js`. Berkas itu sudah punya helper `writeWorkbook(rows)` dan meng-import `parseSalesFile` — pakai keduanya, jangan buat yang baru. `parseSalesFile` melewati 6 baris pertama sebagai header, jadi baris data harus di posisi ke-7.

```js
test('parser sales memakai kolom 79 (KTP Customer STNK), bukan kolom 78', async () => {
  const baris = []
  baris[0] = 1
  baris[1] = 'DXK'
  baris[4] = 'SO/DXK/26/08/00999'
  baris[5] = 'Done'
  baris[6] = 46263                 // serial tanggal Excel, wajib angka
  baris[15] = 'UJI KTP'
  baris[16] = 'ML2A'
  baris[17] = 'BK'
  baris[19] = 'UJIENGINE0001'
  baris[20] = 'UJIFRAME00001'
  baris[50] = 'AT'
  baris[51] = 'BEAT SPORTY'
  baris[55] = 'KAB. KETAPANG'
  baris[57] = 'TUMBANG TITI'
  baris[78] = '9999999999999999'   // KTP Customer -- TIDAK boleh dipakai
  baris[79] = '6104131204050002'   // KTP Customer STNK -- yang benar

  const headerRows = Array.from({ length: 6 }, () => ['header'])
  const { dir, filePath } = await writeWorkbook([...headerRows, baris])
  try {
    const { records } = await parseSalesFile(filePath)
    assert.equal(records.length, 1)
    assert.equal(records[0].no_ktp, '6104131204050002')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/importParsers.test.js`
Expected: FAIL — `no_ktp` masih berisi `'9999999999999999'`.

- [ ] **Step 3: Ubah parser**

Di `api/src/services/importParsers.js`, ganti baris `no_ktp`:

```js
        // Kolom 78 "KTP Customer" vs 79 "KTP Customer STNK". Tanda terima
        // mencantumkan KTP pemilik sesuai STNK/BPKB, jadi yang dipakai 79.
        // Umumnya sama, tapi tidak selalu -- mis. motor atas nama orang tua.
        no_ktp: String(row[79] || ''),
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/importParsers.test.js`
Expected: PASS semua, termasuk test parser lama.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/importParsers.js api/tests/importParsers.test.js
git commit -m "fix(import): ambil KTP sesuai STNK (kolom 79) untuk tanda terima"
```

---

### Task 4: Panen peta nama warna saat import stok unit

Nama warna lengkap (`BK-BLACK`) hanya ada di Report Stock Unit. Import stok unit menghapus baris unit yang sudah terjual, jadi nama itu lewat lalu hilang. Task ini memanennya sebelum penghapusan.

**Files:**
- Modify: `api/src/controllers/showroomImport.js` — di dalam `runShowroomSnapshotImport`
- Test: `api/tests/unitColors.integration.test.js` (create)

**Interfaces:**
- Consumes: `runShowroomSnapshotImport({ req, records, errors, model, module, recordId, backupReason, includeKsuCleanup })`
- Produces: baris `unit_color_names` dengan `{ code, name, source: 'import' }`

- [ ] **Step 1: Tulis test yang gagal**

Buat `api/tests/unitColors.integration.test.js`:

```js
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers } from './helpers.js'
import { harvestColorNames } from '../src/controllers/showroomImport.js'

const KODE_UJI = ['ZQ', 'ZR', 'ZS']

async function cleanup() {
  await prismaTest.unit_color_names.deleteMany({ where: { code: { in: KODE_UJI } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('memanen kode dan nama warna dari record import', async () => {
  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-1', color: 'ZQ-HITAM UJI' },
    { engine_number: 'UJI-2', color: 'ZR-PUTIH UJI' },
  ])

  const zq = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZQ' } })
  assert.equal(zq.name, 'ZQ-HITAM UJI')
  assert.equal(zq.source, 'import')
})

test('mengabaikan warna tanpa tanda hubung dan warna kosong', async () => {
  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-3', color: 'ZS' },
    { engine_number: 'UJI-4', color: '' },
    { engine_number: 'UJI-5', color: null },
    { engine_number: 'UJI-6' },
  ])

  const zs = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZS' } })
  assert.equal(zs, null, 'kode tanpa nama tidak boleh disimpan')
})

test('tidak menimpa nama yang sudah diisi manual', async () => {
  await prismaTest.unit_color_names.create({
    data: { code: 'ZQ', name: 'ZQ-DIISI MANUAL', source: 'manual' },
  }).catch(async () => {
    await prismaTest.unit_color_names.update({
      where: { code: 'ZQ' },
      data: { name: 'ZQ-DIISI MANUAL', source: 'manual' },
    })
  })

  await harvestColorNames(prismaTest, [
    { engine_number: 'UJI-7', color: 'ZQ-HITAM UJI' },
  ])

  const zq = await prismaTest.unit_color_names.findUnique({ where: { code: 'ZQ' } })
  assert.equal(zq.name, 'ZQ-DIISI MANUAL', 'isian manual harus menang')
  assert.equal(zq.source, 'manual')
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/unitColors.integration.test.js`
Expected: FAIL — `harvestColorNames` belum diekspor.

- [ ] **Step 3: Tulis implementasi**

Di `api/src/controllers/showroomImport.js`, tambahkan fungsi ini (diekspor, di atas `runShowroomSnapshotImport`):

```js
/**
 * Panen peta kode warna -> nama lengkap dari record import stok unit.
 *
 * Report Stock Unit membawa warna sebagai "BK-BLACK", satu-satunya tempat nama
 * lengkap itu tersedia. Baris unit yang sudah terjual dihapus di import
 * berikutnya, jadi tanpa panen ini namanya hilang dan tanda terima cuma bisa
 * mencetak kode "BK".
 *
 * Isian manual tidak pernah ditimpa — petugas mengisi kode yang tidak pernah
 * muncul di stok, dan import tidak boleh membatalkan pekerjaan itu.
 */
export async function harvestColorNames(client, records) {
  const byCode = new Map()

  for (const record of records) {
    const color = (record?.color || '').trim()
    const separator = color.indexOf('-')
    // Tanpa tanda hubung berarti tidak ada nama, cuma kode -- tidak berguna.
    if (separator <= 0) continue

    const code = color.slice(0, separator).trim().toUpperCase()
    if (code) byCode.set(code, color)
  }

  for (const [code, name] of byCode) {
    const existing = await client.unit_color_names.findUnique({ where: { code } })
    if (existing?.source === 'manual') continue

    await client.unit_color_names.upsert({
      where: { code },
      update: { name, source: 'import' },
      create: { code, name, source: 'import' },
    })
  }

  return byCode.size
}
```

- [ ] **Step 4: Panggil dari import stok unit**

Di `runShowroomSnapshotImport`, di dalam `prisma.$transaction(async (tx) => {`, **sebelum** `deleteMany` dijalankan — tepat setelah `upsertRecordsInTx`:

```js
    const { created, updated } = await upsertRecordsInTx(tx, { records, model, uniqueField: 'engine_number' })

    // Panen nama warna SEBELUM baris unit terjual dihapus di bawah. Setelah
    // deleteMany berjalan, nama lengkapnya tidak bisa didapat lagi.
    if (model === 'showroom_stock_units') {
      await harvestColorNames(tx, records)
    }

    const deleted = await tx[model].deleteMany({
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/unitColors.integration.test.js`
Expected: PASS semua.

- [ ] **Step 6: Pastikan import lama tidak rusak**

Run: `cd api && node --test tests/import.integration.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add api/src/controllers/showroomImport.js api/tests/unitColors.integration.test.js
git commit -m "feat(import): panen nama warna unit sebelum baris terjual dihapus"
```

---

### Task 5: Pengumpul data tanda terima

Satu tempat yang menyatukan `showroom_stnk_bpkb_tracks`, `customers`, dan peta warna menjadi satu objek siap cetak. Dipisah dari penyusun PDF supaya bisa diuji tanpa membuat berkas.

**Files:**
- Create: `api/src/services/receiptDataService.js`
- Test: `api/tests/receiptData.integration.test.js` (create)

**Interfaces:**
- Consumes: `deriveProductionYear`, `formatMerkType`, `formatColorName` dari `api/src/utils/vehicleIdentity.js`
- Produces: `collectReceiptData(client, { engineNumber, documentType }) -> Promise<ReceiptData|null>` dengan bentuk:
  ```
  {
    document_type, owner_name, owner_address, owner_province, owner_ktp,
    merk_type, model_name, production_year, color_name,
    chassis_number, engine_number, no_polisi, document_number, no_plat
  }
  ```
  `null` bila nomor mesin tidak ada di tabel track.

- [ ] **Step 1: Tulis test yang gagal**

Buat `api/tests/receiptData.integration.test.js`:

```js
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import { prismaTest, seedKnownUsers } from './helpers.js'
import { collectReceiptData } from '../src/services/receiptDataService.js'

const ENG = 'RCPT-DATA-0001'
const SO = 'SO/DXK/26/08/RCPT1'

async function cleanup() {
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: ENG } })
  await prismaTest.customers.deleteMany({ where: { so_number: SO } })
  await prismaTest.unit_color_names.deleteMany({ where: { code: 'BK' } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'Cabang Ketapang',
      engine_number: ENG,
      chassis_number: 'JMH11XTK409060',
      stnk_name: 'HEPRI FAHRIANSYAH',
      partner_address: 'Jl Pematang Teratai',
      no_polisi: 'KB6912GAR',
      no_stnk: '22012900I',
      no_bpkb: 'W06560023',
      no_plat: 'KB6912GAR',
    },
  })

  await prismaTest.customers.create({
    data: {
      customer_name: 'HEPRI FAHRIANSYAH',
      so_number: SO,
      so_date: new Date(2026, 0, 15),
      no_engine: ENG,
      no_ktp: '6104160501060003',
      product_code: 'ML2A',
      type: 'AT',
      model: 'SCOOPY',
      color: 'BK',
      alamat_konsumen: 'TUMBANG TITI, KAB. KETAPANG',
    },
  })

  await prismaTest.unit_color_names.create({
    data: { code: 'BK', name: 'BK-BLACK', source: 'import' },
  })
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('mengumpulkan seluruh field tanda terima STNK', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: ENG, documentType: 'STNK' })

  assert.equal(data.owner_name, 'HEPRI FAHRIANSYAH')
  assert.equal(data.owner_address, 'Jl Pematang Teratai')
  assert.equal(data.owner_province, 'KALIMANTAN BARAT')
  assert.equal(data.owner_ktp, '6104160501060003')
  assert.equal(data.merk_type, 'ML2A / A/T')
  assert.equal(data.model_name, 'SCOOPY')
  assert.equal(data.production_year, 2026)
  assert.equal(data.color_name, 'BK-BLACK')
  assert.equal(data.chassis_number, 'JMH11XTK409060')
  assert.equal(data.engine_number, ENG)
  assert.equal(data.no_polisi, 'KB6912GAR')
  assert.equal(data.document_number, '22012900I', 'STNK memakai no_stnk')
})

test('tanda terima BPKB memakai nomor BPKB', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: ENG, documentType: 'BPKB' })
  assert.equal(data.document_number, 'W06560023')
})

test('null bila nomor mesin tidak ada di tabel track', async () => {
  const data = await collectReceiptData(prismaTest, { engineNumber: 'TIDAK-ADA', documentType: 'STNK' })
  assert.equal(data, null)
})

test('tetap jalan meski data konsumen tidak ketemu', async () => {
  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'Cabang Ketapang',
      engine_number: 'RCPT-DATA-YATIM',
      chassis_number: 'JMH11XTK409061',
      stnk_name: 'TANPA SO',
      no_stnk: '999',
    },
  })

  const data = await collectReceiptData(prismaTest, {
    engineNumber: 'RCPT-DATA-YATIM',
    documentType: 'STNK',
  })

  assert.equal(data.owner_name, 'TANPA SO')
  assert.equal(data.owner_ktp, null)
  assert.equal(data.merk_type, null)
  assert.equal(data.production_year, 2026, 'tahun tetap dari nomor rangka')

  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: 'RCPT-DATA-YATIM' } })
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/receiptData.integration.test.js`
Expected: FAIL — modul `receiptDataService.js` belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `api/src/services/receiptDataService.js`:

```js
/**
 * Pengumpul data untuk tanda terima penyerahan dokumen.
 *
 * Menyatukan tiga sumber:
 *   - showroom_stnk_bpkb_tracks : identitas pemilik & nomor dokumen
 *   - customers                 : KTP, kode produk, model, kode warna
 *   - unit_color_names          : nama warna lengkap
 *
 * Dipisah dari penyusun PDF supaya isinya bisa diuji tanpa membuat berkas.
 */

import {
  deriveProductionYear,
  formatMerkType,
  formatColorName,
} from '../utils/vehicleIdentity.js'

// Cabang Ketapang hanya melayani satu provinsi; tanda terima DMS pun mencetak
// baris ini sebagai teks tetap di bawah alamat.
const PROVINCE = 'KALIMANTAN BARAT'

export async function collectReceiptData(client, { engineNumber, documentType }) {
  const track = await client.showroom_stnk_bpkb_tracks.findUnique({
    where: { engine_number: engineNumber },
  })
  if (!track) return null

  // Join lewat nomor mesin -- cocok untuk 19.990 dari 19.995 baris. Sisanya
  // tetap bisa dicetak, hanya field asal customers yang kosong.
  const customer = await client.customers.findFirst({
    where: { no_engine: engineNumber },
  })

  const colorCode = (customer?.color || '').trim().toUpperCase()
  let colorMap
  if (colorCode) {
    const row = await client.unit_color_names.findUnique({ where: { code: colorCode } })
    colorMap = new Map(row ? [[row.code, row.name]] : [])
  }

  return {
    document_type: documentType,

    owner_name: track.stnk_name || null,
    owner_address: track.partner_address || customer?.alamat_konsumen || null,
    owner_province: PROVINCE,
    owner_ktp: customer?.no_ktp || null,

    merk_type: formatMerkType(customer?.product_code, customer?.type),
    model_name: customer?.model || track.series || null,
    production_year: deriveProductionYear(track.chassis_number),
    color_name: formatColorName(customer?.color, colorMap),

    chassis_number: track.chassis_number || null,
    engine_number: track.engine_number,
    no_polisi: track.no_polisi || null,
    no_plat: track.no_plat || null,

    document_number: documentType === 'BPKB' ? (track.no_bpkb || null) : (track.no_stnk || null),
  }
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/receiptData.integration.test.js`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/receiptDataService.js api/tests/receiptData.integration.test.js
git commit -m "feat(tanda-terima): kumpulkan data form dari track, customer, dan peta warna"
```

---

### Task 6: Penyusun PDF tanda terima

**Files:**
- Create: `api/src/services/receiptPdfService.js`
- Test: `api/tests/receiptPdf.test.js` (create)
- Modify: `api/package.json` (dependensi `pdfkit`)

**Interfaces:**
- Consumes: `ReceiptData` dari `collectReceiptData` (Task 5)
- Produces: `generateReceiptPdf({ receiptNumber, data, giverName, receiverName, items, signatureGiverPath, signatureReceiverPath, issuedAt }) -> Promise<{ urlPath, absolutePath, sha256 }>`

- [ ] **Step 1: Pasang pdfkit**

Run: `cd api && npm install pdfkit`

`pdfkit` dipilih karena JavaScript murni tanpa headless browser. Puppeteer ditolak: menambah ~300MB Chromium di VPS yang juga menjalankan API, Nginx, dan SQLite.

- [ ] **Step 2: Tulis test yang gagal**

Buat `api/tests/receiptPdf.test.js`:

```js
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import crypto from 'crypto'

import { generateReceiptPdf } from '../src/services/receiptPdfService.js'

const dibuat = []

const DATA = {
  document_type: 'BPKB',
  owner_name: 'DARWIN',
  owner_address: 'Jl Pasir Mayang',
  owner_province: 'KALIMANTAN BARAT',
  owner_ktp: '6104160811960005',
  merk_type: 'KG0 / M/T',
  model_name: 'CB150 VERZA CW',
  production_year: 2025,
  color_name: 'BK-BLACK',
  chassis_number: 'KC0411SK036977',
  engine_number: 'KC04E1037046',
  no_polisi: 'KB4223GAQ',
  no_plat: 'KB4223GAQ',
  document_number: 'W06560023',
}

after(async () => {
  for (const p of dibuat) await fs.unlink(p).catch(() => {})
})

test('menyusun PDF dan mengembalikan hash isinya', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-BPKB/DXK/26/08/00001',
    data: DATA,
    giverName: 'MUHAMMAD HARIS SAPUTRA',
    receiverName: 'DARWIN',
    items: ['BPKB', 'Copy Faktur', 'NIK'],
    issuedAt: new Date(2026, 7, 29, 12, 29),
  })
  dibuat.push(hasil.absolutePath)

  const isi = await fs.readFile(hasil.absolutePath)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF', 'berkas harus PDF sungguhan')

  const hashSebenarnya = crypto.createHash('sha256').update(isi).digest('hex')
  assert.equal(hasil.sha256, hashSebenarnya, 'hash harus cocok dengan isi berkas')
  assert.equal(hasil.sha256.length, 64)

  assert.match(hasil.urlPath, /^\/uploads\/tanda-terima\//)
})

test('nama berkas memuat nomor tanda terima yang aman untuk path', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-STNK/DXK/26/08/00042',
    data: { ...DATA, document_type: 'STNK', document_number: '22012900I' },
    giverName: 'LUKMAN',
    receiverName: 'RINALDI AKBAR HASZ',
    items: ['STNK', 'Plat'],
    issuedAt: new Date(2026, 7, 29, 12, 27),
  })
  dibuat.push(hasil.absolutePath)

  // Garis miring di nomor tidak boleh jadi sub-folder.
  assert.ok(!hasil.urlPath.includes('TT-STNK/DXK'), 'garis miring harus diganti')
  assert.match(hasil.urlPath, /TT-STNK-DXK-26-08-00042/)
})

test('tetap menyusun PDF walau tahun dan KTP kosong', async () => {
  const hasil = await generateReceiptPdf({
    receiptNumber: 'TT-STNK/DXK/26/08/00043',
    data: { ...DATA, production_year: null, owner_ktp: null, merk_type: null },
    giverName: 'LUKMAN',
    receiverName: 'SESEORANG',
    items: ['STNK'],
    issuedAt: new Date(2026, 7, 29),
  })
  dibuat.push(hasil.absolutePath)

  const isi = await fs.readFile(hasil.absolutePath)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF')
})
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/receiptPdf.test.js`
Expected: FAIL — modul belum ada.

- [ ] **Step 4: Tulis implementasi**

Buat `api/src/services/receiptPdfService.js`:

```js
/**
 * Penyusun PDF tanda terima penyerahan dokumen.
 *
 * Tata letak mengikuti tanda terima DMS yang selama ini dicetak, dengan satu
 * perbedaan: kolom "Mengetahui" dihilangkan -- hanya ada dua tanda tangan.
 *
 * Memakai pdfkit (JavaScript murni). Headless browser ditolak karena menambah
 * ~300MB Chromium di VPS yang juga menjalankan API, Nginx, dan SQLite.
 */

import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import crypto from 'crypto'
import PDFDocument from 'pdfkit'

const RECEIPT_DIR = 'uploads/tanda-terima'

const TITLES = {
  STNK: 'TANDA TERIMA PENYERAHAN STNK',
  BPKB: 'TANDA TERIMA PENYERAHAN BPKB',
}

const DOCUMENT_LABELS = {
  STNK: 'Surat Tanda Nomor Kendaraan Bermotor (STNK)',
  BPKB: 'Bukti Pemilik Kendaraan (BPKB)',
}

const TERMS = {
  STNK: [
    'Seluruh tanggung jawab terhadap STNK dan Plat secara otomatis beralih kepada Konsumen, setelah konsumen / pelanggan menandatangani tanda terima ini.',
    'Konsumen yang namanya tercantum pada STNK, WAJIB mengambil dan menerima secara langsung STNK, Notice atau Plat. Apabila diwakilkan, maka wajib menunjukkan KTP pemilik kendaraan dan KTP yang mengambil STNK.',
    'Bila ketentuan no.2 dilanggar, maka seluruh tanggung jawab berada di pihak konsumen.',
  ],
  BPKB: [
    'Seluruh tanggung jawab terhadap BPKB / Copy Faktur / NIK secara otomatis beralih kepada Konsumen, setelah konsumen / pelanggan menandatangani tanda terima ini.',
    'Konsumen yang namanya tercantum pada BPKB / Copy Faktur / NIK, WAJIB mengambil dan menerima secara langsung. Apabila diwakilkan, maka wajib melampirkan surat kuasa bermaterai 10.000, KTP asli dan fotocopy KTP sesuai BPKB, fotocopy STNK, serta KTP asli penerima kuasa.',
    'Bila ketentuan no.2 dilanggar, maka seluruh tanggung jawab berada di pihak konsumen.',
  ],
}

// Tanggal lokal -- JANGAN toISOString, di WIB bisa mundur sehari.
function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${date.getFullYear()}`
}

function formatLocalDateTime(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${formatLocalDate(date)} ${hh}:${mi}`
}

// Nomor tanda terima mengandung "/" -- kalau dipakai apa adanya jadi sub-folder.
function safeFileName(receiptNumber) {
  return receiptNumber.replace(/[^A-Za-z0-9]+/g, '-')
}

function drawField(doc, label, value, indent) {
  doc.text(label, indent, doc.y, { continued: true, width: 150 })
  doc.text(`: ${value || '-'}`, indent + 150, doc.y)
}

export async function generateReceiptPdf({
  receiptNumber,
  data,
  giverName,
  receiverName,
  items = [],
  signatureGiverPath = null,
  signatureReceiverPath = null,
  issuedAt = new Date(),
}) {
  await fs.mkdir(RECEIPT_DIR, { recursive: true })

  const fileName = `${safeFileName(receiptNumber)}.pdf`
  const absolutePath = path.resolve(RECEIPT_DIR, fileName)
  const urlPath = `/${RECEIPT_DIR}/${fileName}`

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = createWriteStream(absolutePath)
  doc.pipe(stream)

  const docType = data.document_type
  const left = doc.page.margins.left

  doc.font('Helvetica-Bold').fontSize(11)
  doc.text(TITLES[docType] || TITLES.STNK, { align: 'center' })
  doc.moveDown(0.4)
  doc.text('PT. Tunas Dwipa Matra', { align: 'center' })
  doc.text('Cabang Ketapang', { align: 'center' })
  doc.moveDown(1.2)

  doc.font('Helvetica').fontSize(9)
  doc.text(`No Tanda Terima     :  ${receiptNumber}`)
  doc.moveDown(0.8)
  doc.text('Telah diterima dengan kondisi baik dan lengkap berupa Asli :')
  doc.moveDown(0.6)

  doc.text(`1. ${DOCUMENT_LABELS[docType] || DOCUMENT_LABELS.STNK} dengan data :`)
  doc.moveDown(0.3)

  const fields = [
    ['a. Nama Pemilik', data.owner_name],
    ['b. Alamat Pemilik', data.owner_address],
    ['', data.owner_province],
    ['c. No.KTP Pemilik', data.owner_ktp],
    ['d. Merk/Type', data.merk_type],
    ['e. Jenis/Model', data.model_name],
    ['f. Tahun Pembuatan', data.production_year ? String(data.production_year) : null],
    ['g. Warna', data.color_name],
    ['h. No.Rangka', data.chassis_number],
    ['i. No.Mesin', data.engine_number],
    ['j. No.Polisi', data.no_polisi],
    [docType === 'BPKB' ? 'k. Nomor BPKB' : 'k. No.STNK', data.document_number],
  ]

  for (const [label, value] of fields) {
    if (!label) {
      // Baris lanjutan alamat: sejajarkan dengan kolom nilai.
      doc.text(value || '', left + 170, doc.y)
      continue
    }
    doc.text(label, left + 20, doc.y, { continued: true })
    doc.text(`:  ${value ?? '-'}`, left + 170, doc.y)
  }

  doc.moveDown(0.9)
  if (docType === 'BPKB') {
    doc.text('2. Copy Faktur dan Nomor Identitas Kendaraan (NIK)', left)
  } else {
    doc.text(
      `2. Plat atas sepeda motor HONDA dengan No Rangka ${data.chassis_number || '-'} dengan No Polisi ${data.no_polisi || '-'}`,
      left,
    )
  }
  doc.moveDown(0.6)

  // Kotak centang item yang benar-benar diserahkan.
  const allItems = docType === 'BPKB' ? ['BPKB', 'Copy Faktur', 'NIK'] : ['STNK', 'Plat']
  for (const item of allItems) {
    const y = doc.y
    doc.rect(left + 40, y, 10, 10).stroke()
    if (items.includes(item)) {
      doc.font('Helvetica-Bold').text('X', left + 42.5, y + 1.5)
      doc.font('Helvetica')
    }
    doc.text(item, left + 60, y + 1)
    doc.moveDown(0.35)
  }

  doc.moveDown(1.2)
  doc.text(`${data.owner_province}, ${formatLocalDate(issuedAt)}`, left)
  doc.moveDown(1)

  // Dua blok tanda tangan. Kolom "Mengetahui" sengaja tidak ada.
  const signatureTop = doc.y
  const columnWidth = 200
  doc.text('Yang menyerahkan', left, signatureTop)
  doc.text('Penerima', left + columnWidth + 60, signatureTop)

  const imageTop = signatureTop + 18
  const imageHeight = 55
  if (signatureGiverPath) {
    doc.image(signatureGiverPath, left, imageTop, { fit: [160, imageHeight] })
  }
  if (signatureReceiverPath) {
    doc.image(signatureReceiverPath, left + columnWidth + 60, imageTop, { fit: [160, imageHeight] })
  }

  const lineY = imageTop + imageHeight + 6
  doc.moveTo(left, lineY).lineTo(left + 160, lineY).stroke()
  doc.moveTo(left + columnWidth + 60, lineY).lineTo(left + columnWidth + 220, lineY).stroke()

  doc.text(giverName || '-', left, lineY + 5, { width: 170 })
  doc.text(receiverName || '-', left + columnWidth + 60, lineY + 5, { width: 170 })

  doc.moveDown(3)
  doc.font('Helvetica-Bold').text('Syarat dan Ketentuan', left)
  doc.font('Helvetica').text('TDM dan Konsumen Sepakat bila :')
  doc.moveDown(0.3)

  const terms = TERMS[docType] || TERMS.STNK
  terms.forEach((term, index) => {
    doc.text(`${index + 1}. ${term}`, left, doc.y, { width: doc.page.width - left * 2 })
    doc.moveDown(0.3)
  })

  doc.moveDown(0.8)
  doc.fontSize(8).text(`${giverName || '-'}  ${formatLocalDateTime(issuedAt)}`, left)

  doc.end()
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
  })

  const bytes = await fs.readFile(absolutePath)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')

  return { urlPath, absolutePath, sha256 }
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/receiptPdf.test.js`
Expected: PASS semua.

- [ ] **Step 6: Lihat hasilnya sekali dengan mata sendiri**

```bash
cd api && node -e "
import('./src/services/receiptPdfService.js').then(async (m) => {
  const r = await m.generateReceiptPdf({
    receiptNumber: 'TT-BPKB/DXK/26/08/09999',
    data: { document_type: 'BPKB', owner_name: 'DARWIN', owner_address: 'Jl Pasir Mayang', owner_province: 'KALIMANTAN BARAT', owner_ktp: '6104160811960005', merk_type: 'KG0 / M/T', model_name: 'CB150 VERZA CW', production_year: 2025, color_name: 'BK-BLACK', chassis_number: 'KC0411SK036977', engine_number: 'KC04E1037046', no_polisi: 'KB4223GAQ', document_number: 'W06560023' },
    giverName: 'MUHAMMAD HARIS SAPUTRA', receiverName: 'DARWIN',
    items: ['BPKB', 'Copy Faktur', 'NIK'], issuedAt: new Date(),
  })
  console.log(r.absolutePath)
})
" && open uploads/tanda-terima/TT-BPKB-DXK-26-08-09999.pdf
```

Bandingkan dengan tanda terima DMS asli. Rapikan jarak antar baris bila perlu, lalu hapus berkas contoh itu.

- [ ] **Step 7: Commit**

```bash
git add api/src/services/receiptPdfService.js api/tests/receiptPdf.test.js api/package.json api/package-lock.json
git commit -m "feat(tanda-terima): susun PDF A4 dengan pdfkit dan hash SHA-256"
```

---

### Task 7: Terbitkan tanda terima saat serah terima

Inti fitur. `addHandoverStep` diperluas: menerima dua tanda tangan, checklist item, dan foto surat kuasa; menegakkan aturan kuasa BPKB; menerbitkan nomor di dalam transaksi lalu menyusun PDF setelahnya.

**Files:**
- Modify: `api/src/controllers/documentHandoverController.js` — `addHandoverStep`
- Modify: `api/src/routes/showroomRoutes.js:287-290` — field upload baru
- Test: `api/tests/documentHandoverReceipt.integration.test.js` (create)

**Interfaces:**
- Consumes: `issueReceiptNumber` (Task 2), `collectReceiptData` (Task 5), `generateReceiptPdf` (Task 6)
- Produces: baris `document_handover_steps` dengan `receipt_number`, `receipt_pdf_url`, `receipt_pdf_sha256`, `signature_*_url` terisi

- [ ] **Step 1: Tambah field upload di route**

Di `api/src/routes/showroomRoutes.js`, ganti blok `uploadHandoverPhoto.fields`:

```js
router.post('/document-handovers/:id/steps', authenticate, handoverStepAccess, uploadHandoverPhoto.fields([
  { name: 'photo_doc', maxCount: 1 },
  { name: 'photo_handover', maxCount: 1 },
  { name: 'signature_giver', maxCount: 1 },
  { name: 'signature_receiver', maxCount: 1 },
  { name: 'photo_power_of_attorney', maxCount: 1 }
]), addHandoverStep)
```

- [ ] **Step 2: Tulis test yang gagal**

Buat `api/tests/documentHandoverReceipt.integration.test.js`:

```js
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import fs from 'fs/promises'
import {
  prismaTest,
  seedKnownUsers,
  loginAs,
  request,
  app,
} from './helpers.js'

const ENG_STNK = 'RCPT-FLOW-STNK1'
const ENG_BPKB = 'RCPT-FLOW-BPKB1'
const ENGINES = [ENG_STNK, ENG_BPKB]
const SO_STNK = 'SO/DXK/26/08/RFS1'
const SO_BPKB = 'SO/DXK/26/08/RFB1'

const PNG = Buffer.from('89504e470d0a1a0a-tanda-tangan-uji')
const FOTO = Buffer.from('isi-foto-uji')

let adminCookie
let adminId
let handoverStnkId
let handoverBpkbId

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.customers.deleteMany({ where: { so_number: { in: [SO_STNK, SO_BPKB] } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  for (const [eng, so, nama] of [[ENG_STNK, SO_STNK, 'HEPRI FAHRIANSYAH'], [ENG_BPKB, SO_BPKB, 'DARWIN']]) {
    await prismaTest.showroom_stnk_bpkb_tracks.create({
      data: {
        branch_code: 'DXK',
        branch_name: 'Cabang Ketapang',
        engine_number: eng,
        chassis_number: 'JMH11XTK409060',
        stnk_name: nama,
        partner_address: 'Jl Uji Coba',
        no_polisi: 'KB1234XX',
        no_stnk: '22012900I',
        no_bpkb: 'W06560023',
      },
    })
    await prismaTest.customers.create({
      data: {
        customer_name: nama,
        so_number: so,
        so_date: new Date(2026, 0, 15),
        no_engine: eng,
        no_ktp: '6104160501060003',
        product_code: 'ML2A',
        type: 'AT',
        model: 'SCOOPY',
        color: 'BK',
      },
    })
  }

  const login = await loginAs('test_admin', 'password123')
  adminCookie = login.cookie
  adminId = login.body.user.id

  const buat = async (engine, documentType) => {
    const res = await request(app)
      .post('/api/showroom/document-handovers')
      .set('Cookie', adminCookie)
      .send({ engine_number: engine, document_type: documentType, handover_mode: 'langsung' })
      .expect(201)
    return res.body.id
  }

  handoverStnkId = await buat(ENG_STNK, 'STNK')
  handoverBpkbId = await buat(ENG_BPKB, 'BPKB')
})

after(async () => {
  await cleanup()
  await prismaTest.$disconnect()
})

test('serah terima STNK menerbitkan nomor, PDF, dan hash', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverStnkId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'HEPRI FAHRIANSYAH')
    .field('receiver_is_customer', 'true')
    .field('receipt_items', JSON.stringify(['STNK', 'Plat']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'ttd-petugas.png')
    .attach('signature_receiver', PNG, 'ttd-penerima.png')
    .expect(201)

  assert.match(res.body.receipt_number, /^TT-STNK\/DXK\/\d{2}\/\d{2}\/\d{5}$/)
  assert.ok(res.body.signature_giver_url, 'tanda tangan petugas harus tersimpan')
  assert.ok(res.body.signature_receiver_url, 'tanda tangan penerima harus tersimpan')

  const step = await prismaTest.document_handover_steps.findUnique({ where: { id: res.body.id } })
  assert.ok(step.receipt_pdf_url, 'PDF harus terbentuk')
  assert.equal(step.receipt_pdf_sha256.length, 64)

  const isi = await fs.readFile(`.${step.receipt_pdf_url}`)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF')
})

test('PLAT tidak menerbitkan tanda terima dan tidak minta tanda tangan', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_STNK,
      document_type: 'PLAT',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: adminId,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'SIAPA SAJA')
    .attach('photo_handover', FOTO, 'serah.jpg')
    .expect(201)

  // PLAT bukan jenis yang menerbitkan tanda terima, jadi tetap boleh lewat
  // tanpa tanda tangan.
  assert.equal(res.body.receipt_number, null)
})

test('BPKB dengan penerima berbeda WAJIB melampirkan surat kuasa', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverBpkbId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'ORANG LAIN')
    .field('receiver_is_customer', 'false')
    .field('receipt_items', JSON.stringify(['BPKB']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'a.png')
    .attach('signature_receiver', PNG, 'b.png')
    .expect(400)

  assert.match(res.body.error, /surat kuasa/i)
})

test('BPKB dengan penerima berbeda diterima bila surat kuasa dilampirkan', async () => {
  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handoverBpkbId}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'ORANG LAIN')
    .field('receiver_is_customer', 'false')
    .field('receipt_items', JSON.stringify(['BPKB', 'Copy Faktur', 'NIK']))
    .attach('photo_handover', FOTO, 'serah.jpg')
    .attach('signature_giver', PNG, 'a.png')
    .attach('signature_receiver', PNG, 'b.png')
    .attach('photo_power_of_attorney', FOTO, 'kuasa.jpg')
    .expect(201)

  assert.match(res.body.receipt_number, /^TT-BPKB\//)
  assert.ok(res.body.photo_power_of_attorney_url)
  assert.equal(res.body.receiver_is_customer, false)
})

test('STNK tanpa tanda tangan ditolak', async () => {
  const handover = await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_STNK,
      document_type: 'BPKB',
      handover_mode: 'langsung',
      status: 'tersedia',
      created_by: adminId,
    },
  })

  const res = await request(app)
    .post(`/api/showroom/document-handovers/${handover.id}/steps`)
    .set('Cookie', adminCookie)
    .field('step_type', 'serah_ke_konsumen')
    .field('received_by_name', 'TANPA TTD')
    .attach('photo_handover', FOTO, 'serah.jpg')
    .expect(400)

  assert.match(res.body.error, /tanda tangan/i)
})

test('nomor urut naik untuk penyerahan berikutnya di bulan yang sama', async () => {
  // Dua tanda terima STNK sudah terbit di test-test di atas untuk cabang dan
  // bulan yang sama; nomornya harus berbeda dan berurutan.
  const steps = await prismaTest.document_handover_steps.findMany({
    where: { receipt_number: { startsWith: 'TT-' } },
    select: { receipt_number: true },
    orderBy: { id: 'asc' },
  })

  assert.ok(steps.length >= 2, 'perlu minimal dua tanda terima untuk diuji')

  const perAwalan = new Map()
  for (const { receipt_number } of steps) {
    const pisah = receipt_number.lastIndexOf('/')
    const awalan = receipt_number.slice(0, pisah + 1)
    const urut = parseInt(receipt_number.slice(pisah + 1), 10)
    if (!perAwalan.has(awalan)) perAwalan.set(awalan, [])
    perAwalan.get(awalan).push(urut)
  }

  for (const [awalan, urutan] of perAwalan) {
    const unik = new Set(urutan)
    assert.equal(unik.size, urutan.length, `nomor kembar pada ${awalan}`)
    assert.deepEqual([...urutan].sort((a, b) => a - b), urutan, `urutan tidak naik pada ${awalan}`)
  }
})
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/documentHandoverReceipt.integration.test.js`
Expected: FAIL — `receipt_number` masih `undefined`.

- [ ] **Step 4: Tulis implementasi**

Di `api/src/controllers/documentHandoverController.js`, tambahkan import di bagian atas berkas:

```js
import { issueReceiptNumber } from '../services/receiptNumberService.js'
import { collectReceiptData } from '../services/receiptDataService.js'
import { generateReceiptPdf } from '../services/receiptPdfService.js'

// Hanya dua jenis ini yang menerbitkan tanda terima; BUKU_SERVICE dan PLAT
// ikut sebagai item checklist di badan tanda terima dokumen utamanya.
const RECEIPT_DOCUMENT_TYPES = ['STNK', 'BPKB']
const CONSUMER_STEP_TYPES = ['serah_ke_konsumen', 'ekspedisi_ke_konsumen']
```

Di dalam `addHandoverStep`, ganti destrukturisasi `req.body` di baris awal:

```js
    const {
      step_type,
      given_by_name,
      received_by_name,
      notes,
      receipt_items,
      receiver_is_customer,
    } = req.body
```

Setelah blok yang menyusun `photo_url` dan `photo_handover_url`, tambahkan:

```js
    let signature_giver_url = null
    let signature_receiver_url = null
    let photo_power_of_attorney_url = null
    if (req.files) {
      if (req.files.signature_giver?.[0]) {
        signature_giver_url = `/uploads/handovers/${req.files.signature_giver[0].filename}`
      }
      if (req.files.signature_receiver?.[0]) {
        signature_receiver_url = `/uploads/handovers/${req.files.signature_receiver[0].filename}`
      }
      if (req.files.photo_power_of_attorney?.[0]) {
        photo_power_of_attorney_url = `/uploads/handovers/${req.files.photo_power_of_attorney[0].filename}`
      }
    }

    // Tanda terima hanya terbit saat dokumen benar-benar sampai ke konsumen,
    // dan hanya untuk STNK/BPKB.
    const issuesReceipt = CONSUMER_STEP_TYPES.includes(step_type) &&
      RECEIPT_DOCUMENT_TYPES.includes(handover.document_type)

    // receiver_is_customer datang sebagai teks dari multipart form-data.
    const receiverIsCustomer = receiver_is_customer === undefined
      ? true
      : String(receiver_is_customer) !== 'false'

    if (issuesReceipt) {
      if (!signature_giver_url || !signature_receiver_url) {
        return res.status(400).json({
          error: 'Tanda tangan petugas dan penerima wajib diisi untuk menerbitkan tanda terima.',
        })
      }

      // Syarat di kaki form BPKB: bila diwakilkan, wajib surat kuasa bermaterai.
      // STNK sengaja tidak diwajibkan -- syaratnya lebih ringan dan volumenya
      // hampir empat kali lipat.
      if (handover.document_type === 'BPKB' && !receiverIsCustomer && !photo_power_of_attorney_url) {
        return res.status(400).json({
          error: 'Penerima BPKB bukan konsumen sendiri. Foto surat kuasa bermaterai wajib dilampirkan.',
        })
      }
    }
```

Ganti blok `prisma.$transaction([...])` dengan transaksi interaktif — nomor harus dibaca dan ditulis dalam satu transaksi supaya tidak kembar:

```js
    const step = await prisma.$transaction(async (tx) => {
      // Dibaca-lalu-ditulis di dalam satu transaksi; SQLite menyerialkan
      // penulisan, jadi dua penyerahan bersamaan tidak bisa dapat nomor sama.
      const receiptNumber = issuesReceipt
        ? await issueReceiptNumber(tx, handover.document_type)
        : null

      const created = await tx.document_handover_steps.create({
        data: {
          handover_id: parseInt(id),
          step_type,
          given_by_name: req.user.name || null,
          received_by_name: received_by_name || null,
          photo_url,
          photo_handover_url,
          notes: notes || null,
          performed_by: req.user.userId,
          receipt_number: receiptNumber,
          signature_giver_url,
          signature_receiver_url,
          photo_power_of_attorney_url,
          receiver_is_customer: receiverIsCustomer,
          receipt_items: issuesReceipt ? (receipt_items || null) : null,
        },
        include: { performer: { select: { id: true, name: true } } },
      })

      await tx.document_handovers.update({
        where: { id: parseInt(id) },
        data: {
          status: newStatus,
          handover_mode: handoverMode,
          ...(step_type === 'admin_ke_sales' && received_by_name ? { salesman_name: received_by_name } : {}),
          ...(step_type === 'serah_ke_konsumen' && received_by_name ? { consumer_name: received_by_name } : {}),
        },
      })

      return created
    })

    // PDF disusun SETELAH transaksi commit -- menulis berkas di dalam transaksi
    // menahan kunci tulis SQLite selama I/O disk. Bila penyusunan gagal, baris
    // langkah tetap ada dengan nomornya dan PDF bisa dibangun ulang selama
    // receipt_pdf_sha256 masih null.
    let finalStep = step
    if (step.receipt_number) {
      try {
        const data = await collectReceiptData(prisma, {
          engineNumber: handover.engine_number,
          documentType: handover.document_type,
        })

        if (data) {
          let items = []
          try {
            const parsed = JSON.parse(step.receipt_items || '[]')
            if (Array.isArray(parsed)) items = parsed
          } catch { /* checklist rusak tidak boleh membatalkan penyerahan */ }

          const pdf = await generateReceiptPdf({
            receiptNumber: step.receipt_number,
            data,
            giverName: step.given_by_name,
            receiverName: step.received_by_name,
            items,
            signatureGiverPath: signature_giver_url ? `.${signature_giver_url}` : null,
            signatureReceiverPath: signature_receiver_url ? `.${signature_receiver_url}` : null,
            issuedAt: step.performed_at,
          })

          finalStep = await prisma.document_handover_steps.update({
            where: { id: step.id },
            data: { receipt_pdf_url: pdf.urlPath, receipt_pdf_sha256: pdf.sha256 },
            include: { performer: { select: { id: true, name: true } } },
          })
        }
      } catch (pdfError) {
        // Penyerahan fisik sudah terjadi -- jangan gagalkan permintaan hanya
        // karena PDF gagal disusun. Nomornya sudah terbit dan bisa dibangun ulang.
        logger.warn(req, 'Penyusunan PDF tanda terima gagal', {
          step_id: step.id,
          receipt_number: step.receipt_number,
          error: pdfError.message,
        })
      }
    }

    res.status(201).json(finalStep)
```

Pastikan `logger` sudah di-import di berkas ini; kalau belum, tambahkan `import { logger } from '../utils/logger.js'`.

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/documentHandoverReceipt.integration.test.js`
Expected: PASS semua.

- [ ] **Step 6: Pastikan alur serah terima lama tidak rusak**

Run: `cd api && node --test tests/documentHandoverEkspedisi.integration.test.js tests/documentHandoverBukuService.integration.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add api/src/controllers/documentHandoverController.js api/src/routes/showroomRoutes.js api/tests/documentHandoverReceipt.integration.test.js
git commit -m "feat(tanda-terima): terbitkan nomor, tanda tangan, dan PDF saat serah terima"
```

---

### Task 8: Endpoint unduh tanda terima dan peta warna

**Files:**
- Modify: `api/src/controllers/documentHandoverController.js` — tambah `getReceiptPdf`
- Create: `api/src/controllers/unitColorController.js`
- Modify: `api/src/routes/showroomRoutes.js`
- Test: `api/tests/unitColors.integration.test.js` (tambah ke file dari Task 4)

**Interfaces:**
- Consumes: `document_handover_steps.receipt_pdf_url`, tabel `unit_color_names`
- Produces: `GET /api/showroom/document-handovers/receipt/:stepId`, `GET /api/showroom/unit-colors`, `PATCH /api/showroom/unit-colors/:code`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `api/tests/unitColors.integration.test.js`. Tambahkan juga import `loginAs`, `request`, `app` dari `./helpers.js` di bagian atas berkas.

```js
test('GET /unit-colors mengembalikan kode dan nama', async () => {
  await prismaTest.unit_color_names.upsert({
    where: { code: 'ZQ' },
    update: { name: 'ZQ-HITAM UJI', source: 'import' },
    create: { code: 'ZQ', name: 'ZQ-HITAM UJI', source: 'import' },
  })

  const { cookie } = await loginAs('test_admin', 'password123')
  const res = await request(app)
    .get('/api/showroom/unit-colors')
    .set('Cookie', cookie)
    .expect(200)

  const zq = res.body.find((c) => c.code === 'ZQ')
  assert.equal(zq.name, 'ZQ-HITAM UJI')
})

test('PATCH /unit-colors/:code mengisi nama manual', async () => {
  const { cookie } = await loginAs('test_admin', 'password123')
  const res = await request(app)
    .patch('/api/showroom/unit-colors/ZR')
    .set('Cookie', cookie)
    .send({ name: 'ZR-PUTIH MANUAL' })
    .expect(200)

  assert.equal(res.body.name, 'ZR-PUTIH MANUAL')
  assert.equal(res.body.source, 'manual')
})

test('PATCH /unit-colors menolak nama kosong', async () => {
  const { cookie } = await loginAs('test_admin', 'password123')
  await request(app)
    .patch('/api/showroom/unit-colors/ZS')
    .set('Cookie', cookie)
    .send({ name: '   ' })
    .expect(400)
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `cd api && node --test tests/unitColors.integration.test.js`
Expected: FAIL — route belum ada, 404.

- [ ] **Step 3: Tulis controller peta warna**

Buat `api/src/controllers/unitColorController.js`:

```js
/**
 * Peta kode warna -> nama lengkap untuk tanda terima.
 *
 * Sebagian besar terisi otomatis dari import stok unit (harvestColorNames).
 * Endpoint ini untuk kode yang tidak pernah muncul di stok dan harus diketik
 * sekali oleh petugas.
 */

import { prisma } from '../config/db.js'

export async function getUnitColors(req, res, next) {
  try {
    const colors = await prisma.unit_color_names.findMany({ orderBy: { code: 'asc' } })
    res.json(colors)
  } catch (err) {
    next(err)
  }
}

export async function updateUnitColor(req, res, next) {
  try {
    const code = String(req.params.code || '').trim().toUpperCase()
    const name = String(req.body?.name || '').trim()

    if (!code) return res.status(400).json({ error: 'Kode warna wajib diisi' })
    if (!name) return res.status(400).json({ error: 'Nama warna wajib diisi' })

    const color = await prisma.unit_color_names.upsert({
      where: { code },
      update: { name, source: 'manual' },
      create: { code, name, source: 'manual' },
    })

    res.json(color)
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 4: Tulis endpoint unduh tanda terima**

Di `api/src/controllers/documentHandoverController.js`, tambahkan:

```js
/**
 * Unduh PDF tanda terima. Disajikan lewat route berautentikasi, tidak pernah
 * sebagai berkas statis -- isinya memuat KTP dan alamat konsumen.
 */
export async function getReceiptPdf(req, res, next) {
  try {
    const step = await prisma.document_handover_steps.findUnique({
      where: { id: parseInt(req.params.stepId) },
    })

    if (!step) {
      return res.status(404).json({ error: 'Langkah serah terima tidak ditemukan' })
    }
    if (!step.receipt_pdf_url) {
      return res.status(404).json({ error: 'Tanda terima belum diterbitkan untuk langkah ini' })
    }

    res.sendFile(step.receipt_pdf_url.replace(/^\//, ''), { root: process.cwd() })
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 5: Daftarkan route**

Di `api/src/routes/showroomRoutes.js`, tambahkan import:

```js
import { getUnitColors, updateUnitColor } from '../controllers/unitColorController.js'
```

Tambahkan `getReceiptPdf` ke daftar import dari `documentHandoverController.js`, lalu tambahkan route. **Letakkan `receipt/:stepId` bersama route `photo/:stepId` yang sudah ada** — Express 5 memerlukan route statis sebelum route ber-param `:id`:

```js
router.get('/document-handovers/receipt/:stepId', authenticate, handoverReadAccess, getReceiptPdf)

router.get('/unit-colors', authenticate, showroomAccess, getUnitColors)
router.patch('/unit-colors/:code', authenticate, showroomAccess, updateUnitColor)
```

- [ ] **Step 6: Jalankan test untuk memastikan lulus**

Run: `cd api && node --test tests/unitColors.integration.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add api/src/controllers/unitColorController.js api/src/controllers/documentHandoverController.js api/src/routes/showroomRoutes.js api/tests/unitColors.integration.test.js
git commit -m "feat(tanda-terima): endpoint unduh PDF dan pengelolaan peta warna"
```

---

### Task 9: Backup folder uploads

Backup harian hanya menyalin SQLite. Setelah berkas fisik dihapus, PDF tanda terima dan tanda tangan jadi satu-satunya bukti — dan justru itu yang tidak terlindungi.

**Files:**
- Modify: `api/src/services/backupService.js`
- Modify: `api/scripts/backup-db.js`

**Interfaces:**
- Consumes: `createDatabaseBackup(reason)` yang sudah ada
- Produces: `createUploadsBackup(reason) -> Promise<{ filename, path, created_at }>`

- [ ] **Step 1: Tulis fungsi backup uploads**

Di `api/src/services/backupService.js`, tambahkan dua import ini **di bagian atas berkas** bersama import yang sudah ada — bukan di tengah berkas:

```js
import { execFile } from 'child_process'
import { promisify } from 'util'
```

Lalu tambahkan konstanta ini di dekat `const backupDir = ...` yang sudah ada:

```js
const execFileAsync = promisify(execFile)
const uploadsDir = path.resolve(__dirname, '../../uploads')
```

Terakhir, tambahkan fungsi berikut di bawah `createDatabaseBackup`. Memakai `tar` bawaan sistem (tersedia di macOS maupun VPS Linux) supaya tidak menambah dependensi.

```js
/**
 * Arsipkan folder uploads/ bersama backup database.
 *
 * Foto serah terima, tanda tangan, dan PDF tanda terima hanya ada di disk --
 * tidak ikut di dalam file SQLite. Setelah berkas fisik dihapus, kehilangan
 * folder ini berarti kehilangan seluruh bukti penyerahan tanpa kertas
 * pengganti.
 */
export async function createUploadsBackup(reason = 'manual') {
  await fs.mkdir(backupDir, { recursive: true })

  // Folder belum ada di instalasi baru -- bukan kegagalan.
  try {
    await fs.access(uploadsDir)
  } catch {
    return null
  }

  const safeReason = String(reason).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40) || 'manual'
  const filename = `uploads.backup.${safeReason}.${timestamp()}.tar.gz`
  const target = path.join(backupDir, filename)

  await execFileAsync('tar', ['-czf', target, '-C', path.dirname(uploadsDir), 'uploads'])

  return { filename, path: target, created_at: new Date().toISOString() }
}
```

- [ ] **Step 2: Panggil dari skrip backup harian**

Di `api/scripts/backup-db.js`, ubah import dan `main()`:

```js
import { createDatabaseBackup, createUploadsBackup, listDatabaseBackups } from '../src/services/backupService.js'
```

Di dalam `main()`, setelah backup database dibuat:

```js
  const uploads = await createUploadsBackup('scheduled')
  if (uploads) {
    console.log(`[backup] uploads dibuat: ${uploads.filename}`)
  } else {
    console.log('[backup] folder uploads belum ada, dilewati')
  }
```

Lalu tambahkan retensi untuk arsip uploads, tepat sebelum baris ringkasan terakhir:

```js
  // Retensi arsip uploads mengikuti retensi database.
  const entries = await fs.readdir(backupDir)
  const uploadArchives = entries
    .filter((name) => name.startsWith('uploads.backup.scheduled.'))
    .sort()
    .reverse()
  for (const name of uploadArchives.slice(keep)) {
    await fs.unlink(path.join(backupDir, name))
    console.log(`[backup] uploads dihapus (retensi): ${name}`)
  }
```

- [ ] **Step 3: Jalankan skrip dan periksa hasilnya**

```bash
cd api && node scripts/backup-db.js 14 && ls -la prisma/backups/ | grep uploads
```

Expected: ada berkas `uploads.backup.scheduled.<timestamp>.tar.gz` dengan ukuran wajar.

- [ ] **Step 4: Pastikan isinya benar**

```bash
cd api && tar -tzf "prisma/backups/$(ls prisma/backups | grep uploads.backup | tail -1)" | head -10
```

Expected: daftar berkas di bawah `uploads/`.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/backupService.js api/scripts/backup-db.js
git commit -m "feat(backup): ikutkan folder uploads agar bukti penyerahan terlindungi"
```

---

### Task 10: Komponen canvas tanda tangan

**Files:**
- Create: `web/src/components/common/SignaturePad.jsx`

**Interfaces:**
- Produces: `<SignaturePad label onChange disabled />` — tanpa prop `value` (komponen sengaja uncontrolled; tidak ada yang perlu memuat ulang tanda tangan lama). `onChange(blob | null)` dipanggil dengan `Blob` PNG saat coretan selesai, `null` saat dikosongkan.

- [ ] **Step 1: Tulis komponen**

Buat `web/src/components/common/SignaturePad.jsx`. Tanpa dependensi baru — pointer event bawaan sudah cukup dan bekerja untuk sentuh maupun mouse.

```jsx
import { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser } from 'lucide-react'

/**
 * Kotak tanda tangan berbasis canvas.
 *
 * Pointer event dipakai supaya satu jalur kode melayani sentuhan dan mouse --
 * petugas menandatangani di tablet, lalu perangkat yang sama diberikan kepada
 * konsumen.
 */
export default function SignaturePad({ label, onChange, disabled = false }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  // Canvas diskalakan ke devicePixelRatio supaya garisnya tidak buram di layar
  // beresolusi tinggi.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio

    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
  }, [])

  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const emit = useCallback(() => {
    canvasRef.current.toBlob((blob) => onChange?.(blob), 'image/png')
  }, [onChange])

  const handleDown = (event) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = pointFrom(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawingRef.current = true
  }

  const handleMove = (event) => {
    if (!drawingRef.current) return
    const { x, y } = pointFrom(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
    if (isEmpty) setIsEmpty(false)
  }

  const handleUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    onChange?.(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-semibold text-text">{label}</label>
        {!isEmpty && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Hapus
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className={`w-full h-36 rounded-lg border-2 border-dashed bg-white touch-none ${
          isEmpty ? 'border-border' : 'border-accent'
        } ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
      />
      {isEmpty && (
        <p className="mt-1 text-xs text-muted">Tanda tangan di kotak ini</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Pastikan lint lolos**

Run: `cd web && npm run lint`
Expected: tanpa error.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/common/SignaturePad.jsx
git commit -m "feat(web): komponen canvas tanda tangan tanpa dependensi"
```

---

### Task 11: Modal serah terima dan riwayat menampilkan tanda terima

**Files:**
- Modify: `web/src/pages/ShowroomDocumentHandover.jsx`
- Modify: `web/src/services/api/showroom.js`

**Interfaces:**
- Consumes: `SignaturePad` (Task 10), endpoint dari Task 7 dan Task 8
- Produces: `getUnitColors()`, `updateUnitColor(code, name)`, `getReceiptPdfUrl(stepId)` di `web/src/services/api/showroom.js`

- [ ] **Step 1: Tambah fungsi API**

Di `web/src/services/api/showroom.js`, tambahkan:

```js
export const getUnitColors = () => fetchWithAuth('/showroom/unit-colors')

export const updateUnitColor = (code, name) =>
  fetchWithAuth(`/showroom/unit-colors/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: { name },
  })

// PDF diambil lewat route berautentikasi, bukan tautan statis.
export const getReceiptPdfUrl = (stepId) =>
  `/api/showroom/document-handovers/receipt/${stepId}`
```

- [ ] **Step 2: Tambah state di `HandoverStepModal`**

Komponennya `HandoverStepModal({ handovers, type, salespeople, onClose, onSaved })` di `web/src/pages/ShowroomDocumentHandover.jsx:95`. Tambahkan import di bagian atas berkas:

```jsx
import SignaturePad from '../components/common/SignaturePad'
```

Lalu tambahkan state di dalam komponen, di dekat `const [stepType, setStepType] = useState(initialStepType)`:

```jsx
  const [signatureGiver, setSignatureGiver] = useState(null)
  const [signatureReceiver, setSignatureReceiver] = useState(null)
  const [powerOfAttorney, setPowerOfAttorney] = useState(null)
  const [receiverIsCustomer, setReceiverIsCustomer] = useState(true)
  const [receiptItems, setReceiptItems] = useState([])
```

- [ ] **Step 3: Tentukan kapan tanda terima terbit**

Modal ini melayani **grup dokumen** — `handovers` adalah array (bundling Buku Service), dan `handover = handovers[0]`. Satu grup bisa berisi STNK + Buku Service sekaligus, sementara hanya STNK/BPKB yang menerbitkan tanda terima. Karena itu keputusannya diambil per dokumen, bukan dari `handovers[0]` saja.

Tambahkan tepat di bawah `isThirdPartyHandover` (baris ~153):

```jsx
  const RECEIPT_TYPES = ['STNK', 'BPKB']
  const CONSUMER_STEPS = ['serah_ke_konsumen', 'ekspedisi_ke_konsumen']

  // Dokumen mana saja dalam grup ini yang akan menerbitkan tanda terima.
  const receiptDocs = CONSUMER_STEPS.includes(stepType)
    ? handovers.filter((h) => RECEIPT_TYPES.includes(h.document_type))
    : []
  const issuesReceipt = receiptDocs.length > 0

  // Syarat di kaki form BPKB: bila diwakilkan, wajib surat kuasa bermaterai.
  const requiresPowerOfAttorney = !receiverIsCustomer &&
    receiptDocs.some((h) => h.document_type === 'BPKB')

  const availableItems = receiptDocs.some((h) => h.document_type === 'BPKB')
    ? ['BPKB', 'Copy Faktur', 'NIK']
    : ['STNK', 'Plat']

  const canSubmit = !issuesReceipt || (
    signatureGiver &&
    signatureReceiver &&
    (!requiresPowerOfAttorney || powerOfAttorney)
  )
```

- [ ] **Step 4: Tambah bidang isian di modal**

Sisipkan blok ini setelah bagian foto serah terima yang sudah ada (sekitar baris 378, slot `cameraTarget === 'handover'`), sebelum kolom "Catatan" di baris ~392:

```jsx
{issuesReceipt && (
  <>
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">
        Yang menerima
      </label>
      <label className="flex items-center gap-2 mb-2 text-sm text-text">
        <input
          type="checkbox"
          checked={receiverIsCustomer}
          onChange={(e) => setReceiverIsCustomer(e.target.checked)}
          className="rounded border-border"
        />
        Konsumen sendiri yang menerima
      </label>
      {!receiverIsCustomer && (
        <p className="mb-2 text-xs text-warning">
          {handover?.document_type === 'BPKB'
            ? 'BPKB diwakilkan — surat kuasa bermaterai 10.000 wajib difoto.'
            : 'Pastikan KTP pemilik dan KTP pengambil sudah diperiksa.'}
        </p>
      )}
    </div>

    {requiresPowerOfAttorney && (
      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">
          Foto Surat Kuasa <span className="text-danger">*</span>
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPowerOfAttorney(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />
      </div>
    )}

    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">
        Item yang diserahkan
      </label>
      <div className="flex flex-wrap gap-3">
        {availableItems.map((item) => (
          <label key={item} className="flex items-center gap-1.5 text-sm text-text">
            <input
              type="checkbox"
              checked={receiptItems.includes(item)}
              onChange={(e) => setReceiptItems((prev) =>
                e.target.checked ? [...prev, item] : prev.filter((i) => i !== item)
              )}
              className="rounded border-border"
            />
            {item}
          </label>
        ))}
      </div>
    </div>

    <SignaturePad label="Tanda tangan petugas" onChange={setSignatureGiver} />
    <SignaturePad label="Tanda tangan penerima" onChange={setSignatureReceiver} />
  </>
)}
```

- [ ] **Step 5: Kirim berkas baru saat submit**

`handleSubmit` (baris ~155) mengulang `for (const h of handovers)` dan membuat `FormData` baru tiap putaran. Tambahkan blok ini di dalam putaran itu, setelah `if (photoHandover) formData.append('photo_handover', photoHandover)`:

```jsx
        // Hanya STNK/BPKB yang menerbitkan tanda terima. Buku Service dan Plat
        // dalam grup yang sama tetap dikirim tanpa tanda tangan.
        if (RECEIPT_TYPES.includes(h.document_type) && CONSUMER_STEPS.includes(stepType)) {
          formData.append('receiver_is_customer', String(receiverIsCustomer))
          formData.append('receipt_items', JSON.stringify(receiptItems))
          if (signatureGiver) formData.append('signature_giver', signatureGiver, 'ttd-petugas.png')
          if (signatureReceiver) formData.append('signature_receiver', signatureReceiver, 'ttd-penerima.png')
          if (powerOfAttorney) formData.append('photo_power_of_attorney', powerOfAttorney)
        }
```

Tambahkan juga penjagaan di awal `handleSubmit`, setelah pemeriksaan `isThirdPartyHandover` yang sudah ada:

```jsx
    if (issuesReceipt && (!signatureGiver || !signatureReceiver)) {
      alert('Tanda tangan petugas dan penerima wajib diisi')
      return
    }
    if (requiresPowerOfAttorney && !powerOfAttorney) {
      alert('Penerima BPKB bukan konsumen sendiri. Foto surat kuasa bermaterai wajib dilampirkan.')
      return
    }
```

Terakhir, tambahkan `disabled={!canSubmit || saving}` pada tombol simpan modal (state-nya bernama `saving`, bukan `submitting`).

- [ ] **Step 6: Tampilkan tanda terima di riwayat**

Di bagian yang menampilkan riwayat langkah, tambahkan setelah tautan foto:

```jsx
{step.receipt_number && (
  <a
    href={getReceiptPdfUrl(step.id)}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
  >
    <FileText className="w-3.5 h-3.5" />
    {step.receipt_number}
  </a>
)}
```

Pastikan `FileText` sudah di-import dari `lucide-react` di berkas ini.

- [ ] **Step 7: Uji manual di browser**

```bash
cd api && npm run dev
# terminal lain
cd web && npm run dev
```

Buka `http://localhost:5173`, masuk ke menu penyerahan dokumen, jalankan satu serah terima STNK sampai selesai. Periksa: tombol simpan mati sebelum kedua tanda tangan terisi, tanda terima muncul di riwayat, PDF terbuka dan isinya benar.

Lalu uji BPKB dengan mencentang "bukan konsumen sendiri" — kolom surat kuasa harus muncul dan wajib.

- [ ] **Step 8: Lint dan build**

Run: `cd web && npm run lint && npm run build`
Expected: tanpa error.

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/ShowroomDocumentHandover.jsx web/src/services/api/showroom.js
git commit -m "feat(web): tanda tangan digital dan tanda terima di modal serah terima"
```

---

### Task 12: Halaman peta warna

**Files:**
- Create: `web/src/pages/ShowroomUnitColors.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/pages/ShowroomDocumentHandover.jsx` (tautan menuju halaman)

**Interfaces:**
- Consumes: `getUnitColors()`, `updateUnitColor(code, name)` (Task 11)

- [ ] **Step 1: Tulis halaman**

Buat `web/src/pages/ShowroomUnitColors.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { getUnitColors, updateUnitColor } from '../services/api/showroom'

/**
 * Peta kode warna -> nama lengkap untuk tanda terima.
 *
 * Sebagian besar terisi sendiri dari import stok unit. Halaman ini untuk kode
 * yang tidak pernah muncul di stok sehingga harus diketik sekali.
 */
export default function ShowroomUnitColors() {
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setColors(await getUnitColors())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const save = async (code) => {
    const name = (draft[code] || '').trim()
    if (!name) return
    try {
      setSaving(code)
      await updateUnitColor(code, name)
      setDraft((prev) => ({ ...prev, [code]: '' }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted">Memuat…</div>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-text">Nama Warna Unit</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Tanda terima mencetak nama warna lengkap seperti <strong>BK-BLACK</strong>, sementara
        data penjualan hanya menyimpan kodenya. Sebagian besar terisi sendiri saat import stok
        unit; yang belum terisi bisa diketik di sini.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-hover">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-text">Kode</th>
              <th className="px-4 py-2 text-left font-semibold text-text">Nama Lengkap</th>
              <th className="px-4 py-2 text-left font-semibold text-text">Sumber</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color.code} className="border-t border-border">
                <td className="px-4 py-2 font-mono font-semibold text-text">{color.code}</td>
                <td className="px-4 py-2 text-text">{color.name}</td>
                <td className="px-4 py-2 text-muted">
                  {color.source === 'manual' ? 'Diisi manual' : 'Dari import'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <input
                      value={draft[color.code] ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [color.code]: e.target.value }))}
                      placeholder="Ubah nama"
                      className="w-48 rounded-lg border border-border px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => save(color.code)}
                      disabled={saving === color.code || !(draft[color.code] || '').trim()}
                      className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Simpan
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {colors.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          Belum ada data. Jalankan import stok unit sekali untuk mengisinya otomatis.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Daftarkan route**

Di `web/src/App.jsx`, tambahkan lazy import bersama daftar lazy import showroom lain (sekitar baris 52):

```jsx
const ShowroomUnitColors = lazy(() => import('./pages/ShowroomUnitColors'))
```

Lalu tambahkan route tepat setelah route `showroom/document-handover` (baris ~552-559). Path-nya **relatif** mengikuti route bersaudara, dan memakai prop `roles` eksplisit — bukan `menuKey` — karena halaman ini tidak punya baris di `role_permissions` dan memang tidak perlu muncul di sidebar; aksesnya lewat tautan dari halaman penyerahan dokumen.

```jsx
        <Route
          path="showroom/warna-unit"
          element={
            <RoleGuard roles={[ROLES.ADMIN_SHOWROOM, ROLES.KEPALA_CABANG]}>
              <LazyPage><ShowroomUnitColors /></LazyPage>
            </RoleGuard>
          }
        />
```

`ROLES` sudah di-import di berkas itu (baris 58); `ROLES.ADMIN_SHOWROOM` bernilai `'Admin'`.

- [ ] **Step 3: Tambah tautan dari halaman penyerahan dokumen**

Di `web/src/pages/ShowroomDocumentHandover.jsx`, tambahkan di dekat tombol aksi di kepala halaman:

```jsx
<Link
  to="/showroom/warna-unit"
  className="text-xs font-semibold text-muted hover:text-accent transition-colors"
>
  Nama Warna Unit
</Link>
```

Pastikan `Link` di-import dari `react-router-dom` di berkas itu; kalau belum ada, tambahkan `import { Link } from 'react-router-dom'`.

- [ ] **Step 4: Lint dan build**

Run: `cd web && npm run lint && npm run build`
Expected: tanpa error.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ShowroomUnitColors.jsx web/src/App.jsx web/src/pages/ShowroomDocumentHandover.jsx
git commit -m "feat(web): halaman pengisian nama warna unit"
```

---

### Task 13: Verifikasi penuh dan perbarui dokumentasi

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-tanda-terima-digital-penyerahan-dokumen-design.md`
- Modify: `CLAUDE.md`
- Modify: `lastsesion.md`

- [ ] **Step 1: Jalankan urutan verifikasi lengkap**

```bash
cd api && npx prisma validate
cd api && npm test
cd web && npm run lint
cd web && npm run build
```

Expected: `npm test` lulus semua (61 test lama + test baru dari plan ini). Perbaiki apa pun yang gagal sebelum lanjut.

- [ ] **Step 2: Selaraskan spec dengan yang benar-benar dibangun**

Spec belum menyebut kolom `receipt_items` — kolom itu ditambahkan saat implementasi karena checklist harus disimpan. Tambahkan ke bagian "Model Data" di spec:

```markdown
receipt_items               String?  // JSON array item yang diserahkan
```

Perbaiki juga apa pun yang berbeda antara spec dan hasil akhir.

- [ ] **Step 3: Catat gotcha baru di CLAUDE.md**

Tambahkan di bagian "Key gotchas":

```markdown
- **Tahun pembuatan motor TIDAK ada di report mana pun** — diturunkan dari kode tahun VIN di `chassis_number` (`utils/vehicleIdentity.js`). Kolom `showroom_stnk_bpkb_tracks.tahun` adalah **tahun SO**, bukan tahun pembuatan.
- **Nama warna lengkap (`BK-BLACK`) hanya ada di import stok unit**, yang menghapus baris unit terjual tiap import. `harvestColorNames` memanennya ke `unit_color_names` sebelum `deleteMany` — jangan pindahkan urutannya.
- **Nomor tanda terima diterbitkan di dalam transaksi interaktif** (`addHandoverStep`), sementara **PDF disusun setelah commit**. Menulis berkas di dalam transaksi menahan kunci tulis SQLite selama I/O disk.
```

- [ ] **Step 4: Perbarui catatan serah terima sesi**

Di `lastsesion.md`, catat: branch `feat/tanda-terima-digital`, **belum di-merge ke `main`, belum naik produksi**, menunggu review. Sebutkan bahwa `uploads/` kini ikut backup harian.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-29-tanda-terima-digital-penyerahan-dokumen-design.md CLAUDE.md lastsesion.md
git commit -m "docs: catat tanda terima digital dan gotcha turunan identitas unit"
```

- [ ] **Step 6: Laporkan kondisi akhir**

Sampaikan ke pemilik sistem: jumlah test yang lulus, apa yang sudah bisa dicoba di dev, dan tegaskan bahwa branch ini **belum naik produksi** sesuai permintaan.
