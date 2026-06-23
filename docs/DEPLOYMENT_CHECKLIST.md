# Deployment Checklist — Go-Live

Checklist operasional sebelum & sesudah deploy ke production. Disusun 2026-06-23
(branch `feat/fase2-pickup-request`). Fungsionalitas, test (55 pass), dan keamanan
inti sudah siap — sisa pekerjaan mayoritas operasional.

## 1. Prasyarat (WAJIB sebelum go-live)

- [ ] **HTTPS aktif** — kamera in-app (`getUserMedia`) untuk foto KTP **tidak jalan**
      tanpa HTTPS di production (hanya `localhost` yang dikecualikan browser).
      Pasang reverse proxy (Nginx) + Let's Encrypt/ACME.
- [ ] **`JWT_SECRET` produksi** — secret acak kuat (≥ 32 byte), **bukan** nilai default
      dev. Wajib sama di semua instance. Rotasi = semua sesi logout.
- [ ] **`NODE_ENV=production`** — memastikan `errorHandler` tidak membocorkan
      `debug`/stack ke klien, cookie `secure`, dll.
- [ ] **Git bersih** — pastikan `api/src/utils/excelValidator.js` ter-commit
      (dipakai 6+ controller; deploy dari git tanpa file ini akan crash).
- [ ] **Migrasi diterapkan** — `npx prisma migrate deploy` di server (bukan
      `migrate dev`). Schema sudah valid & lengkap (baseline + pickup).

## 2. Data & Penyimpanan

- [ ] **Backup DB terjadwal** — pasang cron harian:
      ```
      0 2 * * * cd /path/projek_tdmdxk/api && /usr/bin/node scripts/backup-db.js 14 >> /var/log/tdmdxk-backup.log 2>&1
      ```
      atau manual: `cd api && npm run backup`. Retensi default 14 backup terbaru.
- [ ] **Folder `uploads/` ikut di-backup** — berisi foto KTP (data pribadi) &
      lampiran serah-terima. Tidak masuk DB; backup terpisah (rsync/snapshot disk).
- [ ] **Verifikasi restore** — tes `restoreDatabaseBackup` minimal sekali di staging
      (sudah ada integrity_check sebelum swap).
- [ ] **Izin folder** — `uploads/pickup-ktp/` & `prisma/backups/` writable oleh
      user proses Node, tidak world-readable (KTP = sensitif).

## 3. Deploy

- [ ] `cd web && npm run build` → `web/dist` (di-serve statis oleh Express di prod).
- [ ] `cd api && npm ci --omit=dev` lalu `npx prisma generate`.
- [ ] PM2: `instances: 1` (lihat `ecosystem.config.js` — SQLite single-writer +
      rate limiter in-memory; jangan cluster tanpa pindah ke Redis).
- [ ] Smoke test: `curl https://<domain>/health` → 200.
- [ ] Login IT_Master → buka `/cek` (HTTPS) → uji kamera KTP → submit pickup
      request → muncul di halaman staf "Permintaan Ambil Dokumen".

## 4. Verifikasi pasca-deploy

- [ ] Foto KTP hanya bisa diakses via route auth-protected
      (`/api/showroom/pickup-requests/:id/ktp`), bukan sebagai file statis.
- [ ] Cookie `token` httpOnly + `secure` (cek di DevTools).
- [ ] Rate limiter publik aktif di `/api/public/*` (uji >60 request/15 menit).

## 5. Backlog pasca-launch (tidak memblokir)

- [ ] Proteksi replay `pickup_token` (one-time-use/nonce) — dampak rendah.
- [ ] Audit log aksi `IT_Master`.
- [ ] Kuota upload per-user/hari (mitigasi disk penuh).
- [ ] Sinkronkan README.md / AGENTS.md (role akses Backup & User = IT_Master only;
      angka rate limiter aktual 2000/15min).
