# Product Requirements Document
## Sistem Workshop, Sparepart, dan Showroom DXK

**Versi:** 2.3  
**Tanggal Update:** 6 Mei 2026  
**Status:** Functional, role-protected, dan siap dipakai harian untuk cabang DXK

---

## Peta Dokumentasi

| Dokumen | Fungsi |
|---------|--------|
| `README.md` | Quick start, stack, login, endpoint utama, troubleshooting |
| `AGENTS.md` | Konteks kerja cepat untuk AI/developer yang melanjutkan proyek |
| `PRD.md` | Kebutuhan produk, scope bisnis, fitur, role, dan roadmap produk |
| `BLUEPRINT.md` | Arsitektur besar, alur data, workflow operasional, dan prinsip desain |
| `ERD.md` | Database, entitas, relasi, constraint, dan Mermaid ERD |
| `FSD.md` | Spesifikasi fitur per modul, role, endpoint, workflow, dan acceptance criteria |
| `TRD.md` | Spesifikasi teknis, runtime, konfigurasi, API, security, import, backup, dan verifikasi |

PRD ini tetap menjadi acuan kebutuhan produk. Detail arsitektur, database, fungsi per endpoint, dan kebutuhan teknis terbaru dipisahkan ke `BLUEPRINT.md`, `ERD.md`, `FSD.md`, dan `TRD.md` agar dokumen tidak saling tumpang tindih.

---

## 1. Ringkasan Produk

Sistem Workshop & Sparepart DXK adalah aplikasi operasional cabang DXK untuk:

1. Monitoring Work Order bengkel.
2. Monitoring program AHM seperti KPB dan LCR.
3. Monitoring Hotline Part.
4. Monitoring stok sparepart, aging stock, ranking, dan barcode label.
5. Stock opname sparepart dengan barcode scanner.
6. Monitoring konsumen after-sales dari data penjualan dan status KPB.
7. Import Excel berkala dari sistem induk melalui modul upload global.
8. Monitoring showroom: stock unit, KSU, master harga, STNK, BPKB, dan dashboard showroom.
9. Follow-up dokumen STNK/BPKB untuk Admin CRM.
10. Manajemen user dan role access.
11. Tema UI terang/gelap untuk shell aplikasi.

Sistem saat ini tidak lagi memakai mock API. Frontend selalu terhubung ke backend real.

---

## 2. Stack Aktual

| Layer | Teknologi |
|-------|-----------|
| Frontend | Vite + React 19 + Tailwind CSS v4 + React Router + Zustand + lucide-react |
| Backend | Node.js + Express 5 + Prisma |
| Database | SQLite file-based |
| Auth | JWT 24 jam + bcryptjs |
| Excel | SheetJS `xlsx` |
| Upload | Multer + multipart/form-data |
| Barcode | jsbarcode CODE128 |
| Cache | Redis optional, graceful fallback ke database |

UI shell memakai desain final V2 Clean Corporate sebagai default terang. User dapat mengganti tema terang/gelap dari header; pilihan disimpan di `localStorage.theme` melalui `web/src/stores/themeStore.js`.

Tidak ada dependency Docker untuk menjalankan sistem lokal.

---

## 3. Konfigurasi Database dan Prisma

Database utama:

```text
api/prisma/dev.db
```

Konfigurasi runtime:

```env
DATABASE_URL=file:./dev.db
```

Catatan penting:

- `DATABASE_URL=file:./dev.db` relatif terhadap folder `api/prisma`, sehingga menunjuk ke `api/prisma/dev.db`.
- `api/prisma/schema.prisma` memakai `provider = "sqlite"`.
- `api/prisma.config.ts` memuat `.env` via `dotenv/config`.
- `npx prisma validate` sudah berhasil pada konfigurasi saat ini.
- Log backend menampilkan `SQLite connected` saat koneksi berhasil.

Model utama:

| Table | Fungsi |
|-------|--------|
| `users` | User login dan role |
| `work_orders` | Data Work Order workshop |
| `stock_parts` | Data stok sparepart |
| `hotlines` | Data hotline part |
| `hotline_items` | Item detail hotline |
| `customers` | Data konsumen dari sales import |
| `opname_sessions` | Sesi stock opname |
| `opname_items` | Item hasil scan opname |
| `sync_logs` | Riwayat import Excel |
| `audit_logs` | Audit perubahan tertentu |
| `kpb_followups` | Riwayat follow-up konsumen KPB |
| `showroom_stock_units` | Stock unit showroom DXK |
| `showroom_stnks` | Stock dokumen STNK showroom |
| `showroom_bpkbs` | Stock dokumen BPKB showroom |
| `showroom_otr_prices` | Master Harga OTR/Off/Beli |
| `showroom_document_followups` | Riwayat follow-up STNK/BPKB |
| `showroom_bbn_prices` | Master BBN per kode produk dan area |
| `showroom_leasing_tac_programs` | Matrix TAC/PS Finco leasing berbasis series, DP, tenor, periode |
| `showroom_leasing_promo_schemes` | Dana Promosi Scheme leasing berbasis range OTR, dipakai untuk IMFI |
| `showroom_md_programs` | Master Program MD/AHM/Dealer berdasarkan kode produk, tipe jualan, periode |
| `showroom_ksu_standards` | Standar KSU per product type |
| `showroom_unit_ksu_checks` | Status pengecekan KSU per nomor mesin |
| `showroom_opname_sessions` | Sesi opname showroom unit/STNK/BPKB |
| `showroom_opname_items` | Item opname showroom per sesi |
| `showroom_sales_order_margins` | Simpan hasil simulasi/sales order margin showroom |

