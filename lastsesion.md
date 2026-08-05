# Catatan Sesi Terakhir — DXK Operation System

Tanggal: **2026-08-05**
Branch: **`feat/followup-center-whatsapp`** (commit `f1aa001`, bercabang dari `d8a6eee` di `main`).
Status: **belum di-push, belum di-merge ke `main`, belum di-deploy.**
Verifikasi: **API test 189 pass / 0 fail**, lint 0 error (1 warning pre-existing), build sukses, `prisma validate` valid.

> Catatan sesi-sesi sebelumnya (FASE 2 pickup request, self-check publik, single-session, cek-unit) sudah selesai & ter-merge — ringkasannya ada di `CLAUDE.md` dan histori `git log`.

---

## 0. Yang dikerjakan sesi ini

**Pusat Follow-up terpadu + kirim WhatsApp lewat gateway Wablas.**

Latar belakang: KPB, STNK, dan BPKB sebelumnya tiga daftar terpisah yang tidak saling tahu padahal berbagi satu nomor WhatsApp. Nomor gateway dealer dibatasi WhatsApp pada **2026-08-04** dengan alasan "pengiriman pesan otomatis atau massal". Jadi masalahnya bukan "bagaimana menghubungi semua" tapi "siapa 30 orang hari ini".

| Bagian | File utama |
|---|---|
| Skor prioritas antrean | `api/src/services/followupPriority.js` |
| Antrean terpadu (3 sumber) | `api/src/services/followupQueueService.js` |
| Endpoint queue/areas/history/schedule/send | `api/src/controllers/followupController.js`, `routes/followupRoutes.js` |
| Gateway Wablas | `api/src/services/wablasService.js` |
| Batas kirim harian | `api/src/services/whatsappLimitService.js` |
| Template pesan (bawaan + override DB) | `api/src/services/followupMessages.js`, `templateService.js` |
| CRUD template + audit | `api/src/controllers/whatsappTemplateController.js`, `routes/whatsappTemplateRoutes.js` |
| Halaman baru | `web/src/pages/FollowupCenter.jsx`, `WhatsappTemplates.jsx`, `KartuCekDokumen.jsx` |

### Keputusan yang perlu diingat

- **Batas 30 pesan/hari bersifat GLOBAL lintas modul**, bukan per modul. Yang dilindungi satu nomor pengirim, dan WhatsApp menilai perilaku nomor itu secara keseluruhan. Dibagi per modul = 90 pesan/hari dari nomor yang sama. Sumber kebenaran = tabel `whatsapp_send_logs` (bukan menghitung dari tabel followup, yang juga menampung perubahan status manual).
- **KPB dan dokumen memakai kurva skor berbeda** karena perilaku konsumennya berbeda: KPB memuncak di sekitar jatuh tempo (yang lewat >90 hari kemungkinan sudah servis di tempat lain); dokumen memuncak di 3-6 bulan menunggu (yang baru jadi <7 hari sengaja ditekan — mereka biasanya datang sendiri). Skala akhir 30-95, semua angka dikumpulkan di `followupPriority.js` supaya bisa disetel tanpa menyentuh logika antrean.
- **STNK+BPKB satu unit = satu pesan, satu jatah.** Dicatat satu baris log ber-`module: 'STNK_BPKB'`.
- **Auth Wablas berbeda per endpoint** — `/api/send-message` pakai header `Authorization: {token}.{secret}`, `/api/device/info` pakai query `?token=`. Jangan diseragamkan; menyalin pola satu ke yang lain gagal dengan pesan menyesatkan seolah token salah.
- **Device putus tetap dibalas `status:true` dan kuota tetap terpotong.** Karena itu status device dicek sebelum kirim (cache 60 detik) — tanpa itu sistem mencatat "sudah dihubungi" untuk pesan yang tak pernah sampai. Terbukti terjadi saat uji 2026-08-04.
- **Template disimpan sebagai versi baru, versi lama dinonaktifkan bukan ditimpa.** Hak ubah sengaja seluas akses follow-up (keputusan pemilik sistem); pengamannya audit log + riwayat versi.
- **Kartu Cek Dokumen jadi generik** (tanpa nomor mesin) → dicetak setumpuk, dibagikan ke konsumen mana pun. Halaman lama per-unit di Follow-up STNK/BPKB dihapus.
- **Tidak pakai OTP WhatsApp** (keputusan lama, masih berlaku).

