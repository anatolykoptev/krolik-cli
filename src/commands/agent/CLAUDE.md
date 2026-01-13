# Agent Command

> `krolik agent` — run specialized AI agents with project context

## Structure

```text
agent/
├── index.ts           # Command entry, routing
├── types.ts           # AgentDefinition, AgentContext
├── constants.ts       # Magic numbers
├── categories.ts      # Category definitions
├── loader.ts          # Agent loading from wshobson/agents
├── runners.ts         # Execution
├── output.ts          # Text/XML formatting
├── context/           # buildAgentContext, enrichers
└── orchestrator/      # Multi-agent coordination
```

## Two Modes

**Direct:** Run specific agent by name or category

```bash
krolik agent security-auditor    # Single agent
krolik agent security            # Category (primary agents)
krolik agent --list              # List all
```

**Orchestration:** Analyze task, coordinate multiple agents

```bash
krolik agent --orchestrate --task "analyze security and performance"
```

## Agent Categories

| Category     | Aliases         | Primary Agents                            |
|--------------|-----------------|-------------------------------------------|
| security     | sec, audit      | security-auditor, backend-security-coder  |
| performance  | perf, speed     | performance-engineer, database-optimizer  |
| architecture | arch, design    | backend-architect, c4-context             |
| quality      | review, refactor| code-reviewer, architect-review           |
| debugging    | debug, error    | debugger, error-detective                 |
| frontend     | ui, react       | frontend-developer, ui-visual-validator   |
| backend      | api, server     | backend-architect, graphql-architect      |
| database     | db, sql, prisma | database-architect, database-optimizer    |
| devops       | cicd, infra     | deployment-engineer, kubernetes-architect |
| testing      | test, tdd       | test-automator, tdd-orchestrator          |

## Key Types

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  content: string;
  category: AgentCategory;
}

interface AgentContext {
  projectRoot: string;
  schema?: string;      // Prisma
  routes?: string;      // tRPC
  gitStatus?: string;
  gitDiff?: string;
  feature?: string;
}
```

## Constants (constants.ts)

| Group            | Key Constants                                        |
|------------------|------------------------------------------------------|
| `TRUNCATION`     | `DESCRIPTION=60`, `GIT_DIFF=5000`                    |
| `LIMITS`         | `LIBRARY_DOCS=5`, `MEMORIES=5`, `DEFAULT_AGENTS=3`   |
| `TIMEOUTS`       | `GIT_STATUS=5000`, `GIT_DIFF=10000`                  |

## Adding a New Category

1. Add to `AGENT_CATEGORIES` in `categories.ts`
1. Add to `AgentCategory` type in `types.ts`
1. Map plugins and define primary agents

## Adding Context Enricher

1. Create function in `context/enrichers.ts`
1. Call from `buildAgentContext()` in `context/context.ts`
1. Add field to `AgentContext` type

## Checklist

**New Category:**

- [ ] Add to `AGENT_CATEGORIES` in `categories.ts`
- [ ] Add to `AgentCategory` type
- [ ] Map plugins, define primary agents

**New Constant:**

- [ ] Add to appropriate group in `constants.ts`
- [ ] No hardcoded numbers in code (except 0, 1)

**Testing:**

```bash
pnpm build && ./dist/bin/cli.js agent --list
./dist/bin/cli.js agent --orchestrate --task "test" --dry-run
```
