# Rencana Perbaikan — Sistem Workshop, Sparepart, dan Showroom DXK

**Tanggal update:** 2026-06-16 (review lanjutan #2)

Dokumen ini berisi hasil code review menyeluruh (backend + frontend) dan rencana perbaikan terstruktur berdasarkan temuan aktual. Sistem saat ini **fungsional dan siap dipakai harian**, tetapi memiliki beberapa masalah yang perlu diperbaiki untuk keamanan, performa, dan maintainability.

> **Status verifikasi build/test per 2026-06-16 (review #2):** `npm run lint` (web) bersih, `npm run build` (web) sukses, backend `npm test` **26/26 pass** (catatan: hanya lulus jika `test.db` ada di path yang benar — lihat temuan T-3). Temuan blocker baru dari review #2 ada di bagian **"2026-06-16 — Review lanjutan #2"** di bawah.

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

#### Critical (Review 2026-06-16)

| No | File | Masalah | Dampak |
|----|------|---------|--------|
| 1 | `authController.js:14` | Login pakai `prisma.users.findMany()` — load SEMUA user ke memory lalu filter di JS | Performance bomb saat user bertambah, DoS vector |
| 2 | `showroomController.js` | **1.634 baris** — God file berisi parsing, CRUD, export, KSU, document followups, pricing | Sulit maintenance, testing, dan debugging |
| 3 | `customerController.js:364` | Filter KPB load semua customers ke memory lalu filter/slice di JS | Lambat untuk 10K+ records |
| 4 | `workshopController.js:177` | Mechanic performance load SEMUA 60K+ WO ke memory lalu group di JS | Memory/time bomb |
| 5 | `syncController.js:240` | `prisma.$disconnect()` lalu `$connect()` tanpa retry logic | Broken state jika restore gagal |
| 6 | `showroomRoutes.js` | Route statis `/opname/search-unit` & `/opname/notifications` dideklarasikan **setelah** route dinamis `/opname/:id/...` | Express 5 bisa salah cocokkan `:id = "search-unit"`, request masuk handler salah → error 404/500 |
| 7 | `showroomProgramController.js` | Import `pdfjs-dist` — paket **tidak terdaftar** di `package.json` dependencies (hanya ada di `package-lock.json`) | Fatal error saat `npm install` fresh di server baru |
| 8 | `app.js:52-58` | `apiLimiter` didefinisikan tapi **tidak pernah dipasang** dengan `app.use()` | Semua endpoint non-auth & non-import tidak punya rate limiting |
| 9 | `showroomBbnController.js`, `showroomProgramController.js` | `fs.unlinkSync()` (sinkronus, blocking) — sementara controller lain pakai `fs.unlink().catch(() => {})` **async** | Blokir event loop saat file besar; exception jika file tidak ditemukan → 500 error tanpa cleanup |
| 10 | `showroomProgramController.js` | `execFileSync('textutil', ...)` — `textutil` hanya ada di macOS | Import harga OTR dari `.docx` gagal total di server Linux; tidak ada fallback |
| 11 | `salesOrderMarginController.js` | `parseInt(limit)` tanpa batas maksimum — `?limit=999999` ambil semua data | User bisa overload server dengan query massal |
| 12 | `maintenanceService.js` | State maintenance in-memory (`let maintenanceState = { active: false }`) | Hilang saat server restart/crash — restore yang sedang berjalan tidak terproteksi |
| 13 | `authController.js:71` | JWT token dikembalikan di JSON body response selain httpOnly cookie | Potensi disimpan di localStorage oleh client (rentan XSS) |
| 14 | Controller files (34+ tempat) | `parseInt(req.params.id)` tanpa NaN guard — jika `id` non-numerik, hasil `NaN` lolos ke Prisma | Tidak crash (error handler tangkap), tapi seharusnya validasi lebih awal |

#### Security

| Severity | Lokasi | Masalah |
|----------|--------|---------|
| HIGH | `auth.js:4` | Token di query string (`req.query.token`) — logged di server logs, browser history, referrer headers |
| HIGH | `showroomController.js:320` | `execFileSync('textutil', ...)` — command injection risk jika filePath user-controlled |
| MEDIUM | Semua endpoint | ~~Tidak ada rate limiting~~ — **Update 2026-06-16:** `authLimiter` (login) & `importLimiter` (sync) sudah aktif; SISA: `apiLimiter` umum belum dipasang (lihat P1 #20) |
| MEDIUM | `app.js` | ~~Tidak ada helmet.js~~ — **Update 2026-06-16: SUDAH dipasang** (`app.use(helmet())` di `app.js:33`); item ini selesai |
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
| ~~Tidak ada graceful shutdown~~ | **Update 2026-06-16: SUDAH ada** `process.on('SIGTERM')` & `process.on('SIGINT')` di `app.js:137-138` |
| Silent error swallowing | `redis.js:13`, `syncController.js:255`, `customerController.js:322` |
| Upload path relatif | `upload.js:6` — `destination: 'uploads/'` resolve ke CWD yang bisa berbeda |
| MIME type terlalu permisif | `application/octet-stream` di allowed types — bisa upload file apapun |
| Duplikasi `parseIntOrZero` | `showroomMarketingTargetController.js`, `importParsers.js` — sudah ada di `excelUtils.js` sebagai export resmi |
| Duplikasi `cleanupUpload` | `syncController.js` — versi sama sudah ada di `showroomUtils.js` |
| `auth.js` middleware — 2 DB query per request | `prisma.users.findUnique()` + `prisma.showroom_user_locations.findMany()` untuk setiap request | Mayoritas endpoint bengkel tidak butuh `locations` — 1 query sia-sia |
| `showroomOpnameController.js` — konstanta `OPEN_IMPORT_BLOCK_STATUSES` pakai nama status lama | `['draft','open','submitted','approved_adh','sent_to_kacab','approved_kacab','rejected']` vs schema: `draft,open,submitted,adh_done,rfa,approved,rejected,closed` | Potensi filter import tidak bekerja sesuai skema |

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
| 4 | `themeStore.js:3` | `localStorage.getItem('theme')` dipanggil langsung di **module scope**, bukan di dalam hook/fungsi | Error runtime jika modul dijalankan di non-browser environment (SSR, testing Node.js) |
| 5 | `web/src/services/` | **8 folder kosong** sisa refactoring: `authApi.js/`, `customerApi.js/`, `dashboardApi.js/`, `hotlineApi.js/`, `opnameApi.js/`, `showroomApi.js/`, `stockApi.js/`, `syncApi.js/` — direktori dengan ekstensi `.js` yang kosong | Membingungkan developer baru; berpotensi import path salah |

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
| 53 | **[BLOCKER] Buat migration `showroom_team_leaders`** — tabel hanya ada di `schema.prisma` + `dev.db` lokal (via `db push`); migration `20260612021618_add_showroom_marketing_targets` membuat FK ke `showroom_team_leaders("name")` tapi tidak ada migration yang `CREATE TABLE` tabel itu → `prisma migrate deploy` GAGAL di DB baru | `api/prisma/migrations/`, `api/prisma/schema.prisma` | Pending |
| 54 | **[BLOCKER] Fix regression notifikasi Partman** — blok `role === 'Partman'` keliru memakai `showroom_opname_sessions` + `mapShowroomTask` (identik blok PIC Stock opname). Partman menangani opname sparepart bengkel → harus dikembalikan ke `opname_sessions` + `mapPartTask` | `api/src/controllers/notificationController.js:277` | Pending |

### P1 — Performance & Architecture (Short-term)

| # | Task | File/Lokasi | Estimasi |
|---|------|-------------|----------|
| 6 | **Split `api.js`** jadi domain modules: `api/auth.js`, `api/workshop.js`, `api/showroom.js`, `api/customers.js`, `api/opname.js` | `web/src/services/api*.js` | ✅ Selesai |
| 7 | **Extract pagination utility** — reusable `paginate(model, where, req)` | `api/src/utils/pagination.js` | Pending |
| 8 | **Extract Excel export utility** — reusable `exportToExcel(data, columns, filename)` | `api/src/utils/excelExport.js` | Pending |
| 9 | **Extract duplicated utilities** — `excelDateToJSDate`, `cleanupUpload`, `formatForExcel` ke `api/src/utils/` | `api/src/utils/*.js` | ✅ Selesai |
| 10 | **Fix mechanic performance query** — gunakan Prisma aggregation/groupBy, bukan load semua ke memory | `api/src/controllers/workshopController.js` | Pending |
| 11 | **Fix customer KPB filter query** — gunakan Prisma where clause, bukan filter di JS | `api/src/controllers/customerController.js` | Pending |
| 12 | **Tambah graceful shutdown** — `SIGTERM`/`SIGINT` handler dengan `prisma.$disconnect()` | `api/src/app.js` | ✅ Selesai (sudah ada di `app.js:137-138`) |
| 13 | **Tambah rate limiting** — `express-rate-limit` di login, import, export endpoints | `api/src/app.js`, route files | ✅ Selesai |
| 14 | **Tambah helmet.js** — security headers | `api/src/app.js` | ✅ Selesai |
| 15 | **React.lazy() code splitting** — route-level lazy loading untuk semua pages | `web/src/App.jsx` | 3 jam |
| 16 | **Fix `exhaustive-deps` eslint disables** — wrap load functions dalam `useCallback` atau pakai refs | 9+ page files | 4 jam |
| 17 | **Ganti `alert()`/`confirm()`** dengan toast notification + confirmation modal | `web/src/components/common/`, page files | 4 jam |
| 18 | **Fix route order** — pindahkan route statis `/opname/search-unit` dan `/opname/notifications` SEBELUM route dinamis `:id` | `api/src/routes/showroomRoutes.js` | 15 menit |
| 19 | **Daftarkan `pdfjs-dist` ke `package.json`** — tambah ke dependencies | `api/package.json` | 5 menit |
| 20 | **Pasang `apiLimiter`** — `app.use('/api/', apiLimiter)` di `app.js` (non-auth, non-import) | `api/src/app.js` | 10 menit |
| 21 | **Ganti `unlinkSync` ke `unlink` async** — semua controller yang masih sinkronus | `showroomBbnController.js`, `showroomProgramController.js` | 30 menit |
| 22 | **Tambah batas maksimum `?limit`** — `Math.min(parseInt(limit), 100)` di endpoint pagination | `salesOrderMarginController.js` + semua controller | 1 jam |
| 23 | **Hapus folder kosong `web/src/services/*.js/`** — 8 direktori sisa refactoring | `web/src/services/` | 5 menit |
| 24 | **Fix `themeStore.js`** — bungkus `localStorage` access dalam fungsi/guard | `web/src/stores/themeStore.js` | 10 menit |
| 25 | **Fix `parseInt` tanpa NaN guard** — tambah validasi di semua controller yang parsing `req.params.id` | 34+ lokasi di controller | 2 jam |
| 26 | **Hapus JWT dari response body** — cukup kirim via httpOnly cookie; frontend jangan simpan di localStorage | `authController.js`, `authStore.js`, `Login.jsx` | 1 jam |

### P2 — Code Quality & UX (Medium-term)

| # | Task | File/Lokasi | Estimasi |
|---|------|-------------|----------|
| 27 | **Tambah input validation** — Zod atau Joi untuk request body/query validation | `api/src/middleware/validate.js` | 4 jam |
| 28 | **Tambah pagination UI** — page numbers, prev/next buttons di semua list pages | `web/src/components/common/Pagination.jsx`, page files | 4 jam |
| 29 | **Lazy-load `indonesiaAreaCodes.js`** atau fetch dari backend | `web/src/data/indonesiaAreaCodes.js` | 1 jam |
| 30 | **Extract `displayRole()`** ke shared utility | `web/src/utils/displayRole.js` | 30 menit |
| 31 | **Extract export logic** ke reusable hook `useExport()` | `web/src/hooks/useExport.js` | 2 jam |
| 32 | **Split large components** — `Customers.jsx`, `Opname.jsx`, `ShowroomOpname.jsx` jadi sub-components | `web/src/pages/` | 6 jam |
| 33 | **Tambah loading skeletons** — ganti spinner dengan skeleton screens | `web/src/components/common/Skeleton.jsx` | 3 jam |
| 34 | **Tambah React.memo** ke table row components | Page files dengan tabel besar | 3 jam |
| 35 | **Fix typo `cassis_number`** — migration rename ke `chassis_number` | `api/prisma/schema.prisma`, controllers | 2 jam |
| 36 | **Tambah request ID logging** — tracing requests across logs | `api/src/middleware/requestId.js` | 1 jam |
| 37 | **Tambah error boundary** — route-level error boundary | `web/src/components/common/ErrorBoundary.jsx` | 2 jam |
| 38 | **Upload path absolute** — `path.resolve` untuk destination uploads | `api/src/middleware/upload.js` | 30 menit |
| 39 | **Tighten MIME types** — hapus `application/octet-stream` dari allowed types | `api/src/middleware/upload.js` | 30 menit |
| 40 | **Fix maintenance state survive restart** — simpan state ke DB atau file | `api/src/services/maintenanceService.js` | 2 jam |
| 41 | **Add `textutil` fallback** — deteksi OS, fallback ke parser DOCX alternatif (mammoth.js) | `api/src/controllers/showroomProgramController.js` | 2 jam |
| 42 | **Kurangi redundant DB query di auth middleware** — hanya load `locations` jika endpoint showroom | `api/src/middleware/auth.js` | 2 jam |

### P3 — Long-term (Optional)

| # | Task | Estimasi |
|---|------|----------|
| 43 | **Pertimbangkan migrasi ke PostgreSQL** — jika concurrent users bertambah | 16+ jam |
| 44 | **API versioning** — `/api/v1/...` untuk future compatibility | 4 jam |
| 45 | **OpenAPI/Swagger documentation** — auto-generated API docs | 4 jam |
| 46 | **Refresh tokens** — shorter JWT expiry + refresh token rotation | 6 jam |
| 47 | **Structured logging** — ganti `console.log` dengan `pino` atau `winston` | 4 jam |
| 48 | **Export Excel Master BBN/TAC** — jika dibutuhkan untuk audit | 4 jam |
| 49 | **Edit/delete/deactivate Matrix TAC, Dana Promosi, Alias Series dari UI** | 8 jam |
| 50 | **Validasi kalkulator margin** dengan 5-10 DSO Odoo tambahan | 4 jam |
| 51 | **PWA installable** — bisa install di HP | 4 jam |
| 52 | **Notifikasi real-time/WebSocket** — reminder follow-up | 8 jam |

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

### 2026-06-12 — Modul Target Marketing (per TL, bulanan, Kepala Cabang edit)

**Skema & migration**
- Tabel baru `showroom_marketing_targets` (`period_year`, `period_month`, `team_leader`, `target_unit`, `notes`, `is_active`, `created_by`, timestamps). Unique `(period_year, period_month, team_leader)`. FK `team_leader` ke `showroom_team_leaders.name` (`ON UPDATE CASCADE`).
- Migration `20260612021618_add_showroom_marketing_targets/migration.sql` (idempotent).

**Backend**
- Controller `api/src/controllers/showroomMarketingTargetController.js` — `listMarketingTargets`, `getMarketingTargetSummary`, `upsertMarketingTarget`, `deleteMarketingTarget`. Validasi TL master exists, range tahun 2025-2099 & bulan 1-12.
- Routes di `showroomRoutes.js`: `GET /marketing-targets`, `GET /marketing-targets/summary` (read = Admin + Kepala Cabang), `POST/PATCH /marketing-targets` & `DELETE /marketing-targets/:id` (write = hanya Kepala Cabang).
- Refactor `buildTeamPerformanceFromMaster` diekstrak ke `api/src/utils/salesPerformance.js` agar reusable; tambah `countActualForSalesmen` untuk hitung closing DO per TL.
- `showroomSalesDashboardController.js` diupdate memakai util baru — 2 call site dimigrasi, signature `buildTeamPerformanceFromMaster(prisma, { dateWhere, preFetchedMaster })`.

**Frontend**
- Halaman `web/src/pages/ShowroomMarketingTarget.jsx` (route `/showroom/marketing-target`, lazy-loaded) dengan filter tahun+bulan, kartu ringkasan (jumlah tim, total target, total actual, pencapaian %, gap), tabel per-TL (sales aktif, target, actual, %, sisa, status aman/waspada/kritis), form modal upsert.
- Edit & hapus hanya untuk Kepala Cabang — tombol hilang di UI untuk role lain; API `403` jika dipaksa.
- API client ditambah di `web/src/services/api/showroom.js`.
- Route + Sidebar entry di sub-menu **Penjualan** (urutan pertama): `/showroom/marketing-target`.

**Verifikasi**
- `npx prisma validate` lulus
- `npx prisma migrate deploy` apply 1 migration sukses
- `npm test` 26/26 pass (no regression)
- `npm run lint` — file baru 0 error (7 error pre-existing di `ShowroomStnkBpkbMonitoring.jsx` WIP, di luar scope)
- `npm run build` sukses, chunk `ShowroomMarketingTarget` 13.43 kB
- Smoke test 2 role via curl:
  - Kepala Cabang `lukman`: GET 200, POST 200, DELETE 200
  - Admin Showroom `haris`: GET 200, POST 403, DELETE 403
  - Validation: TL invalid → 400
- Frontend dev server: route `/showroom/marketing-target` 200 OK

### 2026-06-12 — Normalisasi data nama historis (customers, work_orders, hotlines)

**Temuan**
- `customers.salesman` (19.396 baris): 1.586 whitespace + 28 mixed-case. Penyebab 3 sales di Juni 2026 tidak match master: `WAWAN SETIAWAN ` (trailing space), `Gunawan`, `Saleh` — total 11 row terlewat dari `countActualForSalesmen` (92 → 103).
- Field nama lain yang aman dinormalisasi: `customers.sales_coord_name` (1), `customers.customer_name` (254), `work_orders.mechanic` (2), `work_orders.login` (2), `hotlines.customer` (3), `hotlines.pembawa` (3) = 265 baris.
- Field nama yang **TIDAK** dinormalisasi (propercase / free-form): `work_orders.customer_name` (7.326 mixed), `work_orders.product_name` (1.599), `kpb_followups.note`, alamat.
- TL yang closing via namanya sendiri: 6 dari 7 TL (`SUGIMAN` 282, `MERIYANTO` 613, `HASHARI` 179, `FEBRI PRATAMA` 85, `BAYU NUSANTARA` 25, `GUNTUR ADYTYA DWI SAPUTRA` 15) = 1.199 row historis.

**Tindakan**
- Backup otomatis: `api/prisma/backups/dev.db.backup.pre_normalize_salesman.202606120252`.
- Insert 6 sales entry self-TL ke `showroom_salespeople` (`team_leader = name`, `source_file = 'AUTO_NORMALIZE_20260612'`) agar TL yang closing via dirinya sendiri terhitung di rekap per TL.
- Normalisasi 1.879 baris via `UPDATE ... SET field = UPPER(TRIM(field)) WHERE field != UPPER(TRIM(field))` (no-op filter).
- Distinct salesman raw = normalized = 161 (tidak ada duplikat case/whitespace sisa).

**Verifikasi**
- `npm test` 26/26 pass (no regression)
- `npm run lint` bersih untuk file baru
- `npm run build` sukses
- Summary API Juni 2026: total_actual = 103 (match grand total customers). Bulan 1-5/2026: 196, 255, 320, 232, 287 — total 1.393 vs 1.459 customers DXK 2026. Selisih 66 row = orphan sales (SUPIANTO 36, HAMISAH 25, CIPRI 4, SUKAMDANI 1) yang belum ada di master.
- Master salespeople: 58 row (52 existing + 6 self-TL).

**Tindak lanjut opsional**
- Tambah 4 sales orphan (`SUPIANTO`, `HAMISAH`, `CIPRI`, `SUKAMDANI`) ke master via UI Master Sales. Atau abaikan karena data historis.
- Search `salesman: { contains: ... }` di `salesOrderMarginController.js:357` masih case-sensitive; kalau user complain search tidak match, ubah ke raw SQL `LIKE UPPER(...)` atau normalisasi di controller.

### 2026-06-12 — Defensive filter `is_active = true` di Target Marketing

**Tujuan**
- Master `showroom_salespeople` hanya menyimpan sales **terbaru/aktif**. Sales non-aktif cukup tersimpan di `customers` historis.
- Query `getMarketingTargetSummary` sebelumnya me-load semua salespeople (termasuk non-aktif). Jika sales dinonaktifkan via UI Master Sales, dia masih dihitung per-TL → angka actual bisa stale.

**Tindakan**
- Edit `api/src/controllers/showroomMarketingTargetController.js`: tambah `where: { is_active: true }` di query `prisma.showroom_salespeople.findMany` untuk `allSalesmen` (pembentuk `salesmenByTl`).
- Tidak insert 4 sales orphan 2026 (`SUPIANTO`, `HAMISAH`, `CIPRI`, `SUKAMDANI`) ke master — sudah pasti non-aktif / legacy.

**Verifikasi**
- Backup: `api/prisma/backups/dev.db.backup.pre_defensive_filter_active.202606120314`.
- Sebelum: Juni 2026 `total_actual = 103`.
- Test: `UPDATE showroom_salespeople SET is_active=0 WHERE name='JULFANDRI'` → Juni 2026 `total_actual = 92` (JULFANDRI 11 row excluded, GUNTUR team actual 21→10, dst). Restore → 103 lagi. Defensive filter tervalidasi.
- `npm test` 26/26 pass.
- `npm run build` sukses, smoke test 2 role OK (Admin Showroom GET 200, POST 403).

**Yang TIDAK dilakukan**
- 4 sales orphan tetap tidak ada di master — by design (data historis di `customers` saja).
- Tidak ada perubahan angka summary default (semua sales masih aktif).

### 2026-06-12 — Filter preset Laporan Analisis Penjualan (7 button)

**Tujuan**
- Mengganti 3 shortcut lama (Hari Ini, Kemarin, Bulan Ini) dengan 7 preset terstruktur: Last 7 Days, Last 30 Days, Last 3 Months, Last 12 Months, Month to Date, Year to Date, All Time.
- Default `mtd` (Month to Date) untuk monitoring operasional bulanan yang konsisten.
- Custom range tetap bisa (date input `from`/`to`) — edit manual clear `activePreset`.

**Tindakan**
- Tambah helper `getDateRangePreset(presetKey)` + `DATE_PRESETS` di `web/src/components/showroom/ShowroomSalesUtils.js`.
- Helper `toISODate()` TZ-safe (pakai `getFullYear/getMonth/getDate` lokal, bukan `toISOString()` UTC) — `new Date(2026, 0, 1)` di Jakarta = 1 Jan 2026 00:00 WIB = 31 Dec 2025 17:00 UTC, tanpa TZ-safe formatting `ytd` jadi mundur 1 hari.
- `getTodayStr`/`getYesterdayStr` di-refactor pakai helper TZ-safe yang sama (fix bug TZ preexisting).
- Update `ShowroomSalesAnalysis.jsx`: state `activePreset` (default `'mtd'`), 7 button preset dengan style active/inactive (active = `bg-blue-600 text-white`).

**Verifikasi**
- API smoke test 7 preset via curl (T=2026-06-12):
  - `last7days` (2026-06-06 → 2026-06-12) → closingDo=55
  - `last30days` (2026-05-14 → 2026-06-12) → closingDo=256
  - `last3months` (2026-03-12 → 2026-06-12) → closingDo=832
  - `last12months` (2025-06-12 → 2026-06-12) → closingDo=3025
  - `mtd` (2026-06-01 → 2026-06-12) → closingDo=103
  - `ytd` (2026-01-01 → 2026-06-12) → closingDo=1459
  - `all` (2015-01-01 → 2026-06-12) → closingDo=19396
- Backend test 26/26 pass.
- Frontend lint bersih untuk file baru; build sukses.
- Backend `getDateRange` tidak diubah — query param `from`/`to` sudah support.

**Yang TIDAK dilakukan**
- `ShowroomClosingDaily` & `ShowroomMarketingTarget` tidak diubah (konteks filter berbeda).

### 2026-06-12 — Filter preset Laporan Analisis Penjualan: native dropdown

**Tujuan**
- Mengganti 7 button horizontal (yang sebelumnya memboros tempat di header) dengan 1 native `<select>` dropdown.
- Lebih ringkas, muat di laptop kecil/mobile, pattern aksesibel (screen reader + keyboard friendly).

**Tindakan**
- Edit `web/src/pages/ShowroomSalesAnalysis.jsx`: ganti `.map(7 button)` dengan `<select>` yang berisi 7 `<option>` dari `DATE_PRESETS` + 1 `<option value="custom">Custom</option>`.
- Tambah icon `Calendar` (lucide-react) di kiri dropdown + label "Periode" agar dropdown lebih jelas.
- `value={activePreset || 'custom'}` — saat `activePreset === ''` (user edit date input manual), dropdown otomatis pindah ke opsi "Custom".
- `min-w-[180px]` agar dropdown tidak "loncat" saat ganti opsi (label "All Time" vs "Last 12 Months").
- Tidak ubah logika `getDateRangePreset` atau backend.

**Verifikasi**
- Frontend lint bersih untuk file yang diubah.
- `npm run build` sukses.
- API smoke test ulang: `mtd` (2026-06-01 → 2026-06-12) → closingDo=103 (sama, tidak ada regresi).
- Frontend dev server: route `/showroom/dashboard-penjualan` 200 OK.

**Visual layout**
- Sebelum: `[date_from] s/d [date_to] | [L7D] [L30D] [L3M] [L12M] [MTD] [YTD] [All] | [Target] | [Refresh] [Export]`
- Sesudah: `[date_from] s/d [date_to] | [📅 Periode: MTD ▾] | [Target] | [Refresh] [Export]`

### 2026-06-16 — Code Review lanjutan: temuan baru + update rencana perbaikan

**Tujuan**
- Review codebase lanjutan setelah refactoring showroomController, api.js, dan utility extraction
- Identifikasi masalah baru yang belum tercakup di review 2026-05-06

**Temuan Baru (Critical)**

| No | File | Masalah | Dampak |
|----|------|---------|--------|
| 1 | `showroomRoutes.js` | Route statis `/opname/search-unit` & `/opname/notifications` setelah route dinamis `:id` | Express 5 bisa salah cocokkan → request error |
| 2 | `showroomProgramController.js` | `pdfjs-dist` tidak di `package.json` dependencies | Fatal error saat fresh install |
| 3 | `app.js:52-58` | `apiLimiter` didefinisikan tapi tidak dipasang | Semua endpoint tidak terlindungi rate limit |
| 4 | `showroomBbnController.js`, dll | `fs.unlinkSync()` blocking | Blokir event loop |
| 5 | `salesOrderMarginController.js` | `?limit=` tanpa batas maksimum | Query overload |
| 6 | `maintenanceService.js` | State in-memory hilang saat restart | Restore tidak terproteksi |
| 7 | `authController.js:71` | JWT di body response selain cookie | Potensi disimpan di localStorage |
| 8 | `showroomProgramController.js` | `textutil` hanya macOS | Import gagal di Linux |
| 9 | Controller files (34+ lokasi) | `parseInt(req.params.id)` tanpa NaN guard | Validasi kurang |
| 10 | `themeStore.js:3` | `localStorage` di module scope | Error di non-browser env |
| 11 | `web/src/services/` | 8 folder kosong sisa refactoring | Kebersihan codebase |
| 12 | `showroomOpnameController.js` | Konstanta `OPEN_IMPORT_BLOCK_STATUSES` mismatch dengan schema | Potensi filter tidak bekerja |
| 13 | `auth.js` middleware | 2 DB query per request (users + locations) | Sia-sia untuk endpoint bengkel |

**Tindakan**
- Tambah 11 task baru di P1 (Task #18-28):
  - #18: Fix route order showroomRoutes
  - #19: Daftarkan `pdfjs-dist` ke `package.json`
  - #20: Pasang `apiLimiter`
  - #21: Ganti `unlinkSync` ke async
  - #22: Tambah batas maksimum `?limit`
  - #23: Hapus folder kosong
  - #24: Fix `themeStore.js`
  - #25: Fix `parseInt` tanpa NaN guard
  - #26: Hapus JWT dari response body
- Tambah task baru di P2 (Task #40-42):
  - #40: Fix maintenance state survive restart
  - #41: Add `textutil` fallback
  - #42: Kurangi redundant DB query di auth middleware

**Verifikasi**
- Semua analisis read-only, tidak ada perubahan kode
- Task siap dikerjakan; prioritas #18-20 (5 menit - 15 menit per task)
- Validasi akhir: npx prisma validate + npm test + npm run lint + npm run build

### 2026-06-16 — Review lanjutan #2: blocker baru + re-verifikasi temuan lama

**Tujuan**
- Review pekerjaan uncommitted terbaru (Target Marketing, Team Leader, STNK/BPKB track, sales analysis preset, dashboard trend) + re-cek apakah temuan review #1 (2026-05-06 & 2026-06-16) masih valid atau sudah usang.

**Status build/test aktual (diverifikasi)**
- Frontend `npm run lint`: bersih (0 error).
- Frontend `npm run build`: sukses.
- Backend `npm test`: **26/26 pass** — TAPI hanya jika `test.db` ada di path yang benar (lihat T-3).

**Temuan BARU — Blocker (belum tercatat di review sebelumnya)**

| Kode | File | Masalah | Dampak | Status |
|------|------|---------|--------|--------|
| T-1 | `api/prisma/migrations/` + `schema.prisma` | Model `showroom_team_leaders` hanya di `schema.prisma` (uncommitted) + ada di `dev.db` lokal via `db push`. Migration `20260612021618_add_showroom_marketing_targets` membuat FK `team_leader → showroom_team_leaders("name")`, tapi **tidak ada migration yang `CREATE TABLE showroom_team_leaders`** (diverifikasi: `grep` migrations = NONE). | `prisma migrate deploy` di DB baru **GAGAL** ("no such table: showroom_team_leaders"). Deployment blocker. | Pending (P0 #53) |
| T-2 | `api/src/controllers/notificationController.js:277-280` | Blok `role === 'Partman'` (uncommitted) keliru diganti ke `showroom_opname_sessions` + `mapShowroomTask` ("Perbaiki hasil SO") — identik blok `PIC Stock opname`. Original: `opname_sessions` + `mapPartTask` ("Perbaiki hasil opname"). | Partman (opname sparepart bengkel) dapat notifikasi salah (showroom) + kehilangan task opname part-nya. Regression fungsional. | Pending (P0 #54) |

**Temuan BARU — Medium/Low**

| Kode | File | Masalah | Dampak |
|------|------|---------|--------|
| T-3 | `api/package.json` (`test` script) + `tests/helpers.js` | `npm test` tidak punya `pretest` untuk setup skema test DB. `prisma.config.ts` mengarahkan `prisma db push` ke `prisma/test.db`, sedangkan runtime `helpers.js` membuka `file:./test.db` (relatif ke `api/`) → path mismatch → semua test integrasi gagal "table main.users does not exist" pada checkout bersih. Lulus hanya setelah `test.db` disalin manual ke `api/`. | Test tidak self-contained / CI rapuh |
| T-4 | `showroomMarketingTargetController.js` (`getMarketingTargetSummary`) vs `showroom_salespeople.team_leader` | Dua sumber kebenaran "Team Leader": enumerasi TL dari `showroom_team_leaders.name`, tapi `salesmenByTl` dikelompokkan dari `showroom_salespeople.team_leader` (string bebas, di-`upper`). Jika kedua nilai tidak persis sama → `salesmen` kosong → `actual_unit = 0` padahal target tampil (silent mismatch). | Angka pencapaian per-TL bisa salah/0 tanpa error |
| T-5 | `api/dev.db` (untracked, 0 byte) | File DB kosong berdampingan dengan `api/prisma/dev.db` (66MB asli). | Risiko membuka DB kosong jika path resolusi salah; membingungkan |
| T-6 | `app.js` (CORS) | `allowedOrigins` hardcode IP `172.20.10.9`. | Konfigurasi rapuh; sebaiknya dari env |

**Re-verifikasi temuan lama (MASIH VALID per 2026-06-16, belum difix)**
- P1 #18 — Route order: `/opname/search-unit` (baris 185) & `/opname/notifications` (baris 188) **masih** setelah `/opname/:id` (baris 158+). **Masih valid.**
- P1 #19 — `pdfjs-dist` di-import (`showroomProgramController.js:5`) tapi **tidak** di `package.json` (hanya `pdf-parse`). **Masih valid.**
- P1 #20 — `apiLimiter` didefinisikan (`app.js:52`) tapi **tidak pernah** `app.use()`. **Masih valid.**
- P1 #21 — `fs.unlinkSync` masih di `showroomProgramController.js` (2x) & `showroomBbnController.js` (2x). **Masih valid.**
- P1 #22 — `salesOrderMarginController.js:364` `take: parseInt(limit)` tanpa `Math.min` cap. **Masih valid.**
- P1 #23 — 9 folder kosong `web/src/services/*.js/` (termasuk `workshopApi.js/` — sebelumnya dicatat 8). **Masih valid, update jumlah jadi 9.**
- P1 #24 — `themeStore.js:3` `localStorage.getItem('theme')` di module scope. **Masih valid.**
- P1 #26 — JWT masih dikembalikan di body (`authController.js:70 res.json({ token, ... })`). **Masih valid.**
- P2 #42 — `auth.js` middleware masih 2 query per request (`users.findUnique` + `showroom_user_locations.findMany`). **Masih valid.**
- Code Quality — `OPEN_IMPORT_BLOCK_STATUSES` (`showroomOpnameController.js:9`) masih `['draft','open','submitted','approved_adh','sent_to_kacab','approved_kacab','rejected']` vs status schema (`adh_done,rfa,approved,closed`). **Masih valid.**

**Temuan lama yang DIHAPUS/USANG (sudah tidak akurat)**
- ~~"Tidak ada helmet.js"~~ — sudah dipasang (`app.js:33 app.use(helmet())`). Sudah tercatat ✅ di P1 #14, dipertahankan sebagai selesai.
- ~~"Tidak ada graceful shutdown"~~ — sudah ada `SIGTERM`/`SIGINT` handler di `app.js:137-138`. **Item P1 #12 ditandai sebenarnya sudah terimplementasi** (perlu update status jika ingin akurat).
- ~~"Tidak ada rate limiting sama sekali"~~ — auth & sync limiter sudah aktif; yang tersisa hanya `apiLimiter` umum belum dipasang (lihat #20).

**Tindakan dokumen**
- Tambah P0 #53 (migration `showroom_team_leaders`) dan #54 (fix Partman notifikasi) sebagai blocker prioritas tertinggi.
- Tambahkan temuan T-3 s/d T-6 sebagai backlog medium.

**Verifikasi**
- Analisis read-only; tidak ada perubahan kode aplikasi (hanya dokumen ini).
- Build/lint/test diverifikasi seperti di atas.