---

## 4. Auth dan Role Access

Auth memakai JWT dengan masa berlaku 24 jam. Semua endpoint operasional membutuhkan token.

Role aktif:

| Role | Menu Frontend |
|------|---------------|
| Admin Showroom (`Admin`) | Dashboard Showroom, Stock Unit Showroom, Master Harga, Stock STNK, Stock BPKB |
| PIC Stock opname | Opname Unit, Opname STNK, Opname BPKB |
| ADH | Verifikator 1 Opname Unit, Opname STNK, Opname BPKB |
| Kepala Cabang | Dashboard Bengkel, Dashboard Showroom, Stock Unit Showroom, Master Harga, hasil Opname Showroom, Manajemen User, Backup & Restore |
| Kepala Bengkel | Semua menu |
| Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Data Konsumen, Follow-up KPB |
| Partman | Dashboard Bengkel, Hotline, Stock, Opname |
| Admin CRM (`CRM`) | Data Konsumen, Follow-up KPB, Follow-up STNK, Follow-up BPKB |

Role value database tetap `Admin` dan `CRM`. UI menampilkan label `Admin Showroom` dan `Admin CRM`.

Authorization diterapkan di backend dan frontend:

- Frontend memakai `RoleGuard` untuk mencegah akses langsung via URL.
- Sidebar hanya menampilkan menu sesuai role.
- Backend memakai `authenticate` dan `authorize(...)`.
- API mengembalikan HTTP `403` jika role tidak berhak.

Authorization backend:

| Modul / Endpoint | Role |
|------------------|------|
| Dashboard Bengkel | Kepala Cabang, Frondesk, Service Advisor, Kepala Bengkel, Partman |
| Customers | CRM, Service Advisor, Kepala Bengkel |
| Follow-up KPB | CRM, Frondesk, Service Advisor, Kepala Bengkel |
| Follow-up STNK/BPKB | CRM |
| Opname | Partman, Kepala Bengkel |
| Hotline | Service Advisor, Partman, Kepala Bengkel |
| Stock | Service Advisor, Partman, Kepala Bengkel |
| Workshop list/summary | Frondesk, Service Advisor, Kepala Bengkel |
| Program AHM KPB/LCR | Service Advisor, Kepala Bengkel |
| Mechanics / performance | Kepala Bengkel |
| Users | Kepala Bengkel, Kepala Cabang |
| Backup, restore, sync logs, audit logs | Kepala Bengkel, Kepala Cabang |
| Showroom Stock Unit dan Master Harga | Admin, Kepala Cabang |
| Showroom Stock STNK/BPKB mentah | Admin |
| Opname Showroom operasi | PIC Stock opname |
| Opname Showroom hasil/report | PIC Stock opname, ADH, Kepala Cabang |

User database aktif saat pengecekan terakhir:

| Username | Role |
|----------|------|
| Imam | Kepala Bengkel |
| aulia | Frondesk |
| danu | Partman |

Seed bawaan masih tersedia untuk membuat user `roni`, `dina`, `pakhendra`, dan `busari` jika diperlukan.

---

## 5. Routing Frontend Aktual

| Route | Page | Role |
|-------|------|------|
| `/login` | Login | Public |
| `/` | Dashboard Bengkel | Kepala Cabang, Frondesk, Service Advisor, Kepala Bengkel, Partman |
| `/workshop` | Workshop List | Frondesk, Service Advisor, Kepala Bengkel |
| `/monitor-kpb-lcr` | Monitoring Program AHM | Service Advisor, Kepala Bengkel |
| `/stock` | Stok Sparepart | Service Advisor, Partman, Kepala Bengkel |
| `/hotline` | Part Hotline | Service Advisor, Partman, Kepala Bengkel |
| `/opname` | Stock Opname | Partman, Kepala Bengkel |
| `/customers` | Data Konsumen | CRM, Service Advisor, Kepala Bengkel |
| `/follow-up-kpb` | Follow-up KPB | CRM, Frondesk, Service Advisor, Kepala Bengkel |
| `/mechanics` | Performa Mekanik | Kepala Bengkel |
| `/users` | Manajemen User | Kepala Bengkel, Kepala Cabang |
| `/backups` | Backup & Restore | Kepala Bengkel, Kepala Cabang |
| `/showroom/dashboard` | Dashboard Showroom | Admin Showroom, Kepala Cabang |
| `/showroom/stock-unit` | Stock Unit Showroom | Admin Showroom, Kepala Cabang |
| `/showroom/harga-otr` | Master Harga OTR | Admin Showroom, Kepala Cabang |
| `/showroom/bbn` | Master BBN | Admin Showroom, Kepala Cabang |
| `/showroom/program` | Master Program MD/AHM/Dealer | Admin Showroom, Kepala Cabang |
| `/showroom/tac-leasing` | Master TAC Leasing dan Dana Promosi | Admin Showroom, Kepala Cabang |
| `/showroom/ksu` | Master KSU | Admin Showroom, Kepala Cabang |
| `/showroom/sales-order-margin` | Simulasi DP & Margin | Admin Showroom, Kepala Cabang |
| `/showroom/opname-unit` | Opname Unit | PIC Stock opname, ADH, Kepala Cabang |
| `/showroom/opname-stnk` | Opname STNK | PIC Stock opname, ADH, Kepala Cabang |
| `/showroom/opname-bpkb` | Opname BPKB | PIC Stock opname, ADH, Kepala Cabang |
| `/showroom/stnk` | Stock STNK Showroom | Admin Showroom |
| `/showroom/bpkb` | Stock BPKB Showroom | Admin Showroom |
| `/follow-up-stnk` | Follow-up STNK | Admin CRM |
| `/follow-up-bpkb` | Follow-up BPKB | Admin CRM |

