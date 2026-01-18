#!/bin/bash

# Show Krolik PRD Execution Status

set -euo pipefail

STATE_FILE=".krolik/ralph/prd-state.json"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ℹ️ No PRD execution found in this project"
  echo ""
  echo "To start: /prd-run PRD_PATH"
  exit 0
fi

# Read state
STATE=$(cat "$STATE_FILE")

IS_ACTIVE=$(echo "$STATE" | jq -r '.active // false')
ITERATION=$(echo "$STATE" | jq -r '.iteration // 1')
MAX_ITERATIONS=$(echo "$STATE" | jq -r '.maxIterations // 50')
TOTAL=$(echo "$STATE" | jq -r '.totalTasks // 0')
PRD_PATH=$(echo "$STATE" | jq -r '.prdPath // "unknown"')
TITLE=$(echo "$STATE" | jq -r '.title // "PRD Tasks"')
STARTED=$(echo "$STATE" | jq -r '.startedAt // "unknown"')

echo "📊 Krolik PRD Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$IS_ACTIVE" == "true" ]]; then
  echo "🔄 Status: ACTIVE"
else
  STATUS=$(echo "$STATE" | jq -r '.status // "inactive"')
  echo "⏹️ Status: ${STATUS^^}"
fi

echo ""
echo "📋 PRD: $TITLE"
echo "📁 Path: $PRD_PATH"
echo "📅 Started: $STARTED"
echo "🔄 Iteration: $ITERATION/$MAX_ITERATIONS"
echo ""
echo "📈 Tasks: $TOTAL total"

# Show task list from PRD
if [[ -f "$PRD_PATH" ]]; then
  PRD=$(cat "$PRD_PATH")

  echo "📋 Tasks:"
  echo "$PRD" | jq -r '.tasks | to_entries | .[] | "   " + (.key + 1 | tostring) + ". " + .value.title' 2>/dev/null || true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$IS_ACTIVE" == "true" ]]; then
  echo "To cancel: /prd-cancel"
else
  echo "To start: /prd-run PRD_PATH"
fi
