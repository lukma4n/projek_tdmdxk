# Rencana Perbaikan — Sistem Workshop, Sparepart, dan Showroom DXK

**Tanggal update:** 2026-05-07

Dokumen ini berisi hasil code review menyeluruh (backend + frontend) dan rencana perbaikan terstruktur berdasarkan temuan aktual. Sistem saat ini **fungsional dan siap dipakai harian**, tetapi memiliki beberapa masalah yang perlu diperbaiki untuk keamanan, performa, dan maintainability.

---

## Kondisi Aktual

- Backend dan frontend sama-sama menerapkan role guard.
- Import Excel/DOCX memakai preview sebelum import final.
- Import destructive membuat backup SQLite otomatis.
- Sales/Customer import memakai upsert by `so_number`, sehingga riwayat follow-up KPB aman.
- Backup & Restore tersedia untuk Kepala Bengkel dan Kepala Cabang.
- Mock API sudah dihapus; frontend memakai backend real.
- Dashboard Bengkel tersedia di `/` untuk operasional bengkel/sparepart, tetapi tidak untuk Admin Showroom dan Admin CRM.
- Dashboard Showroom tersedia di `/showroom/dashboard` untuk Admin Showroom dan Kepala Cabang.
- Modul showroom sudah mencakup Stock Unit, Master Harga, STNK, BPKB, Simulasi DP & Margin.
- Admin CRM mengerjakan Data Konsumen, Follow-up KPB, Follow-up STNK, dan Follow-up BPKB.
- Admin CRM tidak melihat Stock STNK/BPKB mentah; pipeline dokumen memakai tabel `showroom_document_followups`.
- Follow-up STNK/BPKB hanya untuk Admin CRM, bukan Admin Showroom atau Kepala Cabang.
- Follow-up BPKB hanya untuk pembelian cash; data dengan `Finance Company` terisi dianggap milik leasing.
- Backup manual final closing fitur: `dev.db.backup.manual.202605021919`.
- UI internal final memakai V2 Clean Corporate sebagai default terang, dengan toggle tema terang/gelap di header.
- Login page sudah dipoles dengan headline `Satu sistem untuk semua alur kerja TDM Ketapang.` dan subtitle operasional TDM Ketapang.

---

## Role Aktif

| Role | Menu Utama |
|------|------------|
| Admin Showroom (`Admin`) | Dashboard Showroom, Stock Unit Showroom, Master Harga, Stock STNK, Stock BPKB |
| PIC Stock opname | Opname Unit, Opname STNK, Opname BPKB |
| ADH | Verifikator 1 Opname Unit, Opname STNK, Opname BPKB |
| Kepala Cabang | Dashboard Bengkel, Dashboard Showroom, Stock Unit Showroom, Master Harga, hasil Opname Showroom, Manajemen User, Backup & Restore |
| Kepala Bengkel | Semua menu bengkel, Manajemen User, Backup & Restore |
| Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Data Konsumen, Follow-up KPB |
| Partman | Dashboard Bengkel, Stock, Hotline, Opname |
| Admin CRM (`CRM`) | Data Konsumen, Follow-up KPB, Follow-up STNK, Follow-up BPKB |

Role value di database tetap `Admin` dan `CRM`. UI menampilkan label `Admin Showroom` dan `Admin CRM`.
Role `PIC Stock opname` dipakai untuk menjalankan workflow Opname Showroom; `ADH` approve tahap 1; Kepala Cabang approve tahap 2 dan monitoring hasil/report.

---

## Hasil Code Review 2026-05-06

### Skor Keseluruhan

| Kategori | Backend | Frontend |
|----------|---------|----------|
| Struktur & Organisasi | 7/10 | 6/10 |
| Keamanan | 5/10 | 4/10 |
| Performa | 5/10 | 5/10 |
| Kualitas Kode | 6/10 | 6/10 |
| Error Handling | 7/10 | 6/10 |
| **Overall** | **6/10** | **5.5/10** |

### Temuan Backend

#### Critical

