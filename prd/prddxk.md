# PRD — Sistem DXK
**Product Requirements Document untuk Kebutuhan Desain**

**Versi:** 3.0  
**Tanggal:** 20 Juni 2026  
**Status:** Aktif — referensi desain UI/UX

---

## 1. Gambaran Produk

**Sistem DXK** adalah aplikasi web internal cabang TDM Ketapang/DXK. Fungsinya sebagai pusat operasional harian untuk dua domain utama:

| Domain | Fokus |
|--------|-------|
| **Bengkel & Sparepart** | Work Order, program AHM, stok, hotline, opname, performa mekanik |
| **Showroom** | Stock unit, master harga, STNK/BPKB, program sales, margin, dokumen handover |

Data masuk melalui import Excel/DOCX/PDF yang ditarik dari sistem induk AHM. Sistem ini bukan sistem transaksi — semua data berasal dari snapshot import periodik, kecuali data follow-up dan opname yang diinput manual.

Aplikasi berjalan di browser (desktop-first, internal LAN), dengan tema terang dan gelap yang bisa dipilih per pengguna.

---

## 2. Pengguna (Roles)

| Role (DB) | Label UI | Deskripsi |
|-----------|----------|-----------|
| `IT Master` | IT Master | Akses penuh semua fitur, bypass semua RBAC |
| `Admin` | Admin Showroom | Admin operasional showroom — data master, stock unit, dokumen |
| `Kepala Cabang` | Kepala Cabang | Monitoring lintas domain, approval opname, backup/restore, user |
| `Kepala Bengkel` | Kepala Bengkel | Admin domain bengkel, backup/restore, manajemen user |
| `Service Advisor` | Service Advisor | Bengkel: WO, program, hotline, stock, customers |
| `Frondesk` | Frondesk | Bengkel: WO, follow-up KPB |
| `Partman` | Partman | Sparepart: stock, hotline, opname |
| `CRM` | Admin CRM | CRM: customers, follow-up KPB, follow-up STNK/BPKB |
| `PIC Stock opname` | PIC Stock Opname | Opname showroom: scan unit/STNK/BPKB |
| `ADH` | ADH | Verifikasi tahap 1 opname showroom |
| `Salesman` | Salesman | Document Handling — serah terima dokumen ke customer |

Default redirect setelah login:

| Role | Halaman Awal |
|------|-------------|
| Admin Showroom | Dashboard Unit (Showroom) |
| Admin CRM | Follow-up KPB |
| Salesman | Document Handling |
| ADH, PIC Stock Opname | Opname Unit Showroom |
| Lainnya | Dashboard Bengkel |

---

## 3. Struktur Navigasi (Sidebar)

Sidebar dibagi menjadi 5 grup. Accordion — hanya satu sub-menu yang terbuka pada satu waktu.

### 3.1 Grup: Workshop

| Sub-menu | Halaman | Akses |
|----------|---------|-------|
| **Operasional** | Dashboard Bengkel | Kepala Cabang, Frondesk, SA, Kabeng, Partman |
| | Workshop (WO List) | Frondesk, SA, Kabeng |
| | Program AHM | SA, Kabeng |
| **Sparepart** | Stok Sparepart | SA, Partman, Kabeng |
| | Part Hotline | SA, Partman, Kabeng |
| **Laporan & Target** | Target Bengkel | Kabeng, Kacab |
| | Dashboard Laporan & Target | Kabeng, Kacab |
| | Analisa Penjualan | Kabeng, Kacab |
| | Laporan Harian | Kabeng, Kacab |
| | Performa Mekanik | Kabeng |

### 3.2 Grup: CRM & Layanan

| Halaman | Akses |
|---------|-------|
| Data Konsumen | Admin CRM, SA, Kabeng |
| Follow-up KPB | Admin CRM, Frondesk, SA, Kabeng |
| Follow-up STNK | Admin CRM |
| Follow-up BPKB | Admin CRM |

### 3.3 Grup: Showroom

