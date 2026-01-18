# Ralph → ADK-JS: Full Migration Plan

## Принцип

**Полная миграция** — не адаптация старого кода, а правильная интеграция в ADK-JS.

| Концепция Ralph | В ADK-JS это... |
|-----------------|-----------------|
| PRD execution loop | **Wrapper** над Runner |
| Validation pipeline | **Plugin** (afterModelCallback) |
| Retry strategy | **Plugin** (onModelErrorCallback) |
| Cost tracking | **Plugin** (afterModelCallback) |
| Context injection | **Plugin** (beforeAgentCallback) |
| Session/attempts | **BaseSessionService** implementation |
| AI backends | **BaseLlm** implementations |
| Krolik tools | **BaseToolset** implementation |
| Git integration | **Plugin** (afterRunCallback) |
| Quality gates | **Plugin** (onEventCallback) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER                                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    RalphOrchestrator (Wrapper)                           │ │
│  │                                                                          │ │
│  │  • Loads PRD.json                                                        │ │
│  │  • Creates agent hierarchy from tasks                                    │ │
│  │  • Configures plugins based on PRD settings                              │ │
│  │  • Manages session lifecycle (start/pause/resume/cancel)                 │ │
│  │  • Exposes MCP tool interface                                            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
└──────────────────────────────────────┼────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               ADK-JS FRAMEWORK                                │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                              Runner                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         Plugins                                   │  │  │
│  │  │                                                                   │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │  │  │
│  │  │  │ Validation   │ │ Retry        │ │ Cost         │             │  │  │
│  │  │  │ Plugin       │ │ Plugin       │ │ Plugin       │             │  │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘             │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │  │  │
│  │  │  │ Context      │ │ Git          │ │ Quality      │             │  │  │
│  │  │  │ Plugin       │ │ Plugin       │ │ Gate Plugin  │             │  │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘             │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                            Agents                                       │  │
│  │                                                                         │  │
│  │  PRDAgent (SequentialAgent)                                            │  │
│  │  └─► TaskAgent[] (LlmAgent)                                            │  │
│  │       ├─► Single task execution                                        │  │
│  │       └─► Can have sub-agents (Parallel/Loop)                          │  │
│  │                                                                         │  │
│  │  SpecialistAgent (LlmAgent)                                            │  │
│  │  └─► Domain-specific: SecurityAuditor, Refactorer, etc.                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         LLM Implementations                             │  │
│  │                                                                         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│  │  │ ClaudeLlm    │ │ GeminiLlm    │ │ OpenAILlm    │ │ LocalLlm     │  │  │
│  │  │ (CLI/API)    │ │ (ADK native) │ │ (future)     │ │ (Ollama)     │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                            Services                                     │  │
│  │                                                                         │  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │  │
│  │  │ SQLiteSession    │ │ KrolikToolset    │ │ ArtifactService  │       │  │
│  │  │ Service          │ │                  │ │ (file outputs)   │       │  │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Classification

### 🔌 PLUGINS (extend BasePlugin)

Плагины — это hooks в lifecycle ADK. Они не меняют flow, только реагируют.

| Plugin | Hooks | Responsibility |
|--------|-------|----------------|
| **ValidationPlugin** | `afterModelCallback` | Run typecheck/lint/test after AI response |
| **RetryPlugin** | `onModelErrorCallback` | Exponential backoff, error classification |
| **CostPlugin** | `afterModelCallback` | Track tokens/USD, enforce budget |
| **ContextPlugin** | `beforeAgentCallback` | Inject schema/routes/memories before task |
| **GitPlugin** | `afterRunCallback` | Auto-commit on success, secret detection |
| **QualityGatePlugin** | `onEventCallback` | Run krolik_audit, krolik_review |
| **MemoryPlugin** | `afterAgentCallback` | Auto-save decisions/bugfixes to memory |

### 🎁 WRAPPER (orchestration layer)

Wrapper — это то, что управляет ADK Runner сверху.

```typescript
class RalphOrchestrator {
  // НЕ extends Runner — использует его

  private runner: Runner;
  private prd: PRD;
  private state: OrchestratorState;

  // PRD-specific lifecycle
  async start(prdPath: string): Promise<SessionId>;
  async pause(): Promise<void>;
  async resume(): Promise<void>;
  async cancel(): Promise<void>;

  // State
  getStatus(): OrchestratorStatus;
  getTaskProgress(): TaskProgress[];

  // Events (to MCP/CLI)
  on(event: RalphEvent, handler: Handler): void;
}
```

