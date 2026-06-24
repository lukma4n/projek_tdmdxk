# AGENTS.md - DXK Operation System (Workshop, Sparepart, Showroom)

Proyek fungsional dan siap dipakai harian untuk cabang DXK. Pair file ini dengan `README.md`, `PRD.md`, `BLUEPRINT.md`, `ERD.md`, `FSD.md`, `TRD.md`, dan `docs/rencana_perbaikan.md` sesuai kebutuhan.

## 1. Bahasa Komunikasi
- Wajib **Bahasa Indonesia** dan/atau **English ASCII** saja.
- Dilarang karakter non-Latin (Cyrillic, Han/Hanzi, Kana/Kanji, dll). Jika muncul, tulis ulang.

## 2. Quick Start
```bash
# Backend
cd api
npm install
npx prisma generate
npm run dev          # nodemon, port 3001
```
```bash
# Frontend
cd web
npm install
npm run dev          # vite, port 5173, proxy /api ke :3001
```
- URL: `http://localhost:5173`
- Health check: `curl http://localhost:3001/health` -> `{"status":"ok"}`
- Login default ada di `README.md`. Login pakai username case-insensitive.

## 3. Peta Dokumentasi

| File | Isi |
|------|-----|
| `README.md` | Quick start, login, troubleshooting |
| `PRD.md` | Kebutuhan produk, scope, role, roadmap |
| `BLUEPRINT.md` | Arsitektur, alur data, workflow, prinsip desain |
| `ERD.md` | Database, entitas, relasi, Mermaid ERD |
| `FSD.md` | Spesifikasi fitur per modul, acceptance criteria |
| `TRD.md` | Spesifikasi teknis, API, security, import, backup |
| `docs/rencana_perbaikan.md` | Hasil review, risiko, backlog P1/P2 |
| `docs/TEMPLATE_PROMPT_REQUEST.md` | Template request fitur ke AI agent |

## 4. Arsitektur Singkat
- **Stack**: Frontend Vite + React 19 + Tailwind v4 + shadcn/ui + React Router + Zustand. Backend Node + Express 5 + Prisma + SQLite. Auth JWT (24h). Barcode jsbarcode CODE128.
- **Folder**:
  - `api/src/` -> `app.js` (entry), `controllers/`, `routes/`, `middleware/`, `services/`, `utils/`, `config/`
  - `api/prisma/` -> `schema.prisma`, `migrations/`, `dev.db` (SQLite, ~12MB)
  - `web/src/` -> `pages/`, `components/`, `services/api/` (10 module files), `stores/`, `config/`, `data/`, `hooks/`
- **Entry**: backend `api/src/app.js` line 145 (start), frontend `web/src/main.jsx` (Vite). Production: backend serve `web/dist` lewat Express static.
- **DB**: SQLite file `api/prisma/dev.db`. Backup di `api/prisma/backups/`.

## 5. Role & Hak Akses

**Nilai role di DB pakai spasi, bukan underscore** (sumber tunggal `web/src/config/roles.js`).

| DB value | Label UI | Akses singkat |
|----------|----------|---------------|
| `IT Master` | IT Master | **Superadmin**. Bypass semua auth guard. Kelola role_permissions, **Manajemen User, Backup & Restore, Audit Login & Sesi (semua khusus IT Master)** |
| `Admin` | Admin Showroom | Dashboard Showroom, Stock Unit/Harga/STNK/BPKB, Kesegaran Data Import |
| `CRM` | Admin CRM | Data Konsumen, Follow-up KPB/STNK/BPKB |
| `PIC Stock opname` | PIC Stock opname | Opname Unit/STNK/BPKB |
| `ADH` | ADH | Verifikator 1 opname |
| `Kepala Cabang` | Kepala Cabang | Dashboard Bengkel+Showroom, Master Harga, target marketing, Kesegaran Data Import |
| `Kepala Bengkel` | Kepala Bengkel | Semua menu bengkel (termasuk performa mekanik), Kesegaran Data Import |
| `Frondesk` | Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| `Service Advisor` | Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Konsumen, Follow-up KPB |
| `Partman` | Partman | Dashboard Bengkel, Stock, Hotline, Opname |
| `Salesman` | Salesman | Document Handling, Cek Ketersediaan Unit |

