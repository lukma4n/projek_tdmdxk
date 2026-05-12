#!/bin/bash
# DXK Development Start Script
# Usage: ./start-development.sh

echo "🔨 Starting DXK in DEVELOPMENT mode..."
echo ""

# Ensure production backend is running
echo "✅ Production backend should already be running on :3001"
echo "   (if not, run ./start-production.sh first)"
echo ""

# Start frontend dev server
echo "🎨 Starting frontend dev server..."
cd /Users/lukma4n/Documents/projek_tdmdxk/web
npm run dev &
WEB_PID=$!

echo ""
echo "✅ DXK Development is running!"
echo "   🌐 Dev Frontend: http://localhost:5173"
echo "   🔌 API Backend:  http://localhost:3001"
echo ""
echo "📝 Notes:"
echo "   - Edit code in web/src/ → auto-reload at :5173"
echo "   - Backend API always available at :3001"
echo "   - Press Ctrl+C to stop dev server"
echo ""
echo "📋 Useful commands:"
echo "   pm2 status        - Check backend status"
echo "   pm2 logs          - View backend logs"
echo "   pm2 restart all   - Restart backend"
echo ""

wait $WEB_PID
