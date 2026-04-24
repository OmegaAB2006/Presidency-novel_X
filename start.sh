#!/bin/bash
set -e

echo "Starting NOVELX..."

# Kill any previous instances
pkill -f "python app.py" 2>/dev/null || true
pkill -f "flask run" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

PROJECT=$(cd "$(dirname "$0")" && pwd)

# Try to start Redis if available (used for caching, rate limiting, WebSocket pub/sub)
if command -v redis-server &>/dev/null; then
  redis-cli ping &>/dev/null || (redis-server --daemonize yes --loglevel warning && echo "Redis started.")
else
  echo "Redis not found — using in-memory fallback (install Redis for full features)."
fi

# Backend — uses socketio.run (eventlet) for WebSocket support
echo "Starting Flask backend on :5001..."
cd "$PROJECT/backend"
nohup python3 app.py > /tmp/flask.log 2>&1 &

# Wait for backend
until curl -s http://localhost:5001/api/health > /dev/null 2>&1; do sleep 1; done
echo "Backend ready."

# Frontend
echo "Starting React frontend on :3000..."
cd "$PROJECT/frontend"
nohup npm run dev > /tmp/vite.log 2>&1 &

# Wait for frontend
until curl -s http://localhost:3000 > /dev/null 2>&1; do sleep 1; done
echo "Frontend ready."

open http://localhost:3000 2>/dev/null || true

echo ""
echo "NOVELX is running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5001"
echo ""
echo "Logs: tail -f /tmp/flask.log  |  tail -f /tmp/vite.log"
echo "Stop: pkill -f 'python app.py'; pkill -f vite"