| No | File | Masalah | Dampak |
|----|------|---------|--------|
| 1 | `authController.js:14` | Login pakai `prisma.users.findMany()` — load SEMUA user ke memory lalu filter di JS | Performance bomb saat user bertambah, DoS vector |
| 2 | `showroomController.js` | **1.634 baris** — God file berisi parsing, CRUD, export, KSU, document followups, pricing | Sulit maintenance, testing, dan debugging |
| 3 | `customerController.js:364` | Filter KPB load semua customers ke memory lalu filter/slice di JS | Lambat untuk 10K+ records |
| 4 | `workshopController.js:177` | Mechanic performance load SEMUA 60K+ WO ke memory lalu group di JS | Memory/time bomb |
| 5 | `syncController.js:240` | `prisma.$disconnect()` lalu `$connect()` tanpa retry logic | Broken state jika restore gagal |

#### Security

| Severity | Lokasi | Masalah |
|----------|--------|---------|
| HIGH | `auth.js:4` | Token di query string (`req.query.token`) — logged di server logs, browser history, referrer headers |
| HIGH | `showroomController.js:320` | `execFileSync('textutil', ...)` — command injection risk jika filePath user-controlled |
| MEDIUM | Semua endpoint | Tidak ada rate limiting — login, import, export tidak dilindungi |
| MEDIUM | `app.js` | Tidak ada helmet.js — missing security headers (X-Content-Type-Options, X-Frame-Options, dll) |
| MEDIUM | `authController.js:27` | JWT payload include `role` — role change di DB tidak reflect sampai token expire (24 jam) |
| MEDIUM | `backupService.js:71` | Restore tanpa integrity check/checksum verification |
| LOW | `authController.js:10` | Login error message baik — tidak reveal username/password yang salah |

#### Code Quality

| Masalah | Detail |
|---------|--------|
| Duplikasi pagination logic | 7+ file: `hotlineController`, `stockController`, `workshopController`, `customerController`, `showroomController`, `showroomBbnController`, `showroomProgramController` |
| Duplikasi Excel export | 7+ file: `exportCustomersExcel`, `exportFollowupKpbExcel`, `exportStockUnitsExcel`, `exportStnksExcel`, `exportBpkbsExcel`, dll |
| Duplikasi utility functions | `excelDateToJSDate` di 3 file, `cleanupUpload` di 2 file, `formatForExcel` di 2 file |
| Typo di schema | `cassis_number` seharusnya `chassis_number` |
| Tidak ada enum | `role`, `state` pakai String bebas — typo-prone |
| Tidak ada graceful shutdown | Missing `process.on('SIGTERM')` dan `process.on('SIGINT')` untuk clean Prisma disconnect |
| Silent error swallowing | `redis.js:13`, `syncController.js:255`, `customerController.js:322` |
| Upload path relatif | `upload.js:6` — `destination: 'uploads/'` resolve ke CWD yang bisa berbeda |
| MIME type terlalu permisif | `application/octet-stream` di allowed types — bisa upload file apapun |

#### Prisma Schema

| Masalah | Detail |
|---------|--------|
| SQLite untuk production | Tidak support concurrent write, tidak ada WAL mode, file locking issues |
| `work_orders` 57 kolom | Massive denormalized table, banyak nullable fields yang bisa jadi tabel terpisah |
| `customers` mencampur data | Identity + sales + vehicle data dalam satu model — violates single responsibility |
| `showroom_sales_order_margins` 37 kolom | Banyak computed fields stored redundantly (`margin_initial`, `total_deduction`, `margin_remaining`, `margin_percent`) |
| Unique key dengan `period_start` | Old periods accumulate forever tanpa cleanup mechanism |

### Temuan Frontend

#### Critical

