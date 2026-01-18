# Ralph Loop CLI Commands Specification

This document defines the CLI commands for managing Ralph Loop PRDs and execution.

## Command Structure

All Ralph Loop commands use the `krolik ralph` namespace:

```bash
krolik ralph <command> [options]
```

## Commands Reference

### `krolik ralph init`

Initialize a new PRD file from template or interactive prompt.

**Usage:**
```bash
krolik ralph init [--template <name>] [--output <path>]
```

**Options:**
- `--template, -t <name>` - Use a predefined template (stripe, auth, crud, api)
- `--output, -o <path>` - Output file path (default: PRD.json)
- `--interactive, -i` - Interactive mode with prompts
- `--project <name>` - Project name (default: current directory name)

**Examples:**
```bash
# Interactive mode
krolik ralph init --interactive

# Use Stripe template
krolik ralph init --template stripe

# Custom output path
krolik ralph init --output ./prd/feature-x.json
```

**Output:**
- Creates PRD.json with basic structure
- Validates schema before writing
- Shows next steps (add tasks, run validation)

---

### `krolik ralph add`

Add a new task to PRD.

**Usage:**
```bash
krolik ralph add <title> [options]
```

**Options:**
- `--description, -d <text>` - Task description
- `--user-story <text>` - User story (As a X, I want Y, so that Z)
- `--epic <name>` - Epic/feature name
- `--priority <level>` - critical | high | medium | low (default: medium)
- `--complexity <level>` - trivial | simple | moderate | complex | epic (default: moderate)
- `--dependencies <ids>` - Comma-separated task IDs
- `--labels <tags>` - Comma-separated labels
- `--files <paths>` - Comma-separated related file paths
- `--acceptance <criteria>` - Acceptance criteria (can use multiple times)
- `--auto-id` - Auto-generate task ID from title
- `--prd <path>` - PRD file path (default: PRD.json)

**Examples:**
```bash
# Basic task
krolik ralph add "Add Stripe webhook handler" \
  --epic payment-integration \
  --priority high

# With acceptance criteria
krolik ralph add "Create user authentication" \
  --acceptance "User can sign up with email" \
  --acceptance "User can log in with password" \
  --acceptance "Session persists across page reloads"

# With dependencies
krolik ralph add "Deploy to production" \
  --dependencies stripe-webhook,stripe-tests \
  --priority critical \
  --complexity moderate
```

**Output:**
- Validates task structure
- Auto-generates ID if --auto-id
- Checks for duplicate IDs
- Validates dependencies exist
- Updates PRD.json

---

### `krolik ralph list`

List all tasks in PRD with filtering.

**Usage:**
```bash
krolik ralph list [options]
```

**Options:**
- `--epic <name>` - Filter by epic
- `--priority <level>` - Filter by priority
- `--status <state>` - Filter by status (requires progress.json)
- `--labels <tags>` - Filter by labels
- `--format <type>` - Output format: table | json | xml | markdown (default: table)
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Progress file path (default: progress.json)

**Examples:**
```bash
# List all tasks
krolik ralph list

# Filter by epic
krolik ralph list --epic payment-integration

# Show only high priority tasks
krolik ralph list --priority high

# JSON output
krolik ralph list --format json

# Show completed tasks
krolik ralph list --status done
```

**Output:**
```
┌─────────────────────────┬────────────────────────────────┬──────────┬──────────┬────────┐
│ ID                      │ Title                          │ Epic     │ Priority │ Status │
├─────────────────────────┼────────────────────────────────┼──────────┼──────────┼────────┤
│ stripe-001-env          │ Add Stripe environment vars    │ payment  │ critical │ done   │
│ stripe-002-schema       │ Create Prisma schema           │ payment  │ high     │ active │
│ stripe-003-client       │ Initialize Stripe client       │ payment  │ high     │ todo   │
└─────────────────────────┴────────────────────────────────┴──────────┴──────────┴────────┘
```

---

### `krolik ralph prioritize`

Reorder tasks by priority or manually.

**Usage:**
```bash
krolik ralph prioritize [options]
```

**Options:**
- `--auto` - Auto-prioritize by: critical > high > medium > low
- `--interactive, -i` - Interactive reordering
- `--move <id>` - Move task to position
- `--after <id>` - Place moved task after this ID
- `--before <id>` - Place moved task before this ID
- `--prd <path>` - PRD file path (default: PRD.json)

