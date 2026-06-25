# Tarik database & uploads dari server produksi ke lokal.
# Jalankan dari root projek: .\scripts\pull-db.ps1

$SSH_USER = "root"
$SSH_HOST = "tdmketapang.net"
$REMOTE_BASE = "/var/www/projek_tdmdxk"
$LOCAL_BASE = Split-Path -Parent $PSScriptRoot

Write-Host "=== Pull DB dari $SSH_HOST ===" -ForegroundColor Cyan

Write-Host "[1/3] git pull..." -ForegroundColor Yellow
git -C $LOCAL_BASE pull

Write-Host "[2/3] Tarik dev.db dari server..." -ForegroundColor Yellow
# sqlite3 .backup agar konsisten meski PM2 sedang aktif menulis DB
# scp ke $env:TEMP dulu (path tanpa spasi) lalu pindahkan ke tujuan
$TEMP_DB = "$env:TEMP\dev_pull.db"
$DEST_DB = "$LOCAL_BASE\api\prisma\dev.db"
ssh "${SSH_USER}@${SSH_HOST}" "sqlite3 ${REMOTE_BASE}/api/prisma/dev.db '.backup /tmp/dev_pull.db'"
scp "${SSH_USER}@${SSH_HOST}:/tmp/dev_pull.db" $TEMP_DB
ssh "${SSH_USER}@${SSH_HOST}" "rm /tmp/dev_pull.db"
if (Test-Path $TEMP_DB) {
    try {
        # Buang sisa WAL/SHM (boleh tidak ada), lalu timpa dev.db lama
        Remove-Item -Force -ErrorAction SilentlyContinue "$DEST_DB-wal", "$DEST_DB-shm"
        if (Test-Path $DEST_DB) { Remove-Item -Force -ErrorAction Stop $DEST_DB }
        Move-Item -Force -ErrorAction Stop $TEMP_DB $DEST_DB
        Write-Host "dev.db berhasil ditarik." -ForegroundColor Green
    } catch {
        Write-Host "GAGAL menimpa dev.db: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Pastikan server lokal/Prisma Studio yang memakai dev.db sudah ditutup." -ForegroundColor Red
        Write-Host "File baru tersimpan di: $TEMP_DB" -ForegroundColor Yellow
    }
} else {
    Write-Host "GAGAL: backup tidak terunduh dari server." -ForegroundColor Red
}

Write-Host "[3/3] Tarik uploads/ dari server..." -ForegroundColor Yellow
scp -r "${SSH_USER}@${SSH_HOST}:${REMOTE_BASE}/api/uploads/" `
    "$LOCAL_BASE\api\uploads\"

Write-Host ""
Write-Host "Selesai. DB & uploads sudah sinkron dengan server." -ForegroundColor Green
