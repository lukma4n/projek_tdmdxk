# Panduan Deployment DXK Operation System ke VPS Production

## 1. Persiapan VPS

### Spesifikasi Minimum VPS
- OS: Ubuntu 20.04 LTS atau lebih baru / CentOS 8+
- RAM: minimal 2GB (disarankan 4GB)
- Storage: minimal 20GB
- CPU: minimal 2 cores
- Akses root atau sudo

### Install Dependencies di VPS

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi instalasi
node -v  # harus >= v20.x
npm -v   # harus >= v10.x

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install SQLite3 (optional, untuk maintenance)
sudo apt install -y sqlite3

# Install Git
sudo apt install -y git
```

## 2. Setup User & Directory

```bash
# Buat user khusus (optional tapi recommended)
sudo adduser dxk
sudo usermod -aG sudo dxk

# Login sebagai user dxk
sudo su - dxk

# Buat direktori aplikasi
mkdir -p ~/apps
cd ~/apps
```

## 3. Clone & Upload Project

### Opsi A: Via Git (Recommended)

```bash
# Di VPS
cd ~/apps
git clone <YOUR_REPO_URL> dxk-system
cd dxk-system
```

### Opsi B: Via SCP/SFTP

```bash
# Di komputer lokal
# Exclude node_modules dan file besar
tar --exclude='node_modules' \
    --exclude='api/prisma/backups' \
    --exclude='api/prisma/dev.db' \
    --exclude='web/dist' \
    --exclude='.git' \
    -czf dxk-system.tar.gz .

# Upload ke VPS
scp dxk-system.tar.gz user@YOUR_VPS_IP:/home/dxk/apps/

# Di VPS
cd ~/apps
tar -xzf dxk-system.tar.gz -C dxk-system
cd dxk-system
```

## 4. Setup Backend (API)

```bash
cd ~/apps/dxk-system/api

# Install dependencies
npm ci --only=production

# Copy environment production
cp .env.production .env

# Edit .env untuk production
nano .env
```

Edit `.env` dengan nilai production:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=file:./prisma/prod.db
JWT_SECRET=GANTI_DENGAN_SECRET_YANG_KUAT_DAN_RANDOM
JWT_EXPIRES_IN=24h
FRONTEND_URL=https://yourdomain.com
```

**PENTING**: Generate JWT_SECRET yang kuat:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Lanjut setup database:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (buat database production)
npx prisma migrate deploy

# Seed data awal (user default, dll)
npm run db:seed

# Test backend
npm start
# Tekan Ctrl+C setelah verifikasi
```

## 5. Setup Frontend (Web)

```bash
cd ~/apps/dxk-system/web

# Install dependencies
npm ci --only=production

# Build production
npm run build

# Hasil build ada di folder dist/
ls -la dist/
```

## 6. Setup PM2 (Process Manager)

Buat file PM2 ecosystem:

```bash
cd ~/apps/dxk-system
nano ecosystem.config.js
```

Isi file (sudah disediakan di project):

```javascript
module.exports = {
  apps: [
    {
      name: 'dxk-api',
      cwd: './api',
      script: 'src/app.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M'
    }
  ]
};
```

Start aplikasi dengan PM2:

```bash
# Start
pm2 start ecosystem.config.js

# Verifikasi
pm2 status
pm2 logs dxk-api

# Setup auto-start saat VPS restart
pm2 startup
pm2 save
```

## 7. Setup Nginx (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/dxk-system
```

Konfigurasi Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Ganti dengan domain Anda
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend (static files)
    location / {
        root /home/dxk/apps/dxk-system/web/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout untuk upload Excel
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
    
    # Max upload size (untuk import Excel)
    client_max_body_size 50M;
}
```

Aktifkan konfigurasi:

```bash
# Symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/dxk-system /etc/nginx/sites-enabled/