Admin CRM jika membuka `/` diarahkan ke `/follow-up-kpb`. Admin Showroom jika membuka `/` diarahkan ke `/showroom/dashboard`.
Follow-up BPKB hanya menampilkan BPKB pembelian cash. Data BPKB dengan `Finance Company` terisi dianggap milik leasing dan tidak ditampilkan pada pipeline follow-up konsumen.

Halaman login memakai branding `DXK Operation System`, headline `Satu sistem untuk semua alur kerja TDM Ketapang.`, dan subtitle tentang bengkel, sparepart, showroom, dokumen kendaraan, dan follow-up pelanggan.

## 6. Modul Fitur

### 6.1 Dashboard Bengkel

Menampilkan ringkasan operasional:

- Total WO hari ini.
- Revenue hari ini.
- Jumlah hotline aktif.
- Critical stock.
- Open WO.
- Attention stock.
- Alert panel.
- Data freshness import terakhir per modul.

Endpoint:

```text
GET /api/dashboard/summary
```

Dashboard freshness menampilkan modul, waktu import terakhir, filename, rows success/error, dan total row aktif.

### 6.2 Workshop

Fitur:

- List Work Order.
- Filter state, type, search, dan periode.
- Summary workshop.
- Program summary KPB/LCR.
- Performa mekanik khusus Kepala Bengkel.

Endpoint:

```text
GET /api/workshop
GET /api/workshop/summary
GET /api/workshop/program-summary
GET /api/workshop/mechanics
GET /api/workshop/mechanics/performance
```

### 6.3 Program AHM KPB/LCR

Fitur:

- Monitoring program KPB dan LCR.
- Summary total, done, open, cancel, dan revenue.
- Filter program, state, search, dan tanggal.

Route:

```text
/monitor-kpb-lcr
```

### 6.4 Hotline Part

Fitur:

- List hotline part.
- Filter state, jenis PO, search.
- Detail hotline.
- Update state hotline.

Endpoint:

```text
GET /api/hotline
GET /api/hotline/:id
PATCH /api/hotline/:id/state
```

### 6.5 Stok Sparepart

Fitur:

- List stok sparepart.
- Filter kategori, ranking, search.
- Detail part.
- Print label barcode batch.
- Deteksi critical aging stock.

Endpoint:

```text
GET /api/stock
GET /api/stock/categories
GET /api/stock/:code
```

### 6.6 Stock Opname

Fitur:

- Buat sesi opname.
- Kode sesi auto-generate format `SO/DXK/DDMMYY-HHMM`.
- Scan barcode auto-submit saat Enter.
- Scan ulang menambah qty.
- Inline edit qty fisik.
- Delete item.
- Complete session.
- Report modal untuk sesi selesai.
- Beep audio feedback.

Endpoint:

```text
GET /api/opname
POST /api/opname
GET /api/opname/:id/items
GET /api/opname/:id/report
POST /api/opname/:id/items
PATCH /api/opname/:id/items/:itemId
DELETE /api/opname/:id/items/:itemId
PATCH /api/opname/:id/complete
DELETE /api/opname/:id
```

### 6.7 Data Konsumen dan KPB

Data konsumen berasal dari import sales/customer. Sistem menghitung status KPB berdasarkan tanggal SO dan mencocokkan riwayat Work Order.

Logika due date:

| KPB | Due Date |
|-----|----------|
| KPB1 | SO date + 2 bulan |
| KPB2 | SO date + 4 bulan |
| KPB3 | SO date + 6 bulan |
| KPB4 | SO date + 8 bulan |

Matching Work Order:

- `engine_number` / nomor mesin.
- `category_name` KPB1 sampai KPB4.
- Work Order state `done`.

Status:

| Status | Arti |
|--------|------|
| `done` | Ada WO done untuk KPB terkait |
| `pending` | Due date sudah lewat dan belum ada WO |
| `not_due` | Belum waktunya |

Filter tabel dan export konsisten untuk:

- `search`
- `kpb_status`
- `model`
- `kpb_year`
- `kpb_month`

Follow-up KPB:

- Catat follow-up per konsumen dan level KPB.
- Status follow-up: `belum_dihubungi`, `sudah_dihubungi`, `booking`, `datang`, `batal`.
- Riwayat follow-up menampilkan user pencatat dan waktu follow-up.
- Halaman `/follow-up-kpb` menampilkan pipeline follow-up KPB overdue dan mendekati tenggat.
- Tombol WhatsApp membuka template pesan dan otomatis mencatat status `sudah_dihubungi`.
- Aksi cepat tersedia untuk `booking`, `datang`, dan `batal`.
- Frondesk boleh mengakses Follow-up KPB tanpa membuka halaman Data Konsumen penuh.
- Export Excel Follow-up KPB mengikuti filter hari, status, dan level KPB.

Endpoint:

```text
GET /api/customers
GET /api/customers/summary
GET /api/customers/alerts
GET /api/customers/models
GET /api/customers/export
GET /api/customers/followups/export
GET /api/customers/:id/followups
POST /api/customers/:id/followups
```

