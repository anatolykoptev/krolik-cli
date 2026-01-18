#!/bin/bash

# Setup Krolik PRD Loop
# Validates PRD and creates state file. Prompt built from PRD by stop hook.

set -euo pipefail

# Parse arguments
PRD_PATH="${1:-}"
MAX_ITERATIONS=50

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations)
      MAX_ITERATIONS="${2:-50}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$PRD_PATH" ]]; then
  echo "Usage: /prd-run PRD_PATH [--max-iterations N]"
  exit 1
fi

if [[ ! -f "$PRD_PATH" ]]; then
  echo "Error: PRD file not found: $PRD_PATH"
  exit 1
fi

PRD=$(cat "$PRD_PATH")

if ! echo "$PRD" | jq empty 2>/dev/null; then
  echo "Error: Invalid JSON in PRD file"
  exit 1
fi

TOTAL_TASKS=$(echo "$PRD" | jq '.tasks | length')
PROJECT=$(echo "$PRD" | jq -r '.project // "project"')
TITLE=$(echo "$PRD" | jq -r '.title // "PRD Tasks"')

if [[ "$TOTAL_TASKS" -eq 0 ]]; then
  echo "Error: No tasks found in PRD file"
  exit 1
fi

# Create state directory
STATE_DIR=".krolik/ralph"
mkdir -p "$STATE_DIR"

# Store minimal state (PRD is source of truth)
cat > "$STATE_DIR/prd-state.json" << EOF
{
  "version": "1.0",
  "active": true,
  "prdPath": "$PRD_PATH",
  "iteration": 1,
  "maxIterations": $MAX_ITERATIONS,
  "completionPromise": "PRD_COMPLETE",
  "totalTasks": $TOTAL_TASKS,
  "project": "$PROJECT",
  "title": "$TITLE",
  "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "PRD Loop started: $TITLE ($TOTAL_TASKS tasks)"
echo "Stop hook will feed tasks until <promise>PRD_COMPLETE</promise>"
