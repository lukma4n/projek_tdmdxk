# Desain: Dashboard Analisa SLA STNK & BPKB

**Tanggal:** 2026-06-27
**Status:** Disetujui (menunggu review tertulis)
**File terdampak utama:** `web/src/pages/ShowroomStnkBpkbMonitoring.jsx`, `api/src/controllers/showroomStnkBpkbTrackController.js`

## Context

Dashboard **Monitoring STNK & BPKB** saat ini bersifat operasional (daftar dokumen nyangkut + follow-up) dan belum memanfaatkan data yang kini lengkap setelah import gabungan v1+v2: `lt_*` (lead-time per tahap), `area`/`area_kecamatan`, `lokasi_stnk/bpkb/stock`, `no_polisi`, `mobile`. Kepala Cabang/manajemen butuh **analisa kinerja proses (SLA/lead-time)**: tahap mana paling lama (bottleneck), biro jasa/area mana paling lambat, tren membaik/memburuk, dan unit berjalan yang melewati SLA.

Patokan diambil dari file `SLA TDM VS ACTUAL.xlsx` milik user. Keputusan: **acuan utama = SLA IM per-area**.

## Acuan SLA (final)

**Headline (Penjualan/SO → terima dokumen):**
- **STNK: 60 hari** (semua area).
- **BPKB: 180 hari**, kecuali **210 hari** untuk area jauh: Bengkayang (kab 6102), Landak (6103), Kapuas Hulu (6108), Melawi (6110).

**Tahap antara (IM, kumulatif sejak SO kecuali disebut lain):**
| Tahap | Kolom data | Target IM |
|---|---|---|
| Permohonan Faktur | `lt_mohon_faktur` | H+3 |
| Penerimaan Faktur | `lt_terima_faktur` | H+6 |
| Berkas ke Biro Jasa | `lt_proses_stnk` | H+7 |
| Terima STNK | `lt_terima_stnk` | 60 hari (per-area) |
| Terima BPKB | `lt_terima_bpkb` | 180/210 hari (per-area) |
| Penyerahan STNK→konsumen | `lt_penyerahan_stnk − lt_terima_stnk` | +180 hari |
| Penyerahan BPKB (cash) | `lt_penyerahan_bpkb − lt_terima_bpkb` | +90 hari |
| Penyerahan BPKB (kredit/leasing) | idem | +7 hari |

Cash vs kredit ditentukan dari `finance_company` (kosong = cash) — reuse `getCustomerType()` di `showroomUtils.js`.

**Definisi On-Time %:**
- Unit **selesai** (punya `lt_terima_stnk`/`lt_terima_bpkb`): on-time bila `lt ≤ target`.
- Unit **berjalan** (belum selesai): umur = `hari ini − tgl_so` (fallback `tgl_mohon_faktur`); dipakai untuk watchlist "lewat/mendekati SLA", bukan untuk % historis.

## Struktur Dashboard (satu halaman, analisa di atas)

Filter atas: Periode (Tahun/Bulan) · Area · Biro Jasa · Series · Cash/Kredit · Status. *(menambah Periode & Area ke filter existing.)*

1. **Zona 1 — Headline SLA (kartu KPI):** STNK On-Time % + rata-rata hari; BPKB On-Time % + rata-rata; Unit lewat SLA (berjalan); Volume selesai (periode).
2. **Zona 2 — Pipeline & Bottleneck:** tabel/bar per tahap → Target IM · Rata-rata Aktual · On-Time % · Selisih; sorot selisih terbesar.
3. **Zona 3 — Tren Bulanan:** garis On-Time % STNK & BPKB per bulan SO (kohort) + volume.
4. **Zona 4 — Perbandingan:** Per Biro Jasa (unit, on-time % & avg STNK/BPKB, sortable) · Per Area (on-time % vs target area).
5. **Zona 5 — Watchlist (berjalan):** Lewat SLA (umur > target) dan Mendekati SLA (≤14 hari menuju target), per bucket umur; kolom No Mesin, Nama, HP, Biro Jasa, umur, lewat berapa hari.
6. **Zona 6 — Operasional (existing, dipindah ke bawah):** Status STNK/BPKB, anomali follow-up, Top Pending BPKB — dipertahankan apa adanya.
7. **Zona 7 — Lokasi Dokumen (ringkas):** distribusi `lokasi_stnk` & `lokasi_bpkb` (Brankas HO / Cabang / Biro Jasa / Leasing) — jumlah dokumen per lokasi.

## Backend

Perluas `getStnkBpkbTrackMonitoring` (`showroomStnkBpkbTrackController.js`) agar **sekalian** mengembalikan blok `sla` dari data `filtered`/`allTracks` yang sudah dimuat (hindari query 19rb baris dua kali). Tambah:
- Konstanta `STAGE_SLA_IM` (target tahap) dan helper `getAreaSlaTarget(area)` → `{ stnk:60, bpkb:180|210 }` berdasarkan kode kabupaten (6102/6103/6108/6110 → 210).
- Reuse `getCustomerType()` untuk target penyerahan BPKB.
- Hitung: headline (on-time %, avg), pipeline per-tahap, tren per bulan SO, agregat per biro jasa & per area, watchlist (lewat/mendekati), distribusi lokasi.
- Response menambah key `sla: { headline, pipeline, trend, byBirojasa, byArea, watchlist, lokasi }` tanpa mengubah key lama (operasional tetap jalan).

## Frontend

Tata ulang `ShowroomStnkBpkbMonitoring.jsx`: zona analisa (1–5) di atas, operasional (6) & lokasi (7) di bawah. Karena file sudah besar (~750 baris), **pecah komponen** ke `web/src/components/showroom/sla/`:
- `SlaHeadlineCards.jsx`, `SlaPipeline.jsx`, `SlaTrendChart.jsx`, `SlaComparisonTables.jsx`, `SlaWatchlist.jsx`, `DocumentLocationPanel.jsx`.
- Halaman utama jadi orchestrator (fetch + filter + susun zona). Komponen operasional existing dipertahankan/dirapikan.
- Reuse `recharts` (sudah dipakai), `financeShortName`, pola `StatCard`/`SectionCard` yang ada.

## Out of scope (YAGNI)

- Tidak mengubah alur import (sudah selesai terpisah).
- Tidak menambah target SLA yang bisa diedit lewat UI — target di-hardcode sebagai konstanta dulu (bisa jadi tabel editable di iterasi berikut bila perlu).
- Acuan "Actual Cabang" tidak jadi acuan utama; boleh ditampilkan sebagai pembanding sekunder hanya bila murah, kalau tidak, ditunda.

## Verifikasi

1. Script node terhadap dev.db: hitung headline & pipeline, sanity-check angka (mis. avg `lt_terima_stnk` ≈ 45 hari, on-time STNK vs 60 hari masuk akal).
2. `cd api && npx prisma validate && npm test` (61 pass, tidak ada yang dipecah).
3. `cd web && npm run lint && npm run build`.
4. Manual end-to-end lokal: buka dashboard → cek tiap zona terisi (KPI, pipeline bottleneck menyorot Terima BPKB, tren, per biro jasa/area, watchlist, lokasi); ganti filter Periode/Area → angka berubah konsisten.
5. Pastikan bagian operasional lama (status, follow-up, top pending) tetap berfungsi.
