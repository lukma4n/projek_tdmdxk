# Catatan Sesi Terakhir — DXK Operation System

Tanggal: **2026-08-29**
Branch: **`feat/tanda-terima-digital`**. **BELUM di-merge ke `main`, BELUM naik produksi** — pemilik sistem sengaja ingin meninjaunya dulu di dev sebelum ini menggantikan tanda terima kertas yang berjalan sekarang.
Verifikasi (Task 13): `npx prisma validate` valid; `npm test` **232 pass / 0 fail** (naik dari 61 sebelum fitur ini); `npm run lint` 0 error, 1 warning pre-existing (`WorkshopReportDashboard.jsx:35`, sudah dikenal, bukan regresi); `npm run build` sukses.

## 0. Yang dikerjakan sesi ini — Tanda Terima Digital Penyerahan Dokumen

Fitur baru (13 task, lihat `docs/superpowers/specs/2026-08-29-tanda-terima-digital-penyerahan-dokumen-design.md` dan `.superpowers/sdd/progress.md`): saat petugas mencatat STNK/BPKB sampai ke konsumen, sistem menerbitkan nomor tanda terima sendiri (`TT-STNK/DXK/26/08/00001`, `TT-BPKB/...`), mengambil dua tanda tangan digital di perangkat petugas (bukan HP konsumen), lalu mengarsipkan PDF dengan hash SHA-256. Ini menggantikan tanda terima kertas yang selama ini ditandatangani basah dan diarsipkan fisik.

- **Belum di-merge, belum deploy** — sesuai permintaan pemilik sistem, menunggu review di dev.
- **Backup harian sekarang ikut mengarsipkan `api/uploads/`**, bukan cuma database. Sebelum fitur ini, PDF/foto tanda terima tidak punya cadangan sama sekali; kalau disk VPS bermasalah, database selamat tapi bukti serah terima hilang tanpa kertas pengganti. `scripts/backup-db.js` sekarang menyalin keduanya dengan retensi sama (14).
- **Keputusan pemilik sistem di tengah pembangunan:** penyerahan lewat ekspedisi/kurir (`ekspedisi_ke_konsumen`) WAJIB tanda tangan digital, persis seperti serah terima di counter — bukan dikecualikan. Alasannya: penyerahan lewat kurir justru momen yang paling minim pengawasan dalam seluruh proses, jadi harus dijaga sama ketatnya, bukan lebih longgar. (Lihat `.superpowers/sdd/progress.md` Task 7.)
- **Frontend BELUM ditelusuri manual di browser.** Modal serah terima (`ShowroomDocumentHandover.jsx`), SignaturePad, dan halaman peta warna (`ShowroomUnitColors.jsx`) lulus lint+build tapi belum diklik satu per satu oleh manusia. Daftar langkah yang perlu dicoba ada di `.superpowers/sdd/task-11-report.md`.
- Dokumentasi disinkronkan Task 13: spec ditambah kolom `receipt_items` (checklist item yang diserahkan, JSON array) yang hilang dari draf awal; `CLAUDE.md` bagian "Key gotchas" bertambah 4 entri (3 dari brief + 1 temuan reviewer soal ES-module hoisting yang membuat konvensi `DATABASE_URL` di `helpers.js` sebenarnya tidak berjalan seperti yang tertulis).

> ⚠️ **Gateway WhatsApp (Wablas) masih DIHAPUS** sejak sesi 2026-08-05 di bawah. Kalau membaca bagian
> mana pun di bawah yang menyebut pengiriman otomatis, baca §5 dulu — pengiriman
> sekarang MANUAL lewat WhatsApp Web. Lihat [[wablas-diblokir-mode-manual]].

> Catatan sesi-sesi sebelumnya (FASE 2 pickup request, self-check publik, single-session, cek-unit) sudah selesai & ter-merge — ringkasannya ada di `CLAUDE.md` dan histori `git log`. Sisa dokumen di bawah ini (§1 dst.) adalah catatan sesi **2026-08-05** (Pusat Follow-up + pembongkaran gateway Wablas), masih akurat untuk `main`.

---

## 0b. [Sesi 2026-08-05] Yang dikerjakan sesi itu

Dua babak dalam satu hari: membangun Pusat Follow-up dengan gateway WhatsApp
otomatis (§0-§2), lalu **membongkar gatewaynya** setelah nomor dealer diblokir
untuk kedua kalinya (§5). Yang bertahan: antrean prioritas, template, jadwal,
riwayat. Yang hilang: pengiriman otomatis.

**Babak 1 — Pusat Follow-up terpadu + gateway Wablas (kemudian dicabut).**

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


---

## 5. Babak 2 — Wablas diblokir, pengiriman jadi manual (commit `48afc45`, `b06abbe`, `58586f6`, `e0c8e9b`)

### Apa yang terjadi

Beberapa jam setelah gateway aktif, nomor dealer `6289504400622` dibatasi
WhatsApp untuk **kedua kalinya**. Log pengiriman menunjukkan sebabnya: 5 pesan
dalam **94 detik**, dua terakhir berjarak **7 dan 8 detik**.

Batas 30/hari membatasi JUMLAH, tapi tidak ada satu pun aturan tentang JARAK
antar pesan — dan justru laju itu yang terbaca sebagai blast. Akun Wablas-nya
sendiri disetel `delay_message: 60 detik`; memanggil `/api/send-message`
langsung melewatinya, jadi sistem mengirim ~8x lebih rapat daripada anjuran
gatewaynya sendiri.

