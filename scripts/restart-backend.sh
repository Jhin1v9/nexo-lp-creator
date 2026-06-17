#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[NEXO] Restarting backend..."
pm2 restart nexo-lp-server

echo "[NEXO] Waiting for health check..."
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
