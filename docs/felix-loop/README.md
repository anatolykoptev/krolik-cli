# Ralph Loop - Autonomous AI Task Execution

Ralph Loop is an autonomous AI execution system that reads task definitions from PRD.json, executes them sequentially with automatic retry logic, and learns from failures through guardrails.md.

## 🎯 Overview

**Ralph Loop** solves the problem of manual, repetitive AI task execution by:

1. **Reading** structured task definitions (PRD.json)
2. **Executing** tasks in dependency order with Claude
3. **Tracking** progress and token usage (progress.json)
4. **Learning** from failures to prevent future issues (guardrails.md)
5. **Auto-committing** successful changes with meaningful commit messages

## 📁 File Structure

```
project-root/
├── PRD.json              # Task definitions (input)
├── progress.json         # Execution tracking (state)
└── guardrails.md         # Learned patterns (knowledge base)
```

## 🔧 Schema Architecture

### 1. PRD.json (Product Requirements Document)

The source of truth for what needs to be built.

**Key Features:**
- ✅ Task dependency management
- ✅ Acceptance criteria (testable conditions)
- ✅ Token budget estimation
- ✅ Priority ordering
- ✅ Complexity levels for smart estimation

**Example Task:**
```json
{
  "id": "stripe-001-env",
  "title": "Add Stripe environment variables",
  "description": "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET...",
  "userStory": "As a developer, I want to configure Stripe API keys...",
  "acceptanceCriteria": [
    {
      "id": "ac-001-1",
      "description": "STRIPE_SECRET_KEY added to .env.example",
      "testCommand": "pnpm typecheck",
      "expected": "Type checking passes"
    }
  ],
  "dependencies": [],
  "priority": "critical",
  "complexity": "trivial",
  "estimatedTokens": 5000,
  "labels": ["config", "stripe"],
  "relatedFiles": [".env.example", "src/env.ts"],
  "epic": "payment-integration"
}
```

**Fields Explained:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique task identifier (kebab-case) |
| `title` | `string` | Short, descriptive title |
| `description` | `string` | Detailed task description with context |
| `userStory` | `string?` | Optional user story format |
| `acceptanceCriteria` | `array` | List of testable completion conditions |
| `dependencies` | `string[]` | Task IDs that must complete first |
| `priority` | `enum` | critical \| high \| medium \| low |
| `complexity` | `enum` | trivial \| simple \| moderate \| complex \| epic |
| `estimatedTokens` | `number?` | Token estimate (auto-calculated if omitted) |
| `labels` | `string[]` | Tags for filtering/grouping |
| `relatedFiles` | `string[]` | Files to focus on |
| `epic` | `string?` | Epic/feature this belongs to |
| `githubIssue` | `number?` | Linked GitHub issue number |

### 2. progress.json (Execution State)

Tracks the current state of PRD execution.

**Key Features:**
- ✅ Attempt history with error logs
- ✅ Token usage tracking per task
- ✅ Acceptance criteria completion status
- ✅ Commit SHAs for successful tasks
- ✅ Session metadata

**Task Progress States:**
- `todo` - Not started yet
- `in_progress` - Currently being executed
- `done` - Successfully completed
- `failed` - All retry attempts exhausted
- `blocked` - Waiting on dependency
- `skipped` - Intentionally skipped

**Example:**
```json
{
  "version": "1.0",
  "prdId": "stripe-integration-prd",
  "currentTask": "stripe-002-schema",
  "totalTokensUsed": 12800,
  "tasks": {
    "stripe-001-env": {
      "taskId": "stripe-001-env",
      "status": "done",
      "attempts": [
        {
          "attemptNumber": 1,
          "startedAt": "2026-01-15T11:00:00Z",
          "endedAt": "2026-01-15T11:08:30Z",
          "success": true,
          "tokensUsed": 4800,
          "commitSha": "a1b2c3d4e5f6"
        }
      ],
      "acceptanceCriteria": [
        { "id": "ac-001-1", "completed": true }
      ]
    }
  }
}
```

### 3. guardrails.md (Knowledge Base)

Auto-generated lessons learned from task failures.

**Key Features:**
- ✅ Categorized by problem type
- ✅ Problem-Solution-Example format
- ✅ Linked to tasks that triggered them
- ✅ Severity levels
- ✅ Searchable tags

**Example Guardrail:**
```markdown
## Guardrail: Always create Stripe customer before subscription

**Category:** code-quality
**Severity:** high
**Related Tasks:** stripe-004-create-subscription

### Problem
Attempted to create subscription without ensuring customer exists in Stripe.

### Solution
Before creating a subscription, check if user has `stripeCustomerId`. If not, create customer first and save ID to database.

### Example
\`\`\`typescript
// BAD: Assumes customer exists
const subscription = await stripe.subscriptions.create({
  customer: user.stripeCustomerId, // might be null!
  items: [{ price: priceId }],
});

// GOOD: Ensure customer exists
let customerId = user.stripeCustomerId;
if (!customerId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });
  customerId = customer.id;
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customerId },
  });
}
\`\`\`

**Tags:** stripe, customer, subscription
```

## 🚀 Usage

### Creating a PRD

```typescript
import { validatePRD, PRDSchema } from '@/lib/@ralph';

const prd = {
  version: '1.0',
  project: 'my-app',
  title: 'Add Authentication',
  config: {
    maxAttempts: 3,
    autoCommit: true,
  },
  tasks: [
    {
      id: 'auth-001-setup',
      title: 'Install NextAuth.js',
      // ... task details
    }
  ]
};

// Validate
const result = validatePRD(prd);
if (result.success) {
  // Execute with Ralph Loop
} else {
  console.error(result.error);
}
```

