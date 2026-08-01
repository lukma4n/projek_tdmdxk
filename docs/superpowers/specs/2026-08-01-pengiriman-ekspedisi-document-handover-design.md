# Pengiriman Dokumen via Ekspedisi

Tanggal: 2026-08-01
Status: disetujui, siap diimplementasi

## Latar Belakang

Dokumen (STNK/BPKB/Plat/Buku Service) selama ini hanya bisa diserahkan ke
konsumen dengan dua cara: langsung di dealer, atau lewat salesman. Konsumen
yang jauh dari dealer tidak punya opsi lain selain datang sendiri.

Sudah ada dua fondasi yang relevan:

- **`/cek`** (self-check publik, [StnkBpkbCheck.jsx](../../../web/src/pages/StnkBpkbCheck.jsx)) — konsumen verifikasi identitas, lihat status dokumen, dan mengajukan **Permintaan Ambil Dokumen** (`showroom_pickup_requests`) bila ada dokumen siap.
- **`document_handovers`** — pelacakan serah terima dengan riwayat langkah + foto bukti, sudah mendukung mode `langsung` dan `via_sales`.

Kedua sistem ini **belum pernah terhubung**. `showroom_pickup_requests` cuma
antrean notifikasi untuk staf menjadwalkan pengambilan tatap muka; tidak ada
jalur dari situ ke `document_handovers`.

## Konsep

Konsumen bisa memilih **"Kirim via Ekspedisi"** saat mengajukan permintaan di
`/cek` (isi alamat, bukan jadwal pengambilan), atau staf yang mengubahnya jadi
ekspedisi setelah konsumen menelepon langsung. Dealer yang memesan & membayar
kurir. **Tidak ada integrasi API kurir** — sebagai gantinya, kurir yang
ditunjuk dapat **akun login sendiri** di sistem ini (role baru `Ekspedisi`,
mengikuti pola akses terbatas yang sama seperti role `Salesman`), dan mereka
yang menandai status "sudah diterima" secara manual.

`document_handovers` diperluas (bukan tabel baru) — mode `ekspedisi` menjadi
opsi ketiga di samping `via_sales`/`langsung`, memakai ulang seluruh mesin
foto bukti, riwayat langkah, dan status yang sudah ada.

**Buku Service boleh ikut dikirim** (keputusan eksplisit, meski melemahkan
insentif "tahan Buku Service" yang dirancang sebelumnya) — lewat checkbox
bundling "Sertakan Buku Service" yang **sudah ada**, kini juga berlaku saat
staf memproses pengiriman. Tidak ada logika deteksi kelayakan baru untuk Buku
Service di `/cek` — itu tetap murni STNK/BPKB/Plat seperti sekarang, konsisten
dengan sumber data yang sudah ada (`showroom_stnk_bpkb_tracks`).

## Model Data

**`document_handovers`** — kolom baru:

```prisma
shipping_address    String?
assigned_courier_id Int?
tracking_number     String?

assigned_courier users? @relation("EkspedisiAssignee", fields: [assigned_courier_id], references: [id])
```

Back-relation baru di `model users`: `ekspedisi_assignments document_handovers[] @relation("EkspedisiAssignee")`.

`assigned_courier_id` menunjuk ke akun `users` berrole `Ekspedisi` — bukan
field teks bebas. Nama kurir yang tampil = `users.name` akun itu, satu sumber
kebenaran, konsisten dengan pola FK yang sudah dipakai di seluruh tabel ini
(`created_by`, `checked_by`, `cancelled_by_admin`, dst).

**`showroom_pickup_requests`** — kolom baru:

```prisma
delivery_method  String  @default("AMBIL_SENDIRI")  // AMBIL_SENDIRI | EKSPEDISI
shipping_address String?
```

Default `AMBIL_SENDIRI` menjaga data lama tetap valid tanpa migrasi khusus.

**Status baru** pada `document_handovers.status`: `dikirim_ekspedisi`,
disisipkan di antara `tersedia` dan `selesai`. Status akhir `selesai` dipakai
bersama (sudah generik "sampai ke tangan konsumen", tidak perlu nilai baru).

**Step type baru** pada `document_handover_steps.step_type`:
`admin_ke_ekspedisi` (staf serahkan ke kurir, isi resi) dan
`ekspedisi_ke_konsumen` (kurir konfirmasi sudah sampai).

Transisi:

```
admin_ke_ekspedisi:   tersedia         -> dikirim_ekspedisi
ekspedisi_ke_konsumen: dikirim_ekspedisi -> selesai
```

## Role Baru: `Ekspedisi`

Ditambahkan ke `web/src/config/roles.js` (mengikuti pola `Salesman`).
Dibuat oleh Admin lewat halaman Manajemen Pengguna, satu akun per mitra
ekspedisi yang ditunjuk dealer.

Pembatasan di `addHandoverStep` (mirip pembatasan `Salesman` yang sudah ada):
akun `Ekspedisi` hanya boleh melakukan `ekspedisi_ke_konsumen`, dan hanya untuk
handover yang `assigned_courier_id`-nya cocok dengan akun yang login — ditolak
403 kalau tidak. `getDocumentHandovers`/`getDocumentHandoverSummary` difilter
otomatis ke `assigned_courier_id = req.user.userId` untuk role ini, sama
seperti `Salesman` difilter ke `salesman_name = req.user.name`.

Landing page default redirect ke halaman Document Handover, sama seperti
`Salesman`.

