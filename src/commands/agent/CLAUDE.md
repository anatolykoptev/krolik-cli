# Agent Command

> `krolik agent` - run specialized AI agents with project context

## Structure

```
agent/
├── index.ts           # Command entry, routing, exports
├── types.ts           # Core types (AgentDefinition, AgentContext, etc.)
├── constants.ts       # Magic numbers & configuration values
├── categories.ts      # Category definitions & mappings
├── loader.ts          # Agent loading from wshobson/agents repo
├── runners.ts         # Single agent & orchestration execution
├── output.ts          # Formatting (text, AI-friendly XML)
├── memory.ts          # Execution history persistence
├── context/           # Context building for agents
│   ├── index.ts       # Exports
│   ├── context.ts     # buildAgentContext, formatContextForPrompt
│   └── enrichers.ts   # Schema, routes, git enrichment
└── orchestrator/      # Multi-agent coordination
    ├── index.ts       # Exports
    ├── types.ts       # Orchestration types
    ├── task-analysis.ts    # Task classification
    ├── execution-plan.ts   # Agent selection & planning
    └── formatters.ts       # Output formatters
```

## Two Modes

### 1. Direct Mode

Run a specific agent by name or category:

```bash
krolik agent security-auditor          # Run single agent
krolik agent security                  # Run category (primary agents)
krolik agent --list                    # List all agents
krolik agent --list --category=quality # Filter by category
```

### 2. Orchestration Mode

Analyze task and coordinate multiple agents:

```bash
krolik agent --orchestrate --task "analyze security and performance"
krolik agent --orchestrate --task "review code quality" --max-agents=5
```

Orchestration flow:
```
Task Input
    │
    ▼
┌─────────────────┐
│  analyzeTask()  │  ← Classify task, detect types
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ getAgentRecommendations │  ← Match agents to task
└────────┬────────────────┘
         │
         ▼
┌─────────────────────┐
│ createExecutionPlan │  ← Sequential/parallel phases
└────────┬────────────┘
         │
         ▼
    XML Output (for Claude to execute)
```

## Agent Categories

| Category | Aliases | Primary Agents |
|----------|---------|----------------|
| security | sec, audit | security-auditor, backend-security-coder |
| performance | perf, speed | performance-engineer, database-optimizer |
| architecture | arch, design | backend-architect, c4-context |
| quality | review, refactor | code-reviewer, architect-review |
| debugging | debug, error | debugger, error-detective |
| docs | doc, documentation | docs-architect, api-documenter |
| frontend | ui, react | frontend-developer, ui-visual-validator |
| backend | api, server | backend-architect, graphql-architect |
| database | db, sql, prisma | database-architect, database-optimizer |
| devops | cicd, infra | deployment-engineer, kubernetes-architect |
| testing | test, tdd | test-automator, tdd-orchestrator |

## Key Types

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  content: string;           // Prompt content
  category: AgentCategory;
  plugin: string;            // Source plugin (wshobson/agents)
  filePath: string;
  componentType: 'agent' | 'command' | 'skill';
}

interface AgentContext {
  projectRoot: string;
  schema?: string;           // Prisma schema
  routes?: string;           // tRPC routes
  gitStatus?: string;
  gitDiff?: string;
  targetFile?: string;
  targetContent?: string;
  feature?: string;
  libraryDocs?: LibraryDocSnippet[];
  memories?: Memory[];
}

interface OrchestrationResult {
  analysis: TaskAnalysis;    // Task classification
  plan: ExecutionPlan;       // Phases with agents
  context?: AgentContext;
  durationMs: number;
}
```

## Constants (`constants.ts`)

All magic numbers are centralized. Import from `./constants`:

```typescript
import { TRUNCATION, LIMITS, TIMEOUTS, MEMORY_SEARCH, CONFIDENCE } from './constants';
```

| Group | Constants | Description |
|-------|-----------|-------------|
| `TRUNCATION` | `DESCRIPTION_SHORT=60`, `DESCRIPTION_LONG=80`, `TASK_TITLE=50`, `DOC_SNIPPET=300`, `GIT_DIFF=5000` | Text truncation limits |
| `LIMITS` | `LIBRARY_DOCS=5`, `MEMORIES=5`, `SIMILAR_AGENTS=5`, `DEFAULT_AGENTS_TO_RUN=3`, `PRIMARY_AGENTS_TO_ADD=2`, `FALLBACK_AGENTS=1` | Collection limits |
| `TIMEOUTS` | `GIT_STATUS=5000`, `GIT_DIFF=10000` | Command timeouts (ms) |
| `MEMORY_SEARCH` | `MIN_RELEVANCE=20`, `LIMIT_MULTIPLIER=2` | Memory search config |
| `CONFIDENCE` | `SCORE_DIVISOR=3` | Task confidence calculation |

**Adding new constants:**
```typescript
// In constants.ts
export const LIMITS = {
  // ...existing...
  NEW_LIMIT: 10,
} as const;
```

## Adding a New Agent Category

### 1. Update `categories.ts`

```typescript
export const AGENT_CATEGORIES: Record<AgentCategory, AgentCategoryInfo> = {
  // ...existing categories...
  newcategory: {
    name: 'newcategory',
    label: 'New Category',
    description: 'Description of what this category does',
    aliases: ['alias1', 'alias2'],
    plugins: ['plugin-name-1', 'plugin-name-2'],
    primaryAgents: ['main-agent-1', 'main-agent-2'],
  },
};
```

### 2. Update `types.ts`

```typescript
export type AgentCategory =
  | 'security'
  // ...existing...
  | 'newcategory';
```

## Adding Context Enrichers

Edit `context/enrichers.ts` to add new data sources:

```typescript
export async function enrichWithNewData(
  context: AgentContext,
  projectRoot: string,
): Promise<void> {
  // Add data to context
  context.newData = await loadNewData(projectRoot);
}
```

Then call from `context/context.ts` in `buildAgentContext()`.

## Built-in Agents

Two agents are defined in `orchestrator.ts`:

| Agent | Model | Purpose |
|-------|-------|---------|
| `agent-orchestrator` | sonnet | Full task analysis & coordination |
| `task-router` | haiku | Quick classification to category |

## Best Practices

```typescript
// Always check agents are installed
const agentsPath = findAgentsPath(projectRoot);
if (!agentsPath) {
  throw new Error('Agents not found. Run: krolik agent --install');
}

// Use category resolution for flexible input
const category = resolveCategory(userInput); // 'sec' -> 'security'

// Save executions for memory/learning
saveAgentExecution(projectRoot, agent.name, agent.category, feature);
```

## Checklist

**New Category:**
- [ ] Add to `AGENT_CATEGORIES` in `categories.ts`
- [ ] Add to `AgentCategory` type in `types.ts`
- [ ] Map relevant plugins to category
- [ ] Define primary agents

**New Context Enricher:**
- [ ] Create function in `context/enrichers.ts`
- [ ] Call from `buildAgentContext()` in `context/context.ts`
- [ ] Add field to `AgentContext` type

**New Magic Number:**
- [ ] Add to appropriate group in `constants.ts`
- [ ] Replace hardcoded value with constant
- [ ] No hardcoded numbers in code (except 0, 1 for logic)

**Testing:**
```bash
pnpm build && ./dist/bin/cli.js agent --list
./dist/bin/cli.js agent security --dry-run
./dist/bin/cli.js agent --orchestrate --task "test" --dry-run
```
