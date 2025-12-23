# Krolik Fixer Roadmap

> AI-Native Code Quality Pipeline

**Goal:** Create a unified pipeline that collects all errors, auto-fixes what's possible, and provides AI-optimized reports for remaining issues.

---

## Current State Analysis

### What We Have (7153 LOC)

```
fix/
├── index.ts (651)           # Main orchestrator
├── types.ts (122)           # Type definitions
├── applier.ts (198)         # Apply fixes to files
├── context.ts (294)         # Code context extraction
├── git-backup.ts (151)      # Git backup before fixes
├── ast-utils.ts (1014)      # AST manipulation
├── refactorings.ts (749)    # Complex refactorings
└── strategies/
    ├── shared/
    │   ├── biome.ts (487)       # Biome integration ✅
    │   ├── typescript.ts (376)  # tsc integration ✅
    │   ├── formatting.ts (302)  # Prettier + validation
    │   ├── line-utils.ts (127)  # Line manipulation
    │   ├── pattern-utils.ts (148)
    │   └── operations.ts (132)  # Fix operation factories
    ├── lint/                # console, debugger, alert
    ├── type-safety/         # any, @ts-ignore
    ├── complexity/          # nesting, long functions
    ├── hardcoded/           # magic numbers, strings
    └── srp/                 # file splitting

quality/
├── analyzers/               # 9 analyzers
├── recommendations/rules/   # 9 rule sets (Airbnb-style)
├── formatters/ai.ts         # AI-optimized XML output
└── ai-format.ts             # AIReport with priorities
```

### What's Missing

1. **Unified Error Collector** — single JSON with all errors
2. **Pipeline Orchestrator** — step-by-step execution
3. **Verification Step** — check after auto-fixes
4. **AI Plan Generator** — create actionable plan
5. **Progress Tracking** — resume interrupted sessions
6. **Modern Integrations** — oxc, knip, etc.

### Existing Infrastructure to Leverage