| No | File | Masalah | Dampak |
|----|------|---------|--------|
| 1 | `authStore.js` + `Login.jsx` | **JWT di localStorage** — XSS vulnerability, script injected bisa steal token | Security breach |
| 2 | `App.jsx:30-281` | 284 baris dengan 15 role arrays inline + 25+ Route definitions, duplikat dengan `Sidebar.jsx` | Maintainability buruk, risiko inconsistency |
| 3 | `api.js` | **354 baris monolith** — semua endpoint di satu file tanpa separation by domain | Sulit maintenance dan testing |

#### High Priority

| Masalah | Lokasi |
|---------|--------|
| `eslint-disable react-hooks/exhaustive-deps` di mana-mana | 9+ file: `Dashboard.jsx`, `Workshop.jsx`, `Stock.jsx`, `Hotline.jsx`, `Customers.jsx`, `ShowroomStockUnit.jsx`, `ShowroomOpname.jsx`, `FollowupKpb.jsx`, `Opname.jsx` — mask stale closure bugs |
| Pagination state ada tapi tidak ada UI | `Workshop.jsx`, `Stock.jsx`, `Hotline.jsx` — hardcoded limit 50 tanpa next/prev controls |
| `alert()` native untuk error feedback | `ShowroomStockUnit.jsx`, `Opname.jsx`, `Users.jsx` — blocking main thread, poor UX |
| `confirm()` native untuk destructive actions | `Opname.jsx`, `ShowroomOpname.jsx`, `Users.jsx`, `Backups.jsx` — blocking dan unstyled |
| `window.location.href` untuk logout/401 | `authStore.js`, `api.js` — full page reload, harusnya `navigate()` dari react-router |

#### Medium Priority

| Masalah | Detail |
|---------|--------|
| Component terlalu besar | `Customers.jsx` 700 baris, `Opname.jsx` 785 baris, `ShowroomOpname.jsx` 552 baris |
| Export logic duplikat | `ShowroomStockUnit.jsx`, `Customers.jsx`, `FollowupKpb.jsx` — pola blob download yang sama |
| `displayRole()` duplikat 3x | `Sidebar.jsx`, `Header.jsx`, `Users.jsx` — logic identik |
| `indonesiaAreaCodes.js` 3.088 baris | ~50KB+ static data di bundle, harusnya lazy-load atau fetch dari backend |
| Tidak ada React.memo/useMemo/useCallback | Hanya `FollowupKpb.jsx` yang pakai `useMemo`, tidak ada `React.memo` atau `useCallback` |
| Tidak ada loading skeleton | Semua pages pakai spinner + hide content — skeleton screens terasa lebih cepat |
| `Login.jsx` call `api.me()` tanpa cleanup | Jika component unmount sebelum resolve, setState on unmounted component |
| `UploadModal.jsx` switch statements | 2 large switch statements mapping module keys — bisa data-driven dengan config object |

#### Performance

| Masalah | Dampak |
|---------|--------|
| Tidak ada code splitting | Semua 22 pages + `indonesiaAreaCodes.js` loaded upfront — bundle besar |
| Tidak ada virtualization tabel | 10K+ customers akan lag saat render |
| Re-render berlebihan | Zustand store dipanggil di Sidebar, Header, setiap RoleGuard — semua re-render saat auth change |
| Barcode label printing | `BarcodeLabel.jsx` generate HTML string dengan `svgRef.current?.outerHTML` — fragile dan XSS-prone |
| Debounce tanpa request cancellation | `SalesOrderMargin.jsx` 250ms debounce trigger API preview setiap keystroke — bisa overlap requests |

---

## Rencana Perbaikan Terstruktur

### P0 — Security & Critical (Segera)

