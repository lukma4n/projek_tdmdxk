# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`api/`)

```bash
cd api && npm run dev           # nodemon, port 3001
cd api && node src/app.js       # production start

cd api && npx prisma validate
cd api && npx prisma generate
cd api && npm run db:migrate     # prisma migrate dev
cd api && npm run db:seed

cd api && npm test               # node --test, runs tests/*.test.js (268 tests)
```

Test DB (`api/prisma/prisma/test.db`) is auto-synced via `pretest` (`prisma db push --accept-data-loss`). Do not commit it.

To use real data in tests: `cp api/prisma/dev.db api/prisma/prisma/test.db`.

### Frontend (`web/`)

```bash
cd web && npm run dev            # vite, port 5173 (proxy /api → :3001)
cd web && npm run lint
cd web && npm run build
```

### Verification sequence (run after changes)

```bash
cd api && npx prisma validate
cd api && npm test
cd web && npm run lint
cd web && npm run build
curl http://localhost:3001/health
```

## Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 19 + Tailwind CSS v4 + shadcn/ui + React Router + Zustand |
| Backend | Node.js + Express 5 + Prisma |
| Database | SQLite (`api/prisma/dev.db`) |
| Auth | JWT 24h stored as httpOnly cookie `token`; frontend uses `credentials: 'include'`. Single-session (1 akun = 1 sesi aktif, anti-sharing) + idle auto-logout 60 menit + audit login |

### Backend structure (`api/src/`)

- `app.js` — Express entry, route registration, static serve of `web/dist` in production
- `controllers/` — one file per domain (auth, workshop, hotline, stock, customers, opname, backup/sync, showroom variants, pickup requests)
- `routes/` — one file per domain, imported in `app.js`
- `middleware/auth.js` — reads `req.cookies?.token` then falls back to `Authorization: Bearer`. IT Master role bypasses all `authorize()` checks entirely
- `middleware/upload.js` — multer configs (pickup KTP photos → `uploads/pickup-ktp/`, max 10MB)
- `services/` — business logic extracted from controllers
- `utils/` — excel export helpers, SQLite-safe search, date utilities
- `config/` — env, redis, prisma client
- `prisma/schema.prisma` — all DB models; `prisma/migrations/` — ordered migration history
- `tests/` — `*.test.js` files using Node built-in test runner; `helpers.js` sets up test DB

### Frontend structure (`web/src/`)

- `App.jsx` — React Router tree, auth probe (`me()`), `RoleGuard` per route
- `pages/` — one file per screen
- `components/Layout/Sidebar.jsx` — dynamic menu from `role_permissions` API
- `services/api/` — module files (auth, dashboard, workshop, hotline, stock, customers, opname, showroom, security, etc.) + base `api.js`
- `config/roles.js` — role constants and frontend label map
- `stores/` — Zustand stores (auth, theme)
- `data/indonesiaAreaCodes.js` — 514 kab/kota for BBN area dropdown

### Auth flow

1. `POST /api/auth/login` sets httpOnly cookie `token`; **response body has no token**, only `user`
2. `GET /api/auth/me` — frontend probes on mount to restore session
3. Backend constant `JWT_COOKIE_NAME = 'token'` appears in both `authController.js` and `auth.js` middleware — update both if renamed

### Role system

DB value `IT Master` bypasses all `authorize()` middleware. All other roles are checked against the `role_permissions` table (dynamic, managed via `/roles` UI page). Backend returns `403` for unauthorized role. Frontend `RoleGuard` gates routes by `menuKey` or explicit `roles` array. **DB role values use spaces, not underscores** (single source: `web/src/config/roles.js`).

| DB value | UI label |
|---|---|
| `IT Master` | IT Master (superadmin, cannot be deleted) |
| `Kepala Bengkel` | Kepala Bengkel |
| `Kepala Cabang` | Kepala Cabang |
| `Frondesk` | Frondesk |
| `Service Advisor` | Service Advisor |
| `Partman` | Partman |
| `Admin` | Admin Showroom |
| `CRM` | Admin CRM |
| `PIC Stock opname` | PIC Stock Opname |
| `ADH` | ADH |
| `Salesman` | Salesman |

### Data import strategies

- **Replace All**: hotline, stock, workshop (data lama dihapus dulu)
- **Upsert**: sales/customers (`so_number`), showroom stock snapshot (unit/STNK/BPKB by engine number), master harga, master BBN, TAC matrix, program MD
- Importing stock also cascades delete of all active opname sessions and items (`qty_system` becomes invalid)
- Every destructive import auto-creates a pre-import SQLite backup in `api/prisma/backups/`

