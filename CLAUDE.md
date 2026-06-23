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

cd api && npm test               # node --test, runs tests/*.test.js (55 pass)
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
| Auth | JWT 24h stored as httpOnly cookie `token`; frontend uses `credentials: 'include'` |

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
- `services/api/` — 10 module files (auth, workshop, hotline, stock, customers, opname, showroom, etc.) + base `api.js`
- `config/roles.js` — role constants and frontend label map
- `stores/` — Zustand stores (auth, theme)
- `data/indonesiaAreaCodes.js` — 514 kab/kota for BBN area dropdown

### Auth flow

1. `POST /api/auth/login` sets httpOnly cookie `token`; **response body has no token**, only `user`
2. `GET /api/auth/me` — frontend probes on mount to restore session
3. Backend constant `JWT_COOKIE_NAME = 'token'` appears in both `authController.js` and `auth.js` middleware — update both if renamed

### Role system

DB value `IT_Master` bypasses all `authorize()` middleware. All other roles are checked against the `role_permissions` table (dynamic, managed via `/roles` UI page). Backend returns `403` for unauthorized role. Frontend `RoleGuard` gates routes by `menuKey` or explicit `roles` array.

| DB value | UI label |
|---|---|
| `IT_Master` | IT Master (superadmin, cannot be deleted) |
| `Kepala_Bengkel` | Kepala Bengkel |
| `Kepala_Cabang` | Kepala Cabang |
| `Frondesk` | Frondesk |
| `Service_Advisor` | Service Advisor |
| `Partman` | Partman |
| `Admin` | Admin Showroom |
| `CRM` | Admin CRM |
| `PIC_StockOpname` | PIC Stock Opname |
| `ADH` | ADH |

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
- **`apiLimiter`** is defined in `app.js` but not yet mounted (P1 backlog #20).
- **Express 5 strict routing**: static routes like `/opname/search-unit` must be declared **before** `:id` param routes (P1 backlog #18).

### Active branch context (as of 2026-06-22)

Branch `feat/fase2-pickup-request` adds the consumer pickup-request flow on top of `main`:
- `/cek` page: consumer verifies identity → receives `pickup_token` (15min JWT) → submits pickup request with mandatory KTP photo (camera or file picker)
- Backend: `showroom_pickup_requests` table, upload middleware, auth-protected KTP serve route
- Staff page: `ShowroomPickupRequests.jsx` — filter, status update, view KTP
- 55 tests pass. Branch is **not yet merged to main**.

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