### 6.8 Manajemen User

Hanya untuk Kepala Bengkel dan Kepala Cabang.

Fitur:

- List user.
- Tambah user.
- Edit nama dan role.
- Hapus user.
- Reset password.

Role valid:

- Admin (`Admin Showroom` di UI)
- Kepala Cabang
- CRM (`Admin CRM` di UI)
- Frondesk
- Service Advisor
- Kepala Bengkel
- Partman

Endpoint:

```text
GET /api/users
GET /api/users/:id
POST /api/users
PATCH /api/users/:id
DELETE /api/users/:id
PATCH /api/users/:id/reset-password
```

### 6.9 Backup & Restore

Hanya untuk Kepala Bengkel dan Kepala Cabang.

Fitur:

- List backup SQLite dari `api/prisma/backups`.
- Total ukuran backup.
- Buat backup manual.
- Cleanup backup `pre_import_*` lama dengan default menyimpan 30 terbaru.
- Restore backup dengan konfirmasi eksplisit.
- Backup `pre_restore` otomatis sebelum database aktif ditimpa.
- Riwayat operasional import, backup manual, dan restore terbaru.

Route:

```text
/backups
```

### 6.10 Stock Unit Showroom

Tahap awal showroom memakai file `Report Stock Unit`.

Fitur:

- Import Excel dengan preview.
- Snapshot aktif berdasarkan `engine_number`: data file baru di-upsert, unit lama yang tidak ada di file dihapus dari stock aktif.
- List stock unit DXK.
- Filter series, state, lokasi, dan search engine/chassis.
- Filter aging `>= 30`, `>= 60`, dan `>= 90` hari.
- Filter `Tag Aging` A-L berdasarkan bulan `incoming_date` (A=Jan, B=Feb, ... L=Des).
- Summary total unit, aging >= 60 hari, aging >= 90 hari, dan series terbanyak.
- Lookup Harga OTR dari Master Harga, termasuk alias `MV0` memakai `MV1`.
- Export Excel sesuai filter aktif.
- Kolom Aging di list menampilkan `Aging`, `Tag Aging`, dan `Aging FIFO` dalam format compact agar tabel tetap nyaman dipakai.
- Aturan `Aging FIFO`: unit lokasi POS/Pameran memakai `movement_aging_days`; unit Gudang/Showroom memakai selisih hari dari `incoming_date`.
- Label state di UI dirapikan dari format `Stock RFS/NRFS` menjadi `RFS/NRFS` untuk keterbacaan.

Route:

```text
/showroom/stock-unit
```

Endpoint:

```text
GET /api/showroom/stock-units
GET /api/showroom/stock-units/export
GET /api/showroom/stock-units/summary
GET /api/showroom/stock-units/filters
POST /api/showroom/stock-units/preview
POST /api/showroom/stock-units/import
```

Role: `Admin` (Admin Showroom), `Kepala Cabang`.

Query tambahan pada list/export:

- `aging_tag`: `A` sampai `L`, filter berdasarkan bulan `incoming_date`.

### 6.11 Dashboard Showroom

Dashboard Showroom merangkum kondisi operasional showroom.

Fitur:

- Total stock unit.
- Aging unit `>= 60` dan `>= 90` hari.
- Breakdown stock per lokasi dan series.
- Total STNK dan BPKB serta breakdown lokasi dokumen.
- Freshness data showroom.

Route:

```text
/showroom/dashboard
```

Endpoint:

```text
GET /api/showroom/dashboard
```

Role: `Admin` (Admin Showroom), `Kepala Cabang`.

### 6.12 Master Harga OTR

Master Harga OTR memakai file SK Harga OTR AHM format `.docx`.

Fitur:

- Import `.docx` dengan preview.
- Ambil dua tabel harga dari dokumen SK AHM.
- Upsert berdasarkan `product_code` dari kolom `Kode`.
- Stock Unit lookup Harga OTR dari `product_type` ke `product_code`.
- Import SK Harga Off & Beli `.docx` untuk mengisi `dealer_purchase_price` dan `off_road_price` dari file 092B dan 092C.
- BBN Jual dihitung dari `Harga OTR - Harga Off`.
- Alias khusus `MV0` memakai harga `MV1`.

Route:

```text
/showroom/harga-otr
```

Endpoint:

```text
GET /api/showroom/otr-prices
GET /api/showroom/otr-prices/summary
POST /api/showroom/otr-prices/preview
POST /api/showroom/otr-prices/import
POST /api/showroom/otr-prices/off-purchase/preview
POST /api/showroom/otr-prices/off-purchase/import
```

Role: `Admin` (Admin Showroom), `Kepala Cabang`.

### 6.13 Stock STNK dan BPKB Showroom

Tahap lanjutan showroom memakai file `Report Stock STNK` dan `Report Stock BPKB`.

Fitur:

- Import Excel dengan preview.
- Snapshot aktif berdasarkan `engine_number`: data file baru di-upsert, dokumen lama yang tidak ada di file dihapus dari stock aktif.
- List stock STNK dan BPKB DXK.
- Filter lokasi dan search engine/nama/dokumen.
- Summary total dokumen, lokasi terbanyak, dan overdue dasar BPKB.
- Export Excel Stock STNK dan Stock BPKB sesuai filter aktif.
- Admin CRM tidak boleh melihat tabel stock dokumen mentah; Admin CRM memakai Follow-up STNK/BPKB.
- Kepala Cabang tidak membuka tabel stock dokumen mentah; monitoring STNK/BPKB cukup lewat Dashboard Showroom.