**Examples:**
```bash
# Auto-prioritize
krolik ralph prioritize --auto

# Interactive mode (shows numbered list, prompts for new order)
krolik ralph prioritize --interactive

# Move specific task
krolik ralph prioritize --move stripe-003-client --after stripe-001-env
```

---

### `krolik ralph validate`

Validate PRD structure and consistency.

**Usage:**
```bash
krolik ralph validate [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Also validate progress.json consistency
- `--strict` - Strict mode (fail on warnings)
- `--fix` - Auto-fix common issues where possible

**Examples:**
```bash
# Validate PRD only
krolik ralph validate

# Validate PRD + progress consistency
krolik ralph validate --progress progress.json

# Strict validation
krolik ralph validate --strict
```

**Checks:**
- ✅ Schema compliance (Zod validation)
- ✅ Duplicate task IDs
- ✅ Invalid dependencies (non-existent tasks)
- ✅ Circular dependencies
- ✅ Duplicate acceptance criteria IDs
- ✅ Progress-PRD consistency (if --progress)
- ✅ Token budget feasibility

**Output:**
```
✓ Schema validation passed
✓ No duplicate task IDs
✓ All dependencies valid
✗ Circular dependency detected: stripe-001 → stripe-002 → stripe-001
✓ No duplicate acceptance criteria
✗ Warning: Total estimated tokens (520000) exceed budget (500000)

