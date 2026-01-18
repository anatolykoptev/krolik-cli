#!/bin/bash

# Cancel Krolik PRD Execution

set -euo pipefail

STATE_FILE=".krolik/ralph/prd-state.json"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ℹ️ No active PRD execution found"
  exit 0
fi

# Read current state
STATE=$(cat "$STATE_FILE")
IS_ACTIVE=$(echo "$STATE" | jq -r '.active // false')

if [[ "$IS_ACTIVE" != "true" ]]; then
  echo "ℹ️ PRD execution is not active"
  exit 0
fi

# Get progress info
CURRENT=$(echo "$STATE" | jq -r '.currentTaskIndex // 0')
TOTAL=$(echo "$STATE" | jq -r '.totalTasks // 0')

# Mark as cancelled
echo "$STATE" | jq '.active = false | .cancelledAt = (now | todate) | .status = "cancelled"' > "$STATE_FILE"

echo "🛑 PRD execution cancelled"
echo ""
echo "Progress: $CURRENT/$TOTAL tasks completed"
echo ""
echo "To resume from where you left off, run /prd-run again."
