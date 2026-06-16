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

| DB value | Label UI | Akses singkat |
|----------|----------|---------------|
| `Admin` | Admin Showroom | Dashboard Showroom, Stock Unit/Harga/STNK/BPKB |
| `CRM` | Admin CRM | Data Konsumen, Follow-up KPB/STNK/BPKB |
| `PIC_StockOpname` | PIC Stock opname | Opname Unit/STNK/BPKB |
| `ADH` | ADH | Verifikator 1 opname |
| `Kepala_Cabang` | Kepala Cabang | Dashboard Bengkel+Showroom, Master Harga, manajemen user, backup/restore, target marketing |
| `Kepala_Bengkel` | Kepala Bengkel | Semua (termasuk performa mekanik, user, backup/restore) |
| `Frondesk` | Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| `Service_Advisor` | Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Konsumen, Follow-up KPB |
| `Partman` | Partman | Dashboard Bengkel, Stock, Hotline, Opname |

Role guard di backend (`authorize(...roles)`) dan frontend (`web/src/config/roles.js`). API return `403` untuk role tak berhak. Konfigurasi & label UI lengkap di `web/src/config/roles.js` (`ROLES`, `ROLE_LABELS`, `displayRole`, `ALL_ROLES`, `IMPORT_ROLES`, group arrays, `getDefaultRoute`).

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
cd api && npm test             # 7 file, 26/26 pass
cd web && npm run lint
cd web && npm run build
curl http://localhost:3001/health

# Database
cd api && npx prisma migrate dev --name <desc>
cd api && npx prisma migrate deploy
cd api && npx prisma db seed
cd api && npx prisma studio
sqlite3 api/prisma/dev.db ".tables"     # ad-hoc query