| # | Task | File/Lokasi | Status |
|---|------|-------------|--------|
| 1 | **Fix login query** — ganti `findMany()` + JS filter dengan Prisma raw SQL `LOWER(username) = LOWER(?)` | `api/src/controllers/authController.js` | ✅ Selesai |
| 2 | **JWT pindah ke httpOnly cookie** — backend set cookie, frontend hapus localStorage token | `api/src/controllers/authController.js`, `web/src/stores/authStore.js`, `web/src/pages/Login.jsx`, `web/src/services/api.js` | Pending |
| 3 | **Hapus token dari query string** — hanya terima `Authorization` header; fix BASO file download di Opname & ShowroomOpname pakai fetch + blob URL | `api/src/middleware/auth.js`, `web/src/pages/Opname.jsx`, `web/src/pages/ShowroomOpname.jsx` | ✅ Selesai |
| 4 | **Pecah `showroomController.js`** jadi 5+ file: stock, documents, pricing, programs, followups | `api/src/controllers/showroom*.js` | ✅ Selesai |
| 5 | **Extract role definitions** ke satu file shared `src/config/roles.js` | `web/src/App.jsx`, `web/src/components/Layout/Sidebar.jsx` | Pending |

### P1 — Performance & Architecture (Short-term)

| # | Task | File/Lokasi | Estimasi |
|---|------|-------------|----------|
| 6 | **Split `api.js`** jadi domain modules: `api/auth.js`, `api/workshop.js`, `api/showroom.js`, `api/customers.js`, `api/opname.js` | `web/src/services/api*.js` | ✅ Selesai |
| 7 | **Extract pagination utility** — reusable `paginate(model, where, req)` | `api/src/utils/pagination.js` | Pending |
| 8 | **Extract Excel export utility** — reusable `exportToExcel(data, columns, filename)` | `api/src/utils/excelExport.js` | Pending |
| 9 | **Extract duplicated utilities** — `excelDateToJSDate`, `cleanupUpload`, `formatForExcel` ke `api/src/utils/` | `api/src/utils/*.js` | ✅ Selesai |
| 10 | **Fix mechanic performance query** — gunakan Prisma aggregation/groupBy, bukan load semua ke memory | `api/src/controllers/workshopController.js` | Pending |
| 11 | **Fix customer KPB filter query** — gunakan Prisma where clause, bukan filter di JS | `api/src/controllers/customerController.js` | Pending |
| 12 | **Tambah graceful shutdown** — `SIGTERM`/`SIGINT` handler dengan `prisma.$disconnect()` | `api/src/app.js` | Pending |
| 13 | **Tambah rate limiting** — `express-rate-limit` di login, import, export endpoints | `api/src/app.js`, route files | ✅ Selesai |
| 14 | **Tambah helmet.js** — security headers | `api/src/app.js` | ✅ Selesai |
| 15 | **React.lazy() code splitting** — route-level lazy loading untuk semua pages | `web/src/App.jsx` | 3 jam |
| 16 | **Fix `exhaustive-deps` eslint disables** — wrap load functions dalam `useCallback` atau pakai refs | 9+ page files | 4 jam |
| 17 | **Ganti `alert()`/`confirm()`** dengan toast notification + confirmation modal | `web/src/components/common/`, page files | 4 jam |

### P2 — Code Quality & UX (Medium-term)

| # | Task | File/Lokasi | Estimasi |
|---|------|-------------|----------|
| 18 | **Tambah input validation** — Zod atau Joi untuk request body/query validation | `api/src/middleware/validate.js` | 4 jam |
| 19 | **Tambah pagination UI** — page numbers, prev/next buttons di semua list pages | `web/src/components/common/Pagination.jsx`, page files | 4 jam |
| 20 | **Lazy-load `indonesiaAreaCodes.js`** atau fetch dari backend | `web/src/data/indonesiaAreaCodes.js` | 1 jam |
| 21 | **Extract `displayRole()`** ke shared utility | `web/src/utils/displayRole.js` | 30 menit |
| 22 | **Extract export logic** ke reusable hook `useExport()` | `web/src/hooks/useExport.js` | 2 jam |
| 23 | **Split large components** — `Customers.jsx`, `Opname.jsx`, `ShowroomOpname.jsx` jadi sub-components | `web/src/pages/` | 6 jam |
| 24 | **Tambah loading skeletons** — ganti spinner dengan skeleton screens | `web/src/components/common/Skeleton.jsx` | 3 jam |
| 25 | **Tambah React.memo** ke table row components | Page files dengan tabel besar | 3 jam |
| 26 | **Fix typo `cassis_number`** — migration rename ke `chassis_number` | `api/prisma/schema.prisma`, controllers | 2 jam |
| 27 | **Tambah request ID logging** — tracing requests across logs | `api/src/middleware/requestId.js` | 1 jam |
| 28 | **Tambah error boundary** — route-level error boundary | `web/src/components/common/ErrorBoundary.jsx` | 2 jam |
| 29 | **Upload path absolute** — `path.resolve` untuk destination uploads | `api/src/middleware/upload.js` | 30 menit |
| 30 | **Tighten MIME types** — hapus `application/octet-stream` dari allowed types | `api/src/middleware/upload.js` | 30 menit |

