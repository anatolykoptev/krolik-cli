# KROLIK CLI — Development Rules

> Universal CLI toolkit for AI-assisted development.

## Architecture

| Rule | Enforcement |
|------|-------------|
| SRP | One purpose per file |
| Max lines | 200 |
| Paths | Config/args, never hardcoded |
| Dependencies | Explicit injection |
| Functions | Pure first |

## Structure

```
krolik-cli/
├── src/
│   ├── cli/            # CLI entry, command registration
│   ├── commands/       # Command implementations
│   ├── mcp/            # MCP server + handlers
│   ├── lib/            # Shared utilities (@fs, @git, @swc, @cache)
│   ├── config/         # Config loading
│   └── types/          # TypeScript types
└── tests/
    ├── unit/           # Unit tests (mirror src/ structure)
    ├── integration/    # Integration tests
    ├── fixtures/       # Test data files
    ├── helpers/        # Shared test utilities
    └── scripts/        # Debug/manual scripts
```

## Tests

- Place tests in `tests/unit/` mirroring `src/` structure
- Name: `*.test.ts`, fixtures: `tests/fixtures/`
- Helpers: `tests/helpers/`, debug scripts: `tests/scripts/`

<!-- krolik:start -->
<!-- version: 6.0.0 | auto-updated -->

## 🐰 Krolik

### Session Startup

**FIRST:** Call these tools at session start:

1. `krolik_status` `fast: true`
2. `krolik_mem_recent` `limit: 5`
3. `krolik_context` `feature: "..."` or `issue: "123"` (if working on specific feature)

### Context Cache

**FIRST:** Read `.krolik/CONTEXT.xml` — if missing, run `krolik_context -q`

```xml
<context mode="quick|deep|full" generated="ISO-timestamp">
```

| Mode | Sections | Use |
|------|----------|-----|
| `quick` | architecture, git, tree, schema, routes | Fast overview |
| `deep` | imports, types, env, contracts | Heavy analysis |
| `full` | all sections | Complete context |

**Refresh if:** file missing, stale (>1h), or wrong mode

### Tools

| When | Tool | Params |
|------|------|--------|
| **Session start** | `krolik_status` | `fast: true` |
| **Before feature/issue work** | `krolik_context` | `feature: "..."` or `issue: "123"` |
| **Need library API docs** | `krolik_docs` | `action: "search", query: "..."` |
| **Parse GitHub issue details** | `krolik_issue` | `number: "123"` |
| **API routes questions** | `krolik_routes` | — |
| **DB schema questions** | `krolik_schema` | — |
| **Code quality audit** | `krolik_audit` | — |
| **Quality issues found** | `krolik_fix` | `dryRun: true` first |
| **Find duplicates/structure** | `krolik_refactor` | `dryRun: true` |
| **After code changes** | `krolik_review` | `staged: true` |
| **Get recent memories** | `krolik_mem_recent` | `limit: 5` |
| **Save decision/pattern/bugfix** | `krolik_mem_save` | `type: "decision", title: "..."` |
| **Search memories by query** | `krolik_mem_search` | `query: "authentication"` |
| **Multi-agent orchestration** | `krolik_agent` | `orchestrate: true, task: "..."` |

<!-- krolik:end -->

---

## Coding Standards

```typescript
// Types: explicit, never any
function analyze(files: string[]): AnalysisResult { }

// Exports: named only
export { runStatus } from './status';

// Imports: node: → external → @/ → ./
import * as fs from 'node:fs';
import { Command } from 'commander';
import { getConfig } from '@/config';
import { format } from './output';

// Errors: Result type
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

## AST System (ts-morph)

**ALWAYS use the unified pool from `lib/@ast` to prevent memory leaks.**

```typescript
// ✅ RECOMMENDED: Auto-cleanup callback pattern
import { withSourceFile } from '@/lib/@ast';

const count = withSourceFile(content, 'temp.ts', (sourceFile) => {
  return sourceFile.getFunctions().length;
});

// ✅ ADVANCED: Manual project management
import { getProject, releaseProject } from '@/lib/@ast';

const project = getProject({ tsConfigPath: './tsconfig.json' });
try {
  // ... use project
} finally {
  releaseProject(project);
}

// ❌ DEPRECATED: Direct project creation (memory leaks!)
import { createProject } from '@/lib/@ast';  // DON'T USE
const project = createProject();  // Creates new instance every time
```

**Key points:**
- Pool reuses Project instances to avoid memory leaks
- `withSourceFile()` is preferred for single-file operations
- `getProject()` + `releaseProject()` for multi-file operations
- Old `createProject()` is deprecated but kept for backward compatibility

## Refactor Command

Analyze and refactor module structure with 3 modes:

```bash
krolik refactor [options]

Options:
  --path <path>      Path to analyze (default: auto-detect)
  --package <name>   Monorepo package to analyze
  --all-packages     Analyze all packages in monorepo
  --quick            Quick mode: structure only, no AST (~2-3s)
  --deep             Deep mode: + type duplicates (~5-10s)
  --dry-run          Show plan without applying
  --apply            Apply migrations (always creates backup)
  --fix-types        Auto-fix 100% identical type duplicates

Examples:
  krolik refactor                    # Default analysis
  krolik refactor --quick            # Fast structure check
  krolik refactor --deep             # Full analysis with types
  krolik refactor --apply            # Apply suggested migrations
  krolik refactor --package api      # Analyze specific package
```

### Modes

| Mode | Duration | Analyzes |
|------|----------|----------|
| `--quick` | ~2-3s | Structure, domains, file sizes |
| default | ~5-6s | + Function duplicates (SWC) |
| `--deep` | ~5-10s | + Type duplicates (ts-morph) |

### Apply Flow

When using `--apply`:
1. Git backup branch is **always created** automatically
2. Migrations are applied with file-level backups
3. Typecheck runs after completion
4. Clear rollback instructions on failure

## Docs

| Topic | Path |
|-------|------|
| Fix Command | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) |
| File Cache | [src/commands/fix/core/FILE-CACHE.md](src/commands/fix/core/FILE-CACHE.md) |
| Refactor Roadmap | [docs/REFACTOR-CLI-ROADMAP.md](docs/REFACTOR-CLI-ROADMAP.md) |
