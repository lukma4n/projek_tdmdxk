# Catatan Sesi Terakhir — DXK Operation System

Tanggal: 2026-06-22 (sesi lanjutan: FASE 2 self-check pickup request + revisi KTP + kamera in-app)
Branch: `feat/fase2-pickup-request` (semua perubahan sesi ini **sudah di-commit**, BELUM di-push / belum di-merge ke `main`).
Status: **lint 0 error** (1 warning pre-existing), **build sukses**, **API test 55 pass / 0 fail** (39 lama + 16 alur pickup).

> Untuk melanjutkan: `claude --resume` / `--continue` sudah cukup — tidak butuh file handoff tambahan. File ini hanya catatan konteks.

---

## 1. Ringkasan commit sesi FASE 2 (lama → baru, branch `feat/fase2-pickup-request`)

| Commit | Isi |
|---|---|
| `eeb5ce7` | feat(public): **FASE 2 self-check** — pickup request via token + manajemen staf + notifikasi |
| `3c9022e` | fix(notifications): IT Master ikut feed notifikasi pickup request |
| `62def67` | fix(pickup): halaman staf tak menampilkan data — salah baca shape response (baca `res` langsung, bukan `res.data`) |
| `4bd2321` | feat(public): **wajib lampirkan foto KTP** saat ajukan ambil dokumen |
| `bca9683` | feat(public): pemilih tanggal & jam untuk waktu preferensi pengambilan |
| `87271f8` | feat(public): opsi terpisah **Ambil Foto & Pilih File** untuk KTP |
| `5d45769` | feat(public): **kamera in-app (getUserMedia)** untuk foto KTP langsung |

Commit sesi-sesi sebelumnya (design-system, rotasi JWT, landing 2-pintu, kartu self-check, fallback rangka, WA dinamis, dsb.) ada di histori `main` — lihat `git log --oneline`. Histori git pernah ditulis ulang (force-push) untuk menghapus JWT secret lama; backup bundle lokal di `/tmp/dxk-backup-*.bundle` (sementara).

---

## 2. Fitur "Self-Check STNK & BPKB" konsumen (selesai)

Alur: **scan QR kartu / klik link WA → `/cek?engine_number=...` (No. Mesin terisi) → isi No. HP atau 4 digit rangka → lihat status**.

- **Landing `/`** untuk guest = 2 pintu (Cek Dokumen / Area Karyawan). User login → app shell. Restore sesi diangkat ke level App (probe `me()` tanpa redirect).
- **`/cek`** (alias pendek) — prefill No. Mesin dari URL, tombol "Salin Link".
- **Verifikasi** = `No. Mesin + (No. HP [6 digit akhir] ATAU 4 digit terakhir No. Rangka)`. Rangka = fallback bila HP konsumen sudah berganti.
- **Masking DIHAPUS** — response publik tampil data penuh (nama, rangka, no dokumen). *(Lihat catatan keamanan §4.)*
- **Kartu Self-Check** (`SelfCheckCard.jsx`) 85×55mm, QR + URL + No. Mesin; cetak per-baris / massal dari halaman **Document Follow-up**.
- **Tombol "Request via WhatsApp"** di banner "Dokumen Siap Diambil" → `wa.me/<dealer>` template dinamis (daftar dokumen real).
- **Pengecualian BPKB leasing**: `finance_company` terisi (FIF/Adira/IMFI/OTO/dll) → BPKB tidak muncul di banner & WA; BPKB hanya untuk konsumen **cash**.
- **Staf koreksi No. HP**: `PATCH /api/showroom/stnk-bpkb-tracks/:engineNumber/mobile` (Admin/CRM/Kepala Cabang) + edit inline di halaman Follow-up.
- **Menu internal** "Self-Check Publik" (grup "Layanan Publik" sidebar) → buka `/cek` tab baru.

Nomor WA dealer (lokal): `VITE_DEALER_WA_PHONE=6289504400622`.

---

## 3. FASE 2 — Permintaan Ambil Dokumen (PICKUP REQUEST) — SELESAI

> Sudah di-commit (`eeb5ce7` dst.), teruji 55 test pass. Branch `feat/fase2-pickup-request` siap di-merge ke `main` / di-push setelah review.

### Alur inti
Konsumen verifikasi di `/cek` → bila ada dokumen eligible (sudah jadi, belum diserahkan, untuk konsumen; BPKB leasing dikeluarkan), response `/check` menyertakan `pickup_token` (JWT 15mnt, signed `JWT_SECRET`, payload `{engine_number, purpose:'pickup'}`) + `pickup_eligible` + `pickup_docs`. Form inline di `/cek` kirim `POST /api/public/stnk-bpkb/request-pickup` (multipart: field + file `ktp_photo`) → staf menindak lanjuti via halaman **Permintaan Ambil Dokumen**.