Route:

```text
/showroom/stnk
/showroom/bpkb
```

Endpoint:

```text
GET /api/showroom/stnks
GET /api/showroom/stnks/export
GET /api/showroom/stnks/summary
GET /api/showroom/stnks/filters
POST /api/showroom/stnks/preview
POST /api/showroom/stnks/import
GET /api/showroom/bpkbs
GET /api/showroom/bpkbs/export
GET /api/showroom/bpkbs/summary
GET /api/showroom/bpkbs/filters
POST /api/showroom/bpkbs/preview
POST /api/showroom/bpkbs/import
```

Role: `Admin` (Admin Showroom) saja.

### 6.14 Follow-up STNK dan BPKB

Follow-up dokumen dipakai oleh Admin CRM untuk menghubungi konsumen tanpa membuka tabel stock dokumen mentah.
Riwayat follow-up disimpan di `showroom_document_followups`, terpisah dari data import STNK/BPKB sehingga aman saat import ulang.

Fitur:

- Route `/follow-up-stnk` dan `/follow-up-bpkb`.
- List pipeline dokumen dari `showroom_stnks` dan `showroom_bpkbs`.
- Status follow-up: `belum_dihubungi`, `sudah_dihubungi`, `diambil`, `pending`, `batal`.
- Tombol WhatsApp memakai template operasional cabang dan otomatis mencatat `sudah_dihubungi`.
- Export Excel follow-up sesuai filter aktif.
- Follow-up BPKB hanya menampilkan pembelian cash: `finance_company` kosong/null.
- Jika `finance_company` terisi, BPKB dianggap milik leasing dan tidak masuk pipeline konsumen.

Endpoint:

```text
GET /api/showroom/document-followups/:type
GET /api/showroom/document-followups/:type/export
POST /api/showroom/document-followups/:type/:engineNumber
```

Role: `CRM` (Admin CRM) saja.

### 6.15 Backup & Restore Endpoint

Backup & Restore tersedia untuk Kepala Bengkel dan Kepala Cabang. Backup manual final setelah closing fitur adalah `dev.db.backup.manual.202605021919`.

Endpoint:

```text
GET /api/sync/backups
POST /api/sync/backups
POST /api/sync/backups/cleanup
POST /api/sync/backups/:filename/restore
GET /api/sync/audit-logs
```

Cleanup backup tidak menghapus backup `manual` atau `pre_restore`.

---

## 7. Import Excel

Import Excel dilakukan dari global UploadModal di header. Tab upload difilter sesuai role.

Import memakai strategi berbeda per modul. Hotline dan stock memakai Replace All: data lama modul terkait dihapus lalu diganti data terbaru dari file Excel. Workshop memakai snapshot `Workshop Tahun Berjalan`: file harus ditarik dari 1 Januari sampai hari ini, lalu data WO aktif di sistem diganti dengan snapshot tersebut. Sales/Customer memakai upsert by `so_number` agar `customer.id` dan riwayat follow-up KPB tetap aman saat import ulang.

Authorization import:

| Modul | Endpoint | Role |
|-------|----------|------|
| Hotline | `POST /api/sync/hotline` | Service Advisor, Partman, Kepala Bengkel |
| Stock | `POST /api/sync/stock` | Partman, Kepala Bengkel |
| Workshop Tahun Berjalan | `POST /api/sync/workshop` | Frondesk, Service Advisor, Kepala Bengkel |
| Sales/Customer | `POST /api/sync/sales` | Service Advisor, Kepala Bengkel |
| Stock Unit Showroom | `POST /api/showroom/stock-units/import` | Admin Showroom, Kepala Cabang |
| Stock STNK Showroom | `POST /api/showroom/stnks/import` | Admin Showroom |
| Stock BPKB Showroom | `POST /api/showroom/bpkbs/import` | Admin Showroom |
| Harga OTR | `POST /api/showroom/otr-prices/import` | Admin Showroom, Kepala Cabang |
| Harga Off & Beli | `POST /api/showroom/otr-prices/off-purchase/import` | Admin Showroom, Kepala Cabang |
| Sync logs | `GET /api/sync/logs` | Kepala Bengkel, Kepala Cabang |

Catatan khusus:

- Upload stock menghapus `opname_sessions` dan `opname_items` karena `qty_system` opname menjadi invalid setelah stok berubah.
- Upload harus memakai `FormData` / `multipart/form-data`.
- Jangan set header `Content-Type: application/json` untuk upload file.
- Frontend harus menjalankan preview sebelum upload final.
- Backend membuat backup SQLite otomatis sebelum Replace All.
- Preview Workshop menampilkan rentang tanggal, breakdown status WO, dan warning jika file terlihat bukan tarikan year-to-date.
- Preview Stock Unit/STNK/BPKB menampilkan total data aktif, estimasi data setelah import, dan estimasi data lama yang akan dihapus.
- Import Sales/Customer tidak menghapus `customers`; data existing di-update berdasarkan `so_number`, data baru dibuat.

Transaction timeout:

| Modul | Timeout |
|-------|---------|
| Workshop | 120 detik |
| Hotline | 60 detik |
| Stock | 60 detik |
| Sales/Customer | 180 detik |

---

## 8. State Management

Frontend memakai Zustand.

Auth store:

```javascript
{
  user,
  isAuthenticated,
  login(),
  logout(),
  setUser()
}
```

App store:

