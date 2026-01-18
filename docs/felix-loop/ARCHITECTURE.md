# Ralph Loop Architecture

## Current Status

> **Implementation Status: Core Complete (Phases 0-5)**
>
> Ralph Loop core execution is fully implemented in krolik-cli:
> - ✅ P0: Foundation (Storage, Schemas, MCP, CLI)
> - ✅ P1: AI Backend Abstraction (Claude CLI)
> - ✅ P2: Context Injection (Krolik tools integration)
> - ✅ P3: Executor Loop (Task orchestration)
> - ✅ P4: Validation Pipeline (Typecheck, Lint, Test)
> - ✅ P5: Retry Strategy (Backoff, Guardrails)
> - 🔄 P9: Tests (66 tests passing)
>
> **Next:** P6 (Deep Integration), P7 (Git), P8 (Production Hardening)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RALPH LOOP ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  MCP Tool    │    │  CLI         │    │  Commands    │                   │
│  │  krolik_ralph│    │  ralph ...   │    │  Layer       │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                            │
│         └───────────────────┴───────────────────┘                            │
│                             │                                                │
│                             ▼                                                │
│         ┌───────────────────────────────────────────────────────┐           │
│         │                 RalphExecutor                          │           │
│         │  (344 lines - orchestrates all components)            │           │
│         └───────────────────────────────────────────────────────┘           │
│                             │                                                │
│         ┌───────────────────┼───────────────────────────────┐               │
│         │                   │                               │               │
│         ▼                   ▼                               ▼               │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐          │
│  │  PRD Loader  │   │ Task Runner  │   │  Session Manager       │          │
│  │  (109 lines) │   │ (316 lines)  │   │  (ISessionManager)     │          │
│  └──────────────┘   └──────┬───────┘   └────────────────────────┘          │
│                            │                                                │
│         ┌──────────────────┼──────────────────┐                             │
│         │                  │                  │                             │
│         ▼                  ▼                  ▼                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│  │   Context    │   │  Validation  │   │    Retry     │                    │
│  │   Builder    │   │   Pipeline   │   │   Strategy   │                    │
│  └──────────────┘   └──────────────┘   └──────────────┘                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    AI Backend (Pluggable)                      │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │          │
│  │  │ Claude CLI │  │ Claude API │  │  (future)  │              │          │
│  │  │    ✅      │  │     ⬜     │  │            │              │          │
│  │  └────────────┘  └────────────┘  └────────────┘              │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Module Structure

### Executor Module (`src/lib/@ralph/executor/`)

Refactored for maintainability - all files < 350 lines:

| File | Lines | Responsibility |
|------|-------|----------------|
| `executor.ts` | 344 | Main RalphExecutor class |
| `task-runner.ts` | 316 | Task execution with retries |
| `validation.ts` | 296 | Validation pipeline (typecheck, lint, test) |
| `retry.ts` | 283 | Retry logic with exponential backoff |
| `types.ts` | 255 | TypeScript interfaces |
| `session-manager.ts` | 188 | ISessionManager interface + default impl |
| `prd-loader.ts` | 109 | PRD file loading and validation |
| `state-mappers.ts` | 105 | State conversion functions |
| `utils.ts` | 82 | Utility functions (cost, sleep, etc.) |

**Key Design Patterns:**

1. **Dependency Injection** - `ISessionManager` interface allows testing with mocks
2. **State Mappers** - Pure functions for state conversion
3. **Task Runner** - Extracted execution logic for testability

### Context Module (`src/lib/@ralph/context/`)

| File | Responsibility |
|------|----------------|
| `builder.ts` | Combines task + context into prompts |
| `injector.ts` | Pre-runs krolik tools for context |
| `templates.ts` | System/user prompt templates |
| `task-analyzer.ts` | Detects task type (feature/bugfix/etc.) |

### Backends Module (`src/lib/@ralph/backends/`)

| File | Responsibility |
|------|----------------|
| `types.ts` | `AIBackend` interface |
| `claude-cli.ts` | Claude CLI adapter (spawns `claude` process) |
| `index.ts` | Backend registry |

## Execution Flow