# Backup & restore (Kepala Bengkel/Cabang only)
# UI di /backups. Manual + restore di audit log. API: /api/backups/*
```

## 8. Konvensi & Gotcha

- **SQLite + Prisma**: tidak ada `mode: 'insensitive'`. Pakai raw SQL `WHERE LOWER(x) = LOWER(?)` atau normalisasi `UPPER(TRIM(x))` di memory (helper `normalizeKey` di `api/src/utils/salesPerformance.js`).
- **Login username case-insensitive** di auth controller.
- **Migration**: urut timestamp. Migration yang reference FK harus dijamin tabel referentinya dibuat di migration sebelumnya. Daftar saat ini: `20260501095828_init`, `20260607010000_add_showroom_dealer_burdens_and_salespeople`, `20260607120000_add_showroom_stnk_bpkb_tracks`, `20260608000000_add_track_v2_fields`, `20260612021618_add_showroom_marketing_targets`, `20260616140000_add_showroom_team_leaders`.
- **JWT_COOKIE_NAME = 'token'** di auth controller + middleware. Jangan rename tanpa update keduanya.
- **apiLimiter** (`api/src/app.js:52-58`, max 500/15min) **didefinisikan tapi BELUM dipasang** `app.use()` -> P1 #20.
- **TAC Leasing**: ADIRA/FIF/OTO pakai Matrix TAC di `showroom_leasing_tac_programs`. IMFI pakai **Dana Promosi Scheme** (`showroom_leasing_promo_schemes`, range OTR + DP, tenor dikunci). Lihat `docs/rencana_perbaikan.md` untuk aturan field kosong matrix.
- **Master BBN**: area wajib pilih dari `web/src/data/indonesiaAreaCodes.js` (514 kab/kota Indonesia). Field `fee_pusat` = Biaya Tambahan BBN (samakan internal BBN Odoo).
- **Simulasi DP & Margin** (`/showroom/sales-order-margin`): mode CASH tidak pakai leasing/tenor/TAC/finco, program MD tetap lookup. Kredit: `Sisa Piutang = OTR - (DP Net + TAC + Beban Dealer (tanpa Subsidi Dealer Program) + Program MD)`. Komisi gross-up 2,5% (`input / 0,975`).
- **Import timeout transaction**: Hotline/Stock 60s, Workshop 120s, Sales 180s.
- **Import strategy**: Replace All untuk hotline/stock/workshop; Upsert untuk sales (`so_number`), showroom snapshot (unit/STNK/BPKB), master harga, master BBN (`product_code + city_name`), TAC matrix, program MD.
- **Stock upload cascade**: import stock otomatis hapus `opname_sessions` + `opname_items` terkait.
- **Backup**: destructive import otomatis pre-import backup di `api/prisma/backups/`. Manual + restore hanya Kepala Bengkel & Kepala Cabang. Cleanup hanya hapus `pre_import_*` lama; `manual` & `pre_restore` tidak dihapus otomatis.
- **Mock API sudah dihapus** - frontend selalu connect backend real.
- **TZ bug**: hindari `toISOString()` UTC untuk tanggal lokal. Pakai `getFullYear/getMonth/getDate` lokal (lihat helper `getDateRangePreset`, `getTodayStr`, `getYesterdayStr` di `ShowroomSalesUtils.js`).
- **Format angka**: UI pakai `Intl.NumberFormat('id-ID')`. Excel export pakai `formatForExcel` di `api/src/utils/excelUtils.js`.
- **UI bahasa Indonesia** konsisten di semua halaman, label, dan template WhatsApp (KPB, STNK, BPKB, service).

## 9. Test

- **Backend**: `cd api && npm test` -> 7 file, 26/26 pass.
  - File: `auth.test.js`, `auth.integration.test.js`, `importParsers.test.js`, `import.integration.test.js`, `rbac.integration.test.js`, `salesOrderMargin.test.js`, `helpers.js`.
  - Test DB di `api/tests/helpers.js` pakai `file:./test.db`. Copy manual dari `dev.db` jika butuh data real: `cp api/prisma/dev.db api/prisma/test.db`.
- **Frontend**: `cd web && npm run lint && npm run build`. Tidak ada E2E.

## 10. Kode Opname & Barcode

- **Kode opname auto-generate**: `SO/DXK/DDMMYY-HHMM` (contoh `SO/DXK/010526-1130`).
- **Workflow showroom opname**: `draft` -> `open` -> `submitted` (PIC) -> `adh_done` (ADH verifikator 1) -> `rfa` (request final approval) -> `approved` (Kepala Cabang) / `rejected` -> `closed`. Status bisa kembali ke `open` saat revisi.
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

- **#18**: Route statis `/opname/search-unit` & `/opname/notifications` harus dideklarasikan **sebelum** route `:id` (Express 5 strict routing).
- **#19**: Daftarkan `pdfjs-dist` ke `api/package.json` dependencies (saat ini dipakai tanpa declared dep).
- **#20**: Pasang `apiLimiter` di `app.use('/api/', apiLimiter)` setelah middleware lain.
- **#21**: Ganti `fs.unlinkSync` di backup/import controllers ke `unlink` async (non-blocking).
- **#22**: Tambah `Math.min(parseInt(limit) || 50, 100)` di endpoint pagination yang menerima `?limit=` (Hotline, Stock, Customers, Showroom list).
- **#23**: Hapus 9 folder kosong `web/src/services/*.js/` (artefak refactor lama `api.js` -> 10 module files).
- **#24**: Fix `web/src/stores/themeStore.js` - `localStorage` dipanggil di module scope (eksekusi saat import). Pindah ke custom hook (`useTheme()`) atau fungsi lazy initializer Zustand.

## 13. Catatan Tambahan
- UI final: **V2 Clean Corporate** (default terang), toggle tema terang/gelap per browser (`localStorage.theme`, store di `web/src/stores/themeStore.js`).
- Login page pakai branding `DXK Operation System` + headline `Satu sistem untuk semua alur kerja TDM Ketapang.`
- Fix history panjang dipindah ke `docs/rencana_perbaikan.md` agar `AGENTS.md` tetap ringkas.
