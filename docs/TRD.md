# TRD.md
# Technical Requirements Document - Sistem DXK

**Versi:** 1.0  
**Tanggal:** 6 Mei 2026  
**Status:** Implementasi aktual berbasis Node.js, React, Prisma, dan SQLite

---

## 1. Tujuan Dokumen

Dokumen ini mendefinisikan kebutuhan teknis, struktur sistem, dependency, konfigurasi runtime, convention API, database, keamanan, upload/import, backup/restore, verifikasi, dan risiko teknis sistem DXK.

Sumber utama:

- `api/package.json`.
- `web/package.json`.
- `api/prisma/schema.prisma`.
- `api/src/app.js`.
- `api/src/routes/*.js`.
- `web/src/App.jsx`.
- `web/src/services/api.js`.
- `AGENTS.md`, `PRD.md`, `README.md`, dan `rencana_perbaikan.md`.

---

## 2. Stack Teknis

### 2.1 Backend

| Komponen | Versi/Library | Fungsi |
|----------|---------------|--------|
| Runtime | Node.js ES Module | Runtime backend |
| Framework | Express `^5.1.0` | HTTP API |
| ORM | Prisma `^6.7.0` | Database client dan schema |
| Database | SQLite | File-based database |
| Auth | jsonwebtoken `^9.0.2`, bcryptjs `^3.0.2` | JWT dan password hash |
| Upload | multer `^1.4.5-lts.1` | Upload Excel/DOCX/PDF |
| Excel | xlsx `^0.18.5` | Parsing dan export Excel |
| PDF | pdf-parse `^2.4.5` | Parsing PDF program |
| CORS | cors `^2.8.5` | Cross-origin frontend/backend |
| Env | dotenv `^16.4.7` | Environment variables |
| Cache Optional | redis `^4.7.0` | Cache optional, fallback DB |

Backend scripts:

```json
{
  "dev": "nodemon src/app.js",
  "start": "node src/app.js",
  "db:migrate": "npx prisma migrate dev",
  "db:seed": "npx prisma db seed",
  "db:generate": "npx prisma generate",
  "test": "node --test tests/*.test.js"
}
```

### 2.2 Frontend

| Komponen | Versi/Library | Fungsi |
|----------|---------------|--------|
| Build tool | Vite `^8.0.10` | Dev/build frontend |
| UI Runtime | React `^19.2.5`, React DOM `^19.2.5` | UI |
| Routing | react-router-dom `^7.14.2` | Route dan guard |
| Styling | Tailwind CSS `^4.2.4`, `@tailwindcss/vite` | Styling |
| State | Zustand `^5.0.12` | Auth/app/theme store |
| Icon | lucide-react `^0.460.0` | Icon UI |
| Barcode | jsbarcode `^3.12.3` | Barcode label |
| Lint | ESLint `^10.2.1` | Static analysis |

Frontend scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

---

## 3. Runtime dan Environment

### 3.1 Backend Runtime

Port default:

```text
3001
```

Health check:

```text
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "ISO_DATE"
}
```

Environment backend `api/.env`:

```env
DATABASE_URL=file:./dev.db
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=24h
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

Catatan teknis:

- `DATABASE_URL=file:./dev.db` relatif terhadap folder `api/prisma`, sehingga menunjuk ke `api/prisma/dev.db`.
- Redis optional. Jika Redis tidak berjalan, aplikasi tetap fallback ke database.
- CORS mengizinkan origin dari `FRONTEND_URL`.

### 3.2 Frontend Runtime

Port default Vite:

```text
5173
```

Environment frontend optional:

```env
VITE_API_URL=/api
```

Default API base di frontend:

```javascript
export const API_BASE = import.meta.env.VITE_API_URL || '/api'
```

---

## 4. Struktur Folder

### 4.1 Backend

```text
api/
  package.json
  prisma/
    schema.prisma
    dev.db
    backups/
    seed.js
  src/
    app.js
    config/
      db.js
      redis.js
    controllers/
      authController.js
      dashboardController.js
      hotlineController.js
      stockController.js
      workshopController.js
      opnameController.js
      syncController.js
      customerController.js
      userController.js
      showroomController.js
      showroomOpnameController.js
      showroomBbnController.js
      showroomProgramController.js
      showroomTacController.js
      salesOrderMarginController.js
      notificationController.js
    middleware/
      auth.js
      upload.js
      errorHandler.js
    routes/
      authRoutes.js
      dashboardRoutes.js
      hotlineRoutes.js
      stockRoutes.js
      workshopRoutes.js
      opnameRoutes.js
      syncRoutes.js
      customerRoutes.js
      userRoutes.js
      showroomRoutes.js
      notificationRoutes.js
    services/
      backupService.js
      auditService.js
      importParsers.js
