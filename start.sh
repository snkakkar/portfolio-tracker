#!/bin/bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Portfolio Tracker..."

# Start backend
echo "  → Starting FastAPI backend on http://localhost:8000"
cd "$ROOT/backend"
python3 -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "  → Waiting for backend..."
for i in {1..20}; do
  if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo "  ✓ Backend ready"
    break
  fi
  sleep 0.5
done

# Start frontend
echo "  → Starting React frontend on http://localhost:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Portfolio Tracker is running!"
echo "   Open: http://localhost:5173"
echo ""
echo "   Press Ctrl+C to stop both servers."
echo ""

# Handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'; exit 0" INT TERM

wait
