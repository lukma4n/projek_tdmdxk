# Ringkasan Proyek: DXK Operation System

**Versi**: 1.0  
**Tanggal Update**: 12 Mei 2026  
**Status**: Produksi (Siap Pakai Harian)

---

## 1. Deskripsi

Sistem operasional terintegrasi untuk **TDM Ketapang (DXK)** yang mencakup:
- Bengkel (Workshop, Hotline, Stock Part, Mekanik)
- Showroom (Stock Unit, STNK, BPKB, Master Data, Margin Calculator)
- CRM (Follow-up KPB, STNK, BPKB)
- Stock Opname (Bengkel & Showroom)
- Backup & Restore

---

## 2. Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| **Frontend Web** | Vite + React 19 + Tailwind CSS v4 + shadcn/ui + React Router + Zustand + lucide-react |
| **Mobile** | React Native + Expo (untuk Opname Showroom) |
| **Backend** | Node.js + Express 5 + Prisma + SQLite (file-based) |
| **Auth** | JWT (24h expiry) + httpOnly cookie |
| **Barcode** | jsbarcode (CODE128) |
| **Import** | xlsx (Excel), mammoth (DOCX) |
| **Print** | Window.print() dengan template HTML |

---

## 3. Struktur Folder

```
projek_tdmdxk/
├── api/                    # Backend API
│   ├── src/
│   │   ├── app.js          # Entry point
│   │   ├── config/         # DB config
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth & authz
│   │   ├── routes/         # API routes
│   │   └── services/       # Shared services
│   ├── prisma/
│   │   ├── dev.db          # Database SQLite (~12MB, 82.500+ records)
│   │   ├── schema.prisma   # Schema DB
│   │   └── backups/        # Backup otomatis
│   └── tests/              # Integration tests
├── web/                    # Frontend Web
│   ├── src/
│   │   ├── pages/          # Halaman utama
│   │   ├── components/     # Komponen reusable
│   │   ├── services/api/   # API client (pecah per modul)
│   │   ├── stores/         # Zustand stores
│   │   └── config/         # Role config
│   └── dist/               # Build output
├── mobile/                 # React Native + Expo
│   └── src/
│       ├── screens/        # Layar mobile
│       └── api.js          # API client mobile
└── [dokumentasi MD]        # Lihat bagian Dokumentasi
```

---

## 4. Modul & Fitur

### Bengkel
| Modul | Deskripsi | Role |
|-------|-----------|------|
| Dashboard | Ringkasan WO, hotline, stock | Kepala Cabang, Frondesk, Service Advisor, Kepala Bengkel, Partman |
| Workshop | Manajemen Work Orders | Frondesk, Service Advisor, Kepala Bengkel |
| Hotline | Part hotline & order | Service Advisor, Kepala Bengkel, Partman |
| Stock | Stok sparepart (566 item) | Service Advisor, Kepala Bengkel, Partman |
| Opname | Stock opname sparepart | Partman, Kepala Bengkel, Kepala Cabang |
| Mekanik | Performa mekanik | Kepala Bengkel |
| Program AHM | Monitor KPB/LCR | Service Advisor, Kepala Bengkel |

### Showroom
| Modul | Deskripsi | Role |
|-------|-----------|------|
| Dashboard | Total unit, aging, lokasi, dokumen | Admin, Kepala Cabang |
| Stock Unit | 151 unit, filter aging, export Excel | Admin, Kepala Cabang |
| Stock STNK | 715 dokumen, export Excel | Admin |
| Stock BPKB | 400 dokumen, export Excel | Admin |
| Master Harga | 198 kode produk, OTR/Off/Beli | Admin, Kepala Cabang |
| Master BBN | 1.079 row, 514 kab/kota | Admin, Kepala Cabang |
| TAC Leasing | ADIRA/FIF/OTO/IMFI | Admin, Kepala Cabang |
| Program MD/AHM/Dealer | Sales discount | Admin, Kepala Cabang |
| KSU | Kelengkapan standar unit | Admin, Kepala Cabang |
| Simulasi DP & Margin | Kalkulator margin showroom | Admin, Kepala Cabang |
| Opname Unit/STNK/BPKB | Scan barcode + validasi | PIC, Lead PIC, ADH, Kepala Cabang |

