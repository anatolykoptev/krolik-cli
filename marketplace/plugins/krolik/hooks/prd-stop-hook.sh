#!/bin/bash

# Krolik PRD Stop Hook
# Builds prompt from PRD file and feeds back until completion promise detected

set -euo pipefail

HOOK_INPUT=$(cat)
STATE_FILE=".krolik/ralph/prd-state.json"

# No state file = no active PRD execution
if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

STATE=$(cat "$STATE_FILE")

# Not active = allow exit
IS_ACTIVE=$(echo "$STATE" | jq -r '.active // false')
if [[ "$IS_ACTIVE" != "true" ]]; then
  exit 0
fi

# Get state values
ITERATION=$(echo "$STATE" | jq -r '.iteration // 1')
MAX_ITERATIONS=$(echo "$STATE" | jq -r '.maxIterations // 50')
COMPLETION_PROMISE=$(echo "$STATE" | jq -r '.completionPromise // "PRD_COMPLETE"')
PRD_PATH=$(echo "$STATE" | jq -r '.prdPath // ""')

# Validate
if [[ ! "$ITERATION" =~ ^[0-9]+$ ]]; then
  rm "$STATE_FILE"
  exit 0
fi

# PRD file must exist
if [[ -z "$PRD_PATH" ]] || [[ ! -f "$PRD_PATH" ]]; then
  echo "Krolik PRD: PRD file not found: $PRD_PATH"
  rm "$STATE_FILE"
  exit 0
fi

# Max iterations reached
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "Krolik PRD: Max iterations ($MAX_ITERATIONS) reached."
  echo "$STATE" | jq '.active = false | .status = "max_iterations"' > "$STATE_FILE"
  exit 0
fi

# Get transcript to check Claude's output
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')

if [[ -z "$TRANSCRIPT_PATH" ]] || [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  rm "$STATE_FILE"
  exit 0
fi

# Check for completion promise in Claude's output
if grep -q '"role":"assistant"' "$TRANSCRIPT_PATH"; then
  LAST_OUTPUT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1 | jq -r '
    .message.content |
    map(select(.type == "text")) |
    map(.text) |
    join("\n")
  ' 2>/dev/null || echo "")

  PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g' 2>/dev/null || echo "")

  if [[ -n "$PROMISE_TEXT" ]] && [[ "$PROMISE_TEXT" = "$COMPLETION_PROMISE" ]]; then
    echo "Krolik PRD: Complete! All tasks done."
    echo "$STATE" | jq '.active = false | .status = "completed"' > "$STATE_FILE"
    exit 0
  fi
fi

# Not complete - continue loop
NEXT_ITERATION=$((ITERATION + 1))
echo "$STATE" | jq --argjson iter "$NEXT_ITERATION" '.iteration = $iter' > "$STATE_FILE"

# Minimal prompt - Claude reads PRD itself
PROMPT="Continue PRD: ${PRD_PATH}
Iteration: ${NEXT_ITERATION}/${MAX_ITERATIONS}

Complete remaining tasks. Output <promise>PRD_COMPLETE</promise> when done."

SYSTEM_MSG="PRD ${NEXT_ITERATION}/${MAX_ITERATIONS}"

# Block exit
jq -n \
  --arg prompt "$PROMPT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