### 🧩 IMPLEMENTATIONS (extend ADK base classes)

| ADK Base Class | Our Implementation | Responsibility |
|----------------|-------------------|----------------|
| `BaseLlm` | `ClaudeLlm` | Claude API/CLI integration |
| `BaseLlm` | `GeminiLlm` | Use ADK's GoogleLlm |
| `BaseSessionService` | `SQLiteSessionService` | Persist sessions/events to SQLite |
| `BaseToolset` | `KrolikToolset` | Expose krolik_* as tools to agents |
| `BaseAgent` | (use built-in) | SequentialAgent, ParallelAgent, LlmAgent |

---

## File Structure

```
src/lib/@ralph/                    # NEW: Clean implementation
├── index.ts                       # Public API
│
├── orchestrator/                  # WRAPPER
│   ├── orchestrator.ts            # RalphOrchestrator class
│   ├── prd-parser.ts              # PRD → Agent hierarchy
│   ├── state.ts                   # Orchestrator state machine
│   └── events.ts                  # Event types for MCP/CLI
│
├── llm/                           # IMPLEMENTATIONS: BaseLlm
│   ├── claude-llm.ts              # ClaudeLlm extends BaseLlm
│   ├── claude-cli-adapter.ts      # Spawn claude CLI process
│   ├── claude-api-adapter.ts      # Anthropic SDK
│   └── registry.ts                # Model name → LLM class
│
├── session/                       # IMPLEMENTATIONS: BaseSessionService
│   ├── sqlite-session.ts          # SQLiteSessionService
│   └── schema.sql                 # Tables for events/state
│
├── tools/                         # IMPLEMENTATIONS: BaseToolset
│   ├── krolik-toolset.ts          # KrolikToolset
│   └── tools/                     # Individual tool wrappers
│       ├── schema-tool.ts
│       ├── routes-tool.ts
│       ├── context-tool.ts
│       ├── audit-tool.ts
│       └── memory-tool.ts
│
├── plugins/                       # PLUGINS: BasePlugin
│   ├── validation-plugin.ts
│   ├── retry-plugin.ts
│   ├── cost-plugin.ts
│   ├── context-plugin.ts
│   ├── git-plugin.ts
│   ├── quality-gate-plugin.ts
│   └── memory-plugin.ts
│
├── agents/                        # Agent factories (use ADK agents)
│   ├── task-agent-factory.ts      # PRDTask → LlmAgent config
│   └── specialist-agents.ts       # Pre-configured specialists
│
└── types.ts                       # Shared types

# DELETED after migration:
src/lib/@ralph-old/                # Remove completely
```

---

## Phase 0: Setup (Day 1-2)

### 0.1 Add ADK-JS

```bash
# Clone locally (ADK-JS not on npm yet)
cd /Users/anatoliikoptev/CascadeProjects/piternow_project
# Already cloned: adk-js/

# Link for development
cd krolik-cli
npm link ../adk-js/core
```

### 0.2 Create base structure

```typescript
// src/lib/@ralph/index.ts
export { RalphOrchestrator } from './orchestrator/orchestrator';
export type { RalphConfig, RalphStatus, RalphEvent } from './types';
```

---

## Phase 1: LLM Implementations (Day 2-4)

### 1.1 ClaudeLlm

```typescript
// src/lib/@ralph/llm/claude-llm.ts

import { BaseLlm, LlmRequest, LlmResponse, BaseLlmConnection } from 'adk-js';
import { ClaudeCliAdapter } from './claude-cli-adapter';
import { ClaudeApiAdapter } from './claude-api-adapter';

export interface ClaudeLlmConfig {
  model: string;
  mode: 'cli' | 'api';
  apiKey?: string;
  workingDirectory?: string;
}

export class ClaudeLlm extends BaseLlm {
  static readonly supportedModels = [
    /^claude-3-5-sonnet/,
    /^claude-3-5-haiku/,
    /^claude-3-opus/,
    /^claude-sonnet-4/,
    /^claude-opus-4/,
  ];

  private adapter: ClaudeCliAdapter | ClaudeApiAdapter;

  constructor(config: ClaudeLlmConfig) {
    super({ model: config.model });

    this.adapter = config.mode === 'cli'
      ? new ClaudeCliAdapter(config)
      : new ClaudeApiAdapter(config);
  }

  async *generateContentAsync(
    request: LlmRequest,
    stream = false
  ): AsyncGenerator<LlmResponse, void> {
    yield* this.adapter.execute(request, stream);
  }

  async connect(): Promise<BaseLlmConnection> {
    throw new Error('Live connection not implemented for Claude');
  }
}
```