### Angka dari data asli (dev.db, 2026-08-05)

Antrean menghasilkan **2.300 target** dalam 285 ms — 1.213 KPB, 844 STNK, 243 BPKB. Ada **72 baris gabungan STNK+BPKB** dan **524 baris yang menyembunyikan target lain** (aturan satu orang = satu baris per hari). Dengan jatah 30/hari, satu putaran penuh ≈ 4 bulan.

---

## 1. Bug yang ditemukan & diperbaiki sebelum commit

Ketiganya lolos dari 185 test yang sudah ada — ditemukan lewat pembacaan kode + uji terhadap data asli, bukan dari test yang gagal.

1. **Jadwal hubungi-ulang hilang tepat di hari yang dijanjikan.** Urutan filter di `followupQueueService.js` mengecek `next_followup_at` dulu, lalu jeda 7 hari. Janji "hubungi saya Sabtu" yang dibuat Rabu tetap tersaring sebagai "baru dihubungi" sampai hari ke-7. Default prompt UI 7 hari (lolos tipis), jadi setiap tanggal < 7 hari diam-diam tidak berfungsi. **Perbaikan:** jadwal yang tanggalnya sudah tiba mengalahkan jeda 7 hari; jeda tetap penuh untuk kontak tanpa jadwal eksplisit.
2. **Kirim WA sekali klik tanpa konfirmasi** di `FollowupKpb.jsx` dan `ShowroomDocumentFollowup.jsx`. Dulu tombol itu hanya membuka draf `wa.me` yang masih bisa dibatalkan; sekarang langsung terkirim dan tidak bisa ditarik. **Perbaikan:** `window.confirm` dengan nama + nomor, seperti di FollowupCenter.
3. **Riwayat pengiriman kosong untuk kiriman gabungan.** Log ditulis `module: kebutuhan.join('+')` tapi dibaca `module: kind`. Saat memperbaiki ketemu bug kedua: urutan `kebutuhan` datang dari request, jadi pengiriman sama bisa tercatat `'STNK+BPKB'` atau `'BPKB+STNK'`. **Perbaikan:** nilai dibakukan lewat `documentTemplateKey()` → `'STNK_BPKB'`; riwayat STNK & BPKB sama-sama mengambilnya.

**4 test regresi ditambahkan dan sudah dibuktikan gagal terhadap kode sebelum perbaikan** (`jadwal yang tiba mengalahkan jeda 7 hari`, `STNK+BPKB satu unit...`, `riwayat STNK maupun BPKB memuat kiriman gabungan`, `urutan kebutuhan terbalik...`). Ada juga penjaga arah sebaliknya: `jeda 7 hari tetap berlaku untuk kontak tanpa jadwal` — supaya perbaikan #1 tidak diam-diam mematikan pengaman blokir WhatsApp.

### Sengaja TIDAK diperbaiki

- **Race batas harian** — `pastikanJatahHarianCukup()` cek-lalu-kirim, tidak atomik. Dua admin menekan bersamaan bisa melewati batas 1-2 pesan. Memperbaikinya perlu kunci/transaksi yang tidak sepadan dengan dampaknya.
- **Filter "KPB" tidak menampilkan orang yang KPB-nya tersembunyi** di bawah baris STNK-nya (`tertunda_lain`). Ini konsekuensi aturan satu-orang-satu-baris, bukan bug.

---

## 2. WAJIB dilakukan saat deploy