```

### 4.2 Frontend

```text
web/
  package.json
  src/
    main.jsx
    App.jsx
    services/
      api.js
    stores/
      authStore.js
      appStore.js
      themeStore.js
    components/
      Layout/
        Layout.jsx
        Header.jsx
        Sidebar.jsx
      common/
        UploadModal.jsx
        BarcodeLabel.jsx
        BpkbBarcodeLabel.jsx
    pages/
      Dashboard.jsx
      Workshop.jsx
      Hotline.jsx
      Stock.jsx
      Opname.jsx
      Customers.jsx
      FollowupKpb.jsx
      MechanicPerformance.jsx
      Users.jsx
      Backups.jsx
      ShowroomDashboard.jsx
      ShowroomStockUnit.jsx
      ShowroomStnk.jsx
      ShowroomBpkb.jsx
      ShowroomOtrPrice.jsx
      ShowroomBbnPrice.jsx
      ShowroomProgram.jsx
      ShowroomTacLeasing.jsx
      ShowroomKsuMaster.jsx
      ShowroomOpname.jsx
      SalesOrderMargin.jsx
      ShowroomDocumentFollowup.jsx
      Login.jsx
      NotFound.jsx
    data/
      indonesiaAreaCodes.js
```

---

## 5. Backend App Composition

Backend entrypoint: `api/src/app.js`.

Registered routes:

| Mount Path | Route File | Domain |
|------------|------------|--------|
| `/api/auth` | `authRoutes.js` | Login dan current user |
| `/api/dashboard` | `dashboardRoutes.js` | Dashboard Bengkel |
| `/api/hotline` | `hotlineRoutes.js` | Hotline Part |
| `/api/stock` | `stockRoutes.js` | Stok Sparepart |
| `/api/workshop` | `workshopRoutes.js` | Work Order dan Program AHM |
| `/api/opname` | `opnameRoutes.js` | Opname Sparepart |
| `/api/sync` | `syncRoutes.js` | Import, backup, restore, logs |
| `/api/users` | `userRoutes.js` | User management |
| `/api/customers` | `customerRoutes.js` | Customers dan KPB |
| `/api/showroom` | `showroomRoutes.js` | Semua fitur showroom |
| `/api/notifications` | `notificationRoutes.js` | Approval/opname notifications |

Middleware global:

- `cors()` dengan credentials true.
- `express.json()`.
- `express.urlencoded({ extended: true })`.
- `errorHandler` di akhir pipeline.

Startup sequence:

```text
dotenv.config()
connectDB()
connectRedis()
app.listen(PORT)
```

---

## 6. Database Requirements

### 6.1 Provider

Database menggunakan SQLite melalui Prisma.

```text
api/prisma/dev.db
```

Prisma schema harus valid:

```bash
cd api
npx prisma validate
```

Prisma client harus digenerate setelah perubahan schema:

```bash
cd api
npx prisma generate
```

### 6.2 Key Requirements

- SQLite file harus ikut dibackup secara berkala.
- Path `DATABASE_URL=file:./dev.db` harus dipahami sebagai relatif ke `api/prisma`.
- Search query harus kompatibel SQLite; Prisma `mode: 'insensitive'` tidak didukung SQLite.
- Role, state, dan status masih berupa `String`, bukan enum.
- Unique key bisnis harus dijaga saat import agar tidak duplikat.

### 6.3 Data Volume Aktual

Data real yang pernah tercatat:

- Stock Parts: 566 item.
- Work Orders: 60.982 WO.
- Hotlines: 50 item.
- Customers Sales: 10.069 records.
- Showroom Stock Unit: 151 unit.
- Showroom STNK: 715 dokumen.
- Showroom BPKB: 400 dokumen.
- Master Harga: 198 kode produk.
- Master BBN: 1.079 row aktif.

---

## 7. Auth dan Security Requirements

### 7.1 Current Implementation

- Password disimpan sebagai bcrypt hash.
- Login menghasilkan JWT expiry 24 jam.
- Frontend menyimpan JWT di `localStorage`.
- API request memakai header `Authorization: Bearer <token>`.
- Backend middleware `authenticate` memverifikasi token.
- Backend middleware `authorize(...roles)` membatasi endpoint berdasarkan role.
- Token query string sudah dihapus dari middleware auth menurut rencana perbaikan 2026-05-06.

### 7.2 Required Security Rules

- Semua endpoint operasional harus memakai `authenticate`.
- Endpoint harus memakai `authorize(...)` sesuai matrix role.
- Upload file harus dibatasi tipe dan ukuran sesuai kebutuhan modul.
- Endpoint upload/import/export/login sebaiknya diberi rate limit pada perbaikan berikutnya.
- Security headers sebaiknya ditambah via `helmet` pada perbaikan berikutnya.
- JWT di `localStorage` adalah risiko XSS; target perbaikan adalah pindah ke httpOnly cookie.
- JWT payload mengandung role, sehingga perubahan role di DB baru efektif setelah token refresh/expire kecuali implementasi auth diubah.

---

## 8. API Client Frontend

File utama:

```text
web/src/services/api.js
```

Fungsi dasar:

- `fetchWithAuth(endpoint, options)`.
- Mengambil token dari `localStorage`.
- Menambahkan `Authorization` header.
- Mengirim JSON untuk body biasa.
- Tidak menambahkan `Content-Type: application/json` saat body adalah `FormData`.
- Menggunakan `AbortController` dengan timeout default 30 detik.
- Redirect ke `/login` saat response 401.

Timeout upload/import:

```text
300000 ms / 5 menit
```

Technical requirement:

- Semua upload file harus memakai `FormData`.
- Jangan set manual JSON content type untuk upload file.
- Error response backend diharapkan berbentuk `{ error: string }`.
- Export file yang response-nya blob harus ditangani khusus di page/hook terkait, tidak lewat parser JSON standar.

---

## 9. Routing dan Role Guard Frontend

File utama:

```text
web/src/App.jsx
```

Role guard:

```javascript
function RoleGuard({ children, allowedRoles }) {
  const { user } = useAuthStore()

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
```

Current technical note:

- Role arrays masih inline di `App.jsx`.
- Sidebar memiliki logic role sendiri.
- Rencana perbaikan: ekstrak role definitions ke shared config agar route dan sidebar tidak inkonsisten.

---

## 10. Upload dan Import Requirements

### 10.1 Upload Middleware

Backend memakai Multer di:

```text
api/src/middleware/upload.js
```

Kebutuhan teknis:

- Mendukung Excel untuk import operational.
- Mendukung DOCX untuk SK harga.
- Mendukung PDF untuk BASO/program jika dibutuhkan.
- File sementara harus dibersihkan setelah parsing jika sudah tidak dibutuhkan.
- Untuk BASO signed, file disimpan dan dapat diakses via endpoint authenticated.

### 10.2 Import Flow

Semua import dari UI harus mengikuti alur:

```text
Preview -> User konfirmasi -> Backup jika destruktif -> Import final -> sync_logs/audit_logs
```

Endpoint preview/final:

| Domain | Preview | Final |
|--------|---------|-------|
| Hotline | `/api/sync/hotline/preview` | `/api/sync/hotline` |
| Stock | `/api/sync/stock/preview` | `/api/sync/stock` |
| Workshop | `/api/sync/workshop/preview` | `/api/sync/workshop` |
| Sales | `/api/sync/sales/preview` | `/api/sync/sales` |
| Stock Unit | `/api/showroom/stock-units/preview` | `/api/showroom/stock-units/import` |
| STNK | `/api/showroom/stnks/preview` | `/api/showroom/stnks/import` |
| BPKB | `/api/showroom/bpkbs/preview` | `/api/showroom/bpkbs/import` |
| OTR | `/api/showroom/otr-prices/preview` | `/api/showroom/otr-prices/import` |
| Off/Beli | `/api/showroom/otr-prices/off-purchase/preview` | `/api/showroom/otr-prices/off-purchase/import` |
| BBN | `/api/showroom/bbn-prices/preview` | `/api/showroom/bbn-prices/import` |
| Program | `/api/showroom/programs/preview` | `/api/showroom/programs/import` |

### 10.3 Transaction Timeout

Timeout transaksi Prisma karena `createMany` bisa lama:

| Modul | Timeout |
|-------|---------|
| Hotline | 60 detik |
| Stock | 60 detik |
| Workshop | 120 detik |
| Sales/Customer | 180 detik |

### 10.4 Import Strategies

| Modul | Strategi |
|-------|----------|
| Hotline | Replace All baris DXK |
| Stock | Replace All + group by `product_code` |
| Workshop | Snapshot WO tahun berjalan, dedup by `wo_number` |
| Sales/Customer | Upsert by `so_number`, preserve follow-up |
| Stock Unit | Snapshot aktif by `engine_number` |
| STNK | Snapshot aktif by `engine_number` |
| BPKB | Snapshot aktif by `engine_number` |
| Master Harga | Upsert by `product_code` |
| Master BBN | Upsert by `product_code + city_name`, preserve manual jika import value 0 |
| TAC | Upsert by leasing/series/category/tenor/period |
| Program | Upsert by product/sale type/document/period |

---

## 11. Backup dan Restore Requirements

Service:

```text
api/src/services/backupService.js
```

Backup folder:

```text
api/prisma/backups
```

Requirements:

- Buat backup otomatis sebelum import destructive.
- Buat backup manual dari UI `/backups`.
- Buat backup `pre_restore` sebelum restore.
- Cleanup hanya menghapus `pre_import_*` lama.
- Jangan hapus backup `manual` dan `pre_restore` otomatis.
- Restore hanya untuk Kepala Bengkel dan Kepala Cabang.
- Audit operasi import final, backup manual, cleanup, dan restore.

Known risk:

- Restore belum memiliki checksum/integrity verification.
- Restore perlu retry/reconnect database yang lebih robust jika gagal.

---

## 12. Export Requirements

Export Excel tersedia untuk:

- Customers.
- Follow-up KPB.
- Stock Unit Showroom.
- Stock STNK.
- Stock BPKB.
- Follow-up STNK.
- Follow-up BPKB.
- Report Opname Showroom.

Rules:

- Export harus mengikuti filter aktif.
- Filename harus jelas sesuai domain dan tanggal/waktu bila tersedia.
- Export binary/blob tidak boleh diproses dengan `response.json()`.

Roadmap export:

- Master Harga.
- Master BBN/TAC.

---

## 13. Barcode dan Print Requirements

Library:

```text
jsbarcode CODE128
```

Label sparepart:

- Target ukuran 32mm x 64mm.
- Layout A4 3 kolom x 4 baris.
- Printer target Epson L3250 dengan sticker A4 precut.

Label BPKB:

- Encode `engine_number`.
- Header `BPKB - TDM Ketapang`.
- Layout A4 3x4 label 64mm x 32mm.

---

## 14. UI/UX Requirements

Design system aktual:

- V2 Clean Corporate sebagai default terang.
- Toggle tema terang/gelap di header.
- Theme preference disimpan di `localStorage.theme` melalui `web/src/stores/themeStore.js`.
- Login page memakai branding `DXK Operation System`.
- Headline login: `Satu sistem untuk semua alur kerja TDM Ketapang.`

Frontend requirements:

- Sidebar hanya menampilkan menu sesuai role.
- Header menyediakan import modal sesuai hak akses.
- Upload modal memfilter tab modul berdasarkan role.
- Tabel operasional harus tetap muat di desktop cabang.
- Mobile basic harus tetap dapat membuka halaman utama.
- Input nominal showroom harus hanya angka dan format ribuan Indonesia.

Known UX debt:

- Beberapa halaman masih memakai `alert()` dan `confirm()` native.
- Beberapa list memiliki pagination state tetapi UI pagination belum lengkap.
- Belum ada loading skeleton.
- Belum ada route-level code splitting.

---

## 15. Notification Requirements

Endpoint:

```text
GET /api/notifications/approvals
GET /api/notifications/opname
```

Kebutuhan:

- Endpoint harus authenticated.
- Response harus disaring berdasarkan role user.
- Dipakai untuk memberi informasi pekerjaan approval/opname yang perlu tindakan.

Roadmap:

- Notifikasi real-time/WebSocket bila aktivitas harian meningkat.

---

## 16. Testing dan Verification Requirements

### 16.1 Backend

Perintah validasi:

```bash
cd api
npx prisma validate
npm test
```

Expected:

- Prisma schema valid.
- Test Node runner pass.
- Backend bisa start dan `/health` return HTTP 200.

### 16.2 Frontend

Perintah validasi:

```bash
cd web
npm run lint
npm run build
```

Expected:

- Lint tanpa error.
- Build sukses.

### 16.3 Manual Verification

- Login sebagai role utama.
- Cek menu sidebar sesuai role.
- Cek akses URL langsung untuk halaman terlarang.
- Cek endpoint terlarang return HTTP `403`.
- Preview import sebelum final import.
- Pastikan import destruktif mengembalikan nama backup.
- Export sesuai filter aktif.
- Backup manual, list backup, cleanup, dan restore diuji hanya untuk role management.

---

## 17. Performance Requirements dan Batasan

### 17.1 Current Constraints

- SQLite cocok untuk pemakaian lokal/cabang ringan, tetapi terbatas untuk concurrent writes.
- `work_orders` dapat berisi 60K+ row.
- `customers` dapat berisi 10K+ row.
- Beberapa controller masih melakukan filter/grouping di memory.
- Frontend belum memakai virtualization untuk tabel besar.
- Frontend belum memakai route-level lazy loading.

### 17.2 Performance Requirements

- Query list harus memakai pagination server-side.
- Filter besar sebaiknya didorong ke database, bukan JS memory.
- Export besar harus diberi timeout cukup dan feedback UI.
- Import besar harus memakai transaction timeout sesuai modul.
- Data import harus dibersihkan/dedup sebelum insert.

### 17.3 Improvement Targets

- Refactor mechanic performance agar memakai aggregation/groupBy database.
- Refactor customer KPB filtering agar memakai Prisma where clause.
- Tambah pagination UI di halaman list.
- Tambah virtualization untuk tabel 10K+ bila dibutuhkan.
- Pertimbangkan PostgreSQL jika concurrent users/write meningkat.

---

## 18. Maintainability Requirements

Known technical debt:

- `showroomController.js` sangat besar dan berisi beberapa domain sekaligus.
- `web/src/services/api.js` monolith berisi semua endpoint.
- Role arrays didefinisikan inline di `App.jsx` dan terduplikasi dengan sidebar.
- Utility import/export/pagination masih banyak duplikasi.
- Beberapa component page besar: `Customers.jsx`, `Opname.jsx`, `ShowroomOpname.jsx`.

Target maintainability:

- Pecah controller showroom menjadi domain: stock, documents, pricing, programs, followups, KSU.
- Pecah API frontend menjadi module per domain.
- Ekstrak config role ke satu sumber kebenaran.
- Ekstrak utility Excel date, cleanup upload, pagination, dan export.
- Tambah middleware request validation seperti Zod/Joi bila dibutuhkan.
- Tambah error boundary frontend.

---

## 19. Security Improvement Backlog

Prioritas teknis dari review 2026-05-06:

| Prioritas | Task | Status Aktual |
|-----------|------|---------------|
| P0 | Fix login query agar tidak load semua user | Selesai |
| P0 | Hapus token dari query string | Selesai |
| P0 | Pindah JWT dari localStorage ke httpOnly cookie | Pending |
| P0 | Pecah `showroomController.js` | Pending |
| P0 | Extract role definitions shared | Pending |
| P1 | Split `api.js` frontend by domain | Pending |
| P1 | Rate limiting login/import/export | Pending |
| P1 | Tambah helmet security headers | Pending |
| P1 | Graceful shutdown Prisma | Pending |
| P2 | Tighten MIME type upload | Pending |
| P2 | Upload path absolute | Pending |

Security rules yang harus dijaga selama perubahan:

- Jangan mengembalikan password hash di response API.
- Jangan menerima token di query string.
- Jangan membuka endpoint backup/restore ke role selain Kepala Bengkel/Kepala Cabang.
- Jangan membuka STNK/BPKB mentah ke CRM.
- Jangan membuka Dashboard Bengkel ke Admin Showroom/CRM.

---

## 20. Deployment Lokal

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

Tidak perlu Docker untuk menjalankan sistem aktual. `docker-compose.yml` berisi PostgreSQL/Redis lama dan tidak menjadi dependency utama runtime SQLite.

---

## 21. Operational Requirements

- Backup manual perlu dibuat sebelum perubahan besar atau import besar.
- Jangan hapus file `api/prisma/dev.db` tanpa backup.
- Jangan jalankan destructive git/database command tanpa instruksi eksplisit.
- Import data harus menggunakan file sumber cabang DXK.
- Workshop harus memakai tarikan tahun berjalan, idealnya 1 Januari sampai hari ini.
- Admin harus cek preview import sebelum final.
- Setelah restore database, backend perlu dipastikan reconnect dan health check OK.
- Setelah perubahan schema, jalankan `npx prisma validate` dan `npx prisma generate`.

---

## 22. Compatibility Notes

- SQLite tidak mendukung Prisma `mode: 'insensitive'`.
- Login case-insensitive ditangani di backend.
- Redis optional.
- Upload DOCX mentah untuk harga memakai `textutil`, sehingga fitur ini bergantung pada macOS jika parsing memakai command tersebut.
- `application/octet-stream` sebagai MIME upload masih perlu ditinjau karena terlalu permisif.
- Path upload relatif masih perlu ditinjau agar tidak bergantung pada current working directory.

---

## 23. Definition of Done Teknis

Perubahan kode dianggap aman jika:

- `cd api && npx prisma validate` lulus.
- `cd api && npm test` lulus.
- `cd web && npm run lint` lulus.
- `cd web && npm run build` lulus.
- Backend `/health` return HTTP 200 setelah restart.
- Role access utama tetap sesuai matrix.
- Import preview/final domain terkait tetap berjalan.
- Backup dibuat untuk perubahan/import destruktif.
- Tidak ada regression pada login, dashboard, import, export, dan role guard.

---

## Addendum (2026-06-24) — sinkron sistem aktual

Detail teknis lengkap di `CLAUDE.md`, `AGENTS.md §15`, `ERD.md §4`. Ringkas:

- **Auth & sesi:** JWT 24h cookie httpOnly + **single-session** (1 akun = 1 sesi; login ke-2 ditolak `409` selama sesi aktif ≤60 mnt) + **idle auto-logout 60 menit** (frontend). Token bawa `sid`; `authenticate` tolak bila `sid` ≠ `users.session_id`. Enforcement OFF saat test (`ENFORCE_SINGLE_SESSION`).
- **Audit:** tabel `login_logs` (login_success/login_blocked/logout/session_reset + IP + user-agent). Endpoint IT Master: `GET /api/security/login-logs`, `GET /api/security/active-sessions`, `POST /api/security/users/:id/reset-session`. Halaman `/security-audit`.
- **Endpoint baru:** `GET /api/dashboard/freshness` (Kesegaran Data Import), `GET /api/public/stock-units` (cek ketersediaan unit publik — agregat + no.mesin/rangka/OTR; cost/HPP tidak dibocorkan).
- **Akses:** Manajemen User, Backup & Restore, Audit Login & Sesi = **IT Master saja**. Rate limit: login 20/15min, publik 60/15min, import 30/15min, umum 2000/15min (sudah terpasang).
- **DB & deploy:** `prisma migrate` rusak di setup ini (schema-engine error) → pakai **`prisma db push`** untuk terapkan schema (dev & prod). Backup terjadwal cron 02:00 WIB (`scripts/backup-db.js`, keep 14).
- **Font:** self-host `@fontsource` (bukan CDN) agar ekspor screenshot `html-to-image` konsisten.
- **Backlog keamanan** S1-S4 di `docs/rencana_perbaikan.md`.
