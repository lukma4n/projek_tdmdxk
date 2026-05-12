# 🧪 Panduan Testing Import Excel

## Hasil Test

| Modul | Records | Status |
|-------|---------|--------|
| 📦 Stock Parts | 444 items | ✅ Ready |
| 🔧 Workshop | 82,428 WO | ✅ Ready |
| 📞 Hotline | 50 items | ✅ Ready |
| **TOTAL** | **82,922** | ✅ **Ready** |

---

## Cara Import Excel ke Database

### 1. Pastikan Database Jalan

```bash
# Start PostgreSQL + Redis
cd /Users/lukma4n/Documents/Projek_Bengkel
docker-compose up -d
```

### 2. Setup Database (Pertama Kali)

```bash
cd /Users/lukma4n/Documents/Projek_Bengkel/api

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed users
npx prisma db seed
```

### 3. Start Backend

```bash
cd /Users/lukma4n/Documents/Projek_Bengkel/api
npm run dev
```

Backend akan jalan di http://localhost:3001

### 4. Import via Frontend

1. Buka http://localhost:5173
2. Login dengan `roni` / `password`
3. Klik tombol "Import Excel" di header
4. Pilih file:
   - `Report Stock Sparepart 2026-05-01 15_20_59.xlsx`
   - `Report Workshop 2026-05-01 15_24_35.xlsx`
   - `Laporan Part Hotline 2026-05-01 09_45_07.xlsx`
5. Upload → sistem akan parse dan simpan ke database

### 5. Import via API (cURL)

```bash
# 1. Login dulu untuk dapat token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"roni","password":"password"}'

# Response: {"token":"eyJhbGc...","user":{...}}

# 2. Import Stock Excel
curl -X POST http://localhost:3001/api/sync/stock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/Users/lukma4n/Documents/Projek_Bengkel/Report Stock Sparepart 2026-05-01 15_20_59.xlsx"

# 3. Import Workshop Excel
curl -X POST http://localhost:3001/api/sync/workshop \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/Users/lukma4n/Documents/Projek_Bengkel/Report Workshop 2026-05-01 15_24_35.xlsx"

# 4. Import Hotline Excel
curl -X POST http://localhost:3001/api/sync/hotline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/Users/lukma4n/Documents/Projek_Bengkel/Laporan Part Hotline 2026-05-01 09_45_07.xlsx"
```

### 6. Verifikasi Import

```bash
# Check sync logs
curl http://localhost:3001/api/sync/logs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check dashboard
curl http://localhost:3001/api/dashboard/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Format Excel yang Didukung

### Stock Sparepart (22 kolom)
- Row 1-4: Header/judul (di-skip)
- Row 5: Nama kolom
- Row 6+: Data

### Workshop (52 kolom)
- Row 1-4: Header/judul (di-skip)
- Row 5: Nama kolom
- Row 6+: Data
- **Filter**: Hanya `branch_code = 'DXK'` yang di-import
- **Skip**: Rows dengan state atau type kosong

### Hotline (21 kolom)
- Row 1-3: Header/judul (di-skip)
- Row 4: Nama kolom
- Row 5+: Data
- **Filter**: Hanya `branch_code = 'DXK'` yang di-import

---

## Troubleshooting

### Error: "Database connection failed"
```bash
# Check Docker
docker ps

# If not running
docker-compose up -d
```

### Error: "Table does not exist"
```bash
# Run migrations
npx prisma migrate dev
```

### Error: "Duplicate record"
Sistem menggunakan **upsert** (update kalau ada, insert kalau tidak). 
Kalau mau re-import dari awal:
```bash
# Hapus data lama (WASPADA!)
npx prisma db seed --reset
```

---

## Catatan Penting

1. **DXK Only**: Sistem hanya import data dengan `branch_code = 'DXK'`
2. **Upsert**: Data dengan kode yang sama akan di-update, bukan duplikat
3. **Conflict Resolution**: Manual update di web > Excel import (tidak di-overwrite)
4. **Audit Trail**: Setiap import tercatat di `sync_logs`

---

## Data Sample yang Siap Import

| File | Records DXK | Total Rows | Lokasi |
|------|-------------|------------|--------|
| Report Stock Sparepart | 444 | 451 | `.../Projek_Bengkel/` |
| Report Workshop | 82,428 | 82,436 | `.../Projek_Bengkel/` |
| Laporan Part Hotline | 50 | 56 | `.../Projek_Bengkel/` |