## API

### Internal

**`GET /showroom/document-handovers/couriers`** (mirip `getHandoverSalespeople`)
— daftar akun berrole `Ekspedisi`, untuk dropdown penugasan.

**`POST /showroom/pickup-requests/:id/process-shipment`** — endpoint baru.
Body: `{ document_types: string[], assigned_courier_id, include_buku_service? }`.

`document_types` adalah **subset** dari `requested_docs` milik pickup request
`:id` (field lama, string dipisah koma seperti `"STNK,PLAT"`) — staf boleh
memproses sebagian dulu kalau tidak semua dokumen yang diminta konsumen sudah
siap dikirim sekaligus; validasi menolak (400) tipe yang bukan bagian dari
`requested_docs` permintaan tersebut.

Membaca `showroom_pickup_requests` (harus `delivery_method = EKSPEDISI`),
membuat baris `document_handovers` (mode `ekspedisi`, `shipping_address`
tersalin dari permintaan, `assigned_courier_id` dari body) untuk tiap
`document_types` yang dipilih staf — memakai ulang pola non-atomik yang sudah
ada di `createDocumentHandover` (kalau satu gagal karena sudah ada, yang lain
tetap jalan). `include_buku_service` memakai ulang persis logika bundling yang
sudah dibangun untuk STNK/BPKB/Plat. Pickup request ditandai `DONE` setelah
berhasil.

**`addHandoverStep`** diperluas: saat `step_type = admin_ke_ekspedisi`, body
**wajib** menyertakan `tracking_number` non-kosong (400 kalau tidak ada) —
tanpa resi, kiriman tidak bisa dilacak sama sekali, bertentangan dengan tujuan
"termonitoring dengan baik" yang jadi alasan fitur ini dibuat. Disimpan ke
`document_handovers.tracking_number` dalam transaksi yang sama dengan
pembuatan step.

### Publik

**`POST /public/stnk-bpkb/request-pickup`** (sudah ada, diperluas) — body
bertambah `delivery_method` (`AMBIL_SENDIRI`/`EKSPEDISI`, default
`AMBIL_SENDIRI`) dan `shipping_address` (wajib kalau `EKSPEDISI`).

**`GET /public/stnk-bpkb/check`** (sudah ada, diperluas) — kalau ada
`document_handovers` mode `ekspedisi` untuk `engine_number` ini, response
bertambah `shipments: [{ document_type, status, tracking_number,
courier_name, updated_at }]` — supaya konsumen bisa cek ulang status kiriman
mereka tanpa perlu token/login.

## Tampilan

**`/cek`** — form "Ajukan Permintaan Ambil Dokumen" bertambah pilihan di awal:
**Ambil Sendiri** / **Kirim via Ekspedisi**. Pilih kirim → field
tanggal/jam pengambilan diganti textarea alamat (wajib). Kalau hasil check
membawa `shipments`, tampilkan sebagai kartu status: "STNK — Dikirim, Resi
XXXX" / "BPKB — Sudah Diterima, 01 Agu 2026".

**Permintaan Ambil Dokumen** (internal) — baris dengan `delivery_method =
EKSPEDISI` bertambah tombol **"Proses Pengiriman"**: modal pilih dokumen mana
yang dikirim (dari `requested_docs`), centang "Sertakan Buku Service", pilih
akun kurir. Baris dengan `AMBIL_SENDIRI` tidak berubah. Staf juga bisa
mengubah permintaan yang sudah ada dari `AMBIL_SENDIRI` ke `EKSPEDISI` (untuk
konsumen yang menelepon langsung), isi alamat sendiri.

**Document Handover** (internal) — kartu bermode `ekspedisi` memakai ulang
seluruh tampilan yang sudah ada (badge, grouping per engine_number+status,
expand detail). Perbedaannya di `HandoverStepModal`: untuk mode ini, status
`tersedia` tidak menawarkan pilihan "Ke Salesman"/"Langsung Konsumen" seperti
mode lain — langsung tampil aksi tunggal "Serahkan ke Ekspedisi" dengan field
tambahan **Nomor Resi** (wajib). Status `dikirim_ekspedisi` menampilkan aksi
tunggal "Tandai Diterima Konsumen" — inilah satu-satunya aksi yang boleh
dilakukan akun `Ekspedisi`.

## Test

- Transisi `admin_ke_ekspedisi` (tersedia→dikirim_ekspedisi) mengisi
  `tracking_number`; `ekspedisi_ke_konsumen` (dikirim_ekspedisi→selesai)
- Akun `Ekspedisi` ditolak (403) mencoba step selain `ekspedisi_ke_konsumen`,
  dan ditolak untuk handover yang bukan miliknya
- `getDocumentHandovers` untuk role `Ekspedisi` cuma mengembalikan miliknya
- `process-shipment` membuat handover mode `ekspedisi` dengan
  `shipping_address` tersalin; `include_buku_service` bekerja sama seperti di
  `createDocumentHandover`; pickup request jadi `DONE`
- `process-shipment` ditolak kalau `delivery_method` bukan `EKSPEDISI`
- `requestPickup` mewajibkan `shipping_address` saat `delivery_method =
  EKSPEDISI`, opsional saat `AMBIL_SENDIRI`
- `checkStnkBpkb` mengembalikan `shipments` yang sesuai untuk unit yang punya
  handover mode `ekspedisi`, kosong untuk yang tidak