### Keputusan verifikasi (penting)
Backlog awal menyebut "OTP WhatsApp". **Diputuskan: TIDAK pakai OTP/gateway WA** — dipakai **token verifikasi dari `/check`** saja. Alasan: (1) tidak ada gateway WA server-side, (2) identitas konsumen **sudah terverifikasi** di `/check`. Bila kelak ingin OTP WA sungguhan, perlu tambah gateway (Fonnte/Wablas/Twilio) + API key di env.

### File yang berubah (sudah di-commit)
**Backend (api):**
- `prisma/schema.prisma` — model `showroom_pickup_requests` (kolom: id, engine_number, branch_code/name, consumer_name/phone, requested_docs, preferred_time, notes, **ktp_photo_url**, status default PENDING, created_at, handled_by, handled_at) + 2 migrasi: `20260622091349_add_pickup_requests` & `20260622102011_add_pickup_ktp_photo`.
- `src/controllers/publicController.js` — `checkStnkBpkb` keluarkan `pickup_token`/`pickup_eligible`/`pickup_docs`; `requestPickup` (verifikasi token **DULU** sebelum cek file KTP → token invalid tetap 401; cek KTP wajib → 400; 409 bila tak eligible lagi; simpan row + `ktp_photo_url`).
- `src/controllers/showroomStnkBpkbTrackController.js` — `getPickupRequests` (bare array, take 200, orderBy created_at desc), `updatePickupRequest` (status PENDING/CONTACTED/DONE/CANCELLED, isi handled_by/at), `getPickupRequestKtp` (serve foto via `res.sendFile`, auth-protected).
- `src/controllers/notificationController.js` — area `pickup` masuk feed notifikasi untuk Admin/CRM/Kepala Cabang/**IT Master**.
- `src/middleware/upload.js` — `uploadPickupKtp` (diskStorage `uploads/pickup-ktp/`, imageFileFilter JPEG/PNG, max 10MB).
- `src/routes/publicRoutes.js` — `POST /stnk-bpkb/request-pickup` (multer `uploadPickupKtp.single('ktp_photo')`, rate-limited `publicCheckLimiter`).
- `src/routes/showroomRoutes.js` — `GET`/`PATCH /pickup-requests`, `GET /pickup-requests/:id/ktp` (authorize Admin/CRM/Kepala Cabang).
- `tests/pickupRequests.integration.test.js` — 16 tes (multipart KTP): token valid→201, tanpa token→400, token salah→401, mismatch→401, **tanpa KTP→400**, 409, staff GET/PATCH, **serve KTP 200**, **RBAC KTP 403**, feed Admin + IT Master.

**Frontend (web):**
- `src/pages/StnkBpkbCheck.jsx` — form "Ajukan Permintaan Ambil Dokumen": HP, **pemilih tanggal (`type=date`, min hari ini) + jam (`type=time`, 08.00–17.00)** digabung jadi string ramah-baca via `formatPreferredTime`, catatan, **lampiran KTP wajib** dengan 2 opsi (**Ambil Foto** = kamera in-app `getUserMedia` modal full-screen + shutter + preview + Gunakan/Ulangi; **Pilih File** = input file galeri). Error kamera spesifik (izin ditolak / tak ditemukan / browser tak dukung). Konfirmasi sukses.
- `src/pages/ShowroomPickupRequests.jsx` — halaman staf: tabel + filter status + update status + link WA konsumen + **tombol "Lihat KTP"** (buka `/showroom/pickup-requests/:id/ktp` tab baru). Baca response sebagai array langsung (`res`, bukan `res.data`).
- `src/services/api/showroom.js` — `getPickupRequests` + `updatePickupRequest`.
- `src/components/Layout/Sidebar.jsx` — menu "Permintaan Ambil Dokumen" grup Layanan Publik.
- `src/App.jsx` — `RoleGuard` support gate via `roles` (selain `menuKey`); route `/showroom/pickup-requests`.
- `src/pages/ShowroomDashboard.jsx` — fix warning key-duplikat.

### Catatan penting
- **Urutan controller `requestPickup`**: verifikasi JWT **sebelum** cek `req.file`. Jika diubah, tes "token salah → 401" akan dapat 400. Jangan reorder.
- **Shape response list**: backend `getPickupRequests` kembalikan **bare array**. Frontend baca `res` langsung. (Pengecualian: feed notifikasi tetap wrap `{data, summary}`.)
- **test.db churn** (`api/prisma/prisma/test.db`) sengaja **tidak di-commit** (DB tes, berubah tiap run). `pretest` (`prisma db push --accept-data-loss`) auto-sync skema sebelum `npm test`.
- **KTP = data pribadi sensitif**: hanya disajikan via route auth (Admin/CRM/Kepala Cabang), BUKAN static publik. Folder `uploads/pickup-ktp/` diisi multer.
- **getUserMedia butuh HTTPS atau localhost**. Dev `localhost:5173` aman; produksi HARUS dilayani via HTTPS, kalau tidak browser blokir kamera (tombol Pilih File tetap jalan).

---

## 4. ⚠️ Yang HARUS dilakukan sebelum / saat go-live (di luar repo)

1. **Rotasi `JWT_SECRET` di server produksi** — `openssl rand -hex 32`, set di env server, restart API. (Secret lama sudah dihapus dari histori & ditolak guard, tapi server yang sudah ter-deploy harus pakai secret baru.)
2. **Set env produksi saat `npm run build` di server:**
   - `VITE_PUBLIC_URL=https://<domain-final>` (sekarang fallback ke origin → link/QR masih `localhost`).
   - `VITE_DEALER_WA_PHONE=6289504400622`.
3. **Uji cetak fisik kartu self-check** sekali (QR scannable, art carton 260gsm + laminasi).
4. **Apply migrasi pickup ke DB produksi**: `prisma migrate deploy` saat deploy (`20260622091349_add_pickup_requests` + `20260622102011_add_pickup_ktp_photo`).
5. **Produksi dilayani via HTTPS** supaya kamera in-app (`getUserMedia`) berfungsi.
6. **Merge / push branch** `feat/fase2-pickup-request` ke `main` setelah review final.

---

## 5. Catatan keamanan (keputusan dealer, sudah diterima)

Masking dihapus + rangka jadi faktor alternif → **siapa pun yang bisa membaca No. Mesin & No. Rangka di fisik unit dapat menarik nama pemilik penuh + nomor dokumen penuh.** Tradeoff sadar, terdokumentasi di commit `3f4b6e9` (SECURITY NOTE). Mitigasi yang tetap ada: rate limit publik (`publicCheckLimiter` 60/15mnt). Foto KTP yang diunggah konsumen hanya bisa diakses staf berotorisasi (bukan publik).

---

## 6. Backlog / belum dikerjakan

- ~~FASE 2 self-check pickup request~~ → **SELESAI**.
- ~~Warning key-duplikat~~ → **SELESAI** (`ShowroomDashboard.jsx`).
- ~~IT Master tak dapat notifikasi pickup~~ → **SELESAI** (commit `3c9022e`).
- ~~Halaman staf pickup kosong~~ → **SELESAI** (commit `62def67`).
- ~~Foto KTP wajib~~ → **SELESAI** (commit `4bd2321`).
- ~~Waktu preferensi input manual~~ → **SELESAI** (date+time picker, commit `bca9683`).
- ~~Ambil Foto di desktop ke file picker~~ → **SELESAI** (kamera in-app getUserMedia, commit `5d45769`).
- **Lint warning** tersisa 1: `react-hooks/exhaustive-deps` di `WorkshopReportDashboard.jsx:35` (benign, dep array disengaja).
- **SQLite** = DB resmi (keputusan terdokumentasi); sadari batas konkurensi tulis.
- (Opsional, bila diminta) Kalender custom ber-tema DXK (date-fns + headless UI) untuk mengganti native date picker — saat ini pakai native `<input type=date/time>` sesuai konvensi codebase.
- (Opsional) OTP WhatsApp sungguhan untuk verifikasi pickup — butuh gateway WA server-side.

---

## 7. Info teknis cepat (untuk lanjut)

- Frontend: `web/` (React 19 + Vite + Tailwind v4, token semantik via CSS var + `@theme`). Dev: `cd web && npm run dev` (5173). Lint+build: `npm run lint && npm run build`.
- Backend: `api/` (Express 5 + Prisma 6.7 + SQLite WAL). Dev: `cd api && npm run dev` (3001). Test: `npm test` (pretest auto `prisma db push` ke test.db). Proxy Vite `/api → localhost:3001`.
- Test DB ada di `api/prisma/prisma/test.db` (relatif `file:./prisma/test.db` dari schema dir). dev DB di `api/prisma/prisma/dev.db`. **Migrasi manual workaround** bila dev server kunci DB: buat folder migrasi + SQL, apply via `sqlite3 <db> "PRAGMA busy_timeout=10000; <SQL>"`, catat di `_prisma_migrations` (shasum -a 256 + uuidgen + datetime), lalu `npx prisma generate`.
- User test (password `password`): `haris`/Admin, `guntur`/Kepala Cabang, `astri`/CRM, `danu`/Service Advisor, `imam`/Kepala Bengkel. (`itmaster` password BUKAN `password`.) Untuk tes integration: user `test_*` (password `password123`) di `tests/helpers.js`.
- Endpoint publik: `GET /api/public/stnk-bpkb/check?engine_number=&phone=&chassis=`; `POST /api/public/stnk-bpkb/request-pickup` (multipart, field + `ktp_photo`).
- Helper URL/QR self-check: `web/src/config/selfCheck.js`.
- JWT_SECRET **jangan di-commit** (nilai dev di `.env` sudah untrack & dirotasi).