### CLI Commands (Planned)

```bash
# Create new PRD from template
krolik ralph init

# Add task to PRD
krolik ralph add "Add Stripe webhook handler" \
  --epic payment-integration \
  --priority high \
  --dependencies stripe-003-client

# List all tasks
krolik ralph list

# Prioritize tasks (reorder)
krolik ralph prioritize

# Validate PRD
krolik ralph validate

# Execute PRD (start Ralph Loop)
krolik ralph run

# Resume from last checkpoint
krolik ralph resume

# Show progress
krolik ralph status

# Export guardrails as context
krolik ralph guardrails
```

## 🧩 Schema Validation

All data structures are validated using **Zod**:

```typescript
import { PRDSchema, ProgressSchema, GuardrailsFileSchema } from '@/lib/@ralph';

// Type-safe parsing
const prd = PRDSchema.parse(jsonData);
const progress = ProgressSchema.parse(progressData);

// Safe parsing (returns result object)
const result = PRDSchema.safeParse(jsonData);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## 🔄 Schema Migrations

When schemas evolve, migrations ensure backward compatibility:

```typescript
import { safeMigrate } from '@/lib/@ralph';

// Automatically migrates and creates backup
const result = safeMigrate(oldData, 'prd', 'PRD.json');

if (result.changed) {
  console.log('Migrated from version', result.metadata[0].fromVersion);
  console.log('Backup saved to:', result.backupPath);
}
```

## 📊 Token Budget Management

Ralph Loop tracks token usage and warns about budget overruns:

```typescript
import { calculateTokenBudget } from '@/lib/@ralph';

const budget = calculateTokenBudget(prd, progress);

console.log('Used:', budget.used);
console.log('Remaining:', budget.remaining);
if (budget.estimatedOverage) {
  console.warn('Warning: May exceed budget by', budget.estimatedOverage, 'tokens');
}
```

## 🎯 Dependency Resolution

Tasks are executed in topological order:

```typescript
import { buildDependencyGraph, getNextTask } from '@/lib/@ralph';

// Build dependency graph
const graph = buildDependencyGraph(prd.tasks);

if (graph.hasCycles) {
  console.error('Circular dependencies detected:', graph.cycles);
} else {
  console.log('Execution order:', graph.executionOrder);
}

// Get next task to execute
const nextTask = getNextTask(prd, progress);
if (nextTask) {
  console.log('Next task:', nextTask.id);
}
```

## 🧪 Testing Your PRD

Use the validation utilities:

```typescript
import { validatePRD, validateProgressAgainstPRD } from '@/lib/@ralph';

// Validate PRD structure
const prdResult = validatePRD(prdData);
if (!prdResult.success) {
  console.error('PRD validation failed:', prdResult.error);
}

// Validate progress consistency
const consistencyResult = validateProgressAgainstPRD(progress, prd);
if (!consistencyResult.success) {
  console.error('Progress-PRD mismatch:', consistencyResult.error);
}
```

## 🎨 Best Practices

### Writing Good Tasks

1. **Atomic & Focused**: One clear responsibility per task
2. **Testable**: Include verification commands in acceptance criteria
3. **Self-Documenting**: User stories explain the "why"
4. **Dependency-Aware**: Explicitly declare dependencies
5. **Token-Conscious**: Estimate complexity realistically

### Acceptance Criteria

✅ **Good:**
```json
{
  "id": "ac-001-1",
  "description": "Stripe client initialized in lib/stripe.ts",
  "testCommand": "pnpm typecheck",
  "expected": "No type errors, stripe exported"
}
```

❌ **Bad:**
```json
{
  "id": "ac-001-1",
  "description": "Make Stripe work"
  // Too vague, no test command
}
```

### Task Sizing

| Complexity | Estimated Tokens | Example |
|------------|------------------|---------|
| `trivial` | 3,000 | Add env var, update config |
| `simple` | 8,000 | Create utility function, basic model |
| `moderate` | 15,000 | API endpoint with validation |
| `complex` | 30,000 | Feature with tests, multiple files |
| `epic` | 50,000+ | Complete integration (consider splitting) |

## 🔧 Configuration Options

```json
{
  "config": {
    "maxAttempts": 3,           // Retry limit per task
    "maxTokenBudget": 500000,   // Total token budget (optional)
    "continueOnFailure": false, // Stop on first failure
    "autoCommit": true,         // Auto-commit successful tasks
    "autoGuardrails": true,     // Generate guardrails from failures
    "retryDelayMs": 2000,       // Delay between retries
    "temperature": 0.7,         // Claude temperature (0-1)
    "model": "sonnet"           // opus | sonnet | haiku
  }
}
```

## 📚 Examples

See the `examples.ts` file for:
- ✅ Complete Stripe integration PRD (8 tasks)
- ✅ Partially executed progress with retry attempts
- ✅ Auto-generated guardrails with examples

## 🔮 Future Enhancements

- [ ] Visual dependency graph rendering
- [ ] PRD templates for common patterns
- [ ] Multi-agent parallel execution
- [ ] Guardrail search and filtering
- [ ] GitHub issue two-way sync
- [ ] Cost estimation ($ not just tokens)
- [ ] PRD diff/merge for collaboration
- [ ] Progress analytics dashboard

## 📝 License

Part of Krolik CLI - FSL-1.1-Apache-2.0
