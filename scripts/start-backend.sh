#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[NEXO] Stopping any existing backend on port 3460..."
# Stop PM2 managed instance if running
pm2 stop nexo-lp-server 2>/dev/null || true

# Stop any process still listening on port 3460, gracefully first.
PID=$(ss -tlnp 2>/dev/null | grep ':3460' | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -n "$PID" ]; then
  echo "[NEXO] Stopping manual process $PID on port 3460 (SIGTERM)..."
  kill -TERM "$PID" 2>/dev/null || true
  for i in {1..5}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "[NEXO] Process stopped gracefully."
      break
    fi
    sleep 1
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "[NEXO] Process did not stop gracefully, forcing SIGKILL..."
    kill -9 "$PID" 2>/dev/null || true
    sleep 1
  fi
fi

echo "[NEXO] Starting backend via PM2..."
pm2 start nexo-lp-server

echo "[NEXO] Saving PM2 process list..."
pm2 save --force 2>/dev/null || true

echo "[NEXO] Backend started. Health check:"
for i in {1..10}; do
  if curl -s http://127.0.0.1:3460/api/nexo-lp/health >/dev/null; then
    curl -s http://127.0.0.1:3460/api/nexo-lp/health | jq .
    echo "[NEXO] Done."
    exit 0
  fi
  sleep 1
done

echo "[NEXO] Health check failed — check logs with: pm2 logs nexo-lp-server"
exit 1