Role guard di backend (`authorize(...roles)`) dan frontend (`web/src/config/roles.js`). API return `403` untuk role tak berhak. **IT Master** mendapat bypass total di `api/src/middleware/auth.js` (cek `req.user.role === 'IT Master'` sebelum authorize list). **Manajemen User & Backup dipersempit ke IT Master saja** (keputusan tim K1).

Akses menu per role dikontrol secara dinamis dari tabel `role_permissions` (database). IT Master adalah satu-satunya role yang TIDAK perlu entri di `role_permissions` karena bypass penuh.

## 6. Auth & Cookie
- Login set cookie **`token`** httpOnly di `api/src/controllers/authController.js:58-63` dengan `secure: isSecureCookie(req)`, `sameSite: 'lax'`, `maxAge` 24h.
- **Body response tidak berisi `token`** (hanya `user`).
- Middleware `api/src/middleware/auth.js:8` baca `req.cookies?.token` lalu fallback `Authorization: Bearer ...`.
- Frontend pakai `credentials: 'include'` di `api.js`/services.
- Nama cookie didefinisikan konstan `JWT_COOKIE_NAME = 'token'` di controller **dan** middleware. Rename harus update keduanya.
- Username login case-insensitive (SQLite workaround).

## 7. Perintah Penting

```bash
# Setup awal
cd api && npm install && npx prisma generate && npm run db:migrate && npm run db:seed
cd web && npm install

# Dev harian
cd api && npm run dev          # nodemon :3001
cd web && npm run dev          # vite :5173

# Verifikasi urut
cd api && npx prisma validate
cd api && npm test             # node --test, 61 pass
cd web && npm run lint
cd web && npm run build
curl http://localhost:3001/health

# Database — CATATAN: `prisma migrate` rusak di setup ini (schema-engine
# "invalid characters"). Pakai db push untuk terapkan perubahan schema (dev & prod):
cd api && npx prisma db push && npx prisma generate
cd api && npx prisma db seed
cd api && npx prisma studio
sqlite3 api/prisma/dev.db ".tables"     # ad-hoc query

# Backup & restore (IT Master only). UI di /backups. API: /api/sync/backups/*
# Backup terjadwal: cron 02:00 WIB -> api/scripts/backup-db.js (keep 14)
```

## 8. Konvensi & Gotcha

