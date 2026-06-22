# Rencana (versi revisi): Akses Konsumen — Self Check STNK & BPKB

Tanggal: 2026-06-22
Status: **Rencana (belum dieksekusi)**
Penulis: revisi atas catatan brainstorming 2026-06-22, dikoreksi terhadap kode nyata.
Tujuan: saat masuk produksi, **konsumen mudah mengakses** halaman cek status dokumen
(STNK/BPKB) tanpa hambatan, dengan tetap aman.

---

## 0. Ringkasan eksekutif

Fitur backend + frontend Self Check **sudah jalan**. Yang kurang hanyalah **jalur akses
konsumen**. Fokus rencana ini: pendekkan & permudah jalan dari "konsumen pegang motor/BPKB"
→ "lihat status dokumennya", lewat **URL pendek + QR + prefill + share via WA**.

> **Penting — 2 item dari rencana lama DICORET karena sudah ada di kode:**
> - ~~Rate limiter publik baru~~ → **sudah ada**: `publicCheckLimiter` (60 req/15 mnt) di
>   `api/src/app.js:99,108`, plus `apiLimiter`. Dep `express-rate-limit` sudah terpasang.
> - ~~Masking nama di backend~~ → **sudah ada**: `maskName()` di
>   `api/src/controllers/publicController.js:6,76` (mis. "BUDI S*****").
>
> Jadi keamanan dasar (rate limit + masking) **sudah jalan — jangan dibuat ulang**.

---

## 1. Kondisi nyata (terverifikasi)

**Backend (publik, tanpa auth):**
- `GET /api/public/stnk-bpkb/check?engine_number=&phone=` (`publicRoutes.js`,
  `publicController.js:checkStnkBpkb`).
- Sudah: validasi engine+phone wajib, normalisasi phone, **masking nama**, **rate limit**.

**Frontend (publik):**
- Route panjang: `/public/stnk-bpkb-check` (`App.jsx:148`), komponen `StnkBpkbCheck.jsx`.
- Form: Nomor Mesin + Nomor HP. Timeline Faktur→STNK→Plat→BPKB→Serah Terima. Toggle tema.
- **Belum** baca query param (masih `useState` kosong, tak ada `useSearchParams`).

**Hambatan akses konsumen yang nyata:**
1. Root `/` untuk guest → dipaksa ke `/login` (`App.jsx:149`). Tak ada pintu konsumen.
2. Path `/public/stnk-bpkb-check` panjang & sulit diketik/diingat.
3. Tak ada QR fisik di dokumen yang dipegang konsumen.
4. Form harus diisi manual; tak bisa prefill engine via URL/QR.
5. Template WA follow-up belum menyertakan link self-check.
6. `VITE_PUBLIC_URL` belum ada → tak ada sumber URL publik yang konsisten.

---

## 2. Prinsip desain

- **Akses tanpa friksi**: konsumen idealnya cukup *scan* atau *klik*, lalu isi 1 field (HP).
- **Aman secara default tetap dijaga**: engine saja TIDAK membocorkan data (HP tetap wajib),
  jadi QR/URL berisi engine aman dibagikan. Masking + rate limit tetap dipertahankan.
- **Satu sumber URL**: semua link/QR memakai `VITE_PUBLIC_URL`, fallback
  `window.location.origin` agar jalan tanpa konfigurasi tambahan di dev & produksi.
- **Tidak menambah beban staf**: akses konsumen tak boleh memperlambat alur internal.

**Alur target konsumen:**
> Pegang BPKB / buku service (atau terima WA) → **scan QR / klik link** →
> halaman cek terbuka dengan **Nomor Mesin sudah terisi** → konsumen isi **Nomor HP** →
> lihat status & timeline. (1 input saja.)

---

## 3. Rencana perubahan

### A. Routing — pintu konsumen + URL pendek `[prioritas TINGGI]`
- `App.jsx`: guest di root `/` → komponen baru **`PublicLanding.jsx`** (2 kartu besar:
  **"Cek Dokumen Saya"** → `/cek`, **"Area Karyawan"** → `/login`). User sudah login →
  tetap `Layout` (dashboard internal), tanpa perubahan.
- Tambah **alias pendek** `/cek` (dan opsional `/cek-dokumen`) → render `StnkBpkbCheck`
  (boleh redirect ke route lama atau langsung dipetakan). Path lama `/public/stnk-bpkb-check`
  dipertahankan agar link lama tetap hidup.
- **Cek konflik**: route `/cek` belum dipakai (sudah saya verifikasi). Aman.

### C. Prefill + tombol Salin Link `[prioritas TINGGI]`
- `StnkBpkbCheck.jsx`: pakai `useSearchParams`, baca `?engine_number=` (opsional `?phone=`),
  isi form saat init; autofocus ke field HP bila engine sudah terisi.
- Setelah hasil tampil, tombol **"Salin Link"** → `navigator.clipboard.writeText` berisi
  `${PUBLIC_URL}/cek?engine_number=<engine>`.
- Backend **tak berubah** (sudah menerima query param).

### B. QR code di dokumen fisik `[prioritas SEDANG]`
- Dep baru **`qrcode`** (web hanya punya `jsbarcode`). Render QR ke dataURL saat print,
  konsisten dengan pola label existing.
- Target **komponen label sebenarnya** (bukan file page):
  - `web/src/components/common/BpkbBarcodeLabel.jsx` (dipakai `ShowroomBpkb.jsx`).
  - `web/src/components/common/ServiceBookLabel.jsx` + generator HTML print di
    `ShowroomLabelBukuService.jsx` (punya `renderLabel`/`barcodeScripts` sendiri — QR perlu
    disisipkan di jalur print itu juga).
