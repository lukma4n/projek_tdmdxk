# Reset Total + Reinstall Bersih (server lama → pasang ulang)

Untuk: server yang **sudah pernah live** dengan projek ini, deploy via **git**,
ingin **hapus deploy lama sepenuhnya** lalu pasang ulang versi terbaru —
**tanpa kehilangan data riil** (konsumen, STNK, pickup, foto KTP).

> **Prinsip keselamatan:**
> - Data (`dev.db`, `uploads/`) **TIDAK ikut git** (ada di `.gitignore`). Anda
>   **wajib menyalinnya keluar manual** sebelum menghapus apa pun.
> - **Verifikasi backup tersalin** sebelum `rm`. Jangan menaruh backup di dalam
>   folder yang akan dihapus.
> - **Jangan hapus `/etc/letsencrypt`** — sertifikat HTTPS bisa dipakai ulang.
> - Node, Nginx, PM2 yang sudah terpasang **tidak perlu dicopot** — cukup
>   deploy lama (kode + proses PM2 + site Nginx) yang dibersihkan.

Ganti `app.domain-anda.com` sesuai domain Anda. Semua langkah di **server**.

---

## STEP 0 — Kenali kondisi saat ini

```bash
pm2 list                                   # catat NAMA app lama (mis. dxk-api)
ls -l /etc/nginx/sites-enabled/            # catat nama site lama
ls -d ~/projek_tdmdxk 2>/dev/null || pwd   # cari lokasi folder kode lama
```
Catat: nama proses PM2, nama file site Nginx, dan path folder kode. Dipakai di
langkah berikut. (Di bawah diasumsikan folder `~/projek_tdmdxk`, app `dxk-api`,
site `dxk.conf` — sesuaikan.)

---

## STEP 1 — SELAMATKAN DATA (paling penting)

Buat folder aman **di luar** folder kode, lalu salin DB + uploads + .env:
```bash
mkdir -p ~/dxk-safe
cd ~/projek_tdmdxk/api

# Backup DB konsisten (flush WAL) pakai skrip repo, lalu salin keluar:
node scripts/backup-db.js 30
cp prisma/dev.db                 ~/dxk-safe/dev.db
cp -r uploads                    ~/dxk-safe/uploads
cp .env                          ~/dxk-safe/env.lama        # untuk referensi config
cp -r prisma/backups             ~/dxk-safe/backups 2>/dev/null || true
```

**Verifikasi backup BENAR-BENAR ada & utuh** (jangan lanjut bila gagal):
```bash
ls -lh ~/dxk-safe/dev.db                    # ukuran wajar, bukan 0 byte
ls ~/dxk-safe/uploads/pickup-ktp | head     # foto KTP terlihat
```

**Sangat disarankan**: tarik juga salinan ke laptop Anda (🖥️ dari laptop):
```bash
scp -r deploy@SERVER_IP:~/dxk-safe ./dxk-safe-$(date +%Y%m%d)
```

---

## STEP 2 — Bongkar deploy lama

```bash
# Hentikan & hapus proses PM2 lama
pm2 stop dxk-api  && pm2 delete dxk-api
pm2 save

# Lepas site Nginx lama (sertifikat di /etc/letsencrypt TETAP, jangan dihapus)
sudo rm -f /etc/nginx/sites-enabled/dxk.conf
sudo rm -f /etc/nginx/sites-available/dxk.conf
sudo nginx -t && sudo systemctl reload nginx

# Hapus folder kode lama (data sudah aman di ~/dxk-safe)
rm -rf ~/projek_tdmdxk
```

---

## STEP 3 — Clone bersih versi terbaru

```bash
cd ~ && git clone <URL_REPO> projek_tdmdxk
cd projek_tdmdxk && git checkout main      # atau feat/fase2-pickup-request bila belum di-merge
```

---

## STEP 4 — Kembalikan data + siapkan backend

