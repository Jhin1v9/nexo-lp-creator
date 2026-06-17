#!/usr/bin/env bash
# Start the NEXO LP Creator backend with the Luna Kimi Bridge configured
# to use an isolated CDP port. This keeps the LP Creator's Chrome separate
# from the main Luna dashboard Chrome instance.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/nexo-lp.log"

mkdir -p "$LOG_DIR"

cd "$PROJECT_ROOT/nexo-lp-server"

export KIMI_BRIDGE_REUSE_USER_ID=true
export KIMI_BRIDGE_FIXED_USER_ID=nexo-lp-user
export KIMI_CDP_PORT=9226
export KIMI_CDP_URL=http://127.0.0.1:9226
export KIMI_MAX_PAGES=1
export KIMI_CHROME_USER_DATA_DIR="${HOME}/.luna/nexo-lp-chrome-profile"

exec node nexo-lp-server.js >> "$LOG_FILE" 2>&1
