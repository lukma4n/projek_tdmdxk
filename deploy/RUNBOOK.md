# Runbook Deploy — DXK Operation System (VPS Ubuntu/Debian)

Panduan deploy production ke VPS Linux (Ubuntu/Debian) di belakang Nginx + HTTPS.
Ikuti **berurutan**. Tanda 🖥️ = dijalankan di **laptop Anda**, 🌐 = di **server**.

> **Safety gate (jangan dilanggar):**
> 1. Jangan matikan login password/root SSH sebelum login via **kunci** terbukti di sesi SSH **kedua**.
> 2. Jangan jalankan certbot sebelum **DNS sudah mengarah** ke server **dan** situs HTTP terbuka.
> 3. Jangan paksa redirect HTTP→HTTPS sebelum HTTPS terbukti jalan (certbot menanganinya).

Ganti `app.domain-anda.com` dan `SERVER_IP` sesuai milik Anda.

---

## Fase 0 — DNS (lakukan dulu, butuh waktu propagasi)

🖥️ Di panel domain Anda, buat **A record**:
```
app.domain-anda.com  →  SERVER_IP
```
🖥️ Verifikasi (tunggu sampai mengembalikan SERVER_IP):
```bash
dig +short app.domain-anda.com
```
> Gagal? Propagasi DNS bisa sampai beberapa jam. Lanjut fase 1–5 dulu sambil menunggu; **fase 6 (HTTPS) butuh ini benar**.

---

## Fase 1 — Prereqs di server

🌐 Update & paket dasar:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx ufw curl
```

🌐 Node.js 22 LTS (via NodeSource — hindari versi apt yang lawas):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # harus v22.x
```

🌐 (Opsional) Redis — app memakainya bila tersedia, tetap jalan tanpa Redis:
```bash
sudo apt install -y redis-server && sudo systemctl enable --now redis-server
```

🌐 PM2 global:
```bash
sudo npm install -g pm2
```

---

## Fase 2 — Akses aman (SSH) + firewall

🌐 Buat user non-root ber-sudo (lewati bila sudah punya):
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

🖥️ Dari **laptop**, salin kunci SSH Anda ke user itu:
```bash
ssh-copy-id deploy@SERVER_IP        # atau salin ~/.ssh/id_*.pub manual
```

🖥️ **GATE:** buka sesi SSH **kedua** dan pastikan login **tanpa password** berhasil:
```bash
ssh deploy@SERVER_IP
```
> Berhasil tanpa diminta password? Baru lanjut. **Jangan tutup sesi pertama** sampai ini terbukti.

🌐 Firewall — izinkan SSH + web, lalu aktifkan:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # buka 80 + 443
sudo ufw enable
sudo ufw status
```
> App Node tetap di `127.0.0.1:3001` (loopback) — **jangan** buka port 3001 ke publik.

🌐 (Disarankan) Perketat SSH **hanya setelah gate di atas lulus** — edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```
lalu `sudo systemctl restart ssh` dan **uji lagi di sesi baru** sebelum menutup yang lama.

---

## Fase 3 — Ambil kode & build

🌐 Clone ke lokasi tetap (mis. home user deploy):
```bash
cd ~ && git clone <URL_REPO> projek_tdmdxk
cd projek_tdmdxk && git checkout feat/fase2-pickup-request   # atau main setelah merge
```

🌐 Backend deps + Prisma:
```bash
cd ~/projek_tdmdxk/api
npm ci
npx prisma generate
```

🌐 Buat `.env` produksi dari template & isi secret:
```bash
cp .env.production.example .env
openssl rand -hex 32          # salin hasilnya ke JWT_SECRET di .env
nano .env
```
Pastikan di `.env`:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<hasil openssl rand -hex 32>
FRONTEND_URL=https://app.domain-anda.com
ALLOWED_ORIGINS=https://app.domain-anda.com
DATABASE_URL=file:./dev.db
```

🌐 Terapkan migrasi (membuat semua tabel di DB baru):
```bash
npx prisma migrate deploy
```

🌐 Isi data awal — **pilih salah satu**:
- DB baru/demo: `npm run db:seed`
- Pindahkan data lama: salin file `dev.db` lama ke `~/projek_tdmdxk/api/prisma/dev.db`

🌐 Build frontend:
```bash
cd ~/projek_tdmdxk/web
npm ci
npm run build        # hasil → web/dist, disajikan oleh Node di produksi
```

---

## Fase 4 — Jalankan dengan PM2

🌐 Start dari **root repo** (ecosystem pakai `cwd: ./api`):
```bash
cd ~/projek_tdmdxk
mkdir -p api/logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # jalankan perintah yang ditampilkannya (agar auto-start saat reboot)
```

🌐 Verifikasi app hidup di loopback:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/health   # harus 200
pm2 logs dxk-api --lines 20
```
> 502/connection refused nanti di Nginx? Cek `pm2 logs` — biasanya `.env` salah (JWT_SECRET kosong) atau migrasi belum jalan.

