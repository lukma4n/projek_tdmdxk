# Rencana Perbaikan — DXK Operation System

**Tanggal Review:** 21 Juni 2026
**Cakupan:** Diff belum commit (6662 baris, 51 file) vs `origin/main` (HEAD == origin/main).
**Reviewer:** Code Review Agent (8 sudut pandang finder + 5-batch verify, recall-biased)
**Status:** Review selesai. Perbaikan belum diterapkan. Catatan ini dibuat agar agent berikutnya melanjutkan tanpa membaca ulang seluruh diff.

---

## Keputusan yang Sudah Disepakati (bukan bug)

| # | Keputusan | Catatan |
|---|-----------|--------|
| K1 | Akses **Backup & Restore** dan **Manajemen User** dipersempit ke **IT Master** saja. | Disepakati tim. `syncRoutes.js:21` `backupAccess=authorize('IT Master')`, `userRoutes.js:14` `userAdminAccess=authorize('IT Master')`. Bukan regresi — jangan dibuka kembali. **Dokumen (README.md, AGENTS.md) masih stale** dan menyebut Kepala Bengkel/Kepala Cabang → lihat backlog D1. |
| K2 | Import workshop/hotline tidak lagi purge `deleteMany`, diganti upsert by `wo_number`/`no_hotline`. | Commit `fc5dec3` intentional. |
| K3 | IT Master tidak dapat dihapus (validasi backend `userController.js`). | Sesuai AGENTS.md §14. |

---

## Status Perbaikan (update 21 Juni 2026)

| # | Status | Catatan |
|---|--------|--------|
| #1 | ✅ SELESAI | DB diputuskan tetap **SQLite** (single-site). Chain migrasi di-reset jadi 1 baseline tunggal `20260621000000_baseline_current_schema` (Strategi A); 6 migrasi lama diarsip ke `prisma/migrations_archive/pre_baseline_20260621/`. Diuji `migrate deploy` di DB kosong → sukses (40 tabel, schema valid); `dev.db` existing di-`resolve --applied`. SQLite di-harden WAL + `docker-compose` dibersihkan (hapus Postgres/pgAdmin). |
| #2 | ✅ SELESAI | Guard `if(!validRecords.length)` throw 400 sebelum backup/deleteMany — `syncController.js`. |
| #3 | ✅ SELESAI | `deleteUser` hapus `document_handover_steps` (performed_by) + `document_handovers` (created_by) — `userController.js`. |
| #4 | ✅ SELESAI | Ownership check Salesman ditambah di `updateDocumentHandover`. |
| #5 | ✅ SELESAI | Dead branch `handover.track_id`/`status` dihapus, transaksi disederhanakan (cascade onDelete). |
| #6 | ✅ SELESAI | `created_by: req.user?.userId` — `workshopReportController.js`. |
| #7 | ✅ SELESAI | `salesman` tidak lagi dari `partner_name`; di-set `null` (admin pilih via getHandoverSalespeople). |
| #8 | ✅ SELESAI | `minLength={8}` + placeholder di `Users.jsx:181,290`. |
| #10 | ✅ SELESAI | `app.set('trust proxy', 1)` di `app.js`. |

Verifikasi: `npm test` 34/34 pass, `web npm run build` sukses (lint error pre-existing, tidak terkait perubahan ini).

**Lanjutan (sesi 21 Juni):** Backlog **#22 SELESAI** — cap pagination via helper `api/src/utils/pagination.js` (`clampLimit`, maks 5000) diterapkan ke 14 endпoint; cegah `?limit` ekstrem tanpa merusak view besar yang sah (BBN 2000, margin 1000). DB SQLite di-harden (WAL) + baseline migrasi tunggal (#1). Ditambah `api/.env.production.example` & `docs/deploy-checklist.md` untuk hardening env produksi. Sisa: #9/T1-T11 (selain T11 catat), backlog P1 lain, D1 dokumen.

---

## Temuan Utama (diurutkan dari paling berat)

