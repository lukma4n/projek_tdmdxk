# DXK Workshop & Sparepart System - Frontend

Frontend Vite + React 19 untuk sistem operasional Workshop & Sparepart DXK.

## Stack

- Vite + React 19
- Tailwind CSS v4
- React Router
- Zustand
- lucide-react

## Setup

```bash
npm install
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

Backend default:

```text
http://localhost:3001
```

Proxy API memakai path `/api`. Jika perlu override, buat `.env`:

```env
VITE_API_URL=/api
```

## Modul Utama

- Dashboard KPI bengkel, hotline, stock, revenue, dan alerts.
- Dashboard data freshness untuk status import terakhir per modul.
- Workshop list dan monitoring Program AHM KPB/LCR.
- Hotline part tracking.
- Stock sparepart, aging, ranking, dan barcode label.
- Stock opname dengan barcode scanner.
- Data konsumen after-sales dan status KPB.
- Follow-up konsumen KPB dengan status kontak dan catatan.
- Halaman Follow-up KPB dengan filter status/KPB, aksi cepat booking/datang/batal, dan tombol WhatsApp template.
- Export Excel Follow-up KPB mengikuti filter aktif.
- Manajemen user untuk Kepala Bengkel.
- Backup & Restore SQLite untuk Kepala Bengkel dan Kepala Cabang.
- Import Excel global dengan preview sebelum Replace All.
- Dashboard, Stock Unit, Master Harga, STNK, dan BPKB Showroom untuk Admin Showroom dan Kepala Cabang.
- Admin CRM mendapat Data Konsumen, Follow-up KPB, Follow-up STNK, dan Follow-up BPKB.
- Follow-up BPKB CRM hanya untuk pembelian cash; BPKB leasing tidak ditampilkan.

## Role Frontend

| Role | Menu |
|------|------|
| Admin Showroom | Dashboard Showroom, Stock Unit Showroom, Master Harga, Stock STNK, Stock BPKB |
| Kepala Cabang | Dashboard Bengkel, Dashboard Showroom, Stock Unit Showroom, Master Harga, Manajemen User, Backup & Restore |
| Kepala Bengkel | Semua menu |
| Frondesk | Dashboard Bengkel, Workshop, Follow-up KPB |
| Service Advisor | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Data Konsumen, Follow-up KPB |
| Partman | Dashboard Bengkel, Stock, Hotline, Opname |
| Admin CRM | Data Konsumen, Follow-up KPB, Follow-up STNK, Follow-up BPKB |

Frontend menyembunyikan menu berdasarkan role dan memakai route guard. Backend tetap menjadi sumber authorization final.
Route admin `Backup & Restore` tersedia di `/backups` dan hanya dapat diakses oleh Kepala Bengkel dan Kepala Cabang.

## Backup & Restore

Halaman `/backups` menyediakan:

- Daftar backup SQLite di `api/prisma/backups`.
- Total ukuran backup.
- Tombol backup manual.
- Cleanup backup `pre_import_*` lama, default menyimpan 30 terbaru.
- Restore backup dengan konfirmasi eksplisit.
- Informasi backup `pre_restore` yang dibuat otomatis sebelum restore.
- Riwayat operasional import, backup manual, dan restore terbaru.

## Import Excel

Import dilakukan dari tombol `Import Excel` di header.

Alur aman:

1. Pilih modul dan file Excel.
2. Klik `Preview` untuk melihat jumlah baris valid/error.
3. Klik `Upload` hanya setelah preview berhasil.
4. Backend membuat backup SQLite otomatis sebelum Replace All.

Catatan: upload harus memakai `FormData`; jangan mengirim `Content-Type: application/json` secara manual.

## Validasi

```bash
npm run lint
npm run build
```