### 1.2 Model Registry

```typescript
// src/lib/@ralph/llm/registry.ts

import { LLMRegistry } from 'adk-js';
import { ClaudeLlm } from './claude-llm';

// Register Claude
LLMRegistry.register(ClaudeLlm);

// Shortcuts
export const MODELS = {
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-3-5-haiku-20241022',
  'gemini-pro': 'gemini-1.5-pro',
  'gemini-flash': 'gemini-2.0-flash-exp',
} as const;

export type ModelAlias = keyof typeof MODELS;

export function resolveLlm(model: ModelAlias | string): BaseLlm {
  const modelId = MODELS[model as ModelAlias] ?? model;
  return LLMRegistry.newLlm(modelId);
}
```

---

## Phase 2: Session Service (Day 4-5)

### 2.1 SQLiteSessionService

```typescript
// src/lib/@ralph/session/sqlite-session.ts

import {
  BaseSessionService,
  Session,
  Event,
  CreateSessionRequest,
  GetSessionRequest,
  AppendEventRequest,
} from 'adk-js';
import Database from 'better-sqlite3';

export class SQLiteSessionService extends BaseSessionService {
  private db: Database.Database;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        state TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        invocation_id TEXT NOT NULL,
        author TEXT,
        content TEXT,
        actions TEXT DEFAULT '{}',
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    `);
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const id = request.sessionId ?? crypto.randomUUID();

    this.db.prepare(`
      INSERT INTO sessions (id, app_name, user_id, state)
      VALUES (?, ?, ?, ?)
    `).run(id, request.appName, request.userId, JSON.stringify(request.state ?? {}));

    return {
      id,
      appName: request.appName,
      userId: request.userId,
      state: request.state ?? {},
      events: [],
      lastUpdateTime: Date.now(),
    };
  }

  async getSession(request: GetSessionRequest): Promise<Session | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).get(request.sessionId) as any;

    if (!row) return undefined;

    const events = this.db.prepare(`
      SELECT * FROM events WHERE session_id = ? ORDER BY timestamp
    `).all(request.sessionId) as any[];

    return {
      id: row.id,
      appName: row.app_name,
      userId: row.user_id,
      state: JSON.parse(row.state),
      events: events.map(e => ({
        id: e.id,
        invocationId: e.invocation_id,
        author: e.author,
        content: JSON.parse(e.content),
        actions: JSON.parse(e.actions),
        timestamp: e.timestamp,
      })),
      lastUpdateTime: row.updated_at,
    };
  }

  async appendEvent({ session, event }: AppendEventRequest): Promise<Event> {
    // Call parent to update state
    const result = await super.appendEvent({ session, event });

    // Persist
    this.db.prepare(`
      INSERT INTO events (id, session_id, invocation_id, author, content, actions, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      session.id,
      event.invocationId,
      event.author,
      JSON.stringify(event.content),
      JSON.stringify(event.actions),
      event.timestamp
    );

    // Update session state
    this.db.prepare(`
      UPDATE sessions SET state = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(session.state), session.id);

    return result;
  }

  // ... listSessions, deleteSession
}
```

---

## Phase 3: Plugins (Day 5-8)

### 3.1 ValidationPlugin

```typescript
// src/lib/@ralph/plugins/validation-plugin.ts

import { BasePlugin, CallbackContext, LlmResponse } from 'adk-js';
import { spawn } from 'child_process';

export type ValidationStep = 'typecheck' | 'lint' | 'test:unit' | 'test:e2e';

export interface ValidationPluginConfig {
  projectRoot: string;
  steps: ValidationStep[];
  failFast?: boolean;
}

export class ValidationPlugin extends BasePlugin {
  constructor(private config: ValidationPluginConfig) {
    super('validation');
  }

