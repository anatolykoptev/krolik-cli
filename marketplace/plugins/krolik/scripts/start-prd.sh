#!/bin/bash

# Start Krolik PRD Execution
# Initializes state file and prepares for task execution

set -euo pipefail

# Parse arguments
PRD_PATH="${1:-PRD.json}"
MODEL="sonnet"

# Parse optional arguments
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      MODEL="${2:-sonnet}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Validate PRD file exists
if [[ ! -f "$PRD_PATH" ]]; then
  echo "❌ Error: PRD file not found: $PRD_PATH"
  echo ""
  echo "Usage: /prd-run PRD_PATH [--model MODEL]"
  echo "Example: /prd-run .krolik/ralph/prd/issue-123.json --model opus"
  exit 1
fi

# Read and validate PRD
PRD=$(cat "$PRD_PATH")

# Check if it's valid JSON
if ! echo "$PRD" | jq empty 2>/dev/null; then
  echo "❌ Error: Invalid JSON in PRD file"
  exit 1
fi

# Extract task count
TOTAL_TASKS=$(echo "$PRD" | jq '.tasks | length')

if [[ "$TOTAL_TASKS" -eq 0 ]]; then
  echo "❌ Error: No tasks found in PRD file"
  exit 1
fi

# Create state directory
STATE_DIR=".krolik/ralph"
mkdir -p "$STATE_DIR"

# Check if execution already active
STATE_FILE="$STATE_DIR/prd-state.json"
if [[ -f "$STATE_FILE" ]]; then
  IS_ACTIVE=$(cat "$STATE_FILE" | jq -r '.active // false')
  if [[ "$IS_ACTIVE" == "true" ]]; then
    echo "⚠️ PRD execution already active!"
    echo "Current progress: $(cat "$STATE_FILE" | jq -r '.currentTaskIndex + 1')/$TOTAL_TASKS tasks"
    echo ""
    echo "To cancel: /prd-cancel"
    echo "To continue: just exit (the loop will feed next task)"
    exit 0
  fi
fi

# Build task summary
TASKS=$(echo "$PRD" | jq -r '.tasks | to_entries | map({id: .value.id, status: "pending", index: .key}) | .')

# Create state file
cat > "$STATE_FILE" << EOF
{
  "version": "1.0",
  "active": true,
  "prdPath": "$PRD_PATH",
  "currentTaskIndex": 0,
  "totalTasks": $TOTAL_TASKS,
  "tasks": $TASKS,
  "model": "$MODEL",
  "projectRoot": "$(pwd)",
  "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Get first task info for display
FIRST_TASK=$(echo "$PRD" | jq '.tasks[0]')
FIRST_TITLE=$(echo "$FIRST_TASK" | jq -r '.title // "Untitled"')

echo "🚀 Krolik PRD Execution Started"
echo ""
echo "📋 PRD: $PRD_PATH"
echo "📊 Tasks: $TOTAL_TASKS"
echo "🤖 Model: $MODEL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "First task: $FIRST_TITLE"
echo ""
echo "When you complete each task, output:"
echo "  <task-completed>TASK_ID</task-completed>"
echo ""
echo "To skip a task:"
echo "  <task-skipped>TASK_ID</task-skipped>"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