- **SQLite + Prisma**: tidak ada `mode: 'insensitive'`. Pakai raw SQL `WHERE LOWER(x) = LOWER(?)` atau normalisasi `UPPER(TRIM(x))` di memory (helper `normalizeKey` di `api/src/utils/salesPerformance.js`).
- **Login username case-insensitive** di auth controller.
- **Migration RUSAK di setup ini** (schema-engine "invalid characters"). Riwayat sudah di-squash ke 1 baseline `20260621000000_baseline_current_schema`; perubahan setelahnya (`...add_pickup_requests`, `...add_pickup_ktp_photo`, `20260624000000_add_single_session_and_login_logs`) diterapkan via **`prisma db push`**, bukan `migrate dev/deploy`. Folder migrasi disimpan untuk histori saja.
- **JWT_COOKIE_NAME = 'token'** di auth controller + middleware. Jangan rename tanpa update keduanya.
- **apiLimiter** (`api/src/app.js`, max 2000/15min) **sudah dipasang** `app.use('/api/', apiLimiter)`. Login `authLimiter` 20/15min, publik 60/15min, import 30/15min.
- **Single-session** (`api/src/services/sessionService.js`): 1 akun = 1 sesi. Login ke-2 ditolak 409 selama sesi aktif (≤60 mnt). Token bawa `sid`; `authenticate` tolak bila `sid` ≠ `users.session_id`. OFF saat test; override `ENFORCE_SINGLE_SESSION`.
- **Font self-host** (`@fontsource/*` di `web/src/main.jsx`), bukan Google Fonts CDN — wajib agar ekspor screenshot `html-to-image` (Closing Daily) konsisten.
- **TAC Leasing**: ADIRA/FIF/OTO pakai Matrix TAC di `showroom_leasing_tac_programs`. IMFI pakai **Dana Promosi Scheme** (`showroom_leasing_promo_schemes`, range OTR + DP, tenor dikunci). Lihat `docs/rencana_perbaikan.md` untuk aturan field kosong matrix.
- **Master BBN**: area wajib pilih dari `web/src/data/indonesiaAreaCodes.js` (514 kab/kota Indonesia). Field `fee_pusat` = Biaya Tambahan BBN (samakan internal BBN Odoo).
- **Simulasi DP & Margin** (`/showroom/sales-order-margin`): mode CASH tidak pakai leasing/tenor/TAC/finco, program MD tetap lookup. Kredit: `Sisa Piutang = OTR - (DP Net + TAC + Beban Dealer (tanpa Subsidi Dealer Program) + Program MD)`. Komisi gross-up 2,5% (`input / 0,975`).
- **Import timeout transaction**: Hotline/Stock 60s, Workshop 120s, Sales 180s.
- **Import strategy**: Replace All untuk hotline/stock/workshop; Upsert untuk sales (`so_number`), showroom snapshot (unit/STNK/BPKB), master harga, master BBN (`product_code + city_name`), TAC matrix, program MD.
- **Stock upload cascade**: import stock otomatis hapus `opname_sessions` + `opname_items` terkait.
- **Backup**: destructive import otomatis pre-import backup di `api/prisma/backups/`. Manual + restore **hanya IT Master**. Cleanup hanya hapus `pre_import_*` lama; `manual` & `pre_restore` tidak dihapus otomatis. Backup terjadwal harian via cron (`scripts/backup-db.js`).
- **Mock API sudah dihapus** - frontend selalu connect backend real.
- **TZ bug**: hindari `toISOString()` UTC untuk tanggal lokal. Pakai `getFullYear/getMonth/getDate` lokal (lihat helper `getDateRangePreset`, `getTodayStr`, `getYesterdayStr` di `ShowroomSalesUtils.js`).
- **Format angka**: UI pakai `Intl.NumberFormat('id-ID')`. Excel export pakai `formatForExcel` di `api/src/utils/excelUtils.js`.
- **UI bahasa Indonesia** konsisten di semua halaman, label, dan template WhatsApp (KPB, STNK, BPKB, service).

## 9. Test

- **Backend**: `cd api && npm test` -> **61 pass** (node --test). Termasuk `publicCheck.integration.test.js` (incl. cek-unit publik) & `singleSession.integration.test.js`.
  - Test DB di `api/tests/helpers.js` pakai `file:./test.db` (di-sync `prisma db push` via `pretest`). Single-session enforcement OFF saat test (kecuali `ENFORCE_SINGLE_SESSION=true`).
- **Frontend**: `cd web && npm run lint && npm run build`. Tidak ada E2E.

## 10. Kode Opname & Barcode

- **Kode opname auto-generate**: `SO/DXK/DDMMYY-HHMM` (contoh `SO/DXK/010526-1130`).
- **Workflow showroom opname**: `draft` -> `open` -> `submitted` (PIC) -> `approved_adh` (ADH approve 1) -> `sent_to_kacab` (ADH kirim ke Kacab) -> `approved_kacab` (Kepala Cabang approve) / `rejected` -> `done` (setelah BASO upload + verifikasi). Status bisa kembali ke `open` saat revisi.
- **Workflow opname sparepart** (stock/stnk/bpkb): sama dengan showroom, mengikuti role guard per tipe.
- **Import stock/STNK/BPKB showroom diblokir** selama ada sesi opname tipe terkait yang belum `closed`.
- **Label barcode**: ukuran 32mm x 64mm (Label No. 103), layout A4 3 kolom x 4 baris = 12 label/halaman, printer Epson L3250 + kertas sticker A4 precut. Encode `engine_number` untuk BPKB, header `BPKB - TDM Ketapang`.