### P3 — Long-term (Optional)

| # | Task | Estimasi |
|---|------|----------|
| 31 | **Pertimbangkan migrasi ke PostgreSQL** — jika concurrent users bertambah | 16+ jam |
| 32 | **API versioning** — `/api/v1/...` untuk future compatibility | 4 jam |
| 33 | **OpenAPI/Swagger documentation** — auto-generated API docs | 4 jam |
| 34 | **Refresh tokens** — shorter JWT expiry + refresh token rotation | 6 jam |
| 35 | **Structured logging** — ganti `console.log` dengan `pino` atau `winston` | 4 jam |
| 36 | **Export Excel Master BBN/TAC** — jika dibutuhkan untuk audit | 4 jam |
| 37 | **Edit/delete/deactivate Matrix TAC, Dana Promosi, Alias Series dari UI** | 8 jam |
| 38 | **Validasi kalkulator margin** dengan 5-10 DSO Odoo tambahan | 4 jam |
| 39 | **PWA installable** — bisa install di HP | 4 jam |
| 40 | **Notifikasi real-time/WebSocket** — reminder follow-up | 8 jam |

---

## Backlog Lanjutan (Non-Technical)

1. **Halaman detail unit gabungan** jika nanti dibutuhkan:
   - Data fisik unit, harga OTR/Off/Beli/BBN, STNK, dan BPKB.

2. **Export Excel Master Harga** ditunda karena belum menjadi prioritas.

3. **Perluas role Admin CRM** hanya jika proses bisnis tambahan sudah jelas.

4. **Tambah notifikasi/realtime reminder follow-up** bila aktivitas harian mulai padat.

5. **Lanjutkan validasi Simulasi DP & Margin** dengan 5-10 DSO Odoo tambahan:
   - Unit Beat, Scoopy, Vario, PCX, cash, kredit, area BBN berbeda, TAC berbeda, PS MD ada/tidak ada, komisi ada/tidak ada.
   - Catat `Sisa Margin Odoo`, `Sisa Margin Sistem`, selisih, dan penyebab selisih.
   - Prioritaskan pengecekan Master BBN internal, Master TAC Leasing, Program MD/AHM/Dealer, harga beli/cost unit, dan pembulatan.

---

## Closing Terakhir

- Verifikasi akses role Admin Showroom dan Admin CRM sudah dilakukan via endpoint real.
- Admin Showroom ditolak dari Dashboard Bengkel.
- Admin CRM ditolak dari Dashboard Bengkel, Stock STNK/BPKB mentah, Stock Unit, dan Master Harga.
- Admin CRM bisa Data Konsumen, Follow-up KPB, Follow-up STNK, dan Follow-up BPKB.
- Final backend validation/test: `npx prisma validate && npm test` lulus, 10 test pass.
- Final frontend validation: `npm run lint && npm run build` lulus.
- Backend sudah direstart dan health check `/health` mengembalikan `200 OK`.
- Catatan operasional ringkas ada di `CATATAN_OPERASIONAL.md`.
- Simulasi DP & Margin showroom sudah tervalidasi dengan dua contoh Odoo:
  - `MRBC` Scoopy `KAB. KETAPANG` cocok dengan Odoo `540.993,42` setelah TAC dan BBN internal diselaraskan.
  - `LV1B` Vario 160 `KAB. KAYONG UTARA` sudah mendekati setelah TAC `700.000`, PS MD `166.500`, PS Dealer `721.500`, area BBN dropdown, dan gross-up komisi 2,5% diterapkan.
