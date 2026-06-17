#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Review Script
# ============================================================
# Runs code quality checks and linters on the codebase.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Code Review"
echo "=================================================="
echo ""

cd "$PROJECT_DIR"

# Check for common code quality issues
echo -e "${BLUE}[1/4] Checking for TODO/FIXME comments...${NC}"
TODO_COUNT=$(grep -r "TODO\|FIXME" nexo-lp-server/ --include="*.js" --include="*.cjs" -l 2>/dev/null | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}Found $TODO_COUNT file(s) with TODO/FIXME${NC}"
    grep -r "TODO\|FIXME" nexo-lp-server/ --include="*.js" --include="*.cjs" -n 2>/dev/null | head -20
else
    echo -e "  ${GREEN}No TODO/FIXME found${NC}"
fi
echo ""

# Check for console.log in production code
echo -e "${BLUE}[2/4] Checking for debug console.log statements...${NC}"
LOG_COUNT=$(grep -rn "console\.log\|console\.warn\|console\.error" nexo-lp-server/ --include="*.js" --include="*.cjs" 2>/dev/null | grep -v "console\.error" | wc -l)
echo -e "  ${YELLOW}Found logging statements in $LOG_COUNT locations${NC}"
echo ""

# Check file sizes
echo -e "${BLUE}[3/4] Checking file sizes...${NC}"
LARGE_FILES=$(find nexo-lp-server/ -type f \( -name "*.js" -o -name "*.cjs" \) -size +50k 2>/dev/null)
if [ -n "$LARGE_FILES" ]; then
    echo -e "  ${YELLOW}Large files detected (>50KB):${NC}"
    echo "$LARGE_FILES" | while read -r file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "    $SIZE $file"
    done
else
    echo -e "  ${GREEN}All files under 50KB${NC}"
fi
echo ""

# Check for common patterns
echo -e "${BLUE}[4/4] Checking code patterns...${NC}"

# Check for proper error handling
ASYNC_WITHOUT_TRY=$(grep -rn "async function\|async (" nexo-lp-server/ --include="*.js" --include="*.cjs" -l 2>/dev/null | while read -r file; do
    if ! grep -q "try\|catch" "$file" 2>/dev/null; then
        echo "$file"
    fi
done)

if [ -n "$ASYNC_WITHOUT_TRY" ]; then
    echo -e "  ${YELLOW}Files with async functions but no try/catch:${NC}"
    echo "$ASYNC_WITHOUT_TRY" | while read -r file; do
        echo "    $file"
    done
else
    echo -e "  ${GREEN}All async functions have error handling${NC}"
fi

echo ""
echo -e "${GREEN}=================================================="
echo "  Code review complete"
echo "==================================================${NC}"