---

## Fase 5 — Nginx (HTTP dulu)

🌐 Pasang config:
```bash
sudo cp ~/projek_tdmdxk/deploy/nginx/dxk.conf /etc/nginx/sites-available/dxk.conf
sudo sed -i 's/app.domain-anda.com/APP.DOMAIN-ASLI.COM/' /etc/nginx/sites-available/dxk.conf
sudo ln -s /etc/nginx/sites-available/dxk.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default     # hapus default agar tidak bentrok
sudo nginx -t && sudo systemctl reload nginx
```

🖥️ **GATE:** buka `http://app.domain-anda.com` di browser — halaman login harus tampil (via HTTP).
> Tidak tampil? Cek `dig` (fase 0), `sudo ufw status` (80 terbuka?), `sudo nginx -t`, dan `pm2 logs`.

---

## Fase 6 — HTTPS (Let's Encrypt via Certbot)

> Hanya lanjut bila fase 0 (DNS) **dan** fase 5 (HTTP tampil) sudah benar.

🌐 Install Certbot (metode resmi snap):
```bash
sudo snap install core && sudo snap refresh core
sudo apt-get remove -y certbot 2>/dev/null || true
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
```

🌐 Terbitkan + pasang sertifikat (certbot mengedit Nginx otomatis):
```bash
sudo certbot --nginx -d app.domain-anda.com
```
- Saat ditanya redirect HTTP→HTTPS, pilih **Redirect** (certbot menambah blok 443 + redirect — aman karena HTTPS sudah terbukti terbit).

🌐 Uji perpanjangan otomatis:
```bash
sudo certbot renew --dry-run
```

🖥️ Buka `https://app.domain-anda.com` — pastikan **gembok** muncul.

---

## Fase 7 — Backup terjadwal

🌐 Pasang cron harian (02:00) memakai skrip bawaan repo:
```bash
crontab -e
```
tambahkan:
```
0 2 * * * cd /home/deploy/projek_tdmdxk/api && /usr/bin/node scripts/backup-db.js 14 >> /home/deploy/tdmdxk-backup.log 2>&1
```
> Backup DB tersimpan di `api/prisma/backups/`. **Folder `api/uploads/` (foto KTP) tidak ikut** — backup terpisah, mis. `rsync` ke storage lain / snapshot disk.

---

## Fase 8 — Validasi akhir (checklist go-live)

- [ ] `https://app.domain-anda.com` tampil + gembok valid.
- [ ] Login berhasil; di DevTools cookie `token` ber-flag **HttpOnly** + **Secure**.
- [ ] Buka `/cek` → ambil foto KTP **via kamera** → submit → muncul di halaman staf.
- [ ] Klik "Lihat KTP" di halaman staf → foto tampil (route auth-protected jalan).
- [ ] Port 3001 **tidak** bisa diakses dari luar (`curl http://SERVER_IP:3001` dari laptop → gagal/timeout).
- [ ] `pm2 list` → `dxk-api` online; reboot server lalu cek app naik otomatis.
- [ ] `sudo certbot renew --dry-run` sukses.
- [ ] Cron backup terdaftar (`crontab -l`).

---

## Update versi berikutnya (deploy ulang)

```bash
cd ~/projek_tdmdxk && git pull
cd api && npm ci && npx prisma migrate deploy && npx prisma generate
cd ../web && npm ci && npm run build
pm2 restart dxk-api
```

## Optional (setelah semuanya stabil)

- **BBR** (throughput TCP) — hanya bila hosting sudah jalan mulus.
- **Pindah rate limiter ke Redis** bila kelak butuh >1 instance PM2 (lihat `ecosystem.config.js`).
