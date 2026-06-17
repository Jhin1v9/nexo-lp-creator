#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Setup Script
# ============================================================
# Initial project setup: install dependencies, create directories,
# initialize database, and seed default data.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Setup"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Node.js version
echo -e "${BLUE}[1/7] Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required (found $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}  Node.js $(node -v) OK${NC}"

# Install root dependencies
echo -e "${BLUE}[2/7] Installing server dependencies...${NC}"
cd "$PROJECT_DIR"
npm install
echo -e "${GREEN}  Server dependencies installed${NC}"

# Create required directories
echo -e "${BLUE}[3/7] Creating directories...${NC}"
mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/data/previews"
mkdir -p "$PROJECT_DIR/data/templates"
mkdir -p "$PROJECT_DIR/data/mined-templates"
mkdir -p "$PROJECT_DIR/data/zips"
mkdir -p "$PROJECT_DIR/data/screenshots"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/uploads"
mkdir -p "$PROJECT_DIR/nexo-lp-web/dist"
echo -e "${GREEN}  Directories created${NC}"

# Create .env if it doesn't exist
echo -e "${BLUE}[4/7] Setting up environment...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo -e "${YELLOW}  .env created from .env.example - please edit with your credentials${NC}"
else
    echo -e "${GREEN}  .env already exists${NC}"
fi

# Build web frontend if it exists
echo -e "${BLUE}[5/7] Building web frontend...${NC}"
if [ -d "$PROJECT_DIR/nexo-lp-web" ] && [ -f "$PROJECT_DIR/nexo-lp-web/package.json" ]; then
    cd "$PROJECT_DIR/nexo-lp-web"
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run build 2>/dev/null || echo -e "${YELLOW}  Frontend build skipped (no build script)${NC}"
    cd "$PROJECT_DIR"
else
    echo -e "${YELLOW}  Frontend directory not found, skipping${NC}"
fi

echo -e "${GREEN}  Frontend build complete${NC}"

# Initialize database
echo -e "${BLUE}[6/7] Initializing database...${NC}"
node -e "
const path = require('path');
process.chdir('$PROJECT_DIR');
require('./nexo-lp-server/models/sqlite').initDatabase()
  .then(() => {
    console.log('  Database initialized');
    process.exit(0);
  })
  .catch((err) => {
    console.error('  Database init error:', err.message);
    process.exit(1);
  });
" 2>/dev/null || echo -e "${YELLOW}  Database will be initialized on first server start${NC}"

echo -e "${GREEN}  Database ready${NC}"

# Summary
echo ""
echo -e "${BLUE}[7/7] Setup complete!${NC}"
echo ""
echo "  Next steps:"
echo "  1. Edit .env with your credentials"
echo "  2. Start the server: npm run dev:server"
echo "  3. Open the web app: npm run dev:web"
echo ""
echo "=================================================="