```
┌──────────────────┐
│  Load PRD.json   │──▶ prd-loader.ts
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Create Session   │──▶ session-manager.ts
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ For Each Task    │◀──────────────────┐
└────────┬─────────┘                   │
         │                             │
         ▼                             │
┌──────────────────┐                   │
│ Inject Context   │──▶ injector.ts    │
│ - Schema         │                   │
│ - Routes         │                   │
│ - Memories       │                   │
└────────┬─────────┘                   │
         │                             │
         ▼                             │
┌──────────────────┐                   │
│ Build Prompt     │──▶ builder.ts     │
└────────┬─────────┘                   │
         │                             │
         ▼                             │
┌──────────────────┐                   │
│ Execute via      │──▶ claude-cli.ts  │
│ AI Backend       │                   │
└────────┬─────────┘                   │
         │                             │
         ▼                             │
┌──────────────────┐                   │
│ Run Validation   │──▶ validation.ts  │
│ - Typecheck      │                   │
│ - Lint           │                   │
│ - Test           │                   │
└────────┬─────────┘                   │
         │                             │
    Pass │ Fail                        │
         │  └──▶ retry.ts ─────────────┤
         │       (backoff + guardrails)│
         ▼                             │
┌──────────────────┐                   │
│ Update Session   │                   │
│ Next Task        │───────────────────┘
└──────────────────┘
```

## Security Measures

Implemented in `validation.ts`:

1. **Command Injection Prevention**
   ```typescript
   const ALLOWED_STEPS: readonly ValidationStep[] = [
     'typecheck', 'lint', 'format', 'test:unit', 'test:e2e'
   ];

   function isAllowedStep(step: string): step is ValidationStep {
     return ALLOWED_STEPS.includes(step as ValidationStep);
   }
   ```

2. **Environment Variable Allowlist**
   ```typescript
   const SAFE_ENV_KEYS = [
     'PATH', 'HOME', 'USER', 'SHELL', 'LANG',
     'LC_ALL', 'NODE_ENV', 'npm_config_registry'
   ];

   function buildSafeEnv(): Record<string, string> {
     const env: Record<string, string> = { FORCE_COLOR: '0', CI: 'true' };
     for (const key of SAFE_ENV_KEYS) {
       const value = process.env[key];
       if (value) env[key] = value;
     }
     return env;
   }
   ```

3. **Output Size Limit**
   ```typescript
   const MAX_OUTPUT_SIZE = 100_000; // 100KB
   ```

4. **JSON Parsing Safety**
   ```typescript
   try {
     prdData = JSON.parse(prdContent);
   } catch (err) {
     throw new Error(`Failed to parse PRD JSON: ${msg}`);
   }
   ```

## Test Coverage

66 tests in `executor/__tests__/`:

| File | Tests | Coverage |
|------|-------|----------|
| `prd-loader.test.ts` | 11 | PRD loading, validation errors |
| `state-mappers.test.ts` | 15 | State conversion, aggregation |
| `utils.test.ts` | 25 | Cost calculation, file extraction |
| `executor.test.ts` | 15 | Integration, lifecycle, events |

Run tests:
```bash
npx vitest run src/lib/@ralph/executor/__tests__/
```

## MCP Tool Options

```typescript
{
  "action": "status"                           // Get session status
  "action": "validate", "prd": "PRD.json"      // Validate PRD file
  "action": "start", "prd": "PRD.json",        // Start execution
    "maxAttempts": 3,                          // Retry limit
    "model": "sonnet",                         // opus | sonnet | haiku
    "continueOnFailure": false                 // Skip failed tasks
  "action": "pause"                            // Pause active session
  "action": "resume"                           // Resume paused session
  "action": "cancel"                           // Cancel session
}
```

## Key Interfaces

### IExecutor

```typescript
interface IExecutor {
  getState(): ExecutorState;
  on(handler: RalphLoopEventHandler): () => void;
  start(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  cancel(): void;
  executeTask(task: PRDTask): Promise<TaskResult>;
}
```

### ISessionManager

```typescript
interface ISessionManager {
  createSession(config: CreateSessionConfig): string;
  updateCurrentTask(sessionId: string, taskId: string): void;
  incrementCompletedTasks(sessionId: string): void;
  incrementFailedTasks(sessionId: string): void;
  addTokensAndCost(sessionId: string, tokens: number, costUsd: number): void;
  pauseSession(sessionId: string): void;
  resumeSession(sessionId: string): void;
  completeSession(sessionId: string): void;
  failSession(sessionId: string): void;
  cancelSession(sessionId: string): void;
  createAttempt(config: CreateAttemptConfig): number;
  completeAttempt(attemptId: number, data: CompleteAttemptData): void;
}
```

### AIBackend

```typescript
interface AIBackend {
  name: string;
  execute(request: ExecuteRequest): Promise<ExecuteResult>;
}

interface ExecuteRequest {
  systemPrompt: string;
  userPrompt: string;
  workingDirectory: string;
  timeoutMs?: number;
}

interface ExecuteResult {
  success: boolean;
  output: string;
  tokensUsed?: { input: number; output: number };
  error?: string;
}
```

## File Structure (Current)

