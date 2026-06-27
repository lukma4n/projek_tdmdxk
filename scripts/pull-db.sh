#!/usr/bin/env bash
# Tarik database & uploads dari server produksi ke lokal.
# Jalankan dari root projek: bash scripts/pull-db.sh

set -e

SSH_USER="root"
SSH_HOST="tdmketapang.net"
REMOTE_BASE="/var/www/projek_tdmdxk"
LOCAL_BASE="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Pull DB dari $SSH_HOST ==="

echo "[1/3] git pull..."
git -C "$LOCAL_BASE" pull

echo "[2/3] Tarik dev.db dari server..."
scp "$SSH_USER@$SSH_HOST:$REMOTE_BASE/api/prisma/dev.db" \
    "$LOCAL_BASE/api/prisma/dev.db"

echo "[3/3] Tarik uploads/ dari server..."
rsync -avz --progress \
    "$SSH_USER@$SSH_HOST:$REMOTE_BASE/api/uploads/" \
    "$LOCAL_BASE/api/uploads/"

echo ""
echo "Selesai. DB & uploads sudah sinkron dengan server."
