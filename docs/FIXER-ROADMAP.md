# Krolik Fixer Roadmap v2.0

> AI-Native Code Quality Pipeline — Complete DevOps Toolchain

**Last updated:** 2025-12-22  
**MVP Target:** 2026-02-15  
**Release:** 2026-03-01

---

## 🎯 Goal

Create a unified pipeline that collects all errors, auto-fixes what's possible, and provides AI-optimized reports for remaining issues. **Full AI DevOps toolchain** from collection → execution → metrics.

---

## 📊 Current State Analysis (7153 LOC)

### What We Have

```
fix/ (3014 LOC)
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

quality/ (2000+ LOC)
├── analyzers/               # 9 analyzers (SRP, complexity, types, lint)
├── recommendations/rules/   # 9 rule sets (Airbnb-style)
├── formatters/ai.ts         # AI-optimized XML output
└── ai-format.ts             # AIReport with priorities
```

### Existing Infrastructure to Leverage

**context/** command provides:
- Domain detection (booking, events, crm, places, users)
- File discovery (Zod schemas, components, tests)
- Prisma schema analysis
- tRPC routes analysis
- Git status & diff
- Project tree generation
- AI-friendly XML output (`formatAiPrompt`)

---

## 🏗️ Architecture: AI-Native Pipeline

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
│  5. AI PLAN          AI creates IMPROVEMENT-PLAN.md             │ NEW
│        ↓                                                        │
│  6. EXECUTE (AI)     AI follows plan step-by-step               │ NEW
│        ↓                                                        │
│  7. IDE/CI/METRICS   VSCode + GitHub Action + Dashboard         │ NEW
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Unified Error Format (JSON)

```
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

## 🚀 Implementation Phases (8 Weeks)

### Phase 1: Unified Collector (Week 1)
```
#1 [feat] Single command → .krolik/errors.json
```
**Tasks:**
- [ ] Create `collector/` module
- [ ] Integrate tsc, biome, quality analyzers ✅
- [ ] Deduplicate errors (same file:line) ✅
- [ ] Calculate priority scores ✅
- [ ] **NEW:** Wrap 9 quality analyzers into collector API

**CLI:** `krolik fix --collect-only`

### Phase 2: Pipeline Orchestrator (Week 2)
```
#2 [feat] Step-by-step execution + resume
```
**Tasks:**
- [ ] Create `pipeline/` module ✅
- [ ] State persistence (.krolik/state.json) ✅
- [ ] Step execution with rollback ✅
- [ ] **NEW:** Interrupt handling (Ctrl+C)

**CLI:** `krolik fix --full`, `krolik fix --resume`

### Phase 3: Auto-Fix Enhancements (Week 3)
```
#3 [feat] Intelligent auto-fixes + verification
```
**Tasks:**
- [ ] Fix dependency ordering ✅
- [ ] Batch similar fixes ✅
- [ ] Conflict detection ✅
- [ ] **NEW:** LLM-powered micro-fixes (`krolik fix --ai-trivial`)

**Integrations:** oxc, knip, depcheck, madge

### Phase 4: AI Report Generator (Week 4)
```
#4 [feat] Perfect AI-consumable output
```
**Output:** `.krolik/AI-REPORT.md`
```
# Critical Issues
### 1. SQL Injection (src/api/users.ts:42)
**Effort:** Medium (30 min)
```

**CLI:** `krolik fix --ai-report`

### Phase 5: Modern Integrations (Week 5)
```
#5 [feat] Best-in-class tools
```
| Tool | Purpose | Priority |
|------|---------|----------|
| **oxc** | 10x faster linting | High ✅ |
| **knip** | Unused exports | High |
| **depcheck** | Unused deps | Medium |
| **madge** | Circular deps | Medium |

### ⭐ Phase 6: AI Agent Execution (Week 6) **KILLER FEATURE**
```
#10 [feat] krolik fix --ai-execute IMPROVEMENT-PLAN.md
```
**Parses AI plans → Executes → Verifies → Rollbacks**
```
AI Plan: "Fix src/api/users.ts:42 SQL injection"
↓
krolik: Applied parameterized query → tsc PASS ✅
```

**Files:** `fix/agent/executor.ts`, `fix/agent/parser.ts`

### Phase 7: IDE & GitHub Integration (Week 7)
```
#11 [feat] VSCode Extension
- Inline diagnostics (.krolik/errors.json)
- Quick fixes (`krolik fix --apply ts-2322`)

#12 [feat] GitHub Action
```yaml
- uses: anatolykoptev/krolik-action@v1
  with:
    fix-mode: full
    create-pr: true
```
```

### Phase 8: Observability & Enterprise (Week 8)
```
#13 [feat] Metrics Dashboard
.krolik/metrics.json → fix_velocity, ai_accuracy, mttr

#14 [feat] Team Features
- Shared state merge
- krolik fix --review-team
- RBAC (fix/audit/deploy)
```

---

## 🔧 CLI Design

```
# Core Pipeline
krolik fix --full                    # Complete flow
krolik fix --collect-only            # Step 1
krolik fix --auto-fix                # Step 2
krolik fix --resume                  # Continue interrupted

# AI Features ⭐
krolik fix --ai-execute              # Execute AI plan ⭐
krolik fix --ai-trivial              # LLM micro-fixes ⭐

# Integrations ⭐
krolik fix --github-pr               # Create PR ⭐
krolik fix --vscode                  # VSCode diagnostics ⭐
krolik fix --watch                   # Continuous mode

# Options
krolik fix --path=apps/web --dry-run --format=json
krolik fix --no-biome --typecheck-only
```

---

## ⚡ Cross-Cutting Concerns

### Performance
```
#16 [perf] Rust Collector (WASM) ⭐
fix/collector/rust/
├── parser.rs     # oxc + swc (10x faster)
└── wasm-bridge   # Zero Node deps
```

### Testing
```
#15 [test] E2E Suite ⭐
pnpm test:fixer          # Golden files + snapshots
Coverage: applier 100%
Sample: Next.js + tRPC + Prisma
```

### Extensibility
```
#17 [feat] Plugin System
krolik plugins install @krolik/oxc @krolik/nextjs
```

---

## 📈 Success Metrics

| Metric | Target v2.0 | Current | Phase |
|--------|-------------|---------|-------|
| **Fix Coverage** | 95% | 70% | Phase 3 |
| **Pipeline Speed** | <2min | 4min | Phase 1 |
| **AI Plan Accuracy** | 90% | - | Phase 6 ⭐ |
| **False Positives** | <3% | 5% | Phase 3 |
| **GitHub Stars** | 5k | 500 | All |

---

## 🎯 GitHub Issues

```
#1-5  [epic] Core Pipeline (Phase 1-5) ✅
#6    [epic] AI-Native Code Quality Pipeline
#10   [feat] AI Agent Executor ⭐ START HERE
#11   [feat] VSCode Extension ⭐
#12   [feat] GitHub Action ⭐
#13   [feat] Metrics Dashboard
#15   [test] E2E Test Suite
#16   [perf] Rust Collector ⭐
#17   [feat] Plugin System
```

---

## 🚀 Next Steps

1. **Week 1:** Phase 6 AI Executor — **highest impact** ⭐
2. **Week 2:** VSCode extension prototype ⭐
3. **Week 3:** GitHub Action + sample PR ⭐
4. **Week 4:** Rust collector POC (10x perf) ⭐

**This makes krolik the #1 AI DevOps toolchain** — from hobby to enterprise.