### Key gotchas

- **SQLite has no `mode: 'insensitive'`** — use raw SQL `LOWER()` or in-memory normalization. Login username is case-insensitive via workaround in auth controller.
- **Timezone bug**: never use `toISOString()` for local dates — use `getFullYear/getMonth/getDate` local methods.
- **`getUserMedia` (in-app camera)** requires HTTPS in production; `localhost` works in dev. Pickup KTP photos served only via auth-protected route, never as static files.
- **`requestPickup` controller order**: JWT token is verified **before** checking `req.file`. Do not reorder — tests depend on this (token invalid → 401 before file presence matters).
- **Pickup requests list shape**: `getPickupRequests` returns a **bare array** (not `{data: [...]}`). Frontend reads `res` directly, not `res.data`.
- **`apiLimiter`** is mounted at `app.use('/api/', apiLimiter)` (max 2000/15min). Login `authLimiter` 20/15min, public 60/15min, import 30/15min.
- **Express 5 strict routing**: static routes like `/opname/search-unit` must be declared **before** `:id` param routes.
- **Single-session enforcement** (`services/sessionService.js`): login sets `users.session_id` + `sid` in JWT; `authenticate` rejects token if `sid` ≠ current `session_id` (kicked/reset). 2nd login blocked (409) while session active (≤60 min since `session_last_active`). **Enforcement OFF in tests** (DATABASE_URL contains `test.db`); override via env `ENFORCE_SINGLE_SESSION=true|false`.
- **Self-hosted fonts** (`@fontsource/inter`, `@fontsource/jetbrains-mono` in `main.jsx`) — NOT Google Fonts CDN. Required so `html-to-image` screenshot export (Closing Daily reports) embeds fonts same-origin & renders consistently; `await document.fonts.ready` before `toPng`.
- **Prisma migrate is broken on this setup** (schema-engine "invalid characters" error). Apply schema changes with `npx prisma db push` (dev & production), not `migrate dev/deploy`. Migration folders kept for history only.
- **Every integration test MUST set `process.env.DATABASE_URL = 'file:./test.db'` before importing `helpers.js`.** `helpers.js` imports `src/app.js`, which loads `.env` (`DATABASE_URL=file:./dev.db`) on first import — too late to redirect afterwards. Skip it and the app queries **dev.db** (real working data) while `prismaTest` seeds **test.db**, so `loginAs()` fails with `401`. This exact bug hit `stckSalesLookup.integration.test.js` (fixed in `b1720b6`).
- **The convention above does not actually work the way it reads.** ES modules hoist and evaluate all static `import` statements before any of the importing file's own code runs, so `process.env.DATABASE_URL = 'file:./test.db'` written between two `import` lines does **not** execute before `helpers.js` is evaluated — the import of `helpers.js` (and everything it transitively imports, including `src/app.js`) runs first regardless of where that assignment sits in the source. Tests pass today anyway only because `tests/helpers.js` builds `prismaTest` with an **explicitly hardcoded** `datasources.db.url: 'file:./test.db'`, not by reading `process.env.DATABASE_URL`. That hardcoded URL is the real thing protecting test isolation. **Do not "fix" `helpers.js` to read `DATABASE_URL` from the environment** — doing so would silently break every integration test's isolation from `dev.db`, because the env-var-setting convention that looks like it's providing that isolation is not actually running in time to do so. (Found during Task 13 review of `feat/tanda-terima-digital`.)
- **Two separate print paths for Label Buku Service** — bulk print (CSS inline in `pages/ShowroomLabelBukuService.jsx`) and per-item preview modal (`components/common/ServiceBookLabel.jsx`). They duplicate the label CSS, so **a fix in one must be mirrored in the other** or the same sticker sheet prints inconsistently (this caused the truncated-address bug twice: `e3ded38`, then `6a7629f`).
- **Tahun pembuatan motor TIDAK ada di report mana pun** — diturunkan dari kode tahun VIN di `chassis_number` (`utils/vehicleIdentity.js`). Kolom `showroom_stnk_bpkb_tracks.tahun` adalah **tahun SO**, bukan tahun pembuatan.
- **Nama warna lengkap (`BK-BLACK`) hanya ada di import stok unit**, yang menghapus baris unit terjual tiap import. `harvestColorNames` memanennya ke `unit_color_names` sebelum `deleteMany` — jangan pindahkan urutannya.
- **Jangan pernah membuka `dev.db` produksi dengan koneksi SQLite write-capable dari proses lain** — termasuk `sqlite3 prisma/dev.db "SELECT ..."` yang terlihat baca-saja. Saat proses itu ditutup, SQLite melakukan checkpoint lalu **menghapus `dev.db-wal` dan `dev.db-shm`**, sementara proses `dxk-api` masih memegang handle ke berkas yang sudah terhapus. Semua query berikutnya gagal `SQLITE_IOERR 522 "disk I/O error"` dan **seluruh user tidak bisa login** (kejadian 31 Agustus 2026). Untuk inspeksi manual pakai `sqlite3 -readonly`. Pemulihannya: salin WAL yang menggantung dari `/proc/<pid>/fd/<n>` **sebelum** restart — restart mentah melenyapkannya.
- **Backup memakai koneksi read-only + `VACUUM INTO`** (`copyDatabaseSnapshot` di `services/backupService.js`), bukan `wal_checkpoint` + `copyFile`. Koneksi read-only tidak pernah menghapus `-wal`/`-shm`, dan `VACUUM INTO` sudah menghasilkan snapshot konsisten termasuk isi WAL. Jangan kembalikan ke pola checkpoint-lalu-salin, dan jangan bungkus kegagalannya dengan `.catch(() => {})` — dulu backup rusak terlihat sukses.
- **Nomor tanda terima diterbitkan di dalam transaksi interaktif** (`addHandoverStep`), sementara **PDF disusun setelah commit**. Menulis berkas di dalam transaksi menahan kunci tulis SQLite selama I/O disk.