# Test konfigurasi
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 8. Setup SSL/HTTPS dengan Certbot (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot akan otomatis update konfigurasi Nginx
# Auto-renewal sudah diatur otomatis
```

## 9. Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 10. Verifikasi Deployment

```bash
# Cek status PM2
pm2 status

# Cek logs
pm2 logs dxk-api --lines 50

# Cek Nginx
sudo systemctl status nginx

# Test health check
curl http://localhost:3001/health

# Test dari browser
http://your-vps-ip
https://yourdomain.com
```

## 11. Maintenance & Monitoring

### Update Aplikasi

```bash
cd ~/apps/dxk-system

# Pull changes (jika pakai Git)
git pull origin main

# Backend
cd api
npm ci --only=production
npx prisma generate
npx prisma migrate deploy

# Frontend
cd ../web
npm ci --only=production
npm run build

# Restart PM2
pm2 restart dxk-api
```

### Backup Database

```bash
# Manual backup
cd ~/apps/dxk-system/api/prisma
cp prod.db backups/prod.db.backup.$(date +%Y%m%d_%H%M%S)

# Setup cron untuk auto backup harian
crontab -e

# Tambahkan (backup setiap hari jam 2 pagi):
0 2 * * * cd /home/dxk/apps/dxk-system/api/prisma && cp prod.db backups/prod.db.backup.$(date +\%Y\%m\%d_\%H\%M\%S)
```

### Monitoring Logs

```bash
# PM2 logs real-time
pm2 logs dxk-api

# PM2 monitoring dashboard
pm2 monit

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# App logs
tail -f ~/apps/dxk-system/api/logs/backend.log
```

### Monitoring Resources

```bash
# Install htop
sudo apt install htop

# Monitor
htop

# Disk usage
df -h
du -sh ~/apps/dxk-system/*
```

## 12. Troubleshooting

### Backend tidak start

```bash
# Cek logs detail
pm2 logs dxk-api --lines 100

# Cek port 3001 sudah dipakai atau belum
sudo lsof -i :3001

# Restart manual
pm2 restart dxk-api
```

### Database error

```bash
# Verifikasi file database
ls -lh ~/apps/dxk-system/api/prisma/prod.db

# Cek permissions
chmod 644 ~/apps/dxk-system/api/prisma/prod.db

# Re-generate Prisma Client
cd ~/apps/dxk-system/api
npx prisma generate
```

### Nginx error

```bash
# Test konfigurasi
sudo nginx -t

# Reload tanpa downtime
sudo nginx -s reload

# Restart Nginx
sudo systemctl restart nginx
```

### 502 Bad Gateway

```bash
# Backend mungkin mati, cek PM2
pm2 status
pm2 restart dxk-api

# Cek apakah backend berjalan di port 3001
curl http://localhost:3001/health
```

### Upload file gagal

```bash
# Cek permission folder uploads
chmod -R 755 ~/apps/dxk-system/api/uploads/

# Cek Nginx client_max_body_size
sudo nano /etc/nginx/sites-available/dxk-system
# Pastikan ada: client_max_body_size 50M;
```

## 13. Security Best Practices

- [ ] Ganti JWT_SECRET dengan nilai random yang kuat
- [ ] Enable firewall (ufw)
- [ ] Install & enable SSL/HTTPS
- [ ] Disable root login SSH (edit `/etc/ssh/sshd_config`)
- [ ] Setup fail2ban untuk proteksi brute-force
- [ ] Regular update sistem: `sudo apt update && sudo apt upgrade`
- [ ] Backup database berkala
- [ ] Monitor logs secara rutin
- [ ] Gunakan user non-root untuk menjalankan aplikasi

## 14. Checklist Deployment

- [ ] VPS sudah disetup dengan dependencies lengkap
- [ ] User & direktori aplikasi sudah dibuat
- [ ] Project sudah di-upload/clone ke VPS
- [ ] Backend dependencies installed & database migrated
- [ ] Frontend di-build (folder dist)
- [ ] File .env production sudah dikonfigurasi dengan benar
- [ ] PM2 sudah running & auto-start enabled
- [ ] Nginx dikonfigurasi & running
- [ ] SSL certificate installed (jika pakai domain)
- [ ] Firewall enabled
- [ ] Backup otomatis sudah dijadwalkan
- [ ] Monitoring setup (PM2, logs)
- [ ] Test semua fitur utama (login, import, export, dll)

## Kontak & Support

Jika ada masalah deployment, cek:
1. PM2 logs: `pm2 logs dxk-api`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. App logs: `tail -f ~/apps/dxk-system/api/logs/backend.log`
4. Dokumentasi di `README.md`, `AGENTS.md`, `TRD.md`
