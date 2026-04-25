#!/bin/bash
set -euo pipefail

echo "Starting dev servers..."

npm run dev:worker &
WORKER_PID=$!

sleep 2

npm run dev:host &
FRONTEND_PID=$!

cleanup() {
  kill "$WORKER_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

sleep 4

echo "Starting tunnel..."

npx ngrok http 5173
