# DXK Workshop & Sparepart System - Backend API

Backend Express 5 untuk sistem Workshop & Sparepart DXK. Database lokal memakai SQLite file-based melalui Prisma.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
node src/app.js
```

Server berjalan di:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/health
```

Docker tidak dibutuhkan untuk development lokal. Redis bersifat optional dan aplikasi tetap berjalan jika Redis tidak tersedia.

## Environment Variables

```env
DATABASE_URL=file:./dev.db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Lokasi file SQLite Prisma, relatif terhadap folder `prisma` |
| `REDIS_URL` | Optional Redis URL untuk cache dashboard |
| `JWT_SECRET` | Secret key untuk JWT |
| `JWT_EXPIRES_IN` | Masa berlaku JWT |
| `NODE_ENV` | Environment runtime |
| `PORT` | Port backend |
| `FRONTEND_URL` | Origin frontend untuk CORS |

## Seed User

Seed bawaan dapat dijalankan dengan:

```bash
npx prisma db seed
```

User seed:

| Username | Password | Role |
|----------|----------|------|
| roni | password | Frondesk |
| dina | password | Service Advisor |
| pakhendra | password | Kepala Bengkel |
| busari | password | Partman |

Database aktif bisa berbeda dari seed jika memakai file `api/prisma/dev.db` yang sudah berisi data produksi/lokal.

## Authorization

Semua endpoint operasional membutuhkan JWT. Endpoint juga dibatasi per role, bukan hanya login.

| Modul | Role |
|-------|------|
| Dashboard Bengkel | Kepala Cabang, Frondesk, Service Advisor, Kepala Bengkel, Partman |
| Customers | CRM, Service Advisor, Kepala Bengkel |
| Opname | Partman, Kepala Bengkel |
| Hotline | Service Advisor, Partman, Kepala Bengkel |
| Stock | Service Advisor, Partman, Kepala Bengkel |
| Workshop list/summary | Frondesk, Service Advisor, Kepala Bengkel |
| Workshop program KPB/LCR | Service Advisor, Kepala Bengkel |
| Mechanic performance | Kepala Bengkel |
| Users | Kepala Bengkel |

## Sync Import

Import Excel memakai strategi berbeda per modul. Hotline, stock, dan workshop memakai Replace All, sehingga data lama modul terkait dihapus dan diganti dengan data Excel terbaru. Sales/Customer memakai upsert by `so_number` agar follow-up KPB tetap aman saat import ulang.
Backend membuat backup SQLite otomatis sebelum setiap import destruktif.

| Endpoint | Role |
|----------|------|
| `POST /api/sync/hotline` | Service Advisor, Partman, Kepala Bengkel |
| `POST /api/sync/stock` | Partman, Kepala Bengkel |
| `POST /api/sync/workshop` | Frondesk, Service Advisor, Kepala Bengkel |
| `POST /api/sync/sales` | Service Advisor, Kepala Bengkel |
| `GET /api/sync/logs` | Kepala Bengkel |

Upload file harus memakai `multipart/form-data` melalui `FormData`.

Preview sebelum Replace All tersedia di endpoint berikut:

| Endpoint | Role |
|----------|------|
| `POST /api/sync/hotline/preview` | Service Advisor, Partman, Kepala Bengkel |
| `POST /api/sync/stock/preview` | Partman, Kepala Bengkel |
| `POST /api/sync/workshop/preview` | Frondesk, Service Advisor, Kepala Bengkel |
| `POST /api/sync/sales/preview` | Service Advisor, Kepala Bengkel |

Backup dan restore hanya untuk Kepala Bengkel dan Kepala Cabang:

- `GET /api/sync/backups` - list backup SQLite.
- `POST /api/sync/backups` - buat backup manual.
- `POST /api/sync/backups/cleanup` - hapus backup `pre_import_*` lama dan simpan 30 terbaru secara default.
- `POST /api/sync/backups/:filename/restore` - restore dari backup. Sistem membuat backup `pre_restore` lebih dulu.
- `GET /api/sync/audit-logs` - riwayat operasional import, backup manual, dan restore.

Cleanup tidak menghapus backup `manual` atau `pre_restore`.

## API Endpoints

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard Bengkel

- `GET /api/dashboard/summary`

Response dashboard juga berisi `freshness` per modul: import terakhir, filename, rows success/error, dan total row aktif.

### Hotline

- `GET /api/hotline`
- `GET /api/hotline/:id`
- `PATCH /api/hotline/:id/state`

### Stock

- `GET /api/stock`
- `GET /api/stock/categories`
- `GET /api/stock/:code`

### Workshop

- `GET /api/workshop`
- `GET /api/workshop/summary`
- `GET /api/workshop/program-summary`
- `GET /api/workshop/mechanics`
- `GET /api/workshop/mechanics/performance`

### Customers

- `GET /api/customers`
- `GET /api/customers/summary`
- `GET /api/customers/alerts`
- `GET /api/customers/models`
- `GET /api/customers/export`
- `GET /api/customers/followups/export`
- `GET /api/customers/:id/followups`
- `POST /api/customers/:id/followups`

Status follow-up valid: `belum_dihubungi`, `sudah_dihubungi`, `booking`, `datang`, `batal`.
Export Follow-up KPB tersedia untuk Frondesk, Service Advisor, dan Kepala Bengkel.

### Opname

- `GET /api/opname`
- `POST /api/opname`
- `GET /api/opname/:id/items`
- `GET /api/opname/:id/report`
- `POST /api/opname/:id/items`
- `PATCH /api/opname/:id/items/:itemId`
- `DELETE /api/opname/:id/items/:itemId`
- `PATCH /api/opname/:id/complete`
- `DELETE /api/opname/:id`

### Users

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `PATCH /api/users/:id/reset-password`

### Showroom

- `GET /api/showroom/dashboard` - dashboard showroom unit, aging, lokasi, series, dan dokumen
- `GET /api/showroom/stock-units` - list stock unit showroom, mendukung filter `aging_min`
- `GET /api/showroom/stock-units/summary` - summary stock unit dan aging
- `GET /api/showroom/stock-units/filters` - opsi filter series/state/lokasi
- `POST /api/showroom/stock-units/preview` - preview import stock unit
- `POST /api/showroom/stock-units/import` - import stock unit upsert by `engine_number`
- `GET /api/showroom/stnks` - list stock STNK showroom
- `GET /api/showroom/stnks/summary` - summary stock STNK
- `GET /api/showroom/stnks/filters` - opsi filter lokasi STNK
- `POST /api/showroom/stnks/preview` - preview import stock STNK
- `POST /api/showroom/stnks/import` - import stock STNK upsert by `engine_number`
- `GET /api/showroom/bpkbs` - list stock BPKB showroom
- `GET /api/showroom/bpkbs/summary` - summary stock BPKB
- `GET /api/showroom/bpkbs/filters` - opsi filter lokasi BPKB
- `POST /api/showroom/bpkbs/preview` - preview import stock BPKB
- `POST /api/showroom/bpkbs/import` - import stock BPKB upsert by `engine_number`
- `GET /api/showroom/otr-prices` - list master Harga OTR
- `GET /api/showroom/otr-prices/summary` - summary master Harga OTR
- `POST /api/showroom/otr-prices/preview` - preview import SK Harga OTR `.docx`
- `POST /api/showroom/otr-prices/import` - import SK Harga OTR upsert by `product_code`
- `POST /api/showroom/otr-prices/off-purchase/preview` - preview import SK Harga Off & Beli `.docx`
- `POST /api/showroom/otr-prices/off-purchase/import` - import SK Harga Off & Beli upsert by `product_code`

Endpoint showroom tahap awal hanya untuk `Admin` dan `Kepala Cabang`.

## Testing

```bash
npm test
```

Test minimal saat ini mencakup parser import dan role authorization middleware.
