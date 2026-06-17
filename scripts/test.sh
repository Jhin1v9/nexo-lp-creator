#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Test Script
# ============================================================
# Runs the test suite using Jest.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Tests"
echo "=================================================="
echo ""

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

cd "$PROJECT_DIR"

# Check if jest is installed
if ! npx jest --version > /dev/null 2>&1; then
    echo -e "${RED}Jest not found. Installing test dependencies...${NC}"
    npm install --save-dev jest supertest
fi

# Run tests
echo -e "${BLUE}Running tests...${NC}"
echo ""

if [ -d "$PROJECT_DIR/__tests__" ] || [ -d "$PROJECT_DIR/tests" ]; then
    npx jest \
        --verbose \
        --coverage \
        --coverageDirectory="$PROJECT_DIR/coverage" \
        --passWithNoTests \
        "$@"
else
    echo -e "${BLUE}No test directory found. Running with --passWithNoTests${NC}"
    npx jest \
        --verbose \
        --passWithNoTests \
        "$@"
fi

echo ""
echo -e "${GREEN}Tests complete${NC}"