```javascript
{
  lastSync,
  alerts,
  sidebarOpen,
  setLastSync(),
  setAlerts(),
  toggleSidebar()
}
```

---

## 9. Catatan Teknis

- SQLite tidak mendukung Prisma `mode: 'insensitive'`, sehingga search query dibuat kompatibel SQLite.
- Login username case-insensitive.
- Redis optional.
- Mock API sudah dihapus.
- Backend dan frontend sudah punya role guard.
- Prisma schema/config sudah SQLite dan tervalidasi.
- Frontend lint dan build sudah bersih.
- Database backup manual masih bisa dilakukan dengan copy `api/prisma/dev.db`.
- Backup otomatis sebelum import tersimpan di `api/prisma/backups`.
- Restore backup hanya untuk Kepala Bengkel dan Kepala Cabang, serta membuat backup `pre_restore` sebelum file database ditimpa.
- UI backup/restore tersedia di route `/backups`.
- Audit operasional import, backup manual, dan restore memakai tabel `audit_logs`.
- Cleanup backup hanya berlaku untuk backup `pre_import_*` lama.
- Label barcode target 32mm x 64mm, layout A4 3 kolom x 4 baris.

---

## 10. Cara Menjalankan

Backend:

```bash
cd api
npm install
npx prisma generate
node src/app.js
```

Frontend:

```bash
cd web
npm install
npm run dev
```

URL:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
Health:   http://localhost:3001/health
```

Validasi penting:

```bash
cd api
npx prisma validate

cd ../web
npm run lint
npm run build
```

---

## 11. Status Verifikasi Terakhir

Verifikasi yang sudah berhasil:

- `npx prisma validate` berhasil.
- Runtime backend connect sebagai SQLite.
- `npm run lint` frontend berhasil tanpa error/warning.
- `npm run build` frontend berhasil.
- Backend import check berhasil.
- Frontend `http://localhost:5173` merespons HTTP `200`.
- Backend `/health` merespons HTTP `200`.
- API authorization forbidden test mengembalikan HTTP `403` untuk role tidak berhak.
- Kepala Bengkel mendapat HTTP `200` pada endpoint admin/operasional yang dicek.
- Frondesk aktual (`aulia`) dapat dashboard/workshop dan ditolak customers/opname/sync stock.
- Partman aktual (`danu`) dapat dashboard/stock/hotline/opname dan ditolak workshop/customers.
- Endpoint backup/audit/cleanup/restore diverifikasi: `Imam` Kepala Bengkel mendapat akses, `aulia` Frondesk dan `danu` Partman mendapat HTTP `403`.
- Frontend route/menu `/backups` diverifikasi hanya memakai role `Kepala Bengkel`.
- Dashboard freshness dan endpoint follow-up KPB diverifikasi berjalan setelah schema update.
- Simulasi DP & Margin showroom diverifikasi dengan 2 contoh DSO Odoo. Contoh `MRBC` Scoopy `KAB. KETAPANG` menghasilkan sisa margin `540.993,42`, sama dengan Odoo setelah Master BBN/TAC diselaraskan. Contoh `LV1B` Vario 160 `KAB. KAYONG UTARA` sudah mendekati Odoo setelah TAC, Program MD, area BBN, dan gross-up komisi diselaraskan; selisih kecil tersisa dapat berasal dari harga beli/cost unit, pembulatan, atau BBN internal.

---

## 11.1 Simulasi DP & Margin Showroom

Tujuan fitur ini adalah mencegah koreksi transaksi setelah admin/kasir sudah memproses uang konsumen. Sales atau Kepala Cabang dapat mensimulasikan DP net sebelum deal final dan melihat sisa margin sebagai acuan kebijakan manajemen bulan berjalan.

Input utama:

- Kode unit / product type.
- Area BBN, dipilih dari Master BBN.
- Leasing, dipilih dari Master TAC Leasing.
- Tenor, dipilih dari TAC aktif yang nominalnya terisi.
- Tipe jualan `KREDIT` atau `CASH`.
- DP gross konsumen.
- DP net konsumen mau setor.
- Barang bonus, hutang komisi, dan subsidi dealer manual bila ada.

Master otomatis yang dipakai:

- Master Harga untuk OTR, Off Road, dan Harga Beli Dealer.
- Master BBN untuk notice, PNBP/STCK, jasa, biaya tambahan BBN, dan total internal BBN.
- Master TAC Leasing berbasis series, leasing, kategori DP, tenor, dan periode aktif.
- Master Program MD/AHM/Dealer berdasarkan kode unit, tipe jualan, dan periode aktif.

Rumus operasional:

```text
Sisa Margin = GP Unit + GP BBN
GP Unit = Total Harga Jual - Harga Beli Dealer - Total Beban Dealer
GP BBN = Total BBN - Total Internal BBN - PPN BBN Margin
PPN BBN Margin = (Total BBN - Total Internal BBN) * 11 / 111
Tambahan Diskon = DP Gross - TAC/PS Finco - Program MD/AHM/Dealer - DP Net Konsumen
```

Catatan teknis:

- `Total BBN` mengikuti pola Odoo dari `OTR - Off Road`.
- `Total Internal BBN` memakai field `total` Master BBN. Field `fee_pusat` saat ini digunakan sebagai `Biaya Tambahan BBN` untuk koreksi internal BBN jika Odoo lebih tinggi dari notice/PNBP/jasa standar.
- Hutang komisi memakai pendekatan gross-up 2,5%: `Hutang Komisi = input / 0,975`. Contoh `200.000 -> 205.128,21`.
- TAC hanya dianggap valid jika nominal `amount > 0`, sehingga matrix kosong yang pernah tersimpan tidak ikut dipakai.
- Mode `CASH` tidak memakai leasing, tenor, TAC, atau finco. Kalkulasi cash: `Sisa Piutang = OTR - (Setoran + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`; program MD/AHM/Dealer tetap dicari berdasarkan `sale_type = CASH`. Untuk kredit: `Sisa Piutang = OTR - (DP Net + TAC + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`.
- Mode IMFI tidak memakai Matrix TAC. IMFI memakai `showroom_leasing_promo_schemes` berdasarkan range OTR, dengan dana titipan cabang `100.000` dipotong dari gross Dana Promosi sehingga kalkulator memakai nominal net.
- Batas minimal margin tidak dikunci di sistem karena kebijakan margin dapat berubah setiap bulan; dashboard menampilkan sisa margin sebagai acuan keputusan.

Master data per 5 Mei 2026:

- Master BBN diimport dari `MASTER BBN.xlsx`: 1.079 area/kode produk aktif, 170 duplicate `Product + City` dilewati, nilai `0` dari file dianggap kosong agar tidak menimpa nilai existing/manual.
- Referensi area Indonesia berisi 514 kab/kota dan dipakai untuk dropdown area Master BBN agar area tidak diketik bebas.
- TAC ADIRA/FIF/OTO sudah diimport ke Matrix TAC aktif periode 2026-01-06 sampai 2026-12-31. ADIRA berisi tenor 24/30/36; FIF dan OTO berisi tenor 18/24/30/36.
- IMFI Dana Promosi Scheme sudah diisi untuk range OTR 15-25 juta net 200.000, 25-40 juta net 400.000, dan di atas 40 juta net 700.000 setelah titipan cabang 100.000.
- Program Sales Discount LMC 104 Mei 2026 sudah diimport ke Master Program MD/AHM/Dealer dengan periode 2026-05-01 sampai 2026-05-31; baris `Cash & Credit` dipecah otomatis menjadi `CASH` dan `KREDIT`.

Contoh validasi:

```text
MRBC / SCOOPY / KAB. KETAPANG / FIF / 36 bulan
Odoo:   540.993,42
Sistem: 540.993,42
```

```text
LV1B / VARIO 160 / KAB. KAYONG UTARA / FIF / 36 bulan
DP Gross: 3.100.000
PS Finco: 700.000
PS MD: 166.500
PS Dealer: 721.500
Master BBN terakhir: notice 2.575.000, PNBP 310.000, jasa 925.000, total 3.810.000
Status: mendekati Odoo; selisih kecil masih perlu divalidasi dengan cost/harga beli dan BBN internal.
```

---

## 12. Change Log Sistem Aktual

### 2026-05-02

- Excel date timezone bug diperbaiki dengan UTC epoch.
- Workshop import memakai Replace All dan timeout 120 detik.
- Customer/Sales import memakai upsert by `so_number`, dedup, dan timeout 180 detik agar follow-up KPB tidak terhapus.
- Stock import aggregation berdasarkan `product_code`.
- Stock import menghapus opname session/item lama.
- Stock Opname UX diperbaiki: auto-submit, scan append, inline edit, report modal.
- Mechanic performance dibuat kompatibel SQLite.
- Sales import dipindah ke global UploadModal.
- Role invalid lama dihapus dari frontend aktif.
- `mockApi.js` dihapus.
- Backend authorization diterapkan untuk semua modul operasional.
- Import destructive dibatasi berdasarkan role.
- Frontend route guard diterapkan untuk semua route modul.
- Sidebar dan UploadModal diselaraskan dengan role backend.
- Filter Customers table/export dibuat konsisten untuk `kpb_year` dan `kpb_month`.
- Backup otomatis, endpoint restore, dan UI `/backups` ditambahkan untuk Kepala Bengkel dan Kepala Cabang.
- Audit operasional import/backup/restore ditambahkan ke backend dan ditampilkan di UI `/backups`.
- Retention backup ditambahkan untuk cleanup `pre_import_*` lama.
- Role verification final untuk backup/audit diselesaikan.
- Dashboard data freshness dan follow-up konsumen KPB ditambahkan.
- Halaman Follow-up KPB dan tombol WhatsApp template ditambahkan.
- Export Excel Follow-up KPB ditambahkan.
- Role baru `Admin` dan `Kepala Cabang` mulai didukung untuk modul showroom tahap awal.
- Stock Unit Showroom memakai import snapshot aktif berbasis `engine_number`.
- Stock STNK dan BPKB Showroom memakai import snapshot aktif berbasis `engine_number`.
- Master Harga OTR ditambahkan dengan import SK AHM `.docx`; Stock Unit menampilkan harga OTR dari master, termasuk alias `MV0` ke `MV1`.
- Master Harga diperluas dengan Harga Beli, Harga Off, dan BBN Jual dari file SK Harga Off & Beli 092B/092C.
- Dashboard Showroom ditambahkan untuk ringkasan total unit, aging, lokasi, series, dan dokumen.
- Export Excel Stock Unit, Stock STNK, dan Stock BPKB ditambahkan sesuai filter aktif.
- Role final dibuat jelas: Admin Showroom (`Admin`) untuk showroom dan Admin CRM (`CRM`) untuk follow-up konsumen/dokumen.
- Admin CRM tidak lagi mendapat Dashboard Bengkel dan diarahkan ke `/follow-up-kpb` dari `/`.
- Follow-up STNK dan Follow-up BPKB ditambahkan dengan tabel `showroom_document_followups`, template WhatsApp, status follow-up, dan export Excel.
- Follow-up BPKB dibatasi hanya pembelian cash; BPKB dengan `Finance Company` terisi dianggap milik leasing.
- Backup manual final setelah closing dibuat: `dev.db.backup.manual.202605021919`.
- Catatan operasional ringkas ditambahkan di `CATATAN_OPERASIONAL.md`.
- README, backend README, AGENTS, dan PRD disinkronkan dengan implementasi aktual.
- Prisma schema/config diselaraskan ke SQLite.
- Frontend lint dan build dibersihkan.