**context/** command already provides:
- Domain detection (booking, events, crm, places, users)
- File discovery (Zod schemas, components, tests)
- Prisma schema analysis
- tRPC routes analysis
- Git status & diff
- Project tree generation
- AI-friendly XML output (`formatAiPrompt`)

**quality/** already provides:
- 9 analyzers (SRP, complexity, type-safety, lint, etc.)
- 9 recommendation rule sets (Airbnb-style)
- AIReport with priorities and effort estimation
- Concrete fixes (before/after code)

---

## Architecture: AI-Native Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     krolik fix --full                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  0. BACKUP           git stash / branch                         │
│        ↓                                                        │
│  1. COLLECT          tsc + biome + quality → unified.json       │
│        ↓                                                        │
│  2. AUTO-FIX         biome → lint → type-safety → format        │
│        ↓                                                        │
│  2.1 VERIFY          tsc + build (optional)                     │
│        ↓                                                        │
│  3. RECOMMEND        remaining issues + suggestions             │
│        ↓                                                        │
│  4. AI REPORT        structured document for AI agent           │
│        ↓                                                        │
│  5. PLAN (AI)        AI creates IMPROVEMENT-PLAN.md             │
│        ↓                                                        │
│  6. EXECUTE (AI)     AI follows plan step-by-step               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Unified Error Format (JSON)

```json
{
  "meta": {
    "timestamp": "2025-12-22T10:30:00Z",
    "projectRoot": "/path/to/project",
    "gitBranch": "main",
    "backupBranch": "krolik-backup-1703241000"
  },
  "sources": {
    "typescript": { "version": "5.7.2", "duration_ms": 1250 },
    "biome": { "version": "2.0.0", "duration_ms": 450 },
    "quality": { "analyzers": 9, "duration_ms": 800 }
  },
  "summary": {
    "total": 350,
    "by_severity": { "critical": 5, "important": 45, "trivial": 300 },
    "by_source": { "typescript": 120, "biome": 180, "quality": 50 },
    "auto_fixable": 280,
    "manual_required": 70
  },
  "priority_files": [
    { "file": "src/api/router.ts", "score": 95, "issues": 8 },
    { "file": "src/auth/session.ts", "score": 90, "issues": 5 }
  ],
  "errors": [
    {
      "id": "ts-2322-router-42",
      "source": "typescript",
      "code": "TS2322",
      "severity": "critical",
      "file": "src/api/router.ts",
      "line": 42,
      "column": 5,
      "message": "Type 'string' is not assignable to type 'number'",
      "auto_fixable": false,
      "fix_suggestion": {
        "action": "replace",
        "before": "const id: number = params.id",
        "after": "const id = parseInt(params.id, 10)",
        "reason": "Parse string parameter to number"
      },
      "effort": "small",
      "context": {
        "function": "getUser",
        "purpose": "tRPC router procedure"
      }
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Unified Collector (Week 1)

**Goal:** Single command to collect all errors

```bash
krolik fix --collect-only
# Output: .krolik/errors.json
```

**Tasks:**
- [ ] Create `collector/` module
- [ ] Integrate tsc, biome, quality analyzers
- [ ] Deduplicate errors (same file:line from different sources)
- [ ] Calculate priority scores
- [ ] Output unified JSON

**Files:**
```
fix/
└── collector/
    ├── index.ts           # Main collector
    ├── sources/
    │   ├── typescript.ts  # Existing (shared/typescript.ts)
    │   ├── biome.ts       # Existing (shared/biome.ts)
    │   └── quality.ts     # Wrap quality analyzers
    ├── deduplicator.ts    # Remove duplicates
    ├── prioritizer.ts     # Score calculation
    └── types.ts           # UnifiedError, CollectorResult
```

### Phase 2: Pipeline Orchestrator (Week 2)

**Goal:** Step-by-step execution with state

```bash
krolik fix --full              # Full pipeline
krolik fix --resume            # Continue from last state
krolik fix --step=auto-fix     # Run specific step
```

**Tasks:**
- [ ] Create `pipeline/` module
- [ ] State persistence (.krolik/state.json)
- [ ] Step execution with rollback
- [ ] Progress reporting
- [ ] Interrupt handling (Ctrl+C)

**Files:**
```
fix/
└── pipeline/
    ├── index.ts           # Pipeline runner
    ├── steps/
    │   ├── backup.ts      # Git backup
    │   ├── collect.ts     # Error collection
    │   ├── auto-fix.ts    # Auto-fix phase
    │   ├── verify.ts      # Verification
    │   └── report.ts      # AI report generation
    ├── state.ts           # State management
    └── types.ts           # PipelineState, Step
```

### Phase 3: Auto-Fix Enhancements (Week 3)

**Goal:** More intelligent auto-fixes

**Tasks:**
- [ ] Fix dependency ordering (imports before usage)
- [ ] Batch similar fixes (all console.log in one pass)
- [ ] Conflict detection (two fixes on same line)
- [ ] Dry-run with diff preview

**Integrations to Consider:**
- **oxc** — faster linter (Rust-based)
- **knip** — find unused exports/dependencies
- **depcheck** — unused dependencies
- **madge** — circular dependency detection

### Phase 4: AI Report Generator (Week 4)

**Goal:** Perfect AI-consumable output

```bash
krolik fix --ai-report
# Output: .krolik/AI-REPORT.md
```

**Tasks:**
- [ ] Structured markdown for AI
- [ ] Grouped by fix complexity
- [ ] Include file context (purpose, dependencies)
- [ ] Effort estimation per task
- [ ] Suggested fix order

**Output Format:**
```markdown
# Code Quality Report

## Executive Summary
- 70 issues require manual attention
- Estimated effort: 4-6 hours
- Priority: Security (2), Type Safety (15), Performance (8)

## Critical Issues (Fix First)

### 1. SQL Injection Risk
**File:** src/api/users.ts:42
**Effort:** Medium (30 min)
...

## Improvement Plan

### Step 1: Fix Security Issues (30 min)
1. [ ] src/api/users.ts:42 - Parameterize SQL query
2. [ ] src/api/posts.ts:87 - Escape user input

### Step 2: Fix Type Errors (1 hour)
...
```

### Phase 5: Modern Integrations (Week 5)

**Goal:** Integrate best-in-class tools

| Tool | Purpose | Priority |
|------|---------|----------|
| **oxc** | Faster linting (10x biome) | High |
| **knip** | Unused exports detection | High |
| **depcheck** | Unused dependencies | Medium |
| **madge** | Circular dependencies | Medium |
| **bundlephobia** | Package size analysis | Low |

---

## CLI Design

```bash
# Full pipeline
krolik fix --full

# Individual steps
krolik fix --collect-only      # Step 1: Collect errors
krolik fix --auto-fix          # Step 2: Auto-fix
krolik fix --verify            # Step 2.1: Verify
krolik fix --report            # Step 3-4: Generate AI report

# Options
krolik fix --path=apps/web     # Scope to path
krolik fix --resume            # Resume from state
krolik fix --dry-run           # Preview changes
krolik fix --format=json       # Output format

# Tool-specific
krolik fix --biome-only        # Only Biome
krolik fix --typecheck-only    # Only TypeScript
krolik fix --no-biome          # Skip Biome
krolik fix --no-typecheck      # Skip TypeScript
```

---

## Success Metrics

1. **Time Saved:** Reduce manual fix time by 70%
2. **Coverage:** Detect 95% of common issues
3. **AI Efficiency:** AI can follow plan without clarification
4. **False Positives:** < 5% incorrect auto-fixes

---

## GitHub Issues

See linked issues for implementation tracking:
- [#1](https://github.com/anatolykoptev/krolik-cli/issues/1) - Phase 1: Unified Error Collector
- [#2](https://github.com/anatolykoptev/krolik-cli/issues/2) - Phase 2: Pipeline Orchestrator
- [#3](https://github.com/anatolykoptev/krolik-cli/issues/3) - Phase 3: Auto-Fix Enhancements
- [#4](https://github.com/anatolykoptev/krolik-cli/issues/4) - Phase 4: AI Report Generator
- [#5](https://github.com/anatolykoptev/krolik-cli/issues/5) - Phase 5: Modern Tool Integrations
- [#6](https://github.com/anatolykoptev/krolik-cli/issues/6) - **Epic**: AI-Native Code Quality Pipeline

---

*Last updated: 2025-12-22*
