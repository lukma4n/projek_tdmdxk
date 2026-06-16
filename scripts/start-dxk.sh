#!/bin/bash
# DXK Start Script — jalankan backend & frontend sekaligus
# Usage: ./start-dxk.sh [start|stop|status|restart]
# Contoh: ./start-dxk.sh start

PROJECT_DIR="/Users/lukma4n/Documents/projek_tdmdxk"
API_DIR="$PROJECT_DIR/api"
WEB_DIR="$PROJECT_DIR/web"
PID_DIR="$PROJECT_DIR/.dxk"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_LOG="$API_DIR/logs/backend.log"
FRONTEND_LOG="$WEB_DIR/logs/frontend.log"

mkdir -p "$PID_DIR"

check_port() {
  lsof -i :$1 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1
}

start_backend() {
  local existing_pid=$(check_port 3001)
  if [ -n "$existing_pid" ]; then
    echo "⚡ Backend sudah berjalan di PID $existing_pid (port 3001)"
    echo "$existing_pid" > "$BACKEND_PID_FILE"
    return 0
  fi

  echo "🚀 Menjalankan backend..."
  cd "$API_DIR"
  nohup node src/app.js > "$BACKEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$BACKEND_PID_FILE"
  sleep 4

  local running_pid=$(check_port 3001)
  if [ -n "$running_pid" ]; then
    echo "✅ Backend berjalan di PID $running_pid — http://localhost:3001"
  else
    echo "❌ Backend GAGAL start. Cek log: $BACKEND_LOG"
    return 1
  fi
}

start_frontend() {
  local existing_pid=$(check_port 5173)
  if [ -n "$existing_pid" ]; then
    echo "⚡ Frontend sudah berjalan di PID $existing_pid (port 5173)"
    echo "$existing_pid" > "$FRONTEND_PID_FILE"
    return 0
  fi

  echo "🎨 Menjalankan frontend dev server..."
  cd "$WEB_DIR"
  nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$FRONTEND_PID_FILE"
  sleep 5

  local running_pid=$(check_port 5173)
  if [ -n "$running_pid" ]; then
    echo "✅ Frontend berjalan di PID $running_pid — http://localhost:5173"
  else
    echo "❌ Frontend GAGAL start. Cek log: $FRONTEND_LOG"
    return 1
  fi
}

stop_service() {
  local pid_file=$1
  local port=$2
  local name=$3

  # Coba dari PID file
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "🛑 Menghentikan $name (PID $pid)..."
      kill "$pid" 2>/dev/null
      sleep 2
      # Force kill kalau masih hidup
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
      fi
      rm -f "$pid_file"
      echo "✅ $name dihentikan"
      return 0
    fi
  fi

  # Fallback: cari dari port
  local pid_from_port=$(check_port "$port")
  if [ -n "$pid_from_port" ]; then
    echo "🛑 Menghentikan $name (PID $pid_from_port dari port $port)..."
    kill "$pid_from_port" 2>/dev/null
    sleep 2
    if kill -0 "$pid_from_port" 2>/dev/null; then
      kill -9 "$pid_from_port" 2>/dev/null
    fi
    rm -f "$pid_file"
    echo "✅ $name dihentikan"
    return 0
  fi

  echo "ℹ️  $name tidak ditemukan berjalan"
  rm -f "$pid_file"
}

show_status() {
  echo ""
  echo "📊 Status Service DXK"
  echo "===================="
  echo ""

  local backend_pid=$(check_port 3001)
  if [ -n "$backend_pid" ]; then
    echo "🟢 Backend  : BERJALAN (PID $backend_pid) — http://localhost:3001"
  else
    echo "🔴 Backend  : MATI"
  fi

  local frontend_pid=$(check_port 5173)
  if [ -n "$frontend_pid" ]; then
    echo "🟢 Frontend : BERJALAN (PID $frontend_pid) — http://localhost:5173"
  else
    echo "🔴 Frontend : MATI"
  fi

  echo ""
  echo "📁 Log file:"
  echo "   Backend  : $BACKEND_LOG"
  echo "   Frontend : $FRONTEND_LOG"
  echo ""
}

case "${1:-start}" in
  start)
    echo "🔨 Memulai DXK Operation System..."
    echo ""
    start_backend
    echo ""
    start_frontend
    echo ""
    echo "✅ DXK sudah siap!"
    echo "   🌐 Aplikasi  : http://localhost:5173"
    echo "   🔌 API       : http://localhost:3001"
    echo ""
    echo "📝 Perintah berguna:"
    echo "   ./start-dxk.sh status   — Cek status service"
    echo "   ./start-dxk.sh stop     — Hentikan semua service"
    echo "   ./start-dxk.sh restart  — Restart semua service"
    echo ""
    ;;
  stop)
    echo "🛑 Menghentikan DXK Operation System..."
    echo ""
    stop_service "$BACKEND_PID_FILE" 3001 "Backend"
    stop_service "$FRONTEND_PID_FILE" 5173 "Frontend"
    echo ""
    echo "✅ Semua service dihentikan"
    echo ""
    ;;
  status)
    show_status
    ;;
  restart)
    echo "🔄 Restart DXK Operation System..."
    echo ""
    stop_service "$BACKEND_PID_FILE" 3001 "Backend"
    stop_service "$FRONTEND_PID_FILE" 5173 "Frontend"
    sleep 2
    echo ""
    start_backend
    echo ""
    start_frontend
    echo ""
    echo "✅ DXK sudah siap!"
    echo "   🌐 Aplikasi  : http://localhost:5173"
    echo "   🔌 API       : http://localhost:3001"
    echo ""
    ;;
  *)
    echo "Usage: ./start-dxk.sh [start|stop|status|restart]"
    echo ""
    echo "Contoh:"
    echo "  ./start-dxk.sh start    — Mulai backend + frontend"
    echo "  ./start-dxk.sh stop     — Hentikan semua service"
    echo "  ./start-dxk.sh status   — Cek status service"
    echo "  ./start-dxk.sh restart  — Restart semua service"
    echo ""
    ;;
esac
