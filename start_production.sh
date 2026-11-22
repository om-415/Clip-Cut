#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=============================================================================="
echo "      FRAGFLASH AI STREAM CLIPPER - PRODUCTION SYSTEM LAUNCHER"
echo "=============================================================================="

# 1. Check Python Venv
if [ ! -f ".venv/bin/python" ]; then
    echo "[ERROR] Virtual environment not found at .venv"
    echo "Create it with: python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

# 2. Build Frontend if needed
if [ ! -d "frontend/dist" ]; then
    echo "[INFO] Building frontend production bundle..."
    (cd frontend && npm install && npm run build)
fi

# 3. Ensure runtime directories
mkdir -p clips downloads models processed subtitles temp logs

# 4. Start Backend
echo "[1/2] Starting FastAPI Backend on http://0.0.0.0:8000..."
.venv/bin/python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 5. Start Frontend
echo "[2/2] Starting Frontend Studio on http://0.0.0.0:3000..."
(cd frontend && npm run preview -- --port 3000 --host 0.0.0.0) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM EXIT

echo "Application online at http://localhost:3000"
wait