## 11. Data Aktual (Juni 2026)

| Modul | Total row aktif |
|-------|-----------------|
| Work Orders (snapshot tahun berjalan) | 60.982+ |
| Customers (Sales) | 10.069+ |
| Showroom Stock Unit | 151 unit |
| Showroom STNK / BPKB | 715 / 400 dokumen |
| Stock Parts / Hotlines | 566 / 50 |
| Master Harga / BBN / Salespeople | 198 / 1.079 / 58 |

## 12. P1 Backlog (quick win, lihat `docs/rencana_perbaikan.md`)

- ~~**#18**: Route statis sebelum route `:id` (Express 5 strict routing).~~ ✅ done.
- **#19**: Daftarkan `pdfjs-dist` ke `api/package.json` dependencies (saat ini dipakai tanpa declared dep).
- ~~**#20**: Pasang `apiLimiter`.~~ ✅ done (`app.use('/api/', apiLimiter)`).
- **#21**: Ganti `fs.unlinkSync` di backup/import controllers ke `unlink` async (non-blocking).
- **#22**: Tambah `Math.min(parseInt(limit) || 50, 100)` di endpoint pagination yang menerima `?limit=` (Hotline, Stock, Customers, Showroom list).
- **#23**: Hapus 9 folder kosong `web/src/services/*.js/` (artefak refactor lama `api.js` -> 10 module files).
- **#24**: Fix `web/src/stores/themeStore.js` - `localStorage` dipanggil di module scope (eksekusi saat import). Pindah ke custom hook (`useTheme()`) atau fungsi lazy initializer Zustand.

## 13. Catatan Tambahan
- UI final: **V2 Clean Corporate** (default terang), toggle tema terang/gelap per browser (`localStorage.theme`, store di `web/src/stores/themeStore.js`).
- Login page pakai branding `DXK Operation System` + headline `Satu sistem untuk semua alur kerja TDM Ketapang.`
- Fix history panjang dipindah ke `docs/rencana_perbaikan.md` agar `AGENTS.md` tetap ringkas.

## 14. Perubahan Terbaru (2026-06-17)

### Role IT Master (Superadmin)
- Role baru `IT_Master` ditambahkan sebagai superadmin sistem.
- Backend `api/src/middleware/auth.js`: bypass `authorize()` untuk `req.user.role === 'IT_Master'` sehingga IT Master bisa akses semua endpoint tanpa terdaftar di role list manapun.
- User default IT Master: username `it_master` / password `password` dibuat via script.
- IT Master **tidak boleh dihapus** dari Manajemen User (validasi di backend `userController.js`).

### Manajemen Akses Berbasis Database
- Tabel `role_permissions` menyimpan pasangan `role_name` + `menu_key` yang diizinkan.
- Frontend sidebar membaca permissions dari API (`GET /api/permissions`) dan hanya menampilkan menu yang diizinkan per role.
- Halaman `/roles` (Manajemen Akses) memungkinkan IT Master mengatur centang akses menu per role via UI tabel.
- IT Master bypass total — tidak memerlukan entri di `role_permissions`.

### Field `phone` di Tabel `users`
- Kolom `phone String?` ditambahkan ke model `users` via `prisma db push`.
- Backend `userController.js` mendukung `phone` pada `createUser`, `updateUser`, `getUsers`, `getUserById`.
- Frontend `Users.jsx` menampilkan kolom No. HP di tabel dan field input di form tambah/edit user.
- Fungsi: persiapan integrasi notifikasi WhatsApp/Telegram di masa mendatang.

