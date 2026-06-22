# DXK Workshop & Sparepart System

Dashboard operasional bengkel, sparepart, dan showroom cabang DXK untuk monitoring Work Order, KPB/LCR, Hotline Part, Aging Stock, Stock Opname, data konsumen after-sales, dokumen kendaraan, Master Harga/BBN/TAC, dan Simulasi DP & Margin.

## Peta Dokumentasi

| Dokumen | Fungsi |
|---------|--------|
| `README.md` | Quick start, ringkasan stack, login, endpoint utama, troubleshooting |
| `AGENTS.md` | Konteks kerja cepat untuk AI/developer yang melanjutkan proyek |
| `PRD.md` | Kebutuhan produk, scope bisnis, fitur, role, dan roadmap produk |
| `BLUEPRINT.md` | Arsitektur besar, alur data, workflow operasional, dan prinsip desain |
| `ERD.md` | Database, entitas, relasi, constraint, dan Mermaid ERD |
| `FSD.md` | Spesifikasi fitur per modul, role, endpoint, workflow, dan acceptance criteria |
| `TRD.md` | Spesifikasi teknis, runtime, konfigurasi, API, security, import, backup, dan verifikasi |

Untuk detail terbaru yang lebih lengkap, baca `BLUEPRINT.md`, `ERD.md`, `FSD.md`, dan `TRD.md` setelah file ini.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite + React 19 + Tailwind CSS v4 + shadcn/ui + React Router + Zustand + lucide-react |
| Backend | Node.js + Express 5 + Prisma |
| Database | SQLite file-based, file utama `api/prisma/dev.db` |
| Auth | JWT 24 jam + bcryptjs |
| Excel | SheetJS `xlsx` |
| Barcode | jsbarcode CODE128 |
| Cache | Redis optional, aplikasi tetap jalan tanpa Redis |

Tidak perlu Docker untuk menjalankan aplikasi lokal karena database memakai file SQLite.

## Quick Start

### Backend

```bash
cd api
npm install
npx prisma generate
node src/app.js
```

Backend berjalan di:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/health
```

### Frontend

```bash
cd web
npm install
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

## Environment Variables

Backend `api/.env`:

```env
DATABASE_URL=file:./dev.db
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=24h
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

`DATABASE_URL=file:./dev.db` menunjuk ke `api/prisma/dev.db` karena path SQLite Prisma relatif terhadap folder `api/prisma`.
`api/prisma/schema.prisma` memakai `provider = "sqlite"`, dan `api/prisma.config.ts` memuat `.env` via `dotenv/config`.

`REDIS_URL` optional. Jika Redis tidak tersedia, dashboard fallback langsung ke database.

Frontend `.env` optional (lihat `web/.env.example`):

```env
VITE_API_URL=/api

# URL publik untuk link & QR self-check STNK/BPKB (halaman /cek).
# Kosong → fallback ke window.location.origin. Produksi: isi domain publik.
VITE_PUBLIC_URL=

