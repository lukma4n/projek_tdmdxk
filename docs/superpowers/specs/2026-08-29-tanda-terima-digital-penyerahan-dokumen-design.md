# Tanda Terima Digital Penyerahan Dokumen

Tanggal: 2026-08-29
Status: disetujui, siap diimplementasi

## Latar Belakang

Penyerahan STNK dan BPKB ke konsumen sekarang dicatat di `document_handovers`
dengan riwayat langkah, foto dokumen, dan foto serah terima fisik. Yang belum
ada: **tanda terima resmi**. Sampai sekarang tanda terima dicetak dari DMS
(`ENCS/DXK/26/08/03664` untuk STNK, `ENCB/DXK/26/08/01222` untuk BPKB),
ditandatangani basah, lalu diarsipkan sebagai berkas fisik.

Tujuan fitur ini: menghapus berkas fisik itu. Tanda terima diterbitkan sistem,
ditandatangani secara digital oleh petugas dan konsumen di perangkat petugas,
lalu disimpan sebagai PDF bersama foto bukti yang sudah ada.

Kondisi antrean saat spec ditulis: **1.063 STNK** dan **277 BPKB** menunggu
diserahkan. Dari jumlah itu, 1.062 dan 271 sudah punya data lengkap.

## Konsep

Fitur ini **memperluas langkah yang sudah ada**, bukan alur baru. Tanda terima
terbit sebagai hasil sampingan dari langkah `serah_ke_konsumen` dan
`ekspedisi_ke_konsumen` di `addHandoverStep`. Seluruh mesin status, transisi,
penjagaan peran, dan penyimpanan foto dipakai ulang apa adanya.

Berlaku untuk **STNK dan BPKB**. Buku Service dan Plat ikut tercantum sebagai
item checklist di badan tanda terima, tapi tidak menerbitkan tanda terima
sendiri.

Tanda tangan diambil **hanya di perangkat petugas**. Setelah foto serah terima
diambil, petugas menandatangani, lalu perangkat diberikan kepada konsumen untuk
menandatangani. Tidak ada tautan ke HP konsumen — itu di luar lingkup.

Kolom **"Mengetahui" (ADH) dihilangkan** dari form. Di dua tanda terima contoh,
kolom itu terisi di BPKB dan kosong di STNK; keputusannya kolom itu memang tidak
diperlukan. Hanya ada dua tanda tangan: yang menyerahkan dan penerima.

**Tidak ada langkah cetak.** PDF tersimpan di record serah terima konsumen dan
baru dicetak kalau memang dibutuhkan.

## Nomor Tanda Terima

Sistem menerbitkan nomornya sendiri; nomor DMS tidak dipakai dan tidak dicatat.

```
TT-STNK/DXK/26/08/00001
TT-BPKB/DXK/26/08/00001
```

Awalan `TT-` sengaja membedakannya dari `ENCS`/`ENCB` supaya tidak pernah
tertukar dengan nomor DMS saat audit. Nomor urut per jenis dokumen per bulan,
diterbitkan di dalam transaksi yang sama dengan penyimpanan langkah — SQLite
menyerialkan penulisan, jadi tidak ada nomor kembar.

## Aturan Penerima Bukan Konsumen

Nama penerima terisi otomatis dari nama konsumen di sistem dan bisa diubah
petugas bila yang mengambil bukan konsumen sendiri.

Bila nama penerima diubah **dan** jenis dokumennya **BPKB**, foto surat kuasa
menjadi **wajib** — langkah tidak bisa disimpan tanpanya. Ini menegakkan syarat
yang selama ini hanya tertulis di kaki form:

> Konsumen yang namanya tercantum pada BPKB WAJIB mengambil dan menerima secara
> langsung. Apabila diwakilkan, wajib melampirkan surat kuasa bermaterai 10.000,
> KTP asli dan fotocopy sesuai BPKB, fotocopy STNK, dan KTP asli penerima kuasa.

Untuk **STNK tidak wajib**, mengikuti syarat di form STNK yang lebih ringan
(cukup menunjukkan KTP pemilik dan KTP pengambil). Ini juga menjaga penyerahan
STNK tetap cepat, karena volumenya hampir empat kali BPKB.

Penegakan dilakukan di backend, bukan hanya di UI.

## Model Data

**`document_handover_steps`** — kolom baru:

```prisma
receipt_number              String?  @unique
signature_giver_url         String?
signature_receiver_url      String?
photo_power_of_attorney_url String?
receiver_is_customer        Boolean  @default(true)
receipt_items                String?  // JSON array item yang diserahkan
receipt_pdf_url             String?
receipt_pdf_sha256          String?
```

`receipt_items` menyimpan checklist item yang benar-benar diserahkan
(BPKB: BPKB/Copy Faktur/NIK; STNK: STNK/Plat) sebagai JSON array. Ditambahkan
saat implementasi — tidak ada di draf awal spec ini, tapi checklist yang
dicentang petugas (lihat bagian PDF) harus disimpan supaya PDF bisa dibangun
ulang dan riwayatnya bisa diaudit.