  async afterModelCallback({
    callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Skip partial responses
    if (llmResponse.partial) return;

    const results = await this.runValidation();

    // Store in state for other plugins
    callbackContext.eventActions.stateDelta['__validation'] = results;

    if (!results.passed) {
      // Return modified response with errors
      return this.appendValidationErrors(llmResponse, results);
    }

    return; // Pass through
  }

  private async runValidation(): Promise<ValidationResult> {
    const results: StepResult[] = [];

    for (const step of this.config.steps) {
      const result = await this.runStep(step);
      results.push(result);

      if (!result.passed && this.config.failFast) {
        break;
      }
    }

    return {
      passed: results.every(r => r.passed),
      steps: results,
    };
  }

  private async runStep(step: ValidationStep): Promise<StepResult> {
    const commands: Record<ValidationStep, string> = {
      'typecheck': 'npx tsc --noEmit',
      'lint': 'npx eslint . --max-warnings 0',
      'test:unit': 'npx vitest run --reporter=json',
      'test:e2e': 'npx playwright test',
    };

    const { exitCode, output } = await this.exec(commands[step]);

    return {
      step,
      passed: exitCode === 0,
      output,
    };
  }

  private exec(command: string): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', command], {
        cwd: this.config.projectRoot,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      });

      let output = '';
      proc.stdout.on('data', (d) => output += d);
      proc.stderr.on('data', (d) => output += d);
      proc.on('close', (code) => resolve({ exitCode: code ?? 1, output }));
    });
  }
}
```

### 3.2 RetryPlugin

```typescript
// src/lib/@ralph/plugins/retry-plugin.ts

import { BasePlugin, LlmRequest, LlmResponse, CallbackContext } from 'adk-js';

export interface RetryPluginConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class RetryPlugin extends BasePlugin {
  private attempts = new Map<string, number>();

  constructor(private config: RetryPluginConfig) {
    super('retry');
  }