```
src/lib/@ralph/
├── backends/                    # ✅ P1 - AI Backend Abstraction
│   ├── types.ts                 # AIBackend interface
│   ├── claude-cli.ts            # Claude CLI adapter
│   └── index.ts                 # Backend registry
│
├── context/                     # ✅ P2 - Context Injection
│   ├── injector.ts              # Pre-run krolik tools
│   ├── templates.ts             # System/user prompt templates
│   ├── builder.ts               # Combine context + task
│   ├── task-analyzer.ts         # Task type detection
│   └── index.ts                 # Exports
│
├── executor/                    # ✅ P3 - Executor Loop (refactored)
│   ├── executor.ts              # Main RalphExecutor (344 lines)
│   ├── task-runner.ts           # Task execution logic
│   ├── prd-loader.ts            # PRD loading/validation
│   ├── state-mappers.ts         # State conversion
│   ├── session-manager.ts       # ISessionManager interface
│   ├── validation.ts            # ✅ P4 - Validation pipeline
│   ├── retry.ts                 # ✅ P5 - Retry strategy
│   ├── utils.ts                 # Utilities
│   ├── types.ts                 # TypeScript types
│   ├── index.ts                 # Exports
│   └── __tests__/               # 🔄 P9 - Tests (66 passing)
│       ├── prd-loader.test.ts
│       ├── state-mappers.test.ts
│       ├── utils.test.ts
│       └── executor.test.ts
│
├── schemas/                     # ✅ P0 - PRD validation
│   ├── prd.schema.ts
│   └── index.ts
│
├── test-runner/                 # ✅ P4 - Test execution
│   ├── index.ts
│   └── types.ts
│
├── constants.ts                 # Model pricing, limits
├── types.ts                     # Core types
└── index.ts                     # Main exports

src/lib/@storage/ralph/          # ✅ P0 - SQLite storage
├── types.ts
├── sessions.ts
├── attempts.ts
└── crud.ts

src/commands/ralph/              # ✅ Command layer
└── index.ts

src/mcp/tools/ralph/             # ✅ MCP tool
└── index.ts
```

## Implementation Status

| Phase | Focus | Status | Key Deliverables |
|-------|-------|--------|------------------|
| **P0** | Foundation | ✅ Complete | Storage, schemas, MCP tool, CLI |
| **P1** | AI Backends | ✅ Complete | AIBackend interface, Claude CLI |
| **P2** | Context Injection | ✅ Complete | Injector, templates, builder |
| **P3** | Executor Loop | ✅ Complete | RalphExecutor, task runner |
| **P4** | Validation | ✅ Complete | Typecheck, lint, test pipeline |
| **P5** | Retry Strategy | ✅ Complete | Backoff, error classification |
| **P6** | Deep Integration | ⬜ TODO | Quality gates, auto-save memories |
| **P7** | Git Integration | ⬜ TODO | Auto-commit, commit validation |
| **P8** | Production | ⬜ TODO | Cost control, circuit breakers |
| **P9** | Testing | 🔄 Partial | 66 tests passing |

## Next Steps

### P6: Deep Krolik Integration

| Task | Description | File |
|------|-------------|------|
| Quality gate | Run `krolik_audit` post-task | `quality-gate.ts` |
| Auto-save | Save decisions/bugfixes to memory | `memory-manager.ts` |
| Code review | Run `krolik_review` on staged changes | `review-gate.ts` |

### P7: Git Integration

| Task | Description | File |
|------|-------------|------|
| Auto-commit | Commit after task success | `git.ts` |
| Commit messages | Generate based on task type | `git.ts` |
| Secret detection | Prevent credential commits | `git.ts` |

### P8: Production Hardening

| Task | Description |
|------|-------------|
| Cost tracking | Token/USD per task/session |
| Budget limits | Auto-stop on threshold |
| Circuit breaker | Stop on consecutive failures |
| SIGTERM handling | Graceful shutdown |

## Usage

### Via MCP (for AI)

```typescript
// Start execution with options
await mcp.call('krolik_ralph', {
  action: 'start',
  prd: 'PRD.json',
  maxAttempts: 3,
  model: 'sonnet',
  continueOnFailure: false
});

// Check status
await mcp.call('krolik_ralph', { action: 'status' });

// Control session
await mcp.call('krolik_ralph', { action: 'pause' });
await mcp.call('krolik_ralph', { action: 'resume' });
await mcp.call('krolik_ralph', { action: 'cancel' });
```

### Via CLI (for humans)

```bash
# Start session with options
krolik ralph start --prd PRD.json --max-attempts 3 --model sonnet

# Check status
krolik ralph status

# Control session
krolik ralph pause
krolik ralph resume
krolik ralph cancel
```

---

*Last updated: 2026-01-16*
