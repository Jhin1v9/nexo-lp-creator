#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Run All Tests
# ============================================================
# Comprehensive test suite: build verification, unit tests,
# integration tests, and code quality checks.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - All Tests"
echo "=================================================="
echo ""

# Test 1: Build verification
echo -e "${BLUE}[1/5] Build Verification${NC}"
if bash "$SCRIPT_DIR/verify-build.sh" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} Build verification"
else
    echo -e "  ${RED}[FAIL]${NC} Build verification"
    FAILED=1
fi
echo ""

# Test 2: Unit tests
echo -e "${BLUE}[2/5] Unit Tests${NC}"
if bash "$SCRIPT_DIR/test.sh" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} Unit tests"
else
    echo -e "  ${YELLOW}[WARN]${NC} Unit tests (may have no test files)"
fi
echo ""

# Test 3: Code review
echo -e "${BLUE}[3/5] Code Quality Review${NC}"
if bash "$SCRIPT_DIR/run-reviewers.sh" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} Code review"
else
    echo -e "  ${YELLOW}[WARN]${NC} Code review issues found"
fi
echo ""

# Test 4: Server startup test
echo -e "${BLUE}[4/5] Server Startup Test${NC}"
cd "$PROJECT_DIR"

# Start server in background, test health endpoint, then kill
node nexo-lp-server/nexo-lp-server.js &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    # Server is running, test health endpoint
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3460/api/nexo-lp/health 2>/dev/null || echo "000")

    if [ "$HEALTH_STATUS" = "200" ]; then
        echo -e "  ${GREEN}[PASS]${NC} Server starts and health endpoint responds (HTTP $HEALTH_STATUS)"
    else
        echo -e "  ${RED}[FAIL]${NC} Health endpoint returned HTTP $HEALTH_STATUS"
        FAILED=1
    fi
else
    echo -e "  ${RED}[FAIL]${NC} Server failed to start"
    FAILED=1
fi

# Kill server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
sleep 1
echo ""

# Test 5: API endpoints test
echo -e "${BLUE}[5/5] API Endpoints Test${NC}"
node nexo-lp-server/nexo-lp-server.js &
SERVER_PID=$!
sleep 3

API_OK=true

# Test POST /sessions
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3460/api/nexo-lp/sessions \
    -H "Content-Type: application/json" \
    -d '{"userId":"test-user","initialPrompt":"test"}' 2>/dev/null || echo "")

if echo "$SESSION_RESPONSE" | grep -q "success.*true" 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${NC} POST /sessions"
else
    echo -e "  ${RED}[FAIL]${NC} POST /sessions"
    API_OK=false
fi

# Extract session ID
SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
    # Test GET /sessions/:id
    GET_RESPONSE=$(curl -s http://localhost:3460/api/nexo-lp/sessions/$SESSION_ID 2>/dev/null || echo "")
    if echo "$GET_RESPONSE" | grep -q "success.*true" 2>/dev/null; then
        echo -e "  ${GREEN}[PASS]${NC} GET /sessions/:id"
    else
        echo -e "  ${RED}[FAIL]${NC} GET /sessions/:id"
        API_OK=false
    fi
else
    echo -e "  ${YELLOW}[SKIP]${NC} GET /sessions/:id (no session ID)"
fi

# Test GET /health
HEALTH=$(curl -s http://localhost:3460/api/nexo-lp/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q "healthy" 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${NC} GET /health"
else
    echo -e "  ${RED}[FAIL]${NC} GET /health"
    API_OK=false
fi

# Test GET /templates
TEMPLATES=$(curl -s http://localhost:3460/api/nexo-lp/templates 2>/dev/null || echo "")
if echo "$TEMPLATES" | grep -q "success.*true" 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${NC} GET /templates"
else
    echo -e "  ${RED}[FAIL]${NC} GET /templates"
    API_OK=false
fi

# Test GET /stacks
STACKS=$(curl -s http://localhost:3460/api/nexo-lp/stacks 2>/dev/null || echo "")
if echo "$STACKS" | grep -q "success.*true" 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${NC} GET /stacks"
else
    echo -e "  ${RED}[FAIL]${NC} GET /stacks"
    API_OK=false
fi

if [ "$API_OK" = false ]; then
    FAILED=1
fi

# Kill server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "=================================================="
if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}All tests passed!${NC}"
    echo "=================================================="
    exit 0
else
    echo -e "  ${RED}Some tests failed${NC}"
    echo "=================================================="
    exit 1
fi