  async onModelErrorCallback({
    callbackContext,
    llmRequest,
    error,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | undefined> {
    const invocationId = callbackContext.invocationContext.invocationId;
    const attempt = (this.attempts.get(invocationId) ?? 0) + 1;
    this.attempts.set(invocationId, attempt);

    if (attempt >= this.config.maxAttempts) {
      // Max retries reached, let error propagate
      return;
    }

    const delay = this.calculateDelay(attempt);
    await this.sleep(delay);

    // Add retry context to request
    llmRequest.contents.push({
      role: 'user',
      parts: [{
        text: `⚠️ Previous attempt failed (${attempt}/${this.config.maxAttempts}): ${error.message}\n\nPlease try a different approach.`,
      }],
    });

    // Return undefined to retry
    return;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.3 Other Plugins (similar pattern)

- **CostPlugin** — tracks tokens in `afterModelCallback`
- **ContextPlugin** — injects krolik context in `beforeAgentCallback`
- **GitPlugin** — commits in `afterRunCallback`
- **QualityGatePlugin** — runs audit in `onEventCallback`

---

## Phase 4: Orchestrator (Day 8-10)

### 4.1 PRD Parser

```typescript
// src/lib/@ralph/orchestrator/prd-parser.ts

import { BaseAgent, SequentialAgent, ParallelAgent, LlmAgent } from 'adk-js';
import { PRD, PRDTask } from './types';
import { resolveLlm } from '../llm/registry';
import { KrolikToolset } from '../tools/krolik-toolset';

export interface ParseOptions {
  projectRoot: string;
  defaultModel: string;
}

export function parsePRD(prd: PRD, options: ParseOptions): BaseAgent {
  const sortedTasks = topologicalSort(prd.tasks);

  const subAgents = sortedTasks.map(task =>
    createAgentForTask(task, options)
  );

  return new SequentialAgent({
    name: prd.name,
    description: prd.description,
    subAgents,
  });
}

function createAgentForTask(task: PRDTask, options: ParseOptions): BaseAgent {
  const model = resolveLlm(task.model ?? options.defaultModel);
  const tools = [new KrolikToolset({ projectRoot: options.projectRoot })];

  // Parallel sub-tasks
  if (task.subTasks?.length && task.agentType === 'parallel') {
    return new ParallelAgent({
      name: `parallel-${task.id}`,
      subAgents: task.subTasks.map(sub =>
        createAgentForTask(sub, options)
      ),
    });
  }

  // Single task
  return new LlmAgent({
    name: `task-${task.id}`,
    description: task.title,
    model,
    instruction: buildInstruction(task),
    tools,
  });
}

function buildInstruction(task: PRDTask): string {
  return `
# Task: ${task.title}

${task.description}

## Acceptance Criteria
${task.acceptance_criteria?.map(c => `- ${c}`).join('\n') ?? 'None specified'}

## Instructions
1. Analyze the task requirements
2. Make necessary code changes
3. Ensure all acceptance criteria are met
4. Do NOT introduce unrelated changes
`.trim();
}
```

### 4.2 RalphOrchestrator

```typescript
// src/lib/@ralph/orchestrator/orchestrator.ts

import { Runner, Event } from 'adk-js';
import { SQLiteSessionService } from '../session/sqlite-session';
import { ValidationPlugin } from '../plugins/validation-plugin';
import { RetryPlugin } from '../plugins/retry-plugin';
import { CostPlugin } from '../plugins/cost-plugin';
import { ContextPlugin } from '../plugins/context-plugin';
import { parsePRD } from './prd-parser';
import { loadPRD } from './prd-loader';

export interface RalphConfig {
  projectRoot: string;
  prdPath: string;
  model?: string;
  maxAttempts?: number;
  maxCostUsd?: number;
  validationSteps?: ValidationStep[];
}

export interface RalphStatus {
  state: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  sessionId?: string;
  currentTask?: string;
  completedTasks: string[];
  failedTasks: string[];
  tokens: { input: number; output: number };
  costUsd: number;
}

export class RalphOrchestrator {
  private runner: Runner | null = null;
  private status: RalphStatus = {
    state: 'idle',
    completedTasks: [],
    failedTasks: [],
    tokens: { input: 0, output: 0 },
    costUsd: 0,
  };

  private eventHandlers: Array<(event: RalphEvent) => void> = [];

  constructor(private config: RalphConfig) {}

  async start(): Promise<string> {
    const prd = loadPRD(this.config.prdPath);

    const agent = parsePRD(prd, {
      projectRoot: this.config.projectRoot,
      defaultModel: this.config.model ?? 'sonnet',
    });

    const sessionService = new SQLiteSessionService(
      `${this.config.projectRoot}/.krolik/ralph.db`
    );

    const plugins = [
      new ContextPlugin({ projectRoot: this.config.projectRoot }),
      new ValidationPlugin({
        projectRoot: this.config.projectRoot,
        steps: this.config.validationSteps ?? ['typecheck', 'lint'],
      }),
      new RetryPlugin({
        maxAttempts: this.config.maxAttempts ?? 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      }),
      new CostPlugin({
        maxCostUsd: this.config.maxCostUsd ?? 100,
        onUpdate: (cost) => {
          this.status.tokens = cost.tokens;
          this.status.costUsd = cost.costUsd;
        },
      }),
    ];

    this.runner = new Runner({
      appName: 'ralph',
      agent,
      sessionService,
      plugins,
    });

    const session = await sessionService.createSession({
      appName: 'ralph',
      userId: 'orchestrator',
    });

    this.status.sessionId = session.id;
    this.status.state = 'running';

    // Run in background
    this.executeAsync(session.id);

    return session.id;
  }

  private async executeAsync(sessionId: string): Promise<void> {
    try {
      for await (const event of this.runner!.runAsync({
        userId: 'orchestrator',
        sessionId,
        newMessage: { role: 'user', parts: [{ text: 'Execute PRD' }] },
      })) {
        this.handleEvent(event);
      }

      this.status.state = 'completed';
      this.emit({ type: 'completed', status: this.status });

    } catch (error) {
      this.status.state = 'failed';
      this.emit({ type: 'failed', error: String(error) });
    }
  }

  private handleEvent(event: Event): void {
    // Track task progress from state delta
    const taskComplete = event.actions.stateDelta?.['__taskComplete'];
    if (taskComplete) {
      if (taskComplete.success) {
        this.status.completedTasks.push(taskComplete.taskId);
      } else {
        this.status.failedTasks.push(taskComplete.taskId);
      }
      this.status.currentTask = undefined;
    }

    const taskStart = event.actions.stateDelta?.['__taskStart'];
    if (taskStart) {
      this.status.currentTask = taskStart.taskId;
    }

    this.emit({ type: 'event', event });
  }

  pause(): void {
    this.status.state = 'paused';
    // ADK doesn't have built-in pause, we track state
  }

  resume(): void {
    if (this.status.state === 'paused') {
      this.status.state = 'running';
    }
  }

  cancel(): void {
    this.status.state = 'cancelled';
    // TODO: Abort running runner
  }

  getStatus(): RalphStatus {
    return { ...this.status };
  }

  on(handler: (event: RalphEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  private emit(event: RalphEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}
```

---

## Phase 5: Integration (Day 10-12)

### 5.1 MCP Tool

```typescript
// src/mcp/tools/ralph/index.ts

import { defineTool } from '@/mcp/define-tool';
import { RalphOrchestrator } from '@/lib/@ralph';
import { z } from 'zod';

let orchestrator: RalphOrchestrator | null = null;

export const ralphTool = defineTool({
  name: 'krolik_ralph',
  description: 'Execute PRD tasks with multi-agent AI',

  schema: z.object({
    action: z.enum(['start', 'status', 'pause', 'resume', 'cancel']),
    prd: z.string().optional(),
    model: z.enum(['sonnet', 'opus', 'haiku', 'gemini-pro', 'gemini-flash']).optional(),
    maxAttempts: z.number().optional(),
    maxCostUsd: z.number().optional(),
  }),

  async handler(args, projectRoot) {
    switch (args.action) {
      case 'start': {
        if (orchestrator?.getStatus().state === 'running') {
          return '<error>Session already running</error>';
        }

        orchestrator = new RalphOrchestrator({
          projectRoot,
          prdPath: args.prd!,
          model: args.model,
          maxAttempts: args.maxAttempts,
          maxCostUsd: args.maxCostUsd,
        });

        const sessionId = await orchestrator.start();
        return `<ralph-session id="${sessionId}" status="running"/>`;
      }

      case 'status': {
        if (!orchestrator) {
          return '<ralph-status state="idle"/>';
        }
        const status = orchestrator.getStatus();
        return formatStatus(status);
      }

      case 'pause':
        orchestrator?.pause();
        return '<ralph-action>paused</ralph-action>';

      case 'resume':
        orchestrator?.resume();
        return '<ralph-action>resumed</ralph-action>';

      case 'cancel':
        orchestrator?.cancel();
        return '<ralph-action>cancelled</ralph-action>';
    }
  },
});
```

### 5.2 CLI Command

```typescript
// src/commands/ralph/index.ts

import { Command } from 'commander';
import { RalphOrchestrator } from '@/lib/@ralph';

export const ralphCommand = new Command('ralph')
  .description('Execute PRD with multi-agent AI');

ralphCommand
  .command('start')
  .requiredOption('--prd <path>', 'PRD file path')
  .option('--model <model>', 'Default model', 'sonnet')
  .option('--max-attempts <n>', 'Max retries per task', '3')
  .action(async (opts) => {
    const orchestrator = new RalphOrchestrator({
      projectRoot: process.cwd(),
      prdPath: opts.prd,
      model: opts.model,
      maxAttempts: parseInt(opts.maxAttempts),
    });

    orchestrator.on((event) => {
      console.log(formatEvent(event));
    });

    await orchestrator.start();
  });

// ... status, pause, resume, cancel subcommands
```

---

## Migration Checklist

### Week 1 ✅
- [x] Setup ADK-JS dependency (vendored in vendor/@google/adk)
- [x] ClaudeLlm implementation (API mode) — `src/lib/@ralph/models/claude-llm.ts`
- [x] Model registry — `src/lib/@ralph/models/registry.ts`
- [x] SQLiteSessionService — `src/lib/@ralph/services/sqlite-session.ts`

### Week 2 (in progress)
- [x] ValidationPlugin — `src/lib/@ralph/plugins/validation-plugin.ts`
- [x] RetryPlugin — `src/lib/@ralph/plugins/retry-plugin.ts`
- [ ] CostPlugin
- [ ] ContextPlugin
- [ ] GitPlugin
- [ ] QualityGatePlugin

### Week 3
- [ ] PRD parser
- [ ] RalphOrchestrator
- [ ] MCP tool integration
- [ ] CLI integration
- [ ] Delete old `@ralph` code
- [ ] ClaudeLlm CLI mode (optional)

---

## Delete After Migration

```bash
# Remove old implementation completely
rm -rf src/lib/@ralph-old/

# These files move to new structure:
# - executor/ → orchestrator/
# - backends/ → llm/
# - context/ → plugins/context-plugin.ts
# - validation.ts → plugins/validation-plugin.ts
# - retry.ts → plugins/retry-plugin.ts
```

---

*Full rewrite, zero legacy code.*