Validation failed with 2 errors, 1 warning.
```

---

### `krolik ralph run`

Execute PRD tasks with Ralph Loop.

**Usage:**
```bash
krolik ralph run [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Progress file path (default: progress.json)
- `--guardrails <path>` - Guardrails file (default: guardrails.md)
- `--start-from <id>` - Start from specific task
- `--only <id>` - Run only this task (ignores dependencies)
- `--dry-run` - Show execution plan without running
- `--no-commit` - Disable auto-commit (override config)
- `--interactive, -i` - Prompt before each task
- `--model <name>` - Override model (opus | sonnet | haiku)
- `--temperature <n>` - Override temperature (0-1)

**Examples:**
```bash
# Run entire PRD
krolik ralph run

# Dry run (show execution plan)
krolik ralph run --dry-run

# Start from specific task (resume)
krolik ralph run --start-from stripe-003-client

# Run single task only
krolik ralph run --only stripe-002-schema --no-commit

# Interactive mode
krolik ralph run --interactive
```

**Execution Flow:**
1. Validate PRD
2. Load progress.json (or create new)
3. Load guardrails.md
4. Build dependency graph
5. Find next task to execute
6. Execute task with Claude
7. Verify acceptance criteria
8. Auto-commit if successful
9. Update progress.json
10. Generate guardrails on failure
11. Repeat until all tasks done

**Output:**
```
🐰 Ralph Loop v0.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PRD: Add Stripe Payment Integration
📊 Progress: 1/8 tasks completed (12.5%)
🎯 Token Budget: 12,800 / 500,000 used

⏭  Next task: stripe-002-schema
   Create Prisma schema for subscriptions

🤖 Executing with claude-sonnet-4...
   Attempt 1/3

✓ Task completed successfully
✓ All acceptance criteria met
✓ Committed: abc123 "feat: add Stripe subscription models"
   Tokens used: 14,800

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Progress: 2/8 tasks completed (25%)
🎯 Token Budget: 27,600 / 500,000 used
```

---

### `krolik ralph resume`

Resume execution from last checkpoint.

**Usage:**
```bash
krolik ralph resume [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Progress file path (default: progress.json)
- `--retry-failed` - Retry failed tasks instead of skipping

**Examples:**
```bash
# Resume from last state
krolik ralph resume

# Retry failed tasks
krolik ralph resume --retry-failed
```

Equivalent to `krolik ralph run --start-from <last-incomplete-task>`

---

### `krolik ralph status`

Show current PRD execution status.

**Usage:**
```bash
krolik ralph status [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Progress file path (default: progress.json)
- `--format <type>` - Output format: table | json | xml (default: table)
- `--verbose, -v` - Show detailed attempt history

**Examples:**
```bash
# Quick status
krolik ralph status

# Detailed with attempt history
krolik ralph status --verbose

# JSON output
krolik ralph status --format json
```

**Output:**
```
📋 PRD: Add Stripe Payment Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary
   Total Tasks: 8
   Completed: 2 (25%)
   In Progress: 1
   Failed: 0
   Blocked: 0
   Skipped: 0

🎯 Token Budget
   Used: 27,600 / 500,000 (5.5%)
   Remaining: 472,400

⏱  Time
   Started: 2026-01-15 11:00:00
   Elapsed: 28 minutes

🚧 Current Task
   ID: stripe-002-schema
   Title: Create Prisma schema for subscriptions
   Attempt: 2/3
   Status: in_progress
   Tokens: 8,000

📝 Recent Tasks
   ✓ stripe-001-env (completed, 4,800 tokens, commit: abc123)
   🔄 stripe-002-schema (in progress, attempt 2)
```

---

### `krolik ralph guardrails`

Manage and export guardrails.

**Usage:**
```bash
krolik ralph guardrails [command] [options]
```

**Commands:**
- `list` - List all guardrails
- `show <id>` - Show specific guardrail
- `export` - Export as context for Claude
- `add` - Manually add guardrail
- `remove <id>` - Remove guardrail

**Options:**
- `--guardrails <path>` - Guardrails file (default: guardrails.md)
- `--category <type>` - Filter by category
- `--severity <level>` - Filter by severity
- `--tags <list>` - Filter by tags
- `--format <type>` - Output format (markdown | json | xml)

**Examples:**
```bash
# List all guardrails
krolik ralph guardrails list

# Filter by category
krolik ralph guardrails list --category security

# Show specific guardrail
krolik ralph guardrails show guardrail-001

# Export for Claude context
krolik ralph guardrails export --format xml > guardrails-context.xml

# Manually add guardrail
krolik ralph guardrails add \
  --title "Always validate user input" \
  --category security \
  --problem "Unvalidated input caused SQL injection" \
  --solution "Use Zod schemas for all user input"
```

---

### `krolik ralph edit`

Edit PRD task interactively.

**Usage:**
```bash
krolik ralph edit <task-id> [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--field <name>` - Edit specific field only
- `--interactive, -i` - Interactive editor

**Examples:**
```bash
# Edit task in interactive mode
krolik ralph edit stripe-001-env --interactive

# Edit specific field
krolik ralph edit stripe-001-env --field description
```

---

### `krolik ralph delete`

Delete task from PRD.

**Usage:**
```bash
krolik ralph delete <task-id> [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--force, -f` - Skip confirmation
- `--cascade` - Also remove from dependent tasks

**Examples:**
```bash
# Delete with confirmation
krolik ralph delete stripe-999-unused

# Force delete with cascade
krolik ralph delete stripe-001-env --force --cascade
```

---

### `krolik ralph export`

Export PRD/progress in various formats.

**Usage:**
```bash
krolik ralph export [options]
```

**Options:**
- `--prd <path>` - PRD file path (default: PRD.json)
- `--progress <path>` - Include progress data
- `--format <type>` - markdown | html | pdf | json | xml
- `--output, -o <path>` - Output file path

**Examples:**
```bash
# Export as Markdown report
krolik ralph export --format markdown --output report.md

# Export progress as XML
krolik ralph export --progress progress.json --format xml
```

---

## MCP Tool Integration

All commands are also available as MCP tools:

```typescript
// krolik_ralph_init
{
  name: 'krolik_ralph_init',
  description: 'Initialize new PRD file',
  inputSchema: {
    template: { type: 'string', enum: ['stripe', 'auth', 'crud', 'api'] },
    project: { type: 'string' },
    output: { type: 'string' }
  }
}

// krolik_ralph_add
{
  name: 'krolik_ralph_add',
  description: 'Add task to PRD',
  inputSchema: {
    title: { type: 'string' },
    description: { type: 'string' },
    epic: { type: 'string' },
    priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    // ... more fields
  }
}

// krolik_ralph_run
{
  name: 'krolik_ralph_run',
  description: 'Execute PRD tasks',
  inputSchema: {
    prd: { type: 'string' },
    startFrom: { type: 'string' },
    dryRun: { type: 'boolean' }
  }
}

// ... etc
```

## Implementation Notes

1. **File Validation**: All commands validate input files using Zod schemas
2. **Atomic Operations**: File writes are atomic (write to temp, then rename)
3. **Backups**: Commands that modify PRD create .backup files
4. **Exit Codes**: 0 = success, 1 = validation error, 2 = execution error
5. **Logging**: Use `@/lib/@core/logger` for consistent output
6. **Colors**: Use chalk for colorized terminal output
7. **Interactive**: Use inquirer for prompts
8. **Progress Bars**: Use cli-progress for long operations

## Error Handling

All commands should:
- ✅ Validate inputs before execution
- ✅ Provide clear error messages
- ✅ Suggest fixes when possible
- ✅ Exit with appropriate codes
- ✅ Log errors to stderr
- ✅ Create backups before destructive operations
