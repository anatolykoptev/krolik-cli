---
description: "Execute PRD tasks in current session"
argument-hint: "PRD_FILE [--max-iterations N]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-prd-loop.sh:*)"]
---

# Execute Krolik PRD Tasks

Initialize the PRD execution loop:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-prd-loop.sh" $ARGUMENTS
```

## Your Mission

Read the PRD file and execute ALL tasks in dependency order.

### Phase 1: Implementation (for EACH task)

1. **Create TodoWrite item** for the task
2. **Mark task as in_progress**
3. **Implement the task** following acceptance criteria exactly
4. **Run typecheck:** `pnpm typecheck` (must pass)
5. **Mark task as completed** in TodoWrite
6. **Move to next task**

### Phase 2: Finalization (after ALL tasks done)

1. **Run audit:** `krolik_audit mode="pre-commit"`
   - Fix any issues found
2. **Generate tests:** `krolik_codegen` for new/modified code
3. **Run all tests:** `pnpm test:run`
   - Fix any failures
4. **Save to memory:** `krolik_mem_save` with:
   - type: "feature" or "bugfix"
   - title: Brief summary of what was implemented
   - description: Key changes and decisions made
5. **Output completion:** `<promise>PRD_COMPLETE</promise>`

### Completion Protocol

Output `<promise>PRD_COMPLETE</promise>` ONLY when:
- All tasks implemented
- Typecheck passes
- Audit is clean
- Tests pass
- Memory saved

### Critical Rules

1. **Honesty over escape** - Never output promise falsely to exit
2. **Verify before claiming** - Run commands, read actual output
3. **Fix before moving on** - Don't leave broken code
4. **Dependency order** - Complete dependencies first

The loop feeds the same PRD prompt until genuine completion.

Begin working now.