- Rumus aktif kalkulator margin:
  - `Sisa Margin = GP Unit + GP BBN`.
  - `GP Unit = Total Harga Jual - Harga Beli Dealer - Total Beban Dealer`.
  - `GP BBN = Total BBN - Total Internal BBN - PPN BBN Margin`.
  - `PPN BBN Margin = (Total BBN - Total Internal BBN) * 11 / 111`.
  - `Tambahan Diskon = DP Gross - TAC/PS Finco - Program MD/AHM/Dealer - DP Net Konsumen`.
  - `Sisa Piutang = OTR - (DP Net + TAC + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`. Untuk cash: `Sisa Piutang = OTR - (Setoran + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`.
  - `Hutang Komisi = input / 0,975`.
- Master TAC Leasing terakhir: matrix kosong tidak ikut disimpan, field matrix reset setelah simpan, dan kalkulator mengabaikan nominal TAC `0`.
- Master BBN terakhir memakai `fee_pusat` sebagai `Biaya Tambahan BBN` untuk koreksi total internal BBN Odoo. `LV1B/KAB. KAYONG UTARA` terakhir diubah sesuai arahan user menjadi notice `2.575.000`, PNBP `310.000`, jasa `925.000`, total `3.810.000`.

---

## Checklist Verifikasi Rutin

- `npx prisma validate && npm test` di folder `api`.
- `npm run lint && npm run build` di folder `web`.
- Login role utama dan cek menu yang tampil.
- Cek akses URL langsung untuk halaman terlarang.
- Import preview dan final untuk file showroom mentah dari sumber asli.
- Pastikan backend direstart setelah perubahan route/controller.

---

## Checklist Setelah Perbaikan

Setiap task P0/P1/P2 yang selesai harus diverifikasi:

- [ ] `npx prisma validate` lulus
- [ ] `npm test` lulus (semua test pass)
- [ ] `npm run lint` lulus tanpa error/warning
- [ ] `npm run build` lulus
- [ ] Backend restart dan `/health` mengembalikan `200 OK`
- [ ] Login dan role access masih berfungsi normal
- [ ] Import preview dan final masih berfungsi normal
- [ ] Tidak ada regression di fitur existing

---

## Log Perbaikan

### 2026-05-06 — P0 Task #1 & #3 (Security & Critical)

**Task #1: Fix login query**
- `api/src/controllers/authController.js:14` — ganti `prisma.users.findMany()` + JS filter dengan `prisma.$queryRaw` menggunakan `LOWER(username) = LOWER(?)`
- Sebelum: load SEMUA user ke memory lalu filter di JS (O(n) memory)
- Sesudah: query database langsung, hanya return 1 row (O(1) memory)
- Parameterized query, aman dari SQL injection

**Task #3: Hapus token dari query string**
- `api/src/middleware/auth.js:4` — hapus `|| req.query.token`, hanya terima `Authorization: Bearer <token>` header
- `web/src/pages/Opname.jsx:293-296` — `viewUploadedBaso` diganti dari `window.open` dengan query token menjadi `fetch` + Authorization header + blob URL
- `web/src/pages/ShowroomOpname.jsx:284-288` — sama seperti di atas
- Token tidak lagi terekpos di server logs, browser history, atau referrer headers

**Verifikasi:**
- `npx prisma validate` ✅
- `npm test` ✅ (10 test pass)
- `npm run lint` ✅
- `npm run build` ✅

### 2026-05-07 — P0 #4, P1 #6, #9, #13, #14, Bug fix, Optimize aging_tag

