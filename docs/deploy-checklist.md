# Checklist Deploy Produksi — DXK Operation System

DB resmi: **SQLite** (single-site). Lihat `api/prisma/MIGRATION_ALIGNMENT.md` & `docs/rencana_perbaikan.md`.

## 1. Environment (`api/.env`)
Salin `api/.env.production.example` → `api/.env`, isi nilai nyata:
- [ ] `JWT_SECRET` = hasil `openssl rand -hex 32` (bukan placeholder).
- [ ] `NODE_ENV=production`.
- [ ] `ALLOWED_ORIGINS` & `FRONTEND_URL` = domain frontend asli (HTTPS).
- [ ] `DATABASE_URL` path absolut yang ter-backup (mis. `file:/var/lib/dxk/dev.db`).
- [ ] `REDIS_URL` mengarah ke Redis aktif (`docker compose up -d redis`).

## 2. Database
- [ ] `cd api && npx prisma migrate deploy` → semua tabel terbentuk (baseline tunggal).
- [ ] `npx prisma migrate status` → "up to date".
- [ ] Seed user awal IT Master bila DB baru (`node scripts/create_it_master.js`).
- [ ] Konfirmasi WAL aktif: log start menampilkan "SQLite connected" (PRAGMA WAL otomatis di `config/db.js`).

## 3. Build & Run
- [ ] `cd api && npm ci && npm test` → 34/34 pass.
- [ ] `cd web && npm ci && npm run build` → sukses.
- [ ] Jalankan API di belakang reverse proxy (nginx) — `app.set('trust proxy', 1)` sudah diset, pastikan nginx kirim `X-Forwarded-Proto`.
- [ ] Serve build `web/dist` (oleh nginx atau static server API).

## 4. Smoke test (manual, per role)
- [ ] Login tiap role → menu sesuai RBAC.
- [ ] Akses URL terlarang per role → 403 / redirect.
- [ ] Backup & Manajemen User → hanya IT Master 200, role lain 403.
- [ ] Import stock file kosong → 400 (bukan menghapus tabel).
- [ ] Import stock valid → data masuk + backup `dev.db.backup.*` terbentuk.
- [ ] Hapus user yang punya handover → sukses (bukan 500).
- [ ] Restore backup berhasil mengembalikan DB.

## 5. Backup berkelanjutan
- [ ] Jadwalkan backup berkala file `dev.db` (cron `cp` + `PRAGMA wal_checkpoint` sudah ditangani in-app saat backup manual).
- [ ] Simpan salinan off-server.

## Catatan keamanan
- `apiLimiter`, `helmet`, cookie `secure` (via `trust proxy`) sudah aktif.
- Pagination dibatasi `clampLimit` (maks 5000 baris/req) — cegah abuse `?limit` ekstrem.