### Sidebar Terstruktur Per Grup
Menu sidebar kini dibagi menjadi **5 grup utama** yang terpisah dan jelas:
1. **Workshop** → sub-folder: Operasional, Laporan & Target
2. **CRM & Layanan** → flat: Data Konsumen, Follow-up KPB/STNK/BPKB, Program AHM
3. **Showroom** → sub-folder: Penjualan, Marketing, Unit, STNK & BPKB
4. **Stock Opname** → flat: Opname Sparepart, Unit, STNK, BPKB, PIC Users
5. **Monitoring** → flat: Kesegaran Data Import (`/data-freshness`)
6. **Administrasi** → flat: Manajemen User, Manajemen Akses, Backup & Restore, **Audit Login & Sesi** (IT Master)
7. **Layanan Publik** → Self-Check Publik (`/cek`), Cek Ketersediaan Unit (`/cek-unit`), Permintaan Ambil Dokumen

Sidebar memakai mode **Accordion (tutup otomatis)** — hanya sub-folder yang memiliki halaman aktif yang terbuka.

### Hapus User Cascade (Hard Delete)
- `DELETE /api/users/:id` sekarang melakukan cascade delete/null seluruh relasi user di semua tabel terkait sebelum menghapus record `users`.
- IT Master tidak dapat dihapus (validasi backend).
- Tabel yang di-null: `sync_logs.user_id`, `hotlines.state_updated_by`, `showroom_unit_ksu_checks.checked_by/handed_over_by`, `showroom_opname_items.scanned_by`, `showroom_notifications.user_id`, `showroom_opname_sessions.reviewed_by`, `showroom_ksu_standards.updated_by`.
- Tabel yang di-delete: `opname_items`, `opname_sessions`, `showroom_user_locations`, `audit_logs`, `kpb_followups`, `showroom_document_followups`, `showroom_opname_sessions`, `showroom_sales_order_margins`, `showroom_opname_assignments`.

## 15. Perubahan Terbaru (2026-06-24)

- **FASE 2 (pickup-request) merged ke `main`**; branch `feat/fase2-pickup-request` dihapus. Produksi deploy dari `main`.
- **Cek Ketersediaan Unit (publik `/cek-unit`)** — `GET /api/public/stock-units?q=&location=`. Untuk sales & kontrol movement PIC POS: per model/warna, status RFS/Reserved/NRFS, **no.mesin/rangka + OTR ditampilkan (sengaja)**, umur **FIFO** (POS/Pameran = `movement_aging_days`) + Tag aging A-L + kode unit (`product_type`). **cost/HPP tidak pernah dibocorkan**. Rate-limit publik.
- **Kesegaran Data Import** dipisah ke halaman `/data-freshness` + menu (menuKey `DATA_FRESHNESS`; Kacab/Kabeng/Admin). `GET /api/dashboard/freshness` (8 modul).
- **Keamanan**: single-session anti-sharing (login ke-2 ditolak 409), **idle auto-logout 60 menit** (frontend `components/IdleLogout.jsx`), **audit login** (`login_logs`). Halaman `/security-audit` (IT Master): sesi aktif + riwayat login + reset sesi. Endpoint `/api/security/{login-logs,active-sessions,users/:id/reset-session}`. Kolom baru `users.session_id`, `users.session_last_active`.
- **Font self-host** (`@fontsource/inter`, `@fontsource/jetbrains-mono`) ganti Google Fonts CDN → ekspor screenshot Closing Daily konsisten.
- **Backup terjadwal**: cron `02:00 WIB` → `api/scripts/backup-db.js` (keep 14). Backup pre-import lama bisa dibersihkan manual.
- **Backlog keamanan** S1-S4 di `docs/rencana_perbaikan.md` (sesi/refresh token, backup off-site, perluas audit data, higiene). Prioritas tinggi (VIN publik, kebijakan password/lockout, 2FA) ditunda atas keputusan pemilik.