# Nomor WhatsApp dealer untuk tombol "Request via WhatsApp" di /cek.
# Format internasional tanpa + / 0 (mis. 6281234567890). Kosong → tombol disembunyikan.
VITE_DEALER_WA_PHONE=
```

## Login

Database aktif dapat berbeda dari seed. Pada database aktif saat pengecekan terakhir, kredensial yang tersedia:

| Username | Password | Role |
|----------|----------|------|
| Imam | password | Kepala Bengkel |

Seed bawaan `api/prisma/seed.js` membuat user berikut jika dijalankan:

| Username | Password | Role |
|----------|----------|------|
| roni | password | Frondesk |
| dina | password | Service Advisor |
| pakhendra | password | Kepala Bengkel |
| busari | password | Partman |

## Role dan Akses

| Role | Menu |
|------|------|
| IT Master | **Superadmin**: semua menu + Manajemen Akses (kontrol siapa bisa akses menu apa) |
| Admin Showroom | Dashboard Showroom, Stock Unit/Harga/STNK/BPKB |
| PIC Stock opname | Opname Unit, Opname STNK, Opname BPKB |
| ADH | Verifikator 1 Opname |
| Kepala Cabang | Dashboard Bengkel+Showroom, Master Harga, Manajemen User, Backup & Restore |
| Kepala Bengkel | Semua menu bengkel, termasuk Performa Mekanik, Manajemen User, dan Backup & Restore |
| Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Data Konsumen, Follow-up KPB |
| Partman | Dashboard Bengkel, Stock, Hotline, Opname |
| Admin CRM | Data Konsumen, Follow-up KPB, Follow-up STNK, Follow-up BPKB |

Akses menu per role dikontrol secara **dinamis dari database** (`role_permissions`). IT Master bisa mengatur akses melalui halaman `/roles` (Manajemen Akses). IT Master tidak bisa dihapus dari sistem.

## Import Excel

Import Excel dilakukan dari tombol `Import Excel` di header. Modul yang tersedia:

| Modul | Endpoint | Role |
|-------|----------|------|
| Part Hotline | `POST /api/sync/hotline` | Service Advisor, Partman, Kepala Bengkel |
| Stok Sparepart | `POST /api/sync/stock` | Partman, Kepala Bengkel |
| Workshop Tahun Berjalan | `POST /api/sync/workshop` | Frondesk, Service Advisor, Kepala Bengkel |
| Data Konsumen | `POST /api/sync/sales` | Service Advisor, Kepala Bengkel |
| Log Sync | `GET /api/sync/logs` | Kepala Bengkel, Kepala Cabang |

Hotline dan stock memakai strategi Replace All: data lama pada modul terkait dihapus lalu diganti data Excel terbaru. Workshop memakai snapshot tahun berjalan; tarik WO dari 1 Januari sampai hari ini sebelum import. Upload stock juga menghapus sesi dan item opname karena `qty_system` menjadi tidak valid setelah stok berubah.

Data Konsumen/Sales memakai strategi upsert berdasarkan `so_number`, sehingga follow-up KPB yang sudah dicatat tetap aman saat import ulang file sales.

Untuk mengurangi risiko Replace All:

- Frontend menyediakan `Preview` sebelum upload final.
- Backend membuat backup SQLite otomatis sebelum setiap import.
- Kepala Bengkel dan Kepala Cabang dapat membuat backup manual, melihat daftar backup, dan restore via endpoint backup.

Contoh upload via API:

```bash
curl -X POST http://localhost:3001/api/sync/hotline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/Laporan_Part_Hotline.xlsx"
```

Jangan kirim header `Content-Type: application/json` untuk upload file. Gunakan `FormData`.

## API Endpoints

### Auth

- `POST /api/auth/login` - login
- `GET /api/auth/me` - data user dari token

### Dashboard Bengkel

- `GET /api/dashboard/summary` - KPI dashboard dan alerts

### Hotline

- `GET /api/hotline` - list hotline
- `GET /api/hotline/:id` - detail hotline
- `PATCH /api/hotline/:id/state` - update state hotline

### Stock

- `GET /api/stock` - list stock part
- `GET /api/stock/categories` - list kategori
- `GET /api/stock/:code` - detail part

### Workshop

- `GET /api/workshop` - list Work Order
- `GET /api/workshop/summary` - summary workshop
- `GET /api/workshop/program-summary` - summary KPB/LCR
- `GET /api/workshop/mechanics` - list mekanik
- `GET /api/workshop/mechanics/performance` - performa mekanik

### Customers

- `GET /api/customers` - list konsumen
- `GET /api/customers/summary` - summary KPB konsumen
- `GET /api/customers/alerts` - alert KPB jatuh tempo
- `GET /api/customers/models` - list model motor
- `GET /api/customers/export` - export Excel konsumen
- `GET /api/customers/:id/followups` - riwayat follow-up KPB konsumen
- `POST /api/customers/:id/followups` - catat follow-up KPB konsumen
- `GET /api/customers/followups/export` - export Excel Follow-up KPB

Filter `GET /api/customers` dan export sudah konsisten untuk `search`, `kpb_status`, `model`, `kpb_year`, dan `kpb_month`.

### Opname

- `GET /api/opname` - list sesi opname
- `POST /api/opname` - buat sesi opname
- `GET /api/opname/:id/items` - item sesi opname
- `POST /api/opname/:id/items` - tambah item scan
- `PATCH /api/opname/:id/items/:itemId` - update qty fisik
- `DELETE /api/opname/:id/items/:itemId` - hapus item
- `PATCH /api/opname/:id/complete` - complete sesi
- `DELETE /api/opname/:id` - hapus sesi
- `GET /api/opname/:id/report` - report sesi

### Backup dan Restore

- `GET /api/sync/backups` - list backup SQLite, hanya Kepala Bengkel dan Kepala Cabang
- `POST /api/sync/backups` - buat backup manual, hanya Kepala Bengkel dan Kepala Cabang
- `POST /api/sync/backups/cleanup` - hapus backup `pre_import_*` lama, hanya Kepala Bengkel dan Kepala Cabang
- `POST /api/sync/backups/:filename/restore` - restore backup, hanya Kepala Bengkel dan Kepala Cabang
- `GET /api/sync/audit-logs` - riwayat operasional import/backup/restore, hanya Kepala Bengkel dan Kepala Cabang

### Users

- `GET /api/users` - list user (termasuk phone)
- `GET /api/users/:id` - detail user
- `POST /api/users` - tambah user (body: username, password, name, phone?, role, locations)
- `PATCH /api/users/:id` - update user (body: name?, phone?, role?, locations?)
- `DELETE /api/users/:id` - hapus user (cascade delete relasi, IT Master tidak bisa dihapus)
- `PATCH /api/users/:id/reset-password` - reset password

Semua endpoint users hanya untuk IT Master, Kepala Bengkel, dan Kepala Cabang.

### Showroom Margin dan Master Data

- Route frontend aktual Master BBN adalah `/showroom/bbn`.
- Route frontend Master Program adalah `/showroom/program`.
- Route frontend Master KSU adalah `/showroom/ksu`.
- `GET /api/showroom/bbn-prices` - list Master BBN
- `POST /api/showroom/bbn-prices` - tambah Master BBN
- `PATCH /api/showroom/bbn-prices/:id` - edit Master BBN
- `POST /api/showroom/bbn-prices/import` - import Master BBN
- `GET /api/showroom/ksu-standards` - list Master KSU
- `PATCH /api/showroom/ksu-standards/:productType` - edit standar KSU per tipe unit
- `GET /api/showroom/stock-units/:engineNumber/ksu` - detail KSU unit
- `PATCH /api/showroom/stock-units/:engineNumber/ksu` - update KSU unit
- `GET /api/showroom/tac/programs` - list Matrix TAC Leasing
- `POST /api/showroom/tac/programs` - simpan Matrix TAC Leasing
- `GET /api/showroom/tac/promo-schemes` - list Dana Promosi Scheme
- `POST /api/showroom/tac/promo-schemes` - simpan Dana Promosi Scheme
- `GET /api/showroom/tac/series-aliases` - list alias series TAC
- `POST /api/showroom/tac/series-aliases` - simpan alias series TAC
- `POST /api/showroom/sales-order-margins/preview` - preview Simulasi DP & Margin
- `POST /api/showroom/sales-order-margins` - simpan simulasi sales order margin

## Fitur Utama

- Multi-role auth dengan backend authorization dan frontend route guard.
- Dashboard KPI workshop, hotline, stock, revenue, dan alerts.
- Dashboard data freshness untuk import terakhir dan row aktif per modul.
- Hotline part tracking dan update state.
- Stok sparepart dengan filter kategori, ranking, aging, dan label barcode.
- Workshop WO list, summary, Program AHM KPB/LCR, dan performa mekanik.
- Stock opname dengan barcode scanner, scan append, inline edit, complete report.
- Data konsumen dari sales import dengan tracking KPB1 sampai KPB4.
- Follow-up konsumen KPB dengan status kontak dan catatan.
- Halaman Follow-up KPB untuk pipeline harian SA/Kepala Bengkel, termasuk tombol WhatsApp template.
- Export Excel Follow-up KPB mengikuti filter hari, status, dan level KPB.
- Stock Unit, STNK, dan BPKB Showroom memakai import snapshot aktif berbasis nomor mesin: data file baru di-upsert, data lama yang tidak ada di file dihapus dari stock aktif. Master Harga tetap upsert by kode produk.
- Stock Unit Showroom mendukung filter aging `>= 30`, `>= 60`, `>= 90` hari, filter `Tag Aging` (A-L berdasarkan bulan `incoming_date`), serta export Excel sesuai filter aktif.
- Kolom Aging Stock Unit menampilkan badge `Aging`, `Tag Aging`, dan `FIFO` secara compact agar tabel tetap lega di desktop operasional.
- Aturan `Aging FIFO`: lokasi POS/Pameran memakai `movement_aging_days`; lokasi Gudang/Showroom memakai selisih hari dari `incoming_date`.
- Label state unit di UI dirapikan dari `Stock RFS/NRFS` menjadi `RFS/NRFS` tanpa mengubah value asli data.
- Stock STNK dan Stock BPKB Showroom mendukung export Excel sesuai filter aktif.
- CRM memakai halaman Follow-up STNK dan Follow-up BPKB, bukan tabel stock dokumen mentah.
- Follow-up BPKB CRM hanya menampilkan pembelian cash; BPKB dengan `Finance Company` terisi dianggap milik leasing dan tidak masuk pipeline konsumen.
- Master Harga menerima SK Harga OTR serta SK Harga Off & Beli mentah dari AHM tanpa convert/edit manual.
- Dashboard Showroom merangkum total unit, aging, lokasi, series, dan dokumen.
- Simulasi DP & Margin showroom membantu Kepala Cabang mengontrol DP net sebelum deal final. Kalkulator otomatis menarik Master Harga, Master BBN, Master TAC Leasing berbasis series, dan Master Program MD/AHM/Dealer. Input utama: kode unit, area BBN, leasing, tenor, tipe jualan, DP gross, DP net konsumen, barang bonus, hutang komisi, dan subsidi dealer manual.
- Master TAC Leasing berbasis series tersedia untuk TAC/PS Finco per leasing, kategori DP, tenor, dan periode aktif. Area BBN di kalkulator berupa dropdown dari Master BBN; leasing/tenor/tipe jualan juga berupa pilihan.
- Master BBN mendukung tambah/edit per baris, import Excel, dan dropdown area dari referensi 514 kab/kota Indonesia agar area tidak diketik bebas.
- TAC ADIRA, FIF, dan OTO sudah diimport ke Matrix TAC periode 2026; ADIRA berisi tenor 24/30/36, FIF dan OTO berisi tenor 18/24/30/36.
- IMFI memakai Dana Promosi Scheme berbasis range OTR, bukan Matrix TAC. Dana titipan cabang 100.000 otomatis dipotong sehingga kalkulator memakai nominal net.
- Mode Cash di Simulasi DP & Margin tidak memakai leasing, tenor, TAC, atau finco. `Sisa Piutang = OTR - (Setoran + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`, dan program MD/AHM/Dealer tetap bisa ditarik berdasarkan tipe jualan `CASH`. Untuk kredit: `Sisa Piutang = OTR - (DP Net + TAC + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`.
- Program Sales Discount Reguler LMC 104 Mei 2026 sudah diimport ke Master Program MD/AHM/Dealer; baris `Cash & Credit` dipecah otomatis menjadi `CASH` dan `KREDIT`.
- Rumus margin showroom mengikuti hasil validasi Odoo: `Sisa Margin = GP Unit + GP BBN`, `GP Unit = Total Harga Jual - Harga Beli Dealer - Total Beban Dealer`, `GP BBN = Total BBN - Total Internal BBN - PPN BBN Margin`, dan `PPN BBN Margin = (Total BBN - Total Internal BBN) * 11 / 111`.
- Hutang komisi memakai pendekatan gross-up 2,5% agar mendekati Odoo: contoh input `200.000` menjadi beban `205.128,21`. Master BBN memiliki koreksi `Biaya Tambahan BBN` untuk menyesuaikan total internal BBN Odoo jika diperlukan.
- Export Excel konsumen dengan filter yang sama seperti tabel.
- Backup dan restore SQLite untuk Kepala Bengkel dan Kepala Cabang.
- Cleanup backup `pre_import_*` lama dengan tetap menjaga backup manual dan `pre_restore`.
- Riwayat operasional import, backup manual, dan restore di halaman Backup & Restore.
- Mock API sudah dihapus, frontend memakai backend real.
- Source code project sudah diinisialisasi git dan dibackup ke private GitHub repository untuk keamanan versi kerja.

## Data dan Catatan Teknis

- SQLite tidak support Prisma `mode: 'insensitive'`, search query dibuat kompatibel SQLite.
- Login username case-insensitive.
- Import workshop timeout 120 detik.
- Import hotline dan stock timeout 60 detik.
- Kode opname auto-generate memakai format `SO/DXK/DDMMYY-HHMM`.
- Label barcode target ukuran 32mm x 64mm, layout A4 3 kolom x 4 baris.
- Label barcode BPKB encode `engine_number`, memakai header `BPKB - TDM Ketapang`, dan layout print A4 3x4 yang sudah disesuaikan dengan kertas sticker Epson L3250.
- Validasi kalkulator margin terakhir memakai 2 contoh Odoo: `MRBC` Scoopy `KAB. KETAPANG` cocok sampai `540.993,42`, dan `LV1B` Vario 160 `KAB. KAYONG UTARA` sudah mendekati setelah TAC, Program MD, BBN, dan komisi diselaraskan. Untuk penggunaan harian, selisih besar biasanya berasal dari Master BBN internal, TAC yang belum terisi, Program MD belum import, harga beli/cost unit, atau input transaksi yang berbeda dari Odoo.
- Validasi cash terakhir: `MRBC` cash OTR `25.400.000` dengan diskon dealer `1.000.000` menghasilkan `Sisa Piutang` `24.400.000`, tanpa TAC/finco/leasing.
- Verifikasi terakhir: backend `npm test` 10 test pass, frontend `npm run lint` pass, frontend `npm run build` pass, backend `/health` OK setelah restart.

## Troubleshooting

### Frontend tidak terbuka

Pastikan dev server berjalan:

```bash
cd web
npm run dev
```

Cek URL:

```text
http://localhost:5173
```

### Backend tidak merespons

Jalankan backend dan cek health check:

```bash
cd api
node src/app.js
```

```text
http://localhost:3001/health
```

### Login bermasalah

Hapus token lama di browser localStorage, lalu login ulang.

### Prisma client bermasalah

Validasi schema dan generate ulang Prisma client:

```bash
cd api
npx prisma validate
npx prisma generate
```

Schema valid jika output berisi:

```text
The schema at prisma/schema.prisma is valid
```

### Perlu backup database

Copy file SQLite secara manual:

```text
api/prisma/dev.db
```

## Verifikasi Setelah Perubahan Role

- `npx prisma validate` berhasil.
- Backend log menampilkan `SQLite connected`.
- `npm run lint` berhasil tanpa error/warning.
- `npm run build` berhasil.
- Login sebagai tiap role dan cek menu yang tampil.
- Akses URL terlarang langsung dari browser harus redirect ke `/`.
- Akses API endpoint terlarang harus menghasilkan HTTP `403`.
- Endpoint backup/audit hanya boleh `200` untuk Kepala Bengkel; Frondesk/Partman harus `403`.
- Import Excel hanya muncul untuk modul yang sesuai role.
- Import Excel harus preview dulu sebelum upload final dari frontend.
- Setiap import destruktif harus mengembalikan nama backup pada response.
- Filter Customers pada tabel dan export harus menghasilkan jumlah data yang sama.