```bash
cd ~/projek_tdmdxk/api
npm ci
npx prisma generate

# .env: pakai template, isi secret baru (atau salin nilai dari ~/dxk-safe/env.lama).
cp .env.production.example .env
openssl rand -hex 32        # → tempel ke JWT_SECRET (ganti JWT_SECRET = semua sesi logout, wajar)
nano .env                   # set NODE_ENV=production, FRONTEND_URL & ALLOWED_ORIGINS=https://app.domain-anda.com

# KEMBALIKAN DATA RIIL ke instalasi baru:
cp ~/dxk-safe/dev.db        prisma/dev.db
rm -rf uploads && cp -r ~/dxk-safe/uploads uploads
```

**Terapkan migrasi pada DB lama yang dikembalikan:**
```bash
npx prisma migrate status
```
- Jika **"Database schema is up to date"** atau ada migrasi *pending* → jalankan:
  ```bash
  npx prisma migrate deploy
  ```
- Jika **error / minta baseline** (DB lama dibuat sebelum sistem migrasi, jadi
  tabel sudah ada tapi riwayat migrasi belum tercatat) → tandai baseline
  sebagai sudah diterapkan **lalu** deploy sisanya:
  ```bash
  npx prisma migrate resolve --applied 20260621000000_baseline_current_schema
  npx prisma migrate deploy
  ```
  > Aman: `resolve --applied` hanya menulis ke tabel riwayat, **tidak** mengubah
  > data/tabel Anda. `migrate deploy` lalu menerapkan migrasi pickup yang baru
  > (kolom foto KTP dll) tanpa menghapus data.

**Build frontend:**
```bash
cd ~/projek_tdmdxk/web && npm ci && npm run build
```

---

## STEP 5 — Jalankan ulang (PM2 + Nginx + HTTPS)

```bash
# PM2
cd ~/projek_tdmdxk
mkdir -p api/logs
pm2 start ecosystem.config.js && pm2 save

# Cek app hidup di loopback
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/health   # 200

# Nginx (config baru dari repo)
sudo cp deploy/nginx/dxk.conf /etc/nginx/sites-available/dxk.conf
sudo sed -i 's/app.domain-anda.com/APP.DOMAIN-ASLI.COM/' /etc/nginx/sites-available/dxk.conf
sudo ln -s /etc/nginx/sites-available/dxk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS — certbot akan PAKAI ULANG sertifikat lama (tak perlu terbit baru)
sudo certbot --nginx -d app.domain-anda.com
```
> Jika certbot bilang sertifikat sudah ada, pilih opsi **reinstall/keep** lalu
> aktifkan redirect. Tidak ada penerbitan ulang → tidak kena rate-limit Let's Encrypt.

---

## STEP 6 — Validasi (data lama harus tetap ada)

- [ ] `https://app.domain-anda.com` tampil + gembok valid.
- [ ] Login berhasil; **data lama muncul** (cek daftar STNK/pickup yang dulu ada).
- [ ] `/cek` → foto KTP via kamera → submit → muncul di halaman staf.
- [ ] "Lihat KTP" pada request lama → **foto lama tetap tampil** (uploads kembali).
- [ ] `pm2 list` → online; `curl http://SERVER_IP:3001` dari luar → gagal (loopback).
- [ ] Pasang cron backup (lihat RUNBOOK Fase 7).

---

## Kalau ada yang gagal

| Gejala | Cek |
|---|---|
| 502 di browser | `pm2 logs dxk-api` — biasanya `.env` (JWT_SECRET kosong) atau migrate gagal |
| `migrate deploy` error "table already exists" | jalankan `migrate resolve --applied baseline` (Step 4) lalu ulangi |
| Foto KTP lama 404 | `uploads/` belum dikembalikan dari `~/dxk-safe/uploads` |
| Data lama hilang | `prisma/dev.db` belum disalin dari `~/dxk-safe/dev.db` sebelum start |
| HTTPS gagal | DNS belum mengarah ke server, atau site HTTP belum jalan dulu |

> Jangan hapus `~/dxk-safe` sampai Step 6 lulus semua. Itu jaring pengaman Anda.