| Sub-menu | Halaman | Akses |
|----------|---------|-------|
| **Penjualan** | Target Marketing | Admin, Kacab |
| | Laporan Analisis Penjualan | Admin, Kacab |
| | Laporan Closing Harian | Admin, Kacab |
| **Marketing** | Tabel Diskon | Admin, Kacab |
| | Master TAC | Admin, Kacab |
| | Kalkulator Margin | Admin, Kacab |
| | Master Harga (OTR) | Admin, Kacab |
| | Master Sales | Admin, Kacab |
| | Master Team Leader | Admin, Kacab |
| | Master Beban Dealer | Admin, Kacab |
| | Master Program | Admin, Kacab |
| | Master BBN | Admin, Kacab |
| **Unit** | Dashboard Unit | Admin, Kacab |
| | Stock Unit | Admin, Kacab |
| | Master KSU | Admin, Kacab |
| **STNK & BPKB** | Stock STNK | Admin |
| | Stock BPKB | Admin |
| | Monitoring STNK & BPKB | Admin, Admin CRM, Kacab |
| | Label Buku Service | Admin |
| | Document Handling | Admin, Admin CRM, Kacab, Salesman |

### 3.4 Grup: Stock Opname

| Halaman | Akses |
|---------|-------|
| Opname Sparepart | Partman, Kabeng |
| Opname Unit Showroom | PIC, ADH, Kacab |
| Opname STNK | PIC, ADH, Kacab |
| Opname BPKB | PIC, ADH, Kacab |
| PIC Opname Users | Kacab |

### 3.5 Grup: Administrasi

| Halaman | Akses |
|---------|-------|
| Manajemen User | Kabeng, Kacab |
| Manajemen Akses | Kabeng, Kacab |
| Backup & Restore | Kabeng, Kacab |

---

## 4. Inventaris Halaman Lengkap

Total: **38 halaman** + 1 halaman login + 1 halaman 404.

### 4.1 Auth
| Kode | Halaman | Route |
|------|---------|-------|
| A-01 | Login | `/login` |

### 4.2 Bengkel
| Kode | Halaman | Route |
|------|---------|-------|
| B-01 | Dashboard Bengkel | `/` |
| B-02 | Workshop (WO List) | `/workshop` |
| B-03 | Program AHM (KPB/LCR) | `/monitor-kpb-lcr` |
| B-04 | Stok Sparepart | `/stock` |
| B-05 | Part Hotline | `/hotline` |
| B-06 | Performa Mekanik | `/mechanics` |
| B-07 | Target Bengkel | `/workshop-target` |
| B-08 | Dashboard Laporan & Target | `/workshop-dashboard` |
| B-09 | Analisa Penjualan Bengkel | `/workshop-sales-analysis` |
| B-10 | Laporan Harian Bengkel | `/workshop-closing-daily` |

### 4.3 CRM & Layanan
| Kode | Halaman | Route |
|------|---------|-------|
| C-01 | Data Konsumen | `/customers` |
| C-02 | Follow-up KPB | `/follow-up-kpb` |
| C-03 | Follow-up STNK | `/follow-up-stnk` |
| C-04 | Follow-up BPKB | `/follow-up-bpkb` |

### 4.4 Opname
| Kode | Halaman | Route |
|------|---------|-------|
| O-01 | Opname Sparepart | `/opname` |
| O-02 | Opname Unit Showroom | `/showroom/opname-unit` |
| O-03 | Opname STNK Showroom | `/showroom/opname-stnk` |
| O-04 | Opname BPKB Showroom | `/showroom/opname-bpkb` |
| O-05 | PIC Opname Users | `/showroom/pic-users` |

### 4.5 Showroom — Penjualan
| Kode | Halaman | Route |
|------|---------|-------|
| S-01 | Target Marketing | `/showroom/marketing-target` |
| S-02 | Analisis Penjualan Showroom | `/showroom/dashboard-penjualan` |
| S-03 | Closing Harian Showroom | `/showroom/closing-harian` |

### 4.6 Showroom — Marketing & Master Data
| Kode | Halaman | Route |
|------|---------|-------|
| S-04 | Tabel Diskon | `/showroom/tabel-diskon` |
| S-05 | Master TAC Leasing | `/showroom/tac-leasing` |
| S-06 | Kalkulator Margin (DP & Margin) | `/showroom/sales-order-margin` |
| S-07 | Master Harga OTR | `/showroom/harga-otr` |
| S-08 | Master Sales | `/showroom/salespeople` |
| S-09 | Master Team Leader | `/showroom/team-leader` |
| S-10 | Master Beban Dealer | `/showroom/dealer-burden` |
| S-11 | Master Program | `/showroom/program` |
| S-12 | Master BBN | `/showroom/bbn` |