- **Laporan tim penjualan memakai susunan tim per bulan** (`showroom_team_assignments`, `services/teamStructureService.js`): Kapos → TL → Sales, plus sales INDEPENDEN. Tiap transaksi dipetakan dengan susunan **bulan `so_date`-nya**; bulan tanpa susunan mewarisi bulan terakhir sebelumnya. `showroom_salespeople.team_leader` tidak lagi dipakai laporan — jangan kembalikan pengelompokan ke master, karena itu menulis ulang laporan bulan lalu setiap ada mutasi. Target (`showroom_marketing_targets.team_leader`) dipegang TL atau INDEPENDEN; target Pos dihitung, tidak disimpan. Data awal diisi `api/scripts/seed-team-structure.js` (idempoten).

### Major features (on `main`, current)

FASE 2 (pickup-request flow) is **merged to main**; branch `feat/fase2-pickup-request` deleted. Current notable features:
- **Public pages (no login):** `/cek` (consumer STNK/BPKB self-check → pickup-request with mandatory KTP photo, `pickup_token` 15min one-time JWT) and `/cek-unit` (stock unit availability for sales: per-model/color, no.mesin/rangka + OTR shown intentionally, FIFO aging + tag + kode unit, location filter; cost/HPP never exposed).
- **Kesegaran Data Import:** dedicated page `/data-freshness` + menu (menuKey `DATA_FRESHNESS`; roles Kepala Cabang/Kepala Bengkel/Admin). Endpoint `GET /api/dashboard/freshness`.
- **Security:** single-session anti-sharing, idle auto-logout 60 min, login audit. Page `/security-audit` (IT Master only): active sessions + login history + force-reset session. Endpoints under `/api/security/*`. Table `login_logs`; `users.session_id`/`session_last_active`.
- **Tanda terima digital STNK/BPKB** (merged from `feat/tanda-terima-digital`, branch deleted; live in production): system-issued receipt number (`TT-STNK/...`, `TT-BPKB/...`), two on-device signatures (officer + receiver), archived PDF with SHA-256 hash. Extends the existing `serah_ke_konsumen`/`ekspedisi_ke_konsumen` handover steps rather than adding a new flow.
- **Ops:** daily backup via cron 02:00 WIB (`api/scripts/backup-db.js`, keep 14) — archives the database **and** `api/uploads/` (same 14-day retention).
- 268 tests. Production: VPS tdmketapang.net, PM2 + Nginx, deploy from `main`.

## Documentation map

| File | Purpose |
|---|---|
| `README.md` | Quick start, env vars, login credentials, API endpoints, troubleshooting |
| `AGENTS.md` | Concise dev context: gotchas, migration history, P1 backlog |
| `docs/PRD.md` | Product requirements, scope, role roadmap |
| `docs/BLUEPRINT.md` | Architecture, data flow, operational workflow, design principles |
| `docs/ERD.md` | Database entities, relations, Mermaid ERD |
| `docs/FSD.md` | Feature specs per module, acceptance criteria |
| `docs/TRD.md` | Technical specs, API, security, import, backup |
| `docs/rencana_perbaikan.md` | P1/P2 backlog, risks, review findings |
| `lastsesion.md` | Last session handoff notes (current branch state) |