### Keputusan: gateway dihapus, bukan diperlambat

Menambah jeda menyelesaikan insiden hari itu, tapi Wablas bekerja dengan
mengotomasi aplikasi konsumen — melanggar ketentuan WhatsApp — jadi pacing
hanya menunda masalah yang sama. `wablasService.js` dan tesnya dihapus; kode
yang bisa mengirim WhatsApp sendiri terlalu berbahaya untuk ditinggalkan.

### Cara kerja sekarang

Server menyiapkan draf (`draft_message` + `wa_url` ikut dalam respons daftar) →
browser membuka `wa.me` → **staf menekan Kirim di WhatsApp Web miliknya**.

- Tiga endpoint kirim lama diganti SATU: `POST /api/followup/contact/:kind/:key`.
  Tidak mengirim apa pun — hanya memotong jatah harian dan mencatat kontak.
- `window.open` WAJIB dipanggil langsung di handler klik. Karena itu teks pesan
  ikut dalam respons antrean; menunggu request dulu membuat browser
  memblokirnya sebagai popup.
- Batas 30/hari DIPERTAHANKAN: membuka 60 draf lalu mengirim semuanya dalam
  sepuluh menit tetap blast. Yang hilang cuma sinyal otomatisnya.
- Kontak dicatat saat draf DIBUKA, bukan saat terkirim — sistem tidak bisa tahu
  tombol Kirim ditekan. Menghitung lebih lebih aman daripada mengirimi orang
  yang sama dua kali.

### Nomor HP: dikenali & bisa diperbaiki

Aturan lama menerima apa saja sepanjang 11-15 digit lalu menempel `62` di
depannya, jadi `4378400000000` dan `000000000000` pun lolos ke antrean dan baru
ditolak WhatsApp setelah waktu staf terbuang. Dari 39.996 nomor produksi,
**3,84% bermasalah**: 1.084 terlalu panjang, 278 berisi dua nomor tersalin jadi
satu, 145 bukan seluler, 30 terlalu pendek.

Sekarang: wajib berawalan `628`, panjang 11-14 karakter (`utils/phone.js`).
Alasan penolakan + nomor apa adanya ikut ke UI, ada filter **"Nomor bermasalah"**
di Pusat Follow-up, dan nomornya bisa langsung dibetulkan lewat ikon pensil
(`PATCH /api/followup/phone/:kind/:key`, masuk audit log). Endpoint lama
`PATCH /showroom/stnk-bpkb-tracks/:engineNumber/mobile` ikut diperketat —
sebelumnya menerima apa saja sepanjang 8 digit.

Di produksi: 2.269 layak dihubungi, 29 bermasalah.

### Pesan dokumen dipersonalkan

Template STNK/BPKB dulu berbunyi "STNK motor Honda anda Sudah Jadi" — terbaca
seperti pesan massal. Sekarang:

> Bapak/Ibu **MAT JUNI**, kami menginformasikan bahwa STNK motor Honda **REVO**
> dengan nomor polisi **KB5080IR** SUDAH JADI.

Variabel `{nama}`, `{tipe_motor}`, `{no_polisi}` boleh dipakai di template
dokumen. `{tipe_motor}` memakai `series` (REVO), bukan `category_name`
(CUB LOW END) — yang dikenali konsumen adalah nama modelnya. Blok persyaratan
dan jam buka dipertahankan persis seperti yang berjalan di produksi.

---

## 6. Keadaan produksi setelah sesi ini

- Kode di `e0c8e9b`, PM2 `dxk-api` online.
- `.env` produksi: **tidak ada lagi `WABLAS_*`**. Yang relevan tersisa
  `PUBLIC_URL=https://tdmketapang.net` dan `WHATSAPP_DAILY_LIMIT=30`.
- Tabel `whatsapp_send_logs` kini bermakna **log kontak**, bukan log kirim.
  Kolom `message_id`/`quota_left` peninggalan gateway, selalu null — sengaja
  tidak di-drop agar deploy tak perlu menyentuh skema DB produksi.
- Belum ada template kustom tersimpan (`whatsapp_templates` kosong), jadi semua
  memakai bawaan di `services/followupMessages.js`.

### Yang perlu disampaikan ke staf

Beri jeda antar konsumen — jangan 10 draf berturut-turut dalam semenit. Sekitar
satu menit sekali sudah cukup; 30 pesan tersebar seharian jauh lebih aman.
Nomor `6289504400622` masih dalam pembatasan per 2026-08-05, jadi WhatsApp Web-nya
pun belum tentu bisa mengirim sampai pulih.

### Jalur resmi kalau volume menuntut (belum dikerjakan)

WhatsApp Business Cloud API resmi. Tarif Indonesia per 1 Juli 2026: utility
Rp 356,65/pesan, marketing Rp 586,33, +PPN 11%. Untuk 30 pesan/hari × 26 hari
≈ **Rp 309.000/bulan**. Tarif Meta sama di semua BSP; lewat Cloud API langsung
tidak ada biaya platform. Catatan penting: **template KPB kemungkinan dinilai
MARKETING** (memuat alamat, jam buka, ajakan), dan butuh nomor yang BELUM
terdaftar di WhatsApp biasa + verifikasi Meta Business.