### 4.7 Showroom — Unit
| Kode | Halaman | Route |
|------|---------|-------|
| S-13 | Dashboard Unit | `/showroom/dashboard` |
| S-14 | Stock Unit | `/showroom/stock-unit` |
| S-15 | Master KSU | `/showroom/ksu` |

### 4.8 Showroom — STNK & BPKB
| Kode | Halaman | Route |
|------|---------|-------|
| S-16 | Stock STNK | `/showroom/stnk` |
| S-17 | Stock BPKB | `/showroom/bpkb` |
| S-18 | Monitoring STNK & BPKB | `/showroom/stnk-bpkb-monitoring` |
| S-19 | Label Buku Service | `/showroom/label-buku-service` |
| S-20 | Document Handling | `/showroom/document-handover` |

### 4.9 Administrasi
| Kode | Halaman | Route |
|------|---------|-------|
| ADM-01 | Manajemen User | `/users` |
| ADM-02 | Manajemen Akses (Role) | `/roles` |
| ADM-03 | Backup & Restore | `/backups` |

---

## 5. Layout Shell Aplikasi

Semua halaman (kecuali Login) menggunakan layout shell yang sama:

```
┌─────────────────────────────────────────────────────┐
│ HEADER                                              │
│  [Hamburger] [Last Sync] [Import Data]  [Bell][☀/☾][User] │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ SIDEBAR  │  KONTEN HALAMAN                          │
│ (fixed)  │                                          │
│          │  Breadcrumb / Page Title                 │
│ Grup 1   │  ─────────────────                       │
│  ▶ Menu  │  Card / Table / Form                     │
│  ▼ Menu  │                                          │
│    Item  │                                          │
│    Item  │                                          │
│ Grup 2   │                                          │
│  ...     │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Header:**
- Kiri: tombol hamburger (mobile), chip "Last Sync", tombol "Import Data" (hanya jika punya akses import)
- Kanan: ikon notifikasi (approval tasks), toggle tema gelap/terang, info user (nama + label role)

**Sidebar:**
- Grup: label teks besar (Workshop, CRM & Layanan, Showroom, Stock Opname, Administrasi)
- Sub-menu dengan ikon + label, expand/collapse per sub-menu (accordion — hanya satu terbuka)
- Item aktif di-highlight
- Di mobile: sidebar overlay (toggle hamburger)

**Import Data Modal (UploadModal):**
- Muncul sebagai modal overlay ketika tombol "Import Data" di header diklik
- Pilihan modul yang bisa diimport sesuai role user
- Preview data sebelum import final
- Progress dan hasil import

---

## 6. Pola Komponen Berulang

Beberapa pola UI yang muncul di banyak halaman:

### 6.1 Tabel Data
- Filter/search di atas tabel
- Kolom sortable
- Pagination
- Baris bisa diklik untuk detail atau expand
- Badge status berwarna (state WO, status dokumen, status opname)

### 6.2 Card KPI / Statistik
- Muncul di Dashboard Bengkel, Dashboard Unit, summary pages
- Icon + angka utama + label + trend (naik/turun)
- Warna accent berbeda per metrik

### 6.3 Form Modal / Inline
- Konfirmasi import (preview → confirm → result)
- Tambah/edit user
- Tambah/edit follow-up
- Upload foto (Document Handling step)

### 6.4 Status Badge
Digunakan untuk state WO, status hotline, status opname, status dokumen:

| Konteks | Contoh Value | Warna |
|---------|-------------|-------|
| WO State | open, done, cancel | biru/hijau/abu |
| Hotline | pending, arrived, done | kuning/hijau |
| Opname | draft, submitted, reviewed, closed | abu/biru/hijau tua |
| Dokumen | pending, selesai, overdue | kuning/hijau/merah |

### 6.5 Alert Panel
Muncul di Dashboard Bengkel: daftar alert kritis dan perhatian dari data importan (stock kritis, WO pending, dll).

---

## 7. Detail Halaman Utama

### A-01 — Login
- Card login center-aligned, single column
- Logo / nama sistem
- Input username dan password
- Tombol Submit
- Tidak ada link register atau lupa password

### B-01 — Dashboard Bengkel
Ringkasan harian seluruh domain bengkel.

Konten:
- Row kartu KPI: Total WO hari ini, Revenue hari ini, Hotline aktif, Critical Stock
- Panel Open WO (tabel)
- Panel Alert (critical dan attention)
- Panel Data Freshness: per modul (Workshop, Stock, Hotline, Customers) — nama file terakhir, waktu sync, row success/error, total aktif

### B-02 — Workshop (WO List)
- Filter: state, type, search, periode (date range)
- Tabel: no WO, tanggal, customer, unit, mekanik, state, total
- Klik baris → detail WO

### B-03 — Program AHM (KPB/LCR)
- Summary card: total, done, open, cancel, revenue
- Filter: program, state, search, tanggal
- Tabel WO program

### B-04 — Stok Sparepart
- Filter: kategori, ranking, search
- Tabel: kode, nama, qty, ranking, aging
- Tombol print label barcode batch (CODE128)
- Badge aging stock

### B-05 — Part Hotline
- Filter: state, jenis PO, search
- Tabel hotline beserta state
- Klik → detail + item part
- Tombol update state

### B-06 — Performa Mekanik
- List mekanik
- Metrik per mekanik: total WO, revenue, rating

### B-07/B-08/B-09/B-10 — Laporan Bengkel
- Halaman laporan berisi chart + tabel
- Filter periode dan kategori
- Target vs aktual
- Closing daily: ringkasan harian dalam format cetak/ekspor

### O-01 — Opname Sparepart
- Sesi opname: buat baru, lanjut sesi aktif
- Scan barcode (input manual atau via kamera)
- Tabel item: kode, nama, qty sistem vs qty scan, selisih
- Submit → approval → BASO (form persetujuan selisih)
- Badge status sesi

### C-01 — Data Konsumen
- Tabel konsumen dari data sales
- Search, filter status KPB
- Detail konsumen: data kendaraan, riwayat KPB

### C-02/C-03/C-04 — Follow-up
- Pipeline follow-up: tabel dengan kolom status, deadline, catatan
- Tambah/edit follow-up per record
- Filter by status, periode

### S-13 — Dashboard Unit (Showroom)
- Kartu KPI: total unit ready, unit aging, unit on proses, target unit
- Chart aging stock unit
- Ringkasan status STNK/BPKB terkait

### S-14 — Stock Unit
- Tabel stock unit aktif: nomor mesin, tipe, warna, status KSU, aging
- Filter: tipe, status, search
- Klik → detail unit + KSU check

### S-18 — Monitoring STNK & BPKB
- Gabungan status tracking STNK dan BPKB
- Filter: status, periode, search engine number
- Tabel dengan badge status: proses, sudah selesai, overdue

### S-20 — Document Handling
- Halaman serah terima dokumen kendaraan ke customer
- List handover: no mesin, salesman, tanggal, status steps
- Buat handover baru: pilih unit, pilih salesman
- Step-by-step wizard upload foto per tahap serah terima
- Ringkasan status: pending/selesai per step

### O-02/O-03/O-04 — Opname Showroom
- Mirip opname sparepart tapi untuk unit/STNK/BPKB
- Alur 3 tahap: PIC Scan → ADH Review → Kacab Approve
- Tabel selisih: data sistem vs data scan
- Badge status per tahap

### ADM-01 — Manajemen User
- Tabel user: nama, username, role, status
- Tambah user (modal form)
- Reset password (modal)
- Hapus user

### ADM-02 — Manajemen Akses
- Tabel matrix: menu vs role
- Checkbox tiap role untuk tiap menuKey
- Simpan perubahan permission

### ADM-03 — Backup & Restore
- List backup tersimpan: nama file, tipe (pre_import/manual/pre_restore), ukuran, tanggal
- Tombol buat backup manual
- Tombol restore (dengan konfirmasi)
- Cleanup backup lama (pre_import only)

---

## 8. Sistem Tema

Aplikasi mendukung dua tema yang bisa di-toggle per user (disimpan di localStorage):

| Token | Terang (Light) | Gelap (Dark) |
|-------|---------------|-------------|
| Background utama | `white` / `slate-50` | `slate-950` |
| Background sidebar | `white` | `slate-900` |
| Background card | `white` | `slate-900` |
| Border | `slate-200` | `white/10` |
| Teks primer | `slate-800` | `slate-100` |
| Teks sekunder | `slate-500` | `slate-400` |
| Accent primary | `blue-600` | `blue-500` |
| Danger | `red-600` | `red-400` |
| Success | `green-600` | `green-400` |
| Warning | `amber-500` | `amber-400` |

Semua komponen harus support kedua tema. Toggle ada di header (ikon matahari/bulan).

---

## 9. Konteks Import Data

Tombol "Import Data" muncul di header untuk user yang punya akses setidaknya satu modul import. Modal import berisi pilihan modul:

| Modul Import | Akses Role |
|-------------|-----------|
| Workshop | Kabeng, Kacab, Frondesk, SA, Partman, IT Master |
| Stock Sparepart | Kabeng, Kacab, SA, Partman, IT Master |
| Hotline Part | Kabeng, Kacab, SA, Partman, IT Master |
| Sales/Customers | Kabeng, Kacab, SA, Frondesk, IT Master |
| Stock Unit Showroom | Admin, Kacab, IT Master |
| Master Harga OTR | Admin, Kacab, IT Master |
| Master Harga Off-Road | Admin, Kacab, IT Master |
| Master Harga Beli Dealer | Admin, Kacab, IT Master |
| Master BBN | Admin, Kacab, IT Master |
| Master Program | Admin, Kacab, IT Master |
| STNK/BPKB Track | Admin, Kacab, IT Master |

Alur import:
1. User pilih file Excel/DOCX/PDF
2. Sistem tampilkan **preview** — ringkasan data, jumlah row, warning
3. User konfirmasi → **import final** — backup otomatis dibuat jika destruktif
4. Sistem tampilkan hasil: row success, row error, nama backup yang dibuat

---

## 10. Notifikasi Approval (Bell)

Panel notifikasi di header (ikon Bell):
- Muncul badge angka jika ada task menunggu
- Panel dropdown: list task dengan filter (Semua, High, Sync, Follow-up)
- Klik task → navigasi ke halaman terkait
- Direfresh tiap 60 detik

---

## 11. Constraint Teknis untuk Desain

| Hal | Nilai |
|-----|-------|
| Target perangkat | Desktop (min. 1280px lebar), bukan mobile-first |
| Mobile | Sidebar overlay, layout responsif minimal |
| Font | System font / Inter |
| Icon library | Lucide React |
| Framework UI | Tailwind CSS v4 (utility-first, no component library) |
| Warna accent utama | Blue (`blue-600` terang, `blue-500` gelap) |
| Bahasa UI | Indonesia |
| Barcode | CODE128, target ukuran label 32mm × 64mm |
| Foto upload | JPEG/PNG, per step Document Handling |

---

## 12. Halaman yang Belum Didokumentasikan Detail

Halaman berikut sudah ada di kode tetapi belum memiliki spesifikasi desain penuh. Prioritas desain lebih rendah atau masih dalam pengembangan:

| Halaman | Kode | Catatan |
|---------|------|---------|
| Tabel Diskon | S-04 | Master diskon per produk |
| Master Sales | S-08 | Daftar salesman aktif |
| Master Team Leader | S-09 | Daftar TL aktif |
| Master Beban Dealer | S-10 | Beban biaya dealer per unit |
| STNK/BPKB Check (`/stnk-bpkb-check`) | — | Cek cepat status dokumen per nomor mesin |
| Label Buku Service | S-19 | Generator label buku servis |
| PIC Opname Users | O-05 | Assign PIC untuk sesi opname |

---

*Dokumen ini adalah referensi kebutuhan produk untuk kebutuhan desain UI/UX. Untuk detail teknis (endpoint, schema, auth), lihat `docs/TRD.md` dan `docs/ERD.md`.*
