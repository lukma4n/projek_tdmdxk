# Rencana Adopsi Desain "Sistem DXK" — Fondasi Design-System + Shell + 1 Halaman Acuan

> Status: **rencana disetujui, belum diimplementasi.** Catatan ini untuk melanjutkan di sesi berikutnya.
> Tanggal: 21 Juni 2026.

## Context
Ada mockup hi-fi (`Sistem DXK.dc.html`) + dokumen implementasi (`Implementasi DXK.dc.html`) yang
dibuat khusus untuk aplikasi ini, pada stack yang sama (React 19 + Tailwind v4 + Lucide + zustand).
Tujuan: menerapkan desain itu agar "100% berjalan baik".

Masalah pada frontend sekarang yang menghambat adopsi bersih:
- Tema gelap diterapkan lewat ternary `isDark ? '...' : '...'` di tiap elemen (rapuh, tak konsisten).
- Token warna campur: Sidebar pakai ungu Skydash `#4B49AC`, `index.css`/Header pakai biru `#2563eb`.
- Font Nunito (mockup pakai Inter). Belum ada accent/density.

Solusi: adopsi **sistem token CSS-variable semantik** dari mockup sebagai fondasi lebih dulu, lalu
restyle shell + 1 halaman acuan. Setelah pola terbukti, sisa 40 halaman tinggal mengulang pola sama.

## Keputusan yang sudah disepakati
- Aktifkan **dark + accent (biru/indigo/teal) + density**.
- Kerjakan **fondasi + shell + 1 halaman acuan (Dashboard Bengkel)** dulu, sebelum migrasi massal.
- Tinggalkan Skydash & Nunito (konsekuensi ganti arah desain).
- Hanya frontend. **Backend 0 perubahan.**

## Pendekatan inti
Komponen mereferensi **utility token** (mis. `bg-panel`, `text-muted`, `border-border`) yang di-back
CSS var. Tema diganti via atribut `data-theme/data-accent/data-density` di root — **tanpa** ternary
`isDark` lagi. Ini kunci agar dark/accent/density jalan menyeluruh & konsisten.

## Fase 1 — Fondasi design-system

### 1a. Token CSS var — `web/src/index.css`
- Definisikan token semantik mockup di `:root` (light): `--bg, --bg-deep, --panel, --sidebar,
  --border, --border-strong, --text, --text-strong, --text-muted, --text-faint, --accent,
  --accent-text, --accent-soft, --danger(+soft), --success(+soft), --warning(+soft), --hover, --rpad`.
- Override blok: `[data-theme="dark"]`, `[data-accent="indigo"]`, `[data-accent="teal"]`
  (+ kombinasi dark×accent), `[data-density="comfortable"]` (ubah `--rpad`). Salin nilai dari
  `Sistem DXK.dc.html` baris 17–37.
- Petakan ke Tailwind v4 `@theme` agar muncul utility: `--color-bg: var(--bg)`, `--color-panel:
  var(--panel)`, `--color-border: var(--border)`, `--color-muted: var(--text-muted)`,
  `--color-accent: var(--accent)`, `--color-accent-soft: var(--accent-soft)`, dst.
- `--font-sans` → `'Inter'`. Tambah `<link>` Google Fonts Inter+JetBrains Mono di `web/index.html`.

### 1b. State tema — `web/src/stores/themeStore.js`
- Perluas store: `{ theme, accent, density }` + setter + toggle, semua persist ke localStorage.
  Sekalian perbaiki backlog #24 (baca localStorage via lazy init, bukan module scope).
- Terapkan ke root: efek set `document.documentElement.dataset.theme/accent/density` (atau di
  `App.jsx`) supaya Login (di luar Layout) ikut bertema.

### 1c. UI pengaturan tema
- Di Header: dropdown "Tampilan" berisi toggle dark, pilih accent (biru/indigo/teal), pilih density.
  Reuse pola panel dropdown bell yang sudah ada di `Header.jsx`.

## Fase 2 — Shell (token-driven, hapus ternary isDark)
- `web/src/components/Layout/Layout.jsx` — root `bg-bg`, hapus `bgClass` isDark.
- `web/src/components/Layout/Sidebar.jsx` — buang token Skydash `C.*` ungu & inline mouse handlers;
  pakai `bg-sidebar`, `text-muted`, hover `bg-hover`, item aktif `bg-accent-soft text-accent`.
  Pertahankan `navStructure`, RBAC `filterByPermission`, accordion.
- `web/src/components/Layout/Header.jsx` — `bg-panel border-border`; samakan tombol/badge ke token;
  tambah kontrol tema (1c). Pertahankan logika Import/bell/approval.

## Fase 3 — Komponen primitif bersama (baru, `web/src/components/ui/`)
Token-driven, jadi acuan semua halaman:
- `Card.jsx`, `PageHeader.jsx` (breadcrumb + judul + timestamp), `Table.jsx` (header uppercase
  `text-faint`, sel `py-[var(--rpad)]`, angka mono), `Badge.jsx`/Pill (danger/success/warning/accent
  + soft), `KpiCard.jsx`, `ProgressBar.jsx`, `FilterBar.jsx`, `EmptyState.jsx`, `Modal.jsx`.
- Acuan markup di `Sistem DXK.dc.html`: KPI 142–152, tabel 157–176, filter 211–217, modal 437–452.

## Fase 4 — Halaman acuan: Dashboard Bengkel
- Restyle `web/src/pages/Dashboard.jsx` pakai `PageHeader` + grid `KpiCard` + `Card`+`Table`
  (Open WO) + panel Alert + panel "Kesegaran Data Import" (mockup 141–207). Tanpa ubah data/fetch.
- Jadi pola referensi untuk 40 halaman sisanya (gelombang berikutnya).

## Catatan tambahan
- Mockup desktop-first ≥1280px (sesuai PC staf cabang); mobile sidebar overlay yang ada dipertahankan.
- Halaman sisanya (workshop/stock/showroom/opname/admin) = gelombang lanjutan, bukan milestone ini.
- Gap dokumen-vs-realita (tak menghalangi desain): doc sebut import 2-langkah & `import_batch_id` &
  MySQL/PostgreSQL; implementasi nyata = import 1-langkah, SQLite. Abaikan untuk urusan UI.

## Verifikasi (saat implementasi)
- `cd web && npm run dev` → toggle dark/light, accent biru↔indigo↔teal, density rapat↔nyaman →
  seluruh shell + Dashboard Bengkel + Login ikut berubah tanpa elemen "nyangkut" warna lama.
- Bandingkan Dashboard Bengkel dengan mockup (KPI, tabel, alert, freshness).
- `npm run lint` (tanpa error baru) & `npm run build` sukses.
- Cek tak ada sisa `#4B49AC` / `isDark ?` di file shell yang sudah dimigrasi.
- Login tiap role → menu RBAC tetap benar.

## Titik lanjut berikutnya
Mulai dari **Fase 1a** (token `index.css`) → 1b → 1c → Fase 2 → 3 → 4. Setelah Dashboard Bengkel
terbukti, lanjut migrasi 40 halaman per domain.
