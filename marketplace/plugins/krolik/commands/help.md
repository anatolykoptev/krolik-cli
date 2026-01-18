---
description: "Execute GitHub issue end-to-end"
argument-hint: "ISSUE_NUMBER"
allowed-tools: ["krolik_prd", "krolik_audit", "krolik_mem_save", "krolik_context", "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-prd-loop.sh:*)"]
---

# Krolik: Issue → Implementation

Execute GitHub issue `$ARGUMENTS` from start to finish.

## Step 1: Gather Context

Call `krolik_context` with:
- `issue: "$ARGUMENTS"`
- `forPrd: true`

This enriches your context with:
- Database schema and API routes
- Relevant memories from past work
- Project skills/guardrails
- PRD workflow instructions

## Step 2: Generate PRD

Call `krolik_prd` with issue number `$ARGUMENTS`.

This will:
- Fetch issue details from GitHub
- Decompose into atomic tasks with acceptance criteria
- Save PRD to `.krolik/ralph/prd/issue-$ARGUMENTS.json`

## Step 3: Start Execution Loop

After PRD is generated, run:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-prd-loop.sh" ".krolik/ralph/prd/issue-$ARGUMENTS.json"
```

## Step 4: Execute Tasks

For EACH task in PRD:

1. **TodoWrite** - add task, mark in_progress
2. **Implement** - follow acceptance criteria exactly
3. **Verify** - `pnpm typecheck` must pass
4. **Complete** - mark task done in TodoWrite

## Step 5: Finalization

After ALL tasks complete:

1. `krolik_audit mode="pre-commit"` - fix any issues
2. `pnpm test:run` - ensure tests pass
3. `krolik_mem_save` with:
   - type: "feature" or "bugfix"
   - title: Brief summary
   - description: Key changes made
4. Output: `<promise>PRD_COMPLETE</promise>`

## Rules

- **Verify before claiming** - run commands, check output
- **Fix before moving on** - don't leave broken code
- **Dependency order** - complete dependencies first
- **Honest completion** - only output promise when truly done

Begin now.
