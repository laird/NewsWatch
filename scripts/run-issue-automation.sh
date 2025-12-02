#!/bin/bash

# Run Issue Automation
# Main orchestration script for automated GitHub issue management

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN=""
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo -e "${YELLOW}⚠️  Running in DRY RUN mode${NC}\n"
fi

echo -e "${BLUE}🤖 GitHub Issue Automation Pipeline${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Timestamp: $(date)"
echo ""

# Step 1: Prioritize all issues
echo -e "${GREEN}Step 1: Prioritizing issues...${NC}"
echo "─────────────────────────────────"
node "${SCRIPT_DIR}/prioritize-issues.js" $DRY_RUN
echo ""

# Step 2: Work on highest priority issue
echo -e "${GREEN}Step 2: Working on highest priority issue...${NC}"
echo "─────────────────────────────────"
bash "${SCRIPT_DIR}/auto-fix-issue.sh" $DRY_RUN
echo ""

echo -e "${GREEN}✅ Automation pipeline complete!${NC}"