`receipt_pdf_sha256` dihitung saat PDF dibuat dan tidak pernah diperbarui.
Fungsinya membuktikan berkas tidak berubah setelah ditandatangani. Selama
kolom ini masih kosong, PDF boleh dibangun ulang; setelah terisi, tidak.

**Tabel baru — peta nama warna:**

```prisma
model unit_color_names {
  code       String   @id      // "BK"
  name       String            // "BK-BLACK"
  source     String   @default("import") // "import" | "manual"
  updated_at DateTime @updatedAt
}
```

Diisi otomatis setiap import stok unit, dipanen dari record hasil parser
**sebelum** `deleteMany` menghapus baris unit yang sudah terjual
(`showroomImport.js` `runShowroomSnapshotImport`). Kode yang belum ada diisi
manual lewat form.

Saat spec ditulis: dari 29 kode warna di antrean, **19 sudah bisa dipanen**
dari 175 unit stok yang ada. Sepuluh sisanya (`PH`, `BP`, `WR`, `PB`, `MP`,
`SH`, `HO`, `BY`, `BS`, `1B`) menyangkut 53 unit dari 1.340 — diisi manual.

Tidak ada tabel arsip identitas unit. Sempat dipertimbangkan, ternyata tidak
perlu: tahun didapat dari nomor rangka, kode type dan series sudah tersimpan di
`customers`. Hanya warna yang butuh peta.

## Sumber Data Tiap Field

| Field di form | Sumber |
|---|---|
| Nama Pemilik | `showroom_stnk_bpkb_tracks.stnk_name` |
| Alamat Pemilik | `tracks.partner_address`, baris kedua konstanta `"KALIMANTAN BARAT"` |
| No. KTP Pemilik | `customers.no_ktp` |
| Merk/Type | `customers.product_code` + `" / "` + transmisi |
| Jenis/Model | `customers.model` |
| Tahun Pembuatan | turunan dari `tracks.chassis_number` |
| Warna | `customers.color` → `unit_color_names` |
| No. Rangka | `tracks.chassis_number` |
| No. Mesin | `tracks.engine_number` |
| No. Polisi | `tracks.no_polisi` |
| Nomor BPKB | `tracks.no_bpkb` |
| No. STNK | `tracks.no_stnk` |
| Yang menyerahkan | `users.name` petugas yang login |
| Penerima | nama konsumen, atau ketikan petugas |

Join `tracks.engine_number` ↔ `customers.no_engine` — cocok untuk 19.990 dari
19.995 baris.

### Tahun pembuatan dari nomor rangka

Karakter kode tahun mengikuti standar VIN:

```
F=2015  G=2016  H=2017  J=2018  K=2019  L=2020
M=2021  N=2022  P=2023  R=2024  S=2025  T=2026
```

Huruf `I`, `O`, `Q`, `U`, `Z` tidak dipakai. Posisinya:

- nomor rangka **14 karakter** → karakter ke-7
- nomor rangka **17 karakter** (berawalan `MH1`) → karakter ke-10

Keduanya sama; format 14 karakter hanya versi tanpa awalan `MH1`.

Diuji ke seluruh 19.995 baris dan konsisten dengan tahun SO. Divalidasi ke dua
tanda terima asli: `KC0411SK036977` → `S` → 2025, dan `JMH11XTK409060` → `T` →
2026 — keduanya cocok dengan yang tercetak di form.

Bila karakternya bukan huruf yang dikenal, field Tahun Pembuatan dikosongkan di
PDF. Tidak boleh menebak.

### Merk/Type

`customers.product_code` (mis. `ML2A`) digabung transmisi dari `customers.type`
— field itu menyimpan kolom `Parent Category Name` dari Report Penjualan, isinya
`AT` / `SPORT` / `CUB`. Nilai `AT` → `A/T`, selain itu → `M/T`. Hasil:
`ML2A / A/T`.

Jangan tertukar dengan `customers.category` (`AT LOW END`, `SPORT MID END`) yang
menyimpan kolom `Category Name` — itu segmen harga, bukan transmisi.

Kode type panjang (mis. `B5D02M29M5`) **tidak dipakai** — tidak ada di report
mana pun, dan sudah dipastikan tidak diperlukan.

## Perubahan Parser Import

`buildSalesResult` di `importParsers.js` sekarang membaca kolom 78
(`KTP Customer`) untuk `no_ktp`. Diubah ke **kolom 79** (`KTP Customer STNK`),
karena yang dicantumkan di tanda terima adalah KTP pemilik sesuai STNK/BPKB.
Umumnya sama, tapi tidak selalu — misalnya motor dibeli atas nama orang tua.

Kolom 78 tetap tidak disimpan; tidak ada kebutuhan yang memerlukannya.

Import stok unit (`runShowroomSnapshotImport`) menambah satu langkah: upsert
`unit_color_names` dari record masuk, di dalam transaksi yang sama, sebelum
`deleteMany` berjalan.

## Tanda Tangan

Canvas HTML di frontend, tanpa dependensi baru — cukup `<canvas>` dengan
pointer event. Hasilnya PNG, dikirim sebagai berkas bersama foto lain lewat
`uploadHandoverPhoto` yang sudah ada. Tidak ada middleware baru; hanya menambah
nama field di `upload.fields([...])` pada route langkah serah terima.