> Verdict: CONFIRMED = bug pasti dari kode; PLAUSIBLE = realistis terjangkau, perlu runtime/state tertentu.

### #1 — Migrasi tabel baru belum dibuat (deploy akan gagal/break)
- **File:** `api/prisma/schema.prisma` (model `workshop_marketing_targets` ~:889, `role_permissions` ~:911, `document_handovers` ~:922-947, `document_handover_steps` ~:949)
- **Verdict:** CONFIRMED
- **Skenario:** Schema punya tabel baru, tapi migrasi terakhir `20260612021618_add_showroom_marketing_targets` dan `20260616140000_add_showroom_team_leaders` tidak membuat tabel di atas. Saat `prisma migrate deploy` di lingkungan baru (atau DB bersih), Prisma client mengakses tabel yang tidak ada → runtime `P2021` (table does not exist) di endpoint manapun yang menyentuh role_permissions / document_handovers / workshop_marketing_targets.
- **Saran:** Buat migrasi `add_rbac_document_handover_targets` yang mendefinisikan keempat tabel + FK. Jalankan `npx prisma migrate dev --name ...` lalu verifikasi `migrations/` terbentuk. Alternatif cepat (dev only): `npx prisma db push`, tapi ini tidak menghasilkan file migrasi → tidak aman untuk deploy.

### #2 — Import stock kosong menghapus seluruh tabel `stock_parts`
- **File:** `api/src/controllers/syncController.js:86-106`
- **Verdict:** CONFIRMED
- **Skenario:** `uploadStock` membangun `activeProductCodes = validRecords.map(r=>r.product_code).filter(Boolean)`, lalu `tx.stock_parts.deleteMany({where:{product_code:{notIn:activeProductCodes}}})` (96-98) dan `tx.opname_items.deleteMany(... notIn ...)` (101-106). Bila file Excel berisi 0 baris valid (header saja / salah format lewat validasi kolom), `activeProductCodes = []` → `notIn:[]` di Prisma = hapus SEMUA baris. Tidak ada guard `if(!validRecords.length) return`.
- **Saran:** Tambah guard awal: `if(!validRecords.length) return res.status(400).json({error:'File tidak berisi data valid'})`. Pisah path "kosong" dari path "replace all".

### #3 — `deleteUser` 500 FK saat user punya document_handovers/_steps
- **File:** `api/src/controllers/userController.js:197-252`
- **Verdict:** CONFIRMED
- **Skenario:** Cascade delete (222-245) men-SET-NULL dan deleteMany banyak tabel, tetapi **tidak menyentuh** `document_handovers` (FK `created_by` required, no onDelete) maupun `document_handover_steps` (FK `performed_by` required, no onDelete). Menghapus user yang pernah membuat handover/step → Prisma `P2003` FK constraint → 500.
- **Saran:** Sebelum `tx.users.delete`, tangani `document_handovers` dan `document_handover_steps`: SET-NULL bila kolom dibuat nullable, atau reassign ke user IT_Master/system, atau soft-delete user (tandai `deleted_at`). Pilih sesuai kebijakan audit (handover = dokumen, sebaiknya jangan hilangkan author).

### #4 — `updateDocumentHandover` tidak cek ownership (Salesman bisa edit handover orang lain)
- **File:** `api/src/controllers/documentHandoverController.js:403-426`; route `showroomRoutes.js:251`
- **Verdict:** CONFIRMED
- **Skenario:** Route `PUT /document-handovers/:id` = `authenticate, handoverWriteAccess (authorize Admin,Salesman), updateDocumentHandover`. Controller hanya `findUnique` existence check, tidak cek `salesman_name === req.user.name`. Bandingkan `addHandoverStep:285-288` yang PUNYA ownership check untuk Salesman. Salesman A bisa PUT handover milik Salesman B.
- **Saran:** Pindahkan ownership check yang sama ke `updateDocumentHandover` (untuk role Salesman, bandingkan `handover.salesman_name.toLowerCase()` vs `req.user.name.toLowerCase()`).

