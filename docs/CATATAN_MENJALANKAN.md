# Catatan Menjalankan Sistem DXK

## Ringkasan

Sistem DXK sekarang berjalan **manual** (bukan otomatis via PM2). Kamu perlu jalankan 2 terminal: 1 untuk backend API, 1 untuk frontend dev server.

---

## Prasyarat

Pastikan berada di folder project:
```bash
cd /Users/lukma4n/Documents/projek_tdmdxk
```

**Pre-start checklist:**
- [ ] SQLite file `api/prisma/dev.db` ada dan tidak corruption (`sqlite3 api/prisma/dev.db "PRAGMA integrity_check;"` → harus `ok`)
- [ ] Environment (`api/.env`) terisi benar: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
- [ ] Port 3001 dan 5173 tidak dipakai aplikasi lain (`lsof -i :3001` dan `lsof -i :5173`)
- [ ] Node.js tersedia (`node -v` → v20+)
- [ ] `npm install` sudah dilakukan di `api/` dan `web/` (hanya sekali saat clone/update dependensi baru)

---

## Cara Menjalankan

### Langkah 1: Start Backend (Terminal 1)

```bash
cd /Users/lukma4n/Documents/projek_tdmdxk/api
node src/app.js
```

**Output yang diharapkan:**
```
✅ SQLite connected
🚀 Server running on http://localhost:3001
```

**Jangan tutup terminal ini.** Biarkan tetap terbuka.

**Untuk stop backend:** Tekan `Ctrl + C`

---

### Langkah 2: Start Frontend (Terminal 2)

Buka terminal/tab baru:

```bash
cd /Users/lukma4n/Documents/projek_tdmdxk/web
npm run dev
```

**Output yang diharapkan:**
```
🚀 VITE v8.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

**Jangan tutup terminal ini.** Biarkan tetap terbuka.

**Untuk stop frontend:** Tekan `Ctrl + C`

---

## SOP Operasional Harian

### Startup (Urutan Wajib)
1. **Terminal 1** — jalankan backend: `cd api && node src/app.js`
2. Tunggu sampai muncul `🚀 Server running on http://localhost:3001`
3. **Terminal 2** — jalankan frontend: `cd web && npm run dev`
4. Tunggu sampai muncul `Local: http://localhost:5173`
5. Buka browser ke `http://localhost:5173` dan login.
6. **Verifikasi** — buka `http://localhost:3001/health` di tab baru; harus muncul JSON: `{ status: "ok" }`

### Shutdown (Urutan Wajib)
1. **Terminal 2** — tekan `Ctrl + C` untuk stop frontend.
2. **Terminal 1** — tekan `Ctrl + C` untuk stop backend.

### Restart Tanpa Tutup Semua Terminal
```bash
# Terminal 1 (backend)
Ctrl + C
node src/app.js

# Terminal 2 (frontend)
Ctrl + C
npm run dev
```

---

## Troubleshooting

### Backend tidak merespons
- Pastikan terminal backend masih terbuka
- Coba ulang: `cd api && node src/app.js`
- Cek error: lihat pesan di terminal backend

### Frontend tidak terbuka
- Pastikan terminal frontend masih terbuka
- Coba ulang: `cd web && npm run dev`
- Pastikan port 5173 tidak dipakai app lain

### Login gagal terus
- Pastikan backend sudah jalan (lihat langkah 1)
- Coba refresh halaman browser
- Cek health: `http://localhost:3001/health`

### Database error
```bash
cd api
npx prisma validate
npx prisma generate
```

### Import gagal tengah jalan
- Backend mengunci import per modul (hotline/stock/workshop/sales). Jika proses gagal tengah jalan, restart backend untuk reset lock, atau tunggu 10 menit auto-expire. Tidak perlu khawatir kerusakan data karena SQLite backup selalu dibuat sebelum import destruktif.

### Monitoring Stok Per Lokasi
- Upload file stok (`Stock.xlsx`) sekarang juga menulis detail per lokasi ke tabel `stock_part_locations`.
- Halaman **Stock** (`/stock`) menampilkan ringkasan jumlah part per lokasi (Gudang, POS, dll) di atas tabel.
- Klik kartu lokasi untuk filter part di lokasi tersebut. Gunakan tombol **Reset** untuk kembali ke tampilan semua lokasi.
- Jika data lokasi tidak muncul setelah import, pastikan file Excel memiliki kolom `location`/`Gudang`/`Kode Cabang` yang terisi. Hapus filter lokasi di UI untuk melihat aggregate seluruh cabang.

---

## Verifikasi Cepat Sebelum/Habis Kerja

```bash
# Di folder api/
npx prisma validate       # Harus: Valid
node --test tests/*.test.js  # Semua test harus pass

# Di folder web/
npm run lint              # Harus: 0 error
npm run build             # Harus: build success
```

## Rollback Cepat (Jika Ada Masalah Serius)
1. Stop backend (`Ctrl + C`).
2. Copy dari backup manual terakhir:
   ```bash
   cp api/prisma/backups/dev.db.backup.manual.TIMESTAMP api/prisma/dev.db
   ```
3. Restart backend: `node src/app.js`.

---

---

## Mode Production (Kalau Butuh)

Kalau ingin build frontend jadi static dan serve dari backend (1 port saja):

```bash
# 1. Build frontend
cd /Users/lukma4n/Documents/projek_tdmdxk/web
npm run build

# 2. Ubah ke production mode
cd /Users/lukma4n/Documents/projek_tdmdxk/api
# Edit .env: NODE_ENV=production, FRONTEND_URL=http://localhost:3001

# 3. Start backend saja
node src/app.js

# 4. Buka http://localhost:3001
```

*(Tidak perlu jalankan frontend dev server karena backend akan serve file static)*

---

## Catatan Teknis

- **Backend Port:** 3001 (Express + Prisma + SQLite)
- **Frontend Port:** 5173 (Vite dev server)
- **Database:** SQLite file `api/prisma/dev.db`
- **Auth:** JWT via httpOnly cookie
- **Auto-reload:** Aktif di frontend (edit kode → otomatis refresh)

---

## Perintah Berguna

```bash
# Cek backend jalan
curl http://localhost:3001/health

# Build frontend (kalau perlu)
cd web && npm run build

# Validasi database
cd api && npx prisma validate

# Lint frontend
cd web && npm run lint
```

---

**Terakhir diupdate:** 8 Mei 2026  
**Update:** Ditambahkan SOP startup/shutdown, checklist pre-start, troubleshooting import lock, dan langkah verifikasi sebelum/after kerja.
