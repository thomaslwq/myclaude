#!/usr/bin/env bash
# =============================================================================
# auto-fix.sh — Run mini-swe-agent on open GitHub issues
# =============================================================================
#
# This script is invoked by the Auto-Fix Issues GitHub Action workflow.
# It:
#   1. Fetches open issues labeled "auto-fix" from the current repository.
#   2. For each issue, runs mini-swe-agent to attempt a fix.
#   3. If the agent produced changes, commits and pushes them.
#   4. After all issues are processed, bumps the version, tags, and publishes
#      to npm (unless DRY_RUN is true).
#
# Environment variables (set by the workflow):
#   LLM_API_KEY, LLM_MODEL_NAME, LLM_API_BASE
#   GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL
#   MAX_ISSUES, DRY_RUN
#   NODE_AUTH_TOKEN
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_ISSUES="${MAX_ISSUES:-3}"
DRY_RUN="${DRY_RUN:-false}"
MODEL_NAME="${LLM_MODEL_NAME:-openai/glm-4.5}"
REPO="${GITHUB_REPOSITORY}"

# Counters
TOTAL_FIXED=0
TOTAL_FAILED=0
ANY_CHANGES=false

echo "=============================================="
echo " Auto-Fix Issues with mini-swe-agent"
echo "=============================================="
echo "Repository:  $REPO"
echo "Max issues:  $MAX_ISSUES"
echo "Model:       $MODEL_NAME"
echo "Dry run:     $DRY_RUN"
echo "=============================================="

# ---------------------------------------------------------------------------
# Step 1: Fetch open issues
# ---------------------------------------------------------------------------
echo ""
echo ">>> Fetching open issues ..."

# Use gh CLI to list issues (pre-installed on GitHub Actions runners)
ISSUES_JSON=$(gh issue list \
  --repo "$REPO" \
  --state open \
  --json number,title,body,url \
  --limit "$MAX_ISSUES" \
  --jq '.[]')

if [ -z "$ISSUES_JSON" ]; then
  echo "No open issues found. Exiting."
  exit 0
fi

# Parse issues into an array of numbers
ISSUE_NUMBERS=$(echo "$ISSUES_JSON" | jq -r '.number')
ISSUE_COUNT=$(echo "$ISSUE_NUMBERS" | wc -l)
echo "Found $ISSUE_COUNT issue(s) to process."
echo ""

# ---------------------------------------------------------------------------
# Step 2: Process each issue
# ---------------------------------------------------------------------------
for ISSUE_NUMBER in $ISSUE_NUMBERS; do
  echo "=============================================="
  echo " Processing issue #$ISSUE_NUMBER"
  echo "=============================================="

  # Get issue details
  ISSUE_DATA=$(echo "$ISSUES_JSON" | jq "select(.number == $ISSUE_NUMBER)")
  ISSUE_TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
  ISSUE_BODY=$(echo "$ISSUE_DATA" | jq -r '.body // ""')
  ISSUE_URL=$(echo "$ISSUE_DATA" | jq -r '.url')

  echo "Title: $ISSUE_TITLE"
  echo "URL:   $ISSUE_URL"
  echo ""

  # Build the task description for mini-swe-agent
  TASK_DESCRIPTION="Fix GitHub issue #$ISSUE_NUMBER: $ISSUE_TITLE

$ISSUE_BODY