### #5 — Dead branch + field tidak ada → 500 saat handover selesai
- **File:** `api/src/controllers/documentHandoverController.js:440`
- **Verdict:** CONFIRMED
- **Skenario:** `if (handover.track_id) { ... tx.showroom_stnk_bpkb_tracks.update({data:{status:'Tersedia'}}) ... }`. Di schema `showroom_stnk_bpkb_tracks` tidak ada `track_id` (dead branch — kondisi selalu false) dan tidak ada kolom `status` (lapangan sebenarnya `stnk_status`/`bpkb_status`). Bila `track_id` somehow terisi (data lama/manual), `update` menulis field `status` → `P2009`/validation error → 500.
- **Saran:** Hapus dead branch, atau perbaiki: pakai FK aktual + `stnk_status`/`bpkb_status`. Verifikasi maksud bisnis (reset status track saat handover selesai?).

### #6 — `workshopReportController` tulis `created_by: req.user?.id` (selalu null)
- **File:** `api/src/controllers/workshopReportController.js:35`
- **Verdict:** CONFIRMED
- **Skenario:** Middleware `auth.js:31` set `req.user = {userId: user.id, role, name}` (bukan `id`). Controller baca `req.user?.id` → `undefined`. Schema `created_by Int?` menerima null → baris tersimpan tanpa author secara diam-diam. Tidak crash, tapi audit trail patah.
- **Saran:** Ganti ke `req.user?.userId`. Sesuaikan konvensi AGENTS.md §6 (`req.user.userId`, bukan `id`).

### #7 — `salesman` diambil dari `track.partner_name` (partner = leasing, bukan salesman)
- **File:** `api/src/controllers/documentHandoverController.js:205`
- **Verdict:** CONFIRMED
- **Skenario:** `salesman: track.partner_name` — `partner_name` di `showroom_stnk_bpkb_tracks` adalah finance/leasing company, bukan nama salesman. UI/report handover menampilkan nama leasing pada kolom salesman.
- **Saran:** Tarik salesman dari sumber benar (sales order / `salesman_name` di track bila ada, atau join `showroom_salespeople`).

### #8 — `userController.resetPassword` / validate masihboleh minLength 6 di frontend (aturan min 8)
- **File:** `web/src/pages/Users.jsx:181` (create input `minLength={6}`), `:290` (reset input `minLength={6}`)
- **Verdict:** CONFIRMED
- **Skenario:** AGENTS.md P1 #22 + `validate.js:31` (`z.string().min(8)`) + `userController.js:259` (`password.length<8`) menetapkan min 8. Frontend input `minLength={6}` → browser mengizinkan 6-7 char, dikirim, lalu backend tolak 400. Inkonsistensi UX.
- **Saran:** Ubah kedua `minLength` frontend ke `8`. Sinkron dengan aturan global.

### #9 — Tiga query berurutan di dashboard controller (sekuen, bisa paralel)
- **File:** `api/src/controllers/workshopReportDashboardController.js:216,220,224` (juga `:195-259` dead code `renderBranch`)
- **Verdict:** PLAUSIBLE (efisiensi, bukan crash)
- **Skenario:** Tiga `findMany`/`findFirst` independen dijalankan sekuen. Demikian juga `workshopReportController.js:79,86` dua `groupBy` sekuen. Untuk load dashboard cabang, ini menambah latency hold-time.
- **Saran:** Bungkus dengan `Promise.all`. Catatan: transaksi interaktif Prisma pakai 1 koneksi seri, jadi `Promise.all` di dalam `$transaction` tidak benar-benar paralel — gunakan `prisma.$queryRaw` paralel atau keluarkan dari transaksi bila tidak butuh konsistensi. Prioritas rendah.