Disimpan di `uploads/handovers/` mengikuti pola penamaan yang berlaku.

Tanda tangan ini adalah **tanda tangan elektronik tidak tersertifikasi** menurut
PP 71/2019 — sah dan punya kekuatan hukum, tapi pembuktiannya lebih lemah
daripada tanda tangan tersertifikasi PSrE. Yang memperkuatnya di sistem ini:
hash PDF, timestamp server, identitas petugas yang login, foto serah terima
fisik, dan foto surat kuasa bila penerima diwakilkan. Integrasi PSrE di luar
lingkup.

## PDF

Disusun dengan **`pdfkit`** — JavaScript murni, tanpa headless browser.
Puppeteer ditolak karena menambah ~300MB Chromium dan pemakaian RAM di VPS yang
juga menjalankan API, Nginx, dan SQLite. Cetak lewat browser ditolak karena
tidak meninggalkan arsip dan hasilnya berbeda-beda antar perangkat.

Tata letak A4 mengikuti dua tanda terima contoh: judul, nama PT dan cabang,
nomor tanda terima, daftar data `a`–`k`, kotak checklist item, baris tempat dan
tanggal, dua blok tanda tangan bergambar dengan nama di bawahnya, syarat dan
ketentuan, lalu kaki berisi nama petugas dan waktu terbit.

Checklist per jenis dokumen:

- **BPKB** — BPKB, Copy Faktur, NIK
- **STNK** — STNK, Plat

Petugas mencentang item yang benar-benar diserahkan sebelum menyimpan.

Berkas disimpan di `uploads/tanda-terima/`, disajikan lewat route berautentikasi
mengikuti pola `getHandoverPhoto`. Tidak pernah disajikan sebagai berkas statis.

## Backup

Backup harian (`scripts/backup-db.js`) sekarang **hanya menyalin database
SQLite**. Folder `api/uploads/` tidak ikut, dan di-gitignore.

Selama berkas fisik masih ada, risikonya terbatas. Setelah berkas fisik dihapus,
PDF tanda terima dan tanda tangan menjadi satu-satunya bukti yang tersisa — dan
justru bagian itu yang tidak terlindungi. Kalau disk VPS bermasalah, database
selamat tapi seluruh tanda terima hilang tanpa kertas pengganti.

`backup-db.js` diperluas untuk mengarsipkan `uploads/` bersama database,
mengikuti retensi yang sama (default 14). Ini bagian dari pekerjaan ini, bukan
tindak lanjut terpisah.

## API

Tidak ada endpoint baru untuk penyerahan — tanda terima terbit di dalam
`POST /api/showroom/document-handovers/:id/steps` yang sudah ada, dengan field
tambahan di form-data.

Endpoint baru:

```
GET   /api/showroom/document-handovers/receipt/:stepId   # unduh PDF, auth
GET   /api/showroom/unit-colors                          # daftar peta warna
PATCH /api/showroom/unit-colors/:code                    # isi nama manual
```

Akses `receipt` mengikuti `handoverReadAccess`. Akses peta warna mengikuti
`showroomAccess`.

## Tampilan

**Modal serah terima** (`ShowroomDocumentHandover.jsx`) bertambah, berurutan
setelah foto serah terima: kolom nama penerima yang sudah terisi, kolom foto
surat kuasa yang muncul bersyarat, checklist item, lalu dua kotak tanda tangan.
Tombol simpan nonaktif sampai kedua tanda tangan terisi.

**Riwayat langkah** menampilkan tautan unduh PDF di samping foto-foto yang sudah
ada, beserta nomor tanda terimanya.

**Halaman peta warna** — daftar sederhana kode dan nama, kode tanpa nama
ditandai supaya terlihat mana yang perlu diisi.

## Test

Menggunakan `node --test` seperti test yang sudah ada. Setiap test integrasi
wajib menyetel `process.env.DATABASE_URL = 'file:./test.db'` sebelum mengimpor
`helpers.js`.

- Turunan tahun dari nomor rangka: format 14 dan 17 karakter, kedua contoh dari
  tanda terima asli, karakter tidak dikenal menghasilkan kosong
- Penerbitan nomor: urut, tidak kembar, terpisah antara STNK dan BPKB, berganti
  saat bulan berganti
- Surat kuasa: BPKB dengan nama penerima berbeda tanpa foto kuasa ditolak; STNK
  dalam kondisi sama diterima; BPKB dengan nama penerima sama diterima
- Peta warna: terisi dari import stok unit, kode yang belum ada tidak menggagalkan
  penerbitan PDF
- Hash PDF: terisi saat terbit dan cocok dengan isi berkas
- Parser sales membaca kolom 79 untuk `no_ktp`

## Di Luar Lingkup

Halaman verifikasi QR publik, tanda tangan lewat HP konsumen, tanda tangan ADH,
tanda tangan tersertifikasi PSrE, dan pengisian mundur tanda terima untuk 18.554
dokumen yang sudah diserahkan sebelum fitur ini ada.
