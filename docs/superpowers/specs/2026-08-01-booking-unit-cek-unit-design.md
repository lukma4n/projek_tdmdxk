# Penanda Booking Unit di Cek Ketersediaan Unit

Tanggal: 2026-08-01
Status: disetujui, siap implementasi

## Latar Belakang

Halaman publik `/cek-unit` ([StockUnitCheck.jsx](../../../web/src/pages/StockUnitCheck.jsx)) menampilkan status unit `ready` / `reserved` / `not_ready` yang berasal murni dari `engine_state` hasil import stock AHM. Status itu tidak pernah membawa info siapa yang memesan — data source AHM memang tidak menyertakannya. Akibatnya dua sales bisa sama-sama menjanjikan unit yang sama ke customer berbeda tanpa saling tahu.

Tujuan fitur ini: sales bisa menandai "unit ini sedang saya booking" langsung dari halaman publik yang sudah mereka pakai sehari-hari (tanpa login — role Salesman memang tidak punya akses login ke halaman internal manapun, hanya diarahkan ke `/showroom/document-handover` per [roles.js:107](../../../web/src/config/roles.js#L107)), supaya sales lain langsung tahu unit itu sudah "dipegang" siapa.

## Ruang Lingkup

1. Sales booking unit `ready` dari `/cek-unit`, tanpa login, isi nama + nomor HP + durasi (1/3/7 hari)
2. Badge publik menampilkan nama sales + batas waktu booking
3. Sales bisa membatalkan booking sendiri (verifikasi nomor HP)
4. Booking kedaluwarsa otomatis kalau tidak diperpanjang
5. Admin/Kepala Cabang bisa membatalkan booking siapa pun lewat halaman internal Stock Unit Showroom

Di luar lingkup: verifikasi identitas sales terhadap Master Sales (nama diketik bebas), antrean booking bertingkat, notifikasi WA/SMS saat booking dibuat atau kedaluwarsa.

## Keputusan Desain

- **Identitas sales**: nama + nomor HP diketik bebas, tidak dicocokkan ke Master Sales. Untuk ukuran tim sales dealer ini, penyalahgunaan akan cepat ketahuan secara sosial; verifikasi ketat dinilai berlebihan untuk kebutuhan sekarang.
- **Satu unit satu booking aktif.** Booking kedua untuk unit yang sama ditolak selama booking pertama masih aktif — mencegah dua sales menjanjikan unit sama ke customer berbeda, yang justru jadi alasan utama fitur ini dibuat.
- **Booking hanya untuk unit `ready`.** Unit `reserved` (dari AHM) atau `not_ready` tidak relevan untuk dibooking sales — unit itu memang belum/tidak bisa dijual.
- **Durasi dipilih sales sendiri** (1/3/7 hari) saat membuat booking, bukan nilai tetap — kebutuhan tiap transaksi beda (nego cepat vs proses kredit lama).
- **Kedaluwarsa dihitung langsung dari `expires_at`, tanpa cron job.** "Booking aktif" = baris ter-cancel `null` dengan `expires_at` di masa depan. Lebih sederhana daripada menjaga state terpisah yang perlu di-flip oleh proses terjadwal.
- **Nomor HP jadi bukti kepemilikan untuk pembatalan mandiri**, tapi tidak ditampilkan ke publik — hanya nama dan batas waktu yang publik. Admin (sudah login) tetap bisa melihat nomor HP untuk keperluan menghubungi langsung.

## Gotcha yang Menentukan Skema

Saat stock diimpor ulang, unit yang sudah tidak ada di file aktif AHM (misalnya karena laku terjual) **langsung dihapus** dari `showroom_stock_units` (`deleteMany` di [showroomImport.js:97-99](../../../api/src/controllers/showroomImport.js#L97-L99)). Tabel `showroom_unit_ksu_checks` yang sudah ada sengaja **tidak** memakai relasi FK Prisma ke situ — `engine_number` di sana cuma `String @unique` biasa ([schema.prisma:586](../../../api/prisma/schema.prisma#L586)) — supaya `deleteMany` itu tidak pernah diblokir foreign key constraint.

Tabel booking baru mengikuti pola yang sama persis. Kalau unit yang sedang dibooking lalu terjual dan barisnya terhapus dari `showroom_stock_units`, baris booking tetap ada sebagai riwayat tapi tidak lagi terhubung ke unit mana pun — tidak ada error, tidak perlu pembersihan tambahan di transaksi import.

## Model Data

```prisma
model showroom_unit_bookings {
  id                 Int       @id @default(autoincrement())
  engine_number      String
  salesman_name      String
  salesman_phone     String
  expires_at         DateTime
  created_at         DateTime  @default(now())
  cancelled_at       DateTime?
  cancelled_by_admin Int?

  cancelled_by_user users? @relation(fields: [cancelled_by_admin], references: [id])

  @@index([engine_number])
}
```

Satu baris = satu kejadian booking (bukan status yang ditimpa), sehingga riwayat booking per unit tetap terjaga untuk keperluan audit/oversight. `cancelled_by_admin` terisi kalau dibatalkan lewat halaman internal; kosong kalau sales membatalkan sendiri.

Butuh back-relation baru di `model users` (pola yang sama dengan `service_labels_printed customers[]` yang ditambahkan untuk fitur label sebelumnya): `unit_bookings_cancelled showroom_unit_bookings[]`.

Diterapkan dengan `npx prisma db push` (bukan `migrate`), sesuai catatan repo bahwa prisma migrate rusak di setup ini.

## API

### Publik (`/api/public/*`, tanpa login)

**`POST /public/stock-units/:engineNumber/booking`**

Body: `{ salesman_name, salesman_phone, duration_days }` — `duration_days` ∈ `{1, 3, 7}`.

Validasi berurutan:
1. Unit ada, `branch_code = DXK`
2. Status unit `ready` — selain itu 400
3. `salesman_name` tidak kosong setelah `trim()`; `salesman_phone` setelah dinormalisasi lewat `normalizePhone()` (di-`export` dari [publicController.js:30](../../../api/src/controllers/publicController.js#L30), dipakai ulang — tidak ditulis kembali) harus tersisa **minimal 9 digit** — `normalizePhone` sendiri hanya membuang karakter non-digit, tidak memvalidasi panjang, jadi batas minimal ini ditegakkan terpisah di validator booking
4. `duration_days` termasuk yang diizinkan
5. Belum ada booking aktif lain untuk unit itu — kalau ada, 409

Langkah 5 dan pembuatan baris dibungkus `prisma.$transaction` supaya dua submit yang hampir bersamaan tidak lolos berdua.

**`DELETE /public/stock-units/:engineNumber/booking`**

Body: `{ salesman_phone }`. Dicocokkan (setelah dinormalisasi) dengan nomor HP di booking aktif unit tersebut. Tidak cocok → 403, pesan generik tanpa membocorkan siapa pemilik booking sebenarnya.

**`GET /public/stock-units`** (sudah ada, diperluas) — tiap unit di `models[].units[]` bertambah:

```js
booking: { salesman_name, expires_at } | null   // nomor HP tidak pernah dikirim ke sini
```

### Internal (`authenticate` + `showroomAccess` = Admin/Kepala Cabang, sama seperti rute Stock Unit lain)

**`PATCH /showroom/stock-units/:engineNumber/booking/cancel`**

Membatalkan booking aktif unit tersebut tanpa verifikasi nomor HP (admin override). Mengisi `cancelled_by_admin = req.user.userId`.

**`GET /showroom/stock-units`** (sudah ada, diperluas) — tiap unit bertambah info booking lengkap (nama, nomor HP, `expires_at`, `id`) lewat helper baru `attachBookingToStockUnits`, mengikuti pola `attachKsuToStockUnits` yang sudah dipakai di controller yang sama ([showroomStockUnitController.js:214](../../../api/src/controllers/showroomStockUnitController.js#L214)).

### Perlindungan dari Penyalahgunaan

`POST` dan `DELETE` di atas adalah operasi tulis tanpa autentikasi, jadi dipasangi rate limiter khusus per IP (mengikuti pola `authLimiter`/`importLimiter` yang sudah ada di [app.js](../../../api/src/app.js)) — bukan cuma `apiLimiter` umum. Nilai: 30 permintaan/15 menit, cukup longgar untuk pemakaian wajar tim sales dari satu lokasi (WiFi dealer bisa berbagi IP) tapi menahan percobaan spam otomatis.

## Tampilan & Alur

**`/cek-unit`** — tabel unit ([StockUnitCheck.jsx:146-169](../../../web/src/pages/StockUnitCheck.jsx#L146-L169)) bertambah kolom Booking:

- Unit `ready` tanpa booking aktif → tombol "Booking" → modal: pilih durasi (1/3/7 hari), isi nama, isi nomor HP → submit
- Unit sedang dibooking → badge kuning `"Dibooking SITI — s.d. 3 Agu"` menggantikan tombol, plus link kecil "Batalkan booking saya" → modal minta nomor HP untuk verifikasi

**Stock Unit Showroom** (internal) — kolom baru "Booking" menampilkan nama + nomor HP (untuk dihubungi admin) + tombol "Batalkan" langsung tanpa verifikasi, karena sudah terautentikasi sebagai Admin/Kepala Cabang.

**Alur normal:** sales buka `/cek-unit` di HP → pilih unit ready → klik Booking → isi form → unit langsung berubah jadi badge kuning untuk semua orang yang membuka halaman. Kalau customer batal, sales buka lagi, klik "Batalkan booking saya", masukkan nomor HP yang sama → unit kembali tersedia.

## Penanganan Error

- **Race condition** — unit sudah keburu dibooking sales lain saat submit → 409 ditampilkan di modal, modal ditutup, daftar unit di-refresh
- **Nomor HP tidak cocok** saat mencoba batalkan sendiri → pesan generik "Nomor HP tidak cocok dengan booking ini", tidak membocorkan nama/HP pemilik booking sebenarnya
- **Unit tidak lagi `ready`** (berubah status di tengah proses, misal jadi NRFS) → tombol Booking otomatis hilang setelah refresh berikutnya karena backend menolak booking untuk status selain `ready`
- **Booking kedaluwarsa** → otomatis dianggap tidak aktif begitu `expires_at` terlewati; unit kembali muncul sebagai `ready` tanpa booking di response berikutnya, tanpa perlu proses terjadwal apa pun

## Test

Di `api/tests/`, mengikuti pola integration test yang ada (termasuk `process.env.DATABASE_URL = 'file:./test.db'` sebelum import `helpers.js`):

- `POST` berhasil untuk unit `ready` tanpa booking aktif
- `POST` ditolak (400) untuk unit selain `ready`
- `POST` ditolak (409) kalau sudah ada booking aktif lain
- `POST` berhasil lagi setelah booking sebelumnya kedaluwarsa (`expires_at` di masa lalu) atau dibatalkan
- `DELETE` berhasil kalau nomor HP cocok
- `DELETE` ditolak (403) kalau nomor HP tidak cocok
- `PATCH .../booking/cancel` (internal) berhasil dengan role Admin/Kepala Cabang, ditolak tanpa auth (401) dan role lain (403)
- `GET /public/stock-units` mengembalikan `booking: { salesman_name, expires_at }` untuk booking aktif, `null` kalau tidak ada, dan **tidak pernah** mengembalikan nomor HP
- `GET /public/stock-units` untuk booking yang sudah kedaluwarsa → `booking: null` (unit tampil tersedia lagi)