**Task #4: Pecah `showroomController.js` (God file 1.634 baris)**
- Dipecah jadi 9 file:
  - `showroomUtils.js` (274 baris) — shared constants, buildWhere, parser helpers
  - `showroomKsu.js` (165 baris) — KSU logic
  - `showroomImport.js` (123 baris) — snapshot import/upsert helpers
  - `showroomStockUnitController.js` (393 baris) — stock unit + KSU handlers
  - `showroomStnkController.js` (190 baris) — STNK handlers
  - `showroomBpkbController.js` (191 baris) — BPKB handlers
  - `showroomPriceController.js` (127 baris) — OTR price handlers
  - `showroomDashboardController.js` (47 baris) — dashboard handler
  - `showroomFollowupController.js` (182 baris) — document followup handlers
- `showroomController.js` tetap sebagai barrel file (305 baris) untuk shared parser functions
- Routes diupdate untuk import dari sub-controllers baru
- Bug fix `getKsuSummaryData(db)` — parameter `prisma` tidak dikirim di `showroomDashboardController.js`
- Bug fix `BATTERY_TYPES` dan `DOCUMENT_FOLLOWUP_STATUSES` — missing exports

**Task #6: Split `api.js` frontend (354 baris monolith)**
- Dipecah jadi 10 module files di `web/src/services/api/`:
  - `fetchWithAuth.js`, `auth.js`, `dashboard.js`, `hotline.js`, `users.js`, `stock.js`, `workshop.js`, `customers.js`, `opname.js`, `sync.js`, `showroom.js`
- `api.js` tetap sebagai barrel file re-export untuk backward compatibility
- Semua import komponen tetap works tanpa perubahan

**Task #9: Extract duplicated utilities**
- Dibuat `api/src/utils/excelUtils.js` dengan shared functions:
  - `excelDateToJSDate`, `parseDays`, `parseIntOrZero`, `stringOrNull`, `formatForExcel`, `parsePrice`
- `showroomController.js` dan `customerController.js` sudah diupdate import dari excelUtils
- `showroomStockUnitController.js` dan sub-controllers baru sudah import dari sana

**Task #13: Rate limiting granular**
- `express-rate-limit` terpasang di `api/src/app.js`
- `authLimiter`: 20 req/15min untuk `/api/auth/login` (brute-force protection)
- `importLimiter`: 30 req/15min untuk `/api/sync/` (import abuse protection)
- `apiLimiter`: 500 req/15min untuk endpoint API umum
- Health check dikecualikan dari rate limit

**Task #14: Security headers (helmet.js)**
- `helmet()` terpasang di `api/src/app.js` — menambah X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, dll

**Bug fix: `execFileSync` command injection risk**
- `showroomController.js:320` — tambah `--` separator dan path validation di pemanggilan `textutil`

**Bug fix: `attachKsuToStockUnits` missing `prisma` parameter**
- `showroomStockUnitController.js:199` — fungsi dipanggil tanpa parameter `db` (prisma), menyebabkan `TypeError: Cannot read properties of undefined`
- Fix: tambah `prisma` sebagai argumen kedua

**Optimize: `aging_tag` pagination berubah dari in-memory ke DB-level**
- Sebelum: `getStockUnits` load SEMUA row ke memory, filter with `matchesAgingTag()`, lalu slice untuk pagination — O(n) memory
- Sesudah: `applyAgingTagFilter()` konversi aging_tag ke Prisma date range filter (`incoming_date` gte/lt per month), query DB langsung dengan skip/take — O(1) memory
- Export Excel juga di-optimize dengan filter DB-level
- `matchesAgingTag()` tetap dipakai di tempat lain (export enrichment), bukan untuk filtering pagination

**File cleanup:**
- Hapus `showroomController.js.bak` (corrupted backup dari failed edit)

**Verifikasi:**
- Backend restart sukses, `/health` 200 OK
- Login `haris`/`password` mengembalikan token
- `GET /api/showroom/stock-units?page=1&limit=2` → Total: 152, Items: 2
- `GET /api/showroom/stock-units?page=1&limit=2&aging_tag=B` → Total: 3, Items: 2 (DB-level filter)
- Module import semua clean, tidak ada circular dependency