Instructions:
- Analyze the codebase and understand the issue.
- Implement the fix.
- Run the existing tests to verify the fix works.
- Do NOT create a new GitHub issue or PR — just fix the code.
- When done, run: echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT"

  # Set up LLM API key for mini-swe-agent
  # mini-swe-agent uses LiteLLM, which reads provider-specific env vars
  # We detect the provider from the model name prefix and set the right env var
  if [ -n "${LLM_API_KEY:-}" ]; then
    # Determine the provider from the model name
    case "$MODEL_NAME" in
      zai/*)
        # Z.AI (Zhipu AI global platform)
        export ZAI_API_KEY="$LLM_API_KEY"
        echo "  → Using Z.AI provider (ZAI_API_KEY)"
        ;;
      openai/glm*)
        # Zhipu AI (中国站) via OpenAI-compatible endpoint
        export OPENAI_API_KEY="$LLM_API_KEY"
        if [ -n "${LLM_API_BASE:-}" ]; then
          export OPENAI_API_BASE="$LLM_API_BASE"
        fi
        echo "  → Using Zhipu AI via OpenAI-compatible endpoint (OPENAI_API_KEY)"
        ;;
      glm*)
        # Bare GLM model name without provider prefix — use OpenAI-compatible
        export OPENAI_API_KEY="$LLM_API_KEY"
        if [ -n "${LLM_API_BASE:-}" ]; then
          export OPENAI_API_BASE="$LLM_API_BASE"
        fi
        echo "  → Using GLM model via OpenAI-compatible endpoint (OPENAI_API_KEY)"
        ;;
      claude*|anthropic*)
        export ANTHROPIC_API_KEY="$LLM_API_KEY"
        echo "  → Using Anthropic provider (ANTHROPIC_API_KEY)"
        ;;
      gpt*|o1*|o3*)
        export OPENAI_API_KEY="$LLM_API_KEY"
        echo "  → Using OpenAI provider (OPENAI_API_KEY)"
        ;;
      *)
        # Fallback: set both common env vars
        export ANTHROPIC_API_KEY="$LLM_API_KEY"
        export OPENAI_API_KEY="$LLM_API_KEY"
        echo "  → Unknown provider, falling back to ANTHROPIC_API_KEY + OPENAI_API_KEY"
        ;;
    esac
  fi

  if [ -n "${LLM_API_BASE:-}" ]; then
    # Also set provider-specific base URLs
    export OPENAI_API_BASE="$LLM_API_BASE"
    export ANTHROPIC_BASE_URL="$LLM_API_BASE"
    echo "  → API base: $LLM_API_BASE"
  fi

  # Run mini-swe-agent
  echo ""
  echo ">>> Running mini-swe-agent on issue #$ISSUE_NUMBER ..."
  echo "    (this may take a while — up to several minutes)"
  echo ""

  # Pre-configure mini-swe-agent to avoid interactive setup prompt
  MSWEA_CONFIG_DIR="$HOME/.config/mini-swe-agent"
  mkdir -p "$MSWEA_CONFIG_DIR"
  cat > "$MSWEA_CONFIG_DIR/.env" <<-EOF
MSWEA_MODEL_NAME=$MODEL_NAME
EOF
  # Also set the env var for the current session
  export MSWEA_MODEL_NAME="$MODEL_NAME"

  # Redirect stderr to a temp file so we can capture errors without
  # mixing them into stdout
  TMP_TRAJ_DIR=$(mktemp -d)
  TMP_TRAJ="$TMP_TRAJ_DIR/traj.json"

  set +e  # Allow mini to fail without aborting the script
  mini \
    --model "$MODEL_NAME" \
    --task "$TASK_DESCRIPTION" \
    --yolo \
    --exit-immediately \
    --cost-limit 3.0 \
    --output "$TMP_TRAJ" \
    2>&1
  MINI_EXIT_CODE=$?
  set -e

  echo ""
  echo ">>> mini-swe-agent finished with exit code $MINI_EXIT_CODE"

  # Check if the agent made any changes
  if git diff --quiet && git diff --cached --quiet; then
    echo "No changes detected. Skipping issue #$ISSUE_NUMBER."
    TOTAL_FAILED=$((TOTAL_FAILED + 1))

    # Add a comment on the issue to indicate it couldn't be fixed
    if [ "$DRY_RUN" = "false" ]; then
      gh issue comment "$ISSUE_NUMBER" \
        --repo "$REPO" \
        --body "🤖 **mini-swe-agent** attempted to fix this issue but was unable to produce any changes.

Exit code: \`$MINI_EXIT_CODE\`
Model: \`$MODEL_NAME\`

The trajectory log has been saved as a workflow artifact."
    fi
    echo ""
    continue
  fi

  # We have changes!
  echo "Changes detected! Committing ..."
  ANY_CHANGES=true

  # Stage all changes
  git add -A

  # Create a commit
  COMMIT_MSG="fix: auto-resolve issue #$ISSUE_NUMBER

🤖 Automatically fixed by mini-swe-agent.

${ISSUE_URL}

${ISSUE_TITLE}"

  git commit -m "$COMMIT_MSG"

  if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] Would push commit and publish."
    echo "Commit details:"
    git log -1 --oneline
  else
    echo ">>> Pushing changes to $REPO ..."
    git pull --rebase origin "$(git branch --show-current)" 2>/dev/null || true
    git push origin "$(git branch --show-current)"

    echo ">>> Adding success comment on issue #$ISSUE_NUMBER ..."
    gh issue comment "$ISSUE_NUMBER" \
      --repo "$REPO" \
      --body "✅ **Fixed!** 🤖

This issue has been automatically resolved by [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) (model: \`$MODEL_NAME\`).

The fix was committed in $(git rev-parse --short HEAD).

You can find the full agent trajectory in the workflow artifacts."
  fi

  TOTAL_FIXED=$((TOTAL_FIXED + 1))
  echo "Issue #$ISSUE_NUMBER: ✅ Fixed"
  echo ""

  # Clean up temp trajectory
  rm -rf "$TMP_TRAJ_DIR"
done

# ---------------------------------------------------------------------------
# Step 3: Bump version, tag, and publish to npm
# ---------------------------------------------------------------------------
echo ""
echo "=============================================="
echo " Summary"
echo "=============================================="
echo "Fixed:  $TOTAL_FIXED"
echo "Failed: $TOTAL_FAILED"
echo ""

if [ "$ANY_CHANGES" = "true" ] && [ "$DRY_RUN" = "false" ]; then
  echo ">>> Publishing to npm ..."

  # Ensure we're on the latest state
  git pull --rebase origin "$(git branch --show-current)" 2>/dev/null || true

  # Bump patch version (creates a git tag automatically)
  npm version patch \
    -m "chore: release v%s [auto-fix]

🤖 Automated release by mini-swe-agent"

  # Push the commit and tag
  git push origin "$(git branch --show-current)"
  git push origin --tags

  # Publish to npm
  npm publish --access public

  echo ""
  echo "=============================================="
  echo " Published to npm!"
  echo " Version: $(node -e "console.log(require('./package.json').version)")"
  echo "=============================================="
elif [ "$ANY_CHANGES" = "true" ] && [ "$DRY_RUN" = "true" ]; then
  echo "[DRY RUN] Would publish to npm:"
  echo "  - npm version patch"
  echo "  - git push --tags"
  echo "  - npm publish --access public"
else
  echo "No changes were made. Skipping npm publish."
fi

echo ""
echo "Done."