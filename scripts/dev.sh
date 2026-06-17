#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Development Script
# ============================================================
# Starts the development environment with hot reload.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Development"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: .env not found, creating from .env.example${NC}"
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
fi

echo -e "${BLUE}Starting NEXO LP Server...${NC}"
echo "  Server will be available at: http://localhost:3460"
echo "  Health check: http://localhost:3460/api/nexo-lp/health"
echo "  SSE endpoint: http://localhost:3460/api/nexo-lp/events/:sessionId"
echo ""

cd "$PROJECT_DIR"
exec npx nodemon nexo-lp-server/nexo-lp-server.js \
  --watch nexo-lp-server \
  --ext js,cjs,json \
  --ignore nexo-lp-server/node_modules \
  --delay 1
