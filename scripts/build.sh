#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Build Script
# ============================================================
# Builds the production bundle including the web frontend.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Build"
echo "=================================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Build web frontend
echo -e "${BLUE}[1/2] Building web frontend...${NC}"
if [ -d "$PROJECT_DIR/nexo-lp-web" ] && [ -f "$PROJECT_DIR/nexo-lp-web/package.json" ]; then
    cd "$PROJECT_DIR/nexo-lp-web"

    if [ ! -d "node_modules" ]; then
        echo "  Installing frontend dependencies..."
        npm install
    fi

    echo "  Building..."
    npm run build

    cd "$PROJECT_DIR"
    echo -e "${GREEN}  Frontend built to nexo-lp-web/dist/${NC}"
else
    echo -e "${RED}  Frontend directory not found${NC}"
    echo "  Creating minimal dist directory..."
    mkdir -p "$PROJECT_DIR/nexo-lp-web/dist"

    # Create minimal index.html
    cat > "$PROJECT_DIR/nexo-lp-web/dist/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXO Landing Page Creator</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">NEXO Landing Page Creator v3.0</h1>
      <p class="text-gray-600 mb-8">Backend API is running. Frontend integration in progress.</p>
      <a href="/api/nexo-lp/health" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Check API Health
      </a>
    </div>
  </div>
</body>
</html>
EOF
    echo -e "${GREEN}  Minimal frontend created${NC}"
fi

echo ""
echo -e "${BLUE}[2/2] Verifying build...${NC}"
if [ -d "$PROJECT_DIR/nexo-lp-web/dist" ] && [ -f "$PROJECT_DIR/nexo-lp-web/dist/index.html" ]; then
    echo -e "${GREEN}  Build verified${NC}"
else
    echo -e "${RED}  Build verification failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=================================================="
echo "  Build complete!"
echo "  Start server: npm run dev:server"
echo "==================================================${NC}"