### CRM
| Modul | Deskripsi | Role |
|-------|-----------|------|
| Data Konsumen | 10.069 customers | CRM, Service Advisor, Kepala Bengkel |
| Follow-up KPB | WhatsApp, export Excel | CRM, Frondesk, Service Advisor, Kepala Bengkel |
| Follow-up STNK | Tracking dokumen STNK | CRM |
| Follow-up BPKB | Tracking dokumen BPKB (cash only) | CRM |

### Administrasi
| Modul | Deskripsi | Role |
|-------|-----------|------|
| Manajemen User | CRUD user, reset password | Kepala Bengkel, Kepala Cabang |
| Backup & Restore | Backup SQLite otomatis/manual | Kepala Bengkel, Kepala Cabang |

---

## 5. Role & Hak Akses

| Role | Menu Terlihat |
|------|---------------|
| **Admin** | Semua Showroom + Dashboard |
| **ADH** | Verifikasi Opname Showroom |
| **Kepala Cabang** | Dashboard Bengkel & Showroom, Stock Unit, Master, Opname, Manajemen User, Backup |
| **Kepala Bengkel** | Semua Bengkel + Mekanik + Manajemen User + Backup |
| **Frondesk** | Dashboard, Workshop, Follow-up KPB |
| **Service Advisor** | Dashboard, Hotline, Stock, Workshop, Program AHM, Customers, Follow-up KPB |
| **Partman** | Dashboard, Hotline, Stock, Opname |
| **CRM** | Data Konsumen, Follow-up KPB/STNK/BPKB |
| **PIC Stock opname** | Mobile scan only (no web) |
| **Lead PIC Stock opname** | Opname Unit, PIC Users, Validasi, Stock Unit |

---

## 6. API Endpoints (Port 3001)

### Auth
- `POST /api/auth/login` — Login (Bearer token + cookie)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user

### Bengkel
- `GET|POST /api/workshop` — Work orders
- `GET|POST /api/hotline` — Part hotline
- `GET|POST /api/stock` — Sparepart stock
- `GET /api/stock/categories` — Kategori part
- `GET /api/stock/locations` — Lokasi stock
- `GET /api/opname` — Stock opname bengkel

### Showroom
- `GET /api/showroom/stock-units` — Stock unit
- `GET /api/showroom/stnks` — Stock STNK
- `GET /api/showroom/bpkbs` — Stock BPKB
- `GET /api/showroom/otr-prices` — Master harga
- `GET|POST /api/showroom/bbn-prices` — Master BBN
- `GET|POST /api/showroom/tac-programs` — TAC Leasing
- `GET|POST /api/showroom/promo-schemes` — Dana Promosi IMFI
- `GET|POST /api/showroom/md-programs` — Program MD/AHM/Dealer
- `GET|POST /api/showroom/ksu` — Master KSU
- `GET|POST /api/showroom/opname` — Opname sessions
- `POST /api/showroom/opname/:id/scan` — Scan opname
- `POST /api/showroom/opname/:id/scan-with-photo` — Scan dengan foto

### CRM
- `GET|POST /api/customers` — Data konsumen
- `GET|POST /api/customers/followups` — Follow-up KPB
- `GET|POST /api/showroom/document-followups` — Follow-up STNK/BPKB

### Administrasi
- `GET|POST|PATCH|DELETE /api/users` — Manajemen user
- `GET|POST /api/backups` — Backup & restore
- `GET /api/audit-logs` — Audit log

### Import
- `POST /api/sync/workshop` — Import workshop
- `POST /api/sync/hotline` — Import hotline
- `POST /api/sync/stock` — Import stock
- `POST /api/sync/customers` — Import customers (upsert)
- `POST /api/sync/showroom` — Import showroom data

---

## 7. Database

- **Engine**: SQLite (file-based)
- **File**: `api/prisma/dev.db` (~12MB)
- **ORM**: Prisma
- **Schema**: 40+ tabel

