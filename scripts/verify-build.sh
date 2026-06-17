#!/bin/bash
# ============================================================
# NEXO Landing Page Creator v3.0 - Build Verification
# ============================================================
# Verifies that all required files and directories exist
# for the application to run properly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "=================================================="
echo "  NEXO Landing Page Creator v3.0 - Build Verification"
echo "=================================================="
echo ""

# Helper functions
check_file() {
    if [ -f "$1" ]; then
        echo -e "  ${GREEN}[OK]${NC} $2"
    else
        echo -e "  ${RED}[MISSING]${NC} $2"
        ((ERRORS++)) || true
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "  ${GREEN}[OK]${NC} $2"
    else
        echo -e "  ${YELLOW}[WARN]${NC} $2 (will be created on startup)"
        ((WARNINGS++)) || true
    fi
}

# Root files
echo -e "${BLUE}[1/6] Checking root files...${NC}"
check_file "$PROJECT_DIR/package.json" "package.json"
check_file "$PROJECT_DIR/.env.example" ".env.example"
check_file "$PROJECT_DIR/.gitignore" ".gitignore"
check_file "$PROJECT_DIR/README.md" "README.md"
check_file "$PROJECT_DIR/AGENTS.md" "AGENTS.md"
check_file "$PROJECT_DIR/pm2-ecosystem.config.js" "pm2-ecosystem.config.js"
echo ""

# Server files
echo -e "${BLUE}[2/6] Checking server files...${NC}"
check_file "$PROJECT_DIR/nexo-lp-server/nexo-lp-server.js" "nexo-lp-server.js"
check_file "$PROJECT_DIR/nexo-lp-server/nexo-lp-routes.js" "nexo-lp-routes.js"
check_file "$PROJECT_DIR/nexo-lp-server/config/nexo-lp-config.js" "nexo-lp-config.js"
echo ""

# Models
echo -e "${BLUE}[3/6] Checking model files...${NC}"
check_file "$PROJECT_DIR/nexo-lp-server/models/sqlite.js" "sqlite.js"
check_file "$PROJECT_DIR/nexo-lp-server/models/migrations/001_init.sql" "001_init.sql"
check_file "$PROJECT_DIR/nexo-lp-server/models/migrations/002_versions.sql" "002_versions.sql"
check_file "$PROJECT_DIR/nexo-lp-server/models/migrations/003_tokens.sql" "003_tokens.sql"
check_file "$PROJECT_DIR/nexo-lp-server/models/migrations/004_mining_jobs.sql" "004_mining_jobs.sql"
check_file "$PROJECT_DIR/nexo-lp-server/models/migrations/005_templates.sql" "005_templates.sql"
echo ""

# Repositories
echo -e "${BLUE}[4/6] Checking repository files...${NC}"
check_file "$PROJECT_DIR/nexo-lp-server/models/repositories/SessionRepository.js" "SessionRepository.js"
check_file "$PROJECT_DIR/nexo-lp-server/models/repositories/TemplateRepository.js" "TemplateRepository.js"
check_file "$PROJECT_DIR/nexo-lp-server/models/repositories/MiningJobRepository.js" "MiningJobRepository.js"
check_file "$PROJECT_DIR/nexo-lp-server/models/repositories/DeploymentRepository.js" "DeploymentRepository.js"
echo ""

# Services
echo -e "${BLUE}[5/6] Checking service files...${NC}"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpSessionService.js" "lpSessionService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpTokenService.js" "lpTokenService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpGenerationService.js" "lpGenerationService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpPreviewService.js" "lpPreviewService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpDeployService.js" "lpDeployService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpTemplateService.js" "lpTemplateService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpStackService.js" "lpStackService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpBuildVerificationService.js" "lpBuildVerificationService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpBugDetectorService.js" "lpBugDetectorService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpRebuildEngine.js" "lpRebuildEngine.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpMiningService.js" "lpMiningService.js"
check_file "$PROJECT_DIR/nexo-lp-server/services/lpBridgeAdapter.cjs" "lpBridgeAdapter.cjs"
echo ""

# Directories
echo -e "${BLUE}[6/6] Checking directories...${NC}"
check_dir "$PROJECT_DIR/nexo-lp-server/agents" "agents/"
check_dir "$PROJECT_DIR/nexo-lp-server/workers" "workers/"
check_dir "$PROJECT_DIR/scripts" "scripts/"
check_dir "$PROJECT_DIR/nexo-lp-web/dist" "nexo-lp-web/dist/"
echo ""

# Summary
echo "=================================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "  ${GREEN}Verification passed!${NC} ($WARNINGS warnings)"
    echo "=================================================="
    exit 0
else
    echo -e "  ${RED}Verification failed: $ERRORS errors, $WARNINGS warnings${NC}"
    echo "=================================================="
    exit 1
fi