### 2026-05-05

- Kalkulator margin showroom dipivot menjadi **Simulasi DP & Margin** untuk kontrol DP net sebelum deal final ke konsumen.
- Master TAC Leasing berbasis series ditambahkan, termasuk alias series, matrix leasing/kategori DP/tenor/periode, dropdown series, dan reset field matrix setelah simpan.
- Kalkulator menarik TAC otomatis berdasarkan leasing, series alias, kategori DP, tenor, dan periode aktif; baris TAC nominal `0` diabaikan.
- Master Program MD/AHM/Dealer otomatis dipakai dalam simulasi; subsidi MD dan subsidi dealer program ditampilkan dalam rincian DP/program.
- Area BBN, leasing, tenor, dan tipe jualan di kalkulator dibuat dropdown agar mengurangi salah input.
- Field audit/override Odoo teknis di kalkulator disederhanakan; fokus UI dikembalikan ke DP gross, DP net, beban tambahan, program, dan sisa margin.
- Rumus GP BBN diselaraskan dengan Odoo menggunakan `Total BBN - Total Internal BBN - PPN BBN Margin`.
- Master BBN diberi koreksi `Biaya Tambahan BBN` menggunakan field `fee_pusat` agar total internal BBN dapat disamakan dengan Odoo per kode unit/area.
- Hutang komisi diubah memakai gross-up 2,5% (`input / 0,975`) dan ditampilkan sebagai satu baris `Hutang Komisi`.
- Dua contoh DSO Odoo diuji: MRBC Scoopy cocok sampai angka Odoo, LV1B Vario 160 sudah mendekati dan menjadi bahan validasi lanjutan.
- Master BBN dibuat CRUD tambah/edit per baris; form koreksi BBN lama dihapus dari UI karena edit langsung di Master BBN sudah menggantikan.
- Import Master BBN dari `MASTER BBN.xlsx` selesai dengan 1.079 row aktif; duplicate `Product + City` disaring, nilai `0` dari file tidak menimpa nilai existing/manual, dan area wajib dipilih dari referensi 514 kab/kota Indonesia.
- TAC ADIRA, FIF, dan OTO diimport ke `showroom_leasing_tac_programs` sebagai Matrix TAC berbasis `series_key`, kategori DP (`LT_15`/`GT_15`), tenor, dan periode aktif 2026.
- Alias series TAC dirapikan untuk Vario 160, PCX 160, Stylo 160, Genio, CB150R, dan mapping kode produk seperti `LV1B`, `LVEB`, `MV0`, `MW0`, dan `MT0`.
- IMFI dipisahkan dari Matrix TAC ke Dana Promosi Scheme berbasis range OTR; tenor IMFI dikunci tidak dipakai dan nominal net otomatis mengurangi dana titipan cabang 100.000.
- Program Sales Discount Reguler LMC 104 periode Mei 2026 diimport ke Master Program MD/AHM/Dealer; `Cash & Credit` otomatis dipecah menjadi program `CASH` dan `KREDIT`.
- Mode `CASH` di Simulasi DP & Margin dikunci tanpa leasing, tenor, TAC, atau finco. Validasi API MRBC cash OTR 25.400.000 dengan diskon dealer 1.000.000 menghasilkan `Sisa Piutang` 24.400.000.
- Input nominal di halaman showroom terkait dibuat hanya angka dengan format ribuan Indonesia, misalnya `2000000` menjadi `2.000.000`.
- Label barcode BPKB dibuat untuk `engine_number` dengan header `BPKB - TDM Ketapang`; layout print A4 3x4 label sudah disesuaikan dengan kertas sticker dan Epson L3250.
- Verifikasi akhir: backend `npm test` 10 test pass, frontend `npm run lint` pass, frontend `npm run build` pass, backend direstart dan `/health` OK.

---

## 13. Roadmap

- Export Excel Master Harga bila nanti dibutuhkan.
- Halaman detail unit gabungan Stock Unit + harga + STNK + BPKB bila nanti dibutuhkan.
- Dark mode toggle.
- PWA installable untuk penggunaan mobile.
- Role-based CRUD lebih granular di level action/field.
- Notifikasi real-time/WebSocket.
- Import progress bar untuk file besar.
- Multi-cabang selain DXK.
- Tracking lanjutan hubungan KPB dan riwayat workshop.
- Validasi lanjutan kalkulator margin dengan 5-10 DSO Odoo tambahan lintas unit, area BBN, cash/kredit, TAC, PS MD, dan komisi.
- Tambah edit/delete/deactivate untuk Matrix TAC, Dana Promosi Scheme, dan Alias Series bila operasional butuh koreksi rutin dari UI.
- Export Excel Master BBN/TAC bila nanti diperlukan untuk audit atau sharing internal.