### Tabel Utama
| Tabel | Isi |
|-------|-----|
| `users` | User accounts (13 users aktif) |
| `work_orders` | 60.982 WO |
| `stock_parts` | 566 item sparepart |
| `hotlines` | 50 item hotline |
| `customers` | 10.069 sales/customer |
| `showroom_stock_units` | 151 unit |
| `showroom_stnks` | 715 dokumen STNK |
| `showroom_bpkbs` | 400 dokumen BPKB |
| `showroom_otr_prices` | 198 master harga |
| `showroom_bbn_prices` | 1.079 master BBN |
| `showroom_leasing_tac_programs` | Matrix TAC ADIRA/FIF/OTO |
| `showroom_leasing_promo_schemes` | Dana Promosi IMFI |
| `showroom_md_programs` | Program MD/AHM/Dealer |
| `showroom_opname_sessions` | Sesi opname showroom |
| `showroom_opname_items` | Hasil scan opname |
| `showroom_opname_assignments` | Assignment PIC per lokasi |
| `showroom_document_followups` | Follow-up dokumen |
| `sync_logs` | Log import data |
| `audit_logs` | Log operasi kritis |

---

## 8. Status & Perubahan Terbaru (12 Mei 2026)

### Yang Baru Ditambahkan
1. ✅ **Multi-Select Print Label BPKB** — Checkbox per baris, print terpilih, clear selection
2. ✅ **Multi-Select Print Label Stock Part** — Sama seperti BPKB
3. ✅ **Tombol Clear/Batal Pilih** — Di Stock & BPKB (ikon X)
4. ✅ **Perbaikan Lint Error** — Users.jsx (setState in effect)
5. ✅ **Reset Password User** — danu (Partman)

### Dalam Pengembangan
- 🔄 **Opname Showroom Mobile** — React Native + Expo (scan dengan foto, offline sync)
- 🔄 **Role Lead PIC Stock opname** — Koordinator PIC dengan hak admin

### Server Status
| Komponen | Status | Port |
|----------|--------|------|
| Backend API | 🟢 Running | 3001 |
| Frontend Web | 🟢 Running | 5173 |
| Mobile (Expo) | 🟢 Ready | 8081 |

### Build Status
- Backend tests: 26/26 passed ✅
- Frontend lint: Bersih (kecuali 5 error di ShowroomOpname.jsx — non-critical)
- Frontend build: Sukses ✅

---

## 9. Cara Menjalankan

### Backend
```bash
cd api
node src/app.js
# atau
npm start
```

### Frontend
```bash
cd web
npm run dev
```

### Akses
- Web: http://localhost:5173
- API: http://localhost:3001
- Health Check: http://localhost:3001/health

---

## 10. Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| "Unauthorized" saat login | Cek password, reset jika perlu |
| "Akses ditolak" (403) | Cek role user di database |
| Token expired | Login ulang |
| Port 3001/5173 sudah dipakai | Kill process: `lsof -ti:3001 | xargs kill -9` |
| Import Excel gagal | Cek format file, pastikan bukan password-protected |
| Barcode tidak tampil | Cek koneksi internet (CDN jsbarcode) |
| Build gagal | `rm -rf node_modules && npm install` |

---

## 11. Dokumentasi Lengkap

| File | Isi |
|------|-----|
| `README.md` | Quick start, stack, login, endpoint, troubleshooting |
| `AGENTS.md` | Konteks kerja cepat untuk AI/developer |
| `PRD.md` | Product requirements, scope bisnis, roadmap |
| `BLUEPRINT.md` | Arsitektur besar, alur data, workflow |
| `ERD.md` | Database schema, entitas, relasi |
| `FSD.md` | Feature specification per modul |
| `TRD.md` | Technical specification, env, security |
| `rencana_perbaikan.md` | Hasil review, risiko, backlog |
| `CATATAN_PEKERJAAN_OPNAME.md` | Detail pekerjaan opname showroom |
| `CATATAN_MENJALANKAN.md` | Catatan cara menjalankan sistem |
| `TESTING_GUIDE.md` | Panduan testing |

---

**Dibuat oleh**: OpenCode Agent  
**Versi**: 1.0  
**Tanggal**: 12 Mei 2026