```bash
git checkout main && git merge --ff-only feat/followup-center-whatsapp   # kalau sudah ditinjau
git pull
cd api && npx prisma db push && npx prisma generate   # 2 tabel + kolom next_followup_at
node scripts/seed_permissions.js                       # 3 menuKey baru
# set di api/.env server: PUBLIC_URL, WABLAS_TOKEN, WABLAS_SECRET
cd ../web && npm run build
pm2 restart <app>
```

1. **`PUBLIC_URL` wajib diisi.** Fallback-nya `FRONTEND_URL`, yang boleh berisi beberapa origin dipisah koma — itu menghasilkan tautan `{link_cek}` rusak di pesan yang sudah terlanjur sampai ke konsumen. Sudah didokumentasikan di kedua file `.env.example`.
2. **`WABLAS_TOKEN` + `WABLAS_SECRET`.** Selama kosong, tombol Kirim WA menjawab 503 "gateway belum dikonfigurasi" — halaman tetap bisa dipakai untuk menelusuri & menjadwalkan antrean.
3. **Skema:** tabel `whatsapp_send_logs` + `whatsapp_templates`, kolom `next_followup_at` di `kpb_followups` dan `showroom_document_followups`. Ingat: **pakai `db push`, bukan `migrate`** (schema-engine rusak di setup ini).
4. **menuKey baru:** `FOLLOWUP_CENTER`, `WHATSAPP_TEMPLATE`, `SELF_CHECK_CARD`.

---

## 3. Belum selesai / risiko terbuka

- **Pengiriman sungguhan belum teruji.** Nomor gateway dibatasi WhatsApp 2026-08-04; semua uji kirim memakai gateway tiruan di test. Setelah nomornya pulih, uji satu pesan ke nomor sendiri dulu sebelum dipakai staf.
- **Branch belum di-push & belum di-merge** ke `main`.
- **`WHATSAPP_DAILY_LIMIT=30` belum pernah divalidasi di lapangan** — apakah 30 aman atau masih terlalu tinggi baru ketahuan setelah beberapa minggu berjalan. Angkanya bisa diturunkan lewat env tanpa deploy ulang kode.
- **Lint warning** tersisa 1 (pre-existing): `react-hooks/exhaustive-deps` di `WorkshopReportDashboard.jsx:35`.

---

## 4. Info teknis cepat (untuk lanjut)

- Backend `api/` (Express 5 + Prisma + SQLite). Dev `npm run dev` (3001). Test `npm test` (`pretest` auto `db push` ke test.db).
- Frontend `web/` (React 19 + Vite + Tailwind v4). Dev `npm run dev` (5173, proxy `/api` → 3001). `npm run lint && npm run build`.
- Endpoint baru: `GET /api/followup/queue|areas`, `GET /api/followup/history/:kind/:key`, `POST /api/followup/schedule/:kind/:key`, `POST /api/followup/send/:kind/:key`, `GET|PUT|POST /api/whatsapp-templates/*`, `POST /api/customers/:id/followups/whatsapp`, `POST /api/showroom/document-followups/:type/:engineNumber/whatsapp`.
- Halaman baru: `/follow-up`, `/template-wa`, `/kartu-cek-dokumen`.
- User test (password `password`): `haris`/Admin, `guntur`/Kepala Cabang, `astri`/CRM, `danu`/Service Advisor, `imam`/Kepala Bengkel. (`itmaster` password BUKAN `password`.) Integration test: user `test_*` (password `password123`) di `tests/helpers.js`.
- **Setiap integration test WAJIB `process.env.DATABASE_URL = 'file:./test.db'` sebelum import `helpers.js`** — kalau tidak, app menembak `dev.db` (data kerja asli).
- Uji cepat antrean terhadap data asli: skrip sementara di `api/` yang meng-import `services/followupQueueService.js` dan memanggil `buildFollowupQueue({})` (harus di dalam `api/` supaya `node_modules` ter-resolve).
