#!/bin/bash

# Auto-Fix GitHub Issue Script
# 
# Automatically works on the highest priority issue by:
# 1. Finding the highest priority issue (P0 > P1 > P2 > P3)
# 2. Creating a feature branch
# 3. Invoking Antigravity agent to implement the fix
# 4. Running validation tests
# 5. Committing, pushing, and merging to main

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠️  Running in DRY RUN mode - no changes will be made${NC}\n"
fi

# Function to print colored output
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}" >&2
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}" >&2
}

log_error() {
  echo -e "${RED}✗ $1${NC}" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}" >&2
}

# Function to find highest priority issue
find_highest_priority_issue() {
  log_info "Finding highest priority issue..."
  
  # Try each priority level
  for priority in P0 P1 P2 P3; do
    local issues=$(gh issue list --label "$priority" --limit 1 --json number,title,body,url --state open 2>/dev/null)
    if [[ -z "$issues" ]]; then issues='[]'; fi
    # Ensure the output is valid JSON; if not, default to empty array
    if ! echo "$issues" | jq empty > /dev/null 2>&1; then issues='[]'; fi
    if echo "$issues" | jq empty > /dev/null 2>&1; then
      local count=$(echo "$issues" | jq '. | length')
      
      if [[ "$count" -gt 0 ]]; then
        echo "$issues" | jq '.[0]'
        return 0
      fi
    fi
  done
  
  # No prioritized issues found, get any open issue
  log_warning "No prioritized issues found, checking for any open issue..."
  local issues=$(gh issue list --limit 1 --json number,title,body,url --state open 2>/dev/null)
  if [[ -z "$issues" ]]; then issues='[]'; fi
  # Ensure the output is valid JSON; if not, default to empty array
  if ! echo "$issues" | jq empty > /dev/null 2>&1; then issues='[]'; fi
  if echo "$issues" | jq empty > /dev/null 2>&1; then
    local count=$(echo "$issues" | jq '. | length')
    
    if [[ "$count" -gt 0 ]]; then
      echo "$issues" | jq '.[0]'
      return 0
    fi
  fi
  
  return 1
}

# Main execution
main() {
  echo "🤖 Automated GitHub Issue Fix"
  echo "═══════════════════════════════════════════════════"
  echo ""
  
  # Check prerequisites
  if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) is not installed"
    exit 1
  fi
  
  if ! command -v jq &> /dev/null; then
    log_error "jq is not installed"
    exit 1
  fi
  
  # Make sure we're in a git repository
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
  fi
  
  # Get repository root
  REPO_ROOT=$(git rev-parse --show-toplevel)
  cd "$REPO_ROOT"
  
  # Find highest priority issue
  ISSUE_JSON=$(find_highest_priority_issue)
  
  if [[ -z "$ISSUE_JSON" ]]; then
    log_info "No open issues found. Nothing to do!"
    exit 0
  fi
  
  # Parse issue details
  ISSUE_NUMBER=$(echo "$ISSUE_JSON" | jq -r '.number')
  ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
  ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body // ""')
  ISSUE_URL=$(echo "$ISSUE_JSON" | jq -r '.url')
  
  echo ""
  log_success "Found issue to work on:"
  echo "  Number: #$ISSUE_NUMBER"
  echo "  Title: $ISSUE_TITLE"
  echo "  URL: $ISSUE_URL"
  echo ""
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "DRY RUN: Would work on issue #$ISSUE_NUMBER"
    log_warning "Run without --dry-run to actually process the issue"
    exit 0
  fi
  
  # Create branch name (slug from title)
  BRANCH_SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c 1-50)
  BRANCH_NAME="issue-${ISSUE_NUMBER}-${BRANCH_SLUG}"
  
  log_info "Creating branch: $BRANCH_NAME"
  
  # Ensure we're on main and up to date
  git checkout main
  git pull origin main
  
  # Create and checkout new branch
  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    log_warning "Branch $BRANCH_NAME already exists, using it"
    git checkout "$BRANCH_NAME"
  else
    git checkout -b "$BRANCH_NAME"
    log_success "Created and checked out branch: $BRANCH_NAME"
  fi
  
  # Create prompt for Antigravity agent
  AGENT_PROMPT="Please implement a fix for GitHub issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

Issue Details:
${ISSUE_BODY}

Issue URL: ${ISSUE_URL}

Please:
1. Analyze the issue and understand what needs to be changed
2. Implement the necessary code changes
3. Test the changes if applicable
4. Ensure the code follows best practices

After completing the work, please summarize what was done."
  
  log_info "Invoking Antigravity agent to work on the issue..."
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "AGENT TASK:"
  echo "$AGENT_PROMPT"
  echo "════════════════════════════════════════════════════════════════"
  echo ""
  
  # The agent is already running this script, so we'll write the prompt to a file
  # and the human can invoke a new agent session with it
  PROMPT_FILE="${REPO_ROOT}/.agent-issue-${ISSUE_NUMBER}.txt"
  echo "$AGENT_PROMPT" > "$PROMPT_FILE"
  
  log_success "Agent prompt written to: $PROMPT_FILE"
  log_info "Workflow will now implement and validate the fix"
  echo ""
  
  # Since we can't directly invoke another agent, we'll output the workflow steps
  log_info "Automated Fix and Test Workflow:"
  echo ""
  echo "  Phase 1: Implementation"
  echo "  ─────────────────────"
  echo "  1. Implement the fix for issue #${ISSUE_NUMBER}"
  echo "  2. Commit changes: git add -A && git commit -m 'Fix #${ISSUE_NUMBER}: ${ISSUE_TITLE}'"
  echo ""
  echo "  Phase 2: Dev Environment Testing"
  echo "  ─────────────────────────────────"
  echo "  3. Start dev environment: ./deploy.sh local"
  echo "  4. Run tests: npm test (or playwright test if applicable)"
  echo "  5. If tests FAIL: fix issues, commit fixes, repeat from step 4"
  echo "  6. If tests PASS: proceed to Phase 3"
  echo ""
  echo "  Phase 3: Merge to Main"
  echo "  ──────────────────────"
  echo "  7. Push branch: git push origin ${BRANCH_NAME}"
  echo "  8. Create PR: gh pr create --title 'Fix #${ISSUE_NUMBER}: ${ISSUE_TITLE}' --body 'Fixes #${ISSUE_NUMBER}'"
  echo "  9. Merge PR: gh pr merge --merge --delete-branch"
  echo "  10. Checkout main: git checkout main && git pull origin main"
  echo ""
  echo "  Phase 4: Full Regression Testing"
  echo "  ─────────────────────────────────"
  echo "  11. Run full test suite in dev: ./deploy.sh test"
  echo "  12. Run E2E tests: npx playwright test"
  echo "  13. If any tests FAIL: create fix branch, fix issues, merge, repeat from step 11"
  echo "  14. If all tests PASS: deployment complete!"
  echo ""
  
  log_info "Branch $BRANCH_NAME is ready for development"
  log_warning "Remember: Only merge to main after dev tests pass, then run full regression"
}

main "$@"