### #10 — `isSecureCookie` andalkan `x-forwarded-proto` tanpa `trust proxy`
- **File:** `api/src/controllers/authController.js:10`; `api/src/app.js` (tidak ada `app.set('trust proxy')`)
- **Verdict:** PLAUSIBLE
- **Skenario:** `isSecureCookie` return true bila `req.protocol==='https'` atau `x-forwarded-proto==='https'`. Tanpa `app.set('trust proxy', ...)`, Express tidak mempercayai header proxy → `req.protocol` tetap `http` walau di belakang TLS terminator, dan `x-forwarded-proto` bisa dipalsukan client langsung. Risiko: cookie `secure:false` di production HTTPS (lemah), atau `secure:true` spoof di HTTP (cookie tidak terkirim).
- **Saran:** Set `app.set('trust proxy', 1)` (atau sesuai hop proxy) di `app.js` sebelum route. Konfirmasi topologi deploy (PM2 + nginx? lihat `ecosystem.config.js`).

---

## Temuan Tambahan (terpotong cap 10 di laporan utama)

| # | File:Line | Ringkas | Verdict |
|---|-----------|---------|---------|
| T1 | `api/src/controllers/documentHandoverController.js:440` | `track_id` tidak ada di schema (sama dengan #5, duplikat sebagian) | CONFIRMED |
| T2 | `api/src/controllers/userController.js:222-229` | 8 `updateMany` SET-NULL sekuen dalam transaksi — hold-time panjang | PLAUSIBLE (efisiensi) |
| T3 | `api/src/app.js:77-78` | `ALLOWED_ORIGINS` tidak diset di `.env`, cors hanya default localhost | PLAUSIBLE (konfigurasi) |
| T4 | `api/src/app.js:73` | `apiLimiter` dipasang sebelum `cors`/`json`/`urlencoded` — urutan middleware perlu verifikasi vs AGENTS.md P1 #20 | PLAUSIBLE |
| T5 | `web/src/pages/ShowroomClosingDaily.jsx:498,512,529,546` & `ShowroomSalesAnalysis.jsx:324,425` | Emoji di JSX label (🔍💳👥👤🎉💡) — konvensi ASCII AGENTS.md §1? (emoji = non-ASCII, perlu keputusan) | PLAUSIBLE (konvensi) |
| T6 | `api/src/controllers/opnameController.js:5` vs `showroomOpnameController.js:9` | Dua array `OPEN_IMPORT_BLOCK_STATUSES` paralel — risiko drift | PLAUSIBLE (DRY) |
| T7 | `api/src/controllers/opnameController.js:398` | Path-traversal guard `path.resolve(...).startsWith(uploadDir)` bandaid | PLAUSIBLE (altitude) |
| T8 | `api/src/controllers/showroomStnkBpkbTrackController.js:155-163` & `:429-437` | Klausa search OR 5-field duplikat di dua tempat | PLAUSIBLE (DRY) |
| T9 | `api/prisma/schema.prisma` FK `document_handovers.created_by`, `_steps.performed_by`, `audit_logs.user_id` | Required FK tanpa `onDelete` → cascade tergantung default Prisma (Restrict) | CONFIRMED (terkait #3) |
| T10 | `api/scripts/create_it_master.js` | Hanya upsert 1 user `itmaster`, tidak ada role migration/seed role_permissions | PLAUSIBLE (setup) |
| T11 | `api/src/services/importLockService.js:58-60` | `deleteMany` expired lock pakai `.catch(()=>{})` menelan error | PLAUSIBLE (error swallow) |

---

## Backlog P1 (quick win, sumber AGENTS.md §12)

- **#18** Route statis `/opname/search-unit` & `/opname/notifications` deklarasikan **sebelum** route `:id` (Express 5 strict routing).
- **#19** Daftarkan `pdfjs-dist` ke `api/package.json`.
- **#20** Pasang `apiLimiter` di `app.use('/api/', apiLimiter)` setelah middleware lain. (Verifikasi status: `app.js:73` sudah `app.use('/api/', apiLimiter)` — kemungkinan sudah done, konfirmasi lalu tutup item.)
- **#21** Ganti `fs.unlinkSync` ke `unlink` async.
- **#22** `Math.min(parseInt(limit) || 50, 100)` di endpoint pagination `?limit=`.
- **#23** Hapus 9 folder kosong `web/src/services/*.js/`.
- **#24** Fix `themeStore.js` — `localStorage` di module scope → pindah ke hook/lazy initializer.

---

## Backlog Keamanan (S) — direncanakan (24 Juni 2026)

Konteks: review keamanan 24 Jun 2026. Postur saat ini sudah solid (auth httpOnly+bcrypt,
RBAC, helmet/CORS/rate-limit, HTTPS, idle-logout 60 mnt, single-session anti-sharing,
audit login, backup harian). Item di bawah adalah sisa celah.

**Ditunda atas keputusan pemilik (accepted risk — JANGAN diangkat lagi sebagai bug):**
- Halaman publik `/cek-unit` **sengaja** menampilkan no. mesin/rangka + OTR (bantu sales).
  Rem: rate-limit publik 60/15mnt. Cost/HPP tetap tidak pernah dibocorkan.
- Belum ada **kebijakan password / penguncian akun** setelah N gagal login
  (hanya `authLimiter` 20/15mnt).
- Belum ada **2FA**.

**Direncanakan (belum dikerjakan):**
- **S1** Sesi/cookie JWT 24 jam → pertimbangkan perpendek + refresh-token rotation.
  Risiko: cookie dicuri valid ≤24 jam (sudah dipersempit oleh single-session).
- **S2** **Backup off-site** — backup harian (cron 02:00) masih satu disk dengan DB;
  belum aman dari kerusakan disk/server total. Salin ke luar server (object storage /
  unduh terjadwal). Skrip: `api/scripts/backup-db.js`.
- **S3** **Perluas audit perubahan data** — saat ini terekam: login (`login_logs`) + aksi
  IT Master (`audit_logs`). Tambah cakupan perubahan data sensitif (edit harga, hapus,
  override status).
- **S4** **Higiene** — `npm audit` rutin (kerentanan dependency), monitoring/alert dasar,
  pastikan password VPS sudah diganti (pernah ter-paste di chat saat setup awal).

---

## Backlog Dokumen (D)

- **D1** Sinkronkan README.md + AGENTS.md ke keputusan K1 (Backup & User Management = IT Master saja):
  - `README.md:120-121` (role table: Kepala Cabang/Kepala Bengkel masih list Backup & User Mgmt).
  - `README.md:219-223` (backup endpoint "hanya Kepala Bengkel dan Kepala Cabang").
  - `README.md:234` (users "hanya IT Master, Kepala Bengkel, Kepala Cabang").
  - `AGENTS.md:58-59` (role table Kepala_Cabang/Kepala_Bengkel "manajemen user, backup/restore").
  - `AGENTS.md:101-103` (komentar backup "Kepala Bengkel/Cabang only").
  - `AGENTS.md:120` (`apiLimiter max 500/15min` vs aktual `app.js:58 max:2000` — update angka).

---

## Urutan Rekomendasi Pengerjaan

1. **#1 migrasi** (blok deploy) + **#2 guard stock kosong** (data loss) + **#3 deleteUser FK** (500) — tiga blocker.
2. **#4, #5, #6, #7** — bug logika handover/report, satu PR.
3. **#8** — sinkronisasi minLength password, trivial.
4. **#10 trust proxy** — konfirmasi topologi deploy dulu.
5. **#9, T2, T6, T8** — efisiensi/DRY, prioritas rendah.
6. **D1** — update dokumen setelah kode stabil.

## Verifikasi Setelah Perbaikan

- `cd api && npx prisma validate && npx prisma migrate dev --name <desc>` lalu `npm test` (7 file, target 26/26 pass + `publicCheck.integration.test.js` baru).
- `cd web && npm run lint && npm run build`.
- Login tiap role, cek menu + akses URL terlarang → redirect/403.
- Endpoint backup/users: hanya IT Master 200, lainnya 403.
- Import stock file kosong → 400 (bukan hapus tabel).
- Hapus user yang punya handover → sukses (bukan 500).