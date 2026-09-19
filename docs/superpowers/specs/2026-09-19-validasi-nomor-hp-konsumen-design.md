# Validasi Nomor HP Konsumen — Design

## Latar Belakang

Tim mengalami banyak nomor HP konsumen yang tidak valid di data produksi, yang berdampak pada follow-up (WhatsApp/telepon). Utilitas validasi (`periksaNomor`/`normalizePhone` di `api/src/utils/phone.js`) sudah ada dan sudah dikalibrasi dari analisis 39.996 nomor produksi (2026-08-05) — mendeteksi kosong, dua nomor tersalin jadi satu, bukan nomor seluler, terlalu pendek, dan terlalu panjang. Utilitas ini dipakai untuk membentuk tautan `wa.me`, tapi belum ada tool yang menjalankannya sebagai audit terhadap data yang sudah tersimpan.

## Tujuan

Halaman audit yang menjalankan `periksaNomor()` terhadap nomor HP konsumen yang sudah ada di database, menampilkan ringkasan + daftar yang tidak valid beserta alasannya, dan bisa diekspor ke Excel untuk ditindaklanjuti tim secara manual (telepon/verifikasi ulang konsumen). Tidak menambah aturan validasi baru — memakai persis logika yang sudah tervalidasi.

## Scope Data

Riset alur data (lihat catatan di bawah) menunjukkan empat tabel di skema punya field nomor HP konsumen, tapi hanya dua yang relevan untuk tool ini:

| Tabel.field | Sumber data | Masuk scope? |
|---|---|---|
| `customers.customer_mobile` | Hanya import Excel sales (`importParsers.js` `buildSalesResult()`), tidak ada form edit manual | **Ya — target utama.** ~40rb baris, satu-satunya cara memperbaikinya adalah audit+export karena tidak ada UI edit langsung. |
| `document_handovers.consumer_phone` | Diinput/diedit manual staf lewat `EditHandoverModal` (`ShowroomDocumentHandover.jsx`), tidak divalidasi format saat disimpan | **Ya — target sekunder.** Rawan salah ketik manual. |
| `showroom_pickup_requests.consumer_phone` | Form publik `/cek`, sudah lewat `normalizePhone()` saat submit (`publicController.js` `requestPickup()`) | Tidak — nomor buruk sudah tersaring di pintu masuk, nilai audit rendah. |
| `showroom_sales_order_margins.customer_phone` | API menerima dari `req.body`, tapi tidak ada field UI di `SalesOrderMargin.jsx` yang mengisinya | Tidak — field pada praktiknya selalu kosong, bukan target yang berguna. |

## Backend

### `api/src/controllers/phoneValidationController.js` (baru)

- `getInvalidPhones(req, res, next)`
  - Query params: `source` (`customers` default | `handovers`), `search`, `page`, `limit` (pakai `clampLimit`).
  - `source=customers`: ambil `{ id, customer_name, customer_mobile, so_number, so_date }` dari `prisma.customers` (filter `branch_code: 'DXK'` seperti `getCustomers`).
  - `source=handovers`: ambil `{ id, consumer_name, consumer_phone, created_at }` dari `prisma.document_handovers` (kolom pasti disesuaikan ke skema riil saat implementasi).
  - Jalankan `periksaNomor(row.customer_mobile atau row.consumer_phone)` per baris, filter `valid === false`.
  - `search` menyaring by nama sebelum filter validasi (substring, `LOWER()` manual sesuai gotcha SQLite di CLAUDE.md).
  - Paginasi in-memory setelah filter — pola yang sama dipakai untuk filter KPB di `customerController.js` `getCustomers()` (baris ~414-424), diterima sebagai precedent untuk skala serupa.
  - Response: `{ data: [...], summary: { total_invalid, by_reason: { kosong, dobel, bukan_seluler, terlalu_pendek, terlalu_panjang } }, pagination: { page, limit, total, totalPages } }`.
- `exportInvalidPhonesExcel(req, res, next)`
  - Query sama (tanpa `page`/`limit`), tulis ke xlsx via library `xlsx` mengikuti pola `exportShowroomSalesDashboard` (`showroomSalesDashboardController.js` baris ~555-559): kolom nama, nomor SO/handover, nomor asli (mentah), alasan tidak valid (label dari `ALASAN_NOMOR`).
  - Header response: `Content-Disposition: attachment`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Route

`api/src/routes/phoneValidationRoutes.js` (baru):
```
router.get('/', authenticate, authorizeMenu('VALIDASI_NOMOR_HP'), getInvalidPhones)
router.get('/export', authenticate, authorizeMenu('VALIDASI_NOMOR_HP'), exportInvalidPhonesExcel)
```
Didaftar di `app.js` sebagai `/api/phone-validation`.

## Frontend

### `web/src/pages/PhoneValidation.jsx` (baru)

- Toggle sumber data: "Data Konsumen" (customers, default) / "Serah Terima Dokumen" (handovers).
- Kartu ringkasan: total tidak valid + breakdown per alasan, label memakai padanan `ALASAN_NOMOR` dari `phone.js` (diduplikasi ke frontend atau diserve dari backend sebagai bagian response `summary` — keputusan implementasi, bukan keputusan desain, karena tidak mengubah kontrak fungsional).
- Tabel berpaginasi + search (nama), kolom: nama, no. SO / no. handover, nomor asli, alasan tidak valid.
- Tombol "Export Excel" → `GET /api/phone-validation/export?source=...`.
- Route `/validasi-nomor-hp` di `App.jsx`, dibungkus `<RoleGuard menuKey="VALIDASI_NOMOR_HP">`.
- Entri sidebar baru di `Sidebar.jsx`, grup CRM dekat "Data Konsumen", menuKey `VALIDASI_NOMOR_HP`.

### Service

`web/src/services/api/phoneValidation.js` (baru) — modul tipis memanggil endpoint di atas, mengikuti pola modul service lain (`services/api/*.js`).

## Akses

`menuKey VALIDASI_NOMOR_HP`. IT Master bypass otomatis (bawaan `authorize()`). CRM dan Admin Showroom **tidak** otomatis dapat akses — harus di-*enable* manual lewat halaman `/roles` oleh IT Master setelah deploy, sama seperti menuKey lain (`DATA_FRESHNESS`, dll.) — tidak perlu perubahan kode atau seed untuk ini.

## Error Handling

Tool ini murni baca + export, tidak ada mutasi data — risiko rendah. Skala ~40rb baris di `customers` ditangani dengan filter in-memory setelah query, pola yang sama sudah dipakai di `getCustomers()` untuk filter KPB pada volume serupa; tidak diperlukan penanganan khusus tambahan.

## Testing

- `api/tests/phoneValidation.integration.test.js` (baru): seed beberapa baris `customers` dengan nomor valid, kosong, dobel (>15 digit), bukan-seluler (mis. 021xxxx), assert `GET /api/phone-validation` mengembalikan `summary.total_invalid` dan `summary.by_reason` yang benar; assert role tanpa `VALIDASI_NOMOR_HP` mendapat `403`; assert `search` menyaring dengan benar.
- Verifikasi manual di browser: buka halaman, cek ringkasan cocok dengan jumlah di test DB, export Excel dan cek isi file.

## Di Luar Scope

- Tidak memvalidasi/mengaudit `showroom_pickup_requests` dan `showroom_sales_order_margins` (lihat tabel scope di atas untuk alasannya).
- Tidak menambah kemampuan edit-langsung dari halaman ini — hanya lihat + export (keputusan eksplisit user, bukan keterbatasan teknis).
- Tidak mengubah logika `periksaNomor()` yang sudah ada.