- Isi QR: `${PUBLIC_URL}/cek?engine_number=<engine>`. Teks kecil: "Scan untuk cek status
  STNK/BPKB Anda". Ukuran ≥15×15mm (label BPKB 32×64mm → muat).

### D. Distribusi link via WA internal `[prioritas SEDANG]`
- `ShowroomDocumentFollowup.jsx`: tambah baris di template WA — "Cek status dokumen Anda:
  `${PUBLIC_URL}/cek?engine_number=<engine>`" + tombol **"Salin Link Self-Check"**.

### G. Discoverability internal `[prioritas RENDAH]`
- `web/src/config/roles.js` + `Sidebar.jsx`: menu "Self-Check Publik" (mis. role IT Master /
  Kepala Cabang) → buka tab baru ke `${PUBLIC_URL}/cek`, agar staf tahu URL untuk dibagikan.

### ~~E. Rate limiter~~ — **DICORET (sudah ada).**
Opsional: jika ingin kebijakan lebih ketat (mis. 30/menit), cukup **ubah parameter
`publicCheckLimiter` di `app.js:99`** (1 baris), bukan file baru.

### ~~F. Masking nama~~ — **DICORET (sudah ada).**
Opsional audit cepat: pastikan field lain di respons (no_polisi, alamat bila ada) tak
membocorkan data sensitif. Nama sudah ditangani `maskName()`.

---

## 4. Keputusan produksi yang perlu kamu tentukan

1. **Domain publik & `VITE_PUBLIC_URL`.** Di produksi, frontend dilayani dari origin yang
   sama dengan API (`express.static`), jadi cukup 1 domain. Set `VITE_PUBLIC_URL` =
   domain produksi (mis. `https://dxk-ketapang.co.id`). Fallback `window.location.origin`.
   → *Keputusan: domain finalnya apa?*
2. **Root `/` jadi landing 2-pintu.** Mengubah perilaku root untuk guest (kini → login).
   Cocok bila domainnya consumer-facing. → *Setuju root jadi landing, atau cukup andalkan
   URL pendek `/cek` dan biarkan root tetap ke login?*
3. **Whitelist IP internal untuk rate limit** (opsional): staf yang testing berulang bisa
   kena limit. Bisa di-skip dulu.

---

## 5. File yang akan diubah (ringkas, terverifikasi)

| File | Perubahan |
|------|-----------|
| `web/src/App.jsx` | Root → landing untuk guest; alias `/cek` |
| `web/src/pages/PublicLanding.jsx` (baru) | Landing 2 pintu |
| `web/src/pages/StnkBpkbCheck.jsx` | Prefill `useSearchParams` + tombol Salin Link |
| `web/src/components/common/BpkbBarcodeLabel.jsx` | QR di label BPKB |
| `web/src/components/common/ServiceBookLabel.jsx` + `ShowroomLabelBukuService.jsx` | QR di label buku service (komponen + jalur print) |
| `web/src/pages/ShowroomDocumentFollowup.jsx` | Link self-check di WA + tombol salin |
| `web/src/config/roles.js` + `Sidebar.jsx` | Menu internal (opsional) |
| `web/package.json` | Dep `qrcode` |
| `web/.env*` | `VITE_PUBLIC_URL` |
| ~~`api/src/middleware/publicLimiter.js`~~ | **tidak perlu** (limiter sudah ada) |
| ~~`api/src/controllers/publicController.js`~~ (masking) | **tidak perlu** (maskName sudah ada) |

**Backend: 0 perubahan wajib.** (Hanya opsional: tune param limiter / audit field.)

---

## 6. Urutan eksekusi

1. **Gelombang 1 (cepat, dampak besar):** A (landing + `/cek`) + C (prefill + salin link) +
   tambah `VITE_PUBLIC_URL`. Setelah ini konsumen sudah bisa diarahkan via link pendek.
2. **Gelombang 2 (butuh cetak ulang):** B (QR label) + D (link di WA).
3. **Gelombang 3 (polish):** G (menu internal) + audit opsional E/F.

---

## 7. Verifikasi

- `cd api && npm test` → **36/36 tetap pass** (catatan: jumlah test sekarang 36, bukan 26).
- `cd web && npm run lint && npm run build` → 0 error.
- Manual:
  - Guest buka `/` → landing 2 pintu muncul; user login buka `/` → dashboard internal.
  - `/cek` → form muncul. `/cek?engine_number=MH1XXX` → engine prefilled, fokus ke HP.
  - Hasil muncul → "Salin Link" → clipboard berisi `…/cek?engine_number=…`.
  - Print label BPKB & buku service → QR muncul → scan → buka `/cek?engine_number=…`.
  - Template WA → ada baris link self-check + tombol salin.
  - Rate limit & masking masih berlaku (regresi: tak boleh hilang).

---

## 8. Keamanan & risiko

- **Model identitas lemah (engine+phone):** phone bukan rahasia kuat → rawan enumerasi.
  Mitigasi (**rate limit + masking**) sudah ada — **pertahankan**. Prefill hanya mengisi
  engine (bukan HP) → QR/URL aman dibagikan, data tetap perlu HP yang cocok.
- **QR di dokumen fisik:** aman karena hanya berisi engine. Pastikan ukuran cukup untuk
  scan HP biasa.
- **`VITE_PUBLIC_URL` belum diset:** fallback `window.location.origin` menjaga agar tetap
  jalan tanpa konfigurasi.
- **Alias route:** `/cek` sudah dipastikan tak bentrok; cek lagi bila menambah alias lain.
- **Perubahan root `/`:** keputusan #4.2 — uji guest vs user-login agar tak ada regresi
  RBAC/redirect.
