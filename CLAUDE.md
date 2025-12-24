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
│   ├── lib/            # Shared utilities (@fs, @git, @log, @shell, @time)
│   ├── config/         # Config loading
│   └── types/          # TypeScript types
└── tests/              # Unit tests
```

<!-- krolik:start -->
<!-- version: 1.2.0 | auto-updated by krolik CLI -->

## 🐰 Krolik CLI

> AI-toolkit for development. Auto-updated — do not edit manually.

### Core Commands (use these!)

| Command | Use | Key Flags |
|---------|-----|-----------|
| **context** | Get task context | `--feature <name>`, `--issue <n>`, `--full` |
| **refactor** | AST analysis, duplicates | `--dry-run`, `--apply`, `--types-only` |
| **audit** | Code quality → AI-REPORT.md | `--path <dir>` |
| **fix** | Auto-fix issues | `--dry-run`, `--quick`, `--deep`, `--full` |

### Workflow

```bash
krolik context --feature booking  # 1. Understand task
krolik refactor --dry-run         # 2. Find duplicates, structure issues
krolik audit                      # 3. Quality analysis → .krolik/AI-REPORT.md
krolik fix --dry-run              # 4. Preview fixes
krolik fix --yes                  # 5. Apply fixes
```

### MCP Tools

| Tool | Use |
|------|-----|
| `krolik_context` | Before task — feature/issue context |
| `krolik_audit` | Code quality analysis |
| `krolik_fix` | Auto-fix issues |
| `krolik_status` | Project state — git, typecheck, TODOs |
| `krolik_schema` | DB work — Prisma models |
| `krolik_routes` | API work — tRPC routers |
| `krolik_review` | Code review changes |

### Fix Presets

```bash
krolik fix --quick  # trivial (console, debugger) + biome
krolik fix --deep   # safe fixes + biome + typecheck
krolik fix --full   # all fixes + backup
```

<!-- krolik:end -->

---

## Commands

| Command | Use | Key Flags |
|---------|-----|-----------|
| status | Diagnostics | `--fast` |
| audit | Code quality | `--path` |
| fix | Auto-fix | `--dry-run`, `--quick`, `--deep`, `--full` |
| context | AI context | `--feature`, `--issue`, `--full` |
| review | Code review | `--staged`, `--pr` |
| schema | Prisma analysis | `--json` |
| routes | tRPC analysis | `--json` |
| refactor | AST analysis | `--apply`, `--types-only` |
| mcp | MCP server | — |

## MCP Tools

| Tool | When to Use |
|------|-------------|
| `krolik_status` | Start of session — git, typecheck, TODOs |
| `krolik_context` | Before task — feature/issue context |
| `krolik_schema` | DB work — Prisma models |
| `krolik_routes` | API work — tRPC routers |
| `krolik_review` | After code — review changes |
| `krolik_audit` | Code quality analysis |
| `krolik_fix` | Auto-fix issues |

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

## Workflows

```bash
# Quick fix
krolik fix --quick          # console/debugger + biome + typecheck

# Deep fix
krolik audit                # → .krolik/AI-REPORT.md
krolik fix --deep           # safe fixes + biome + typecheck

# Full pipeline
krolik refactor --dry-run   # Structure analysis
krolik fix --full           # All fixes + backup
krolik review --staged      # Before commit
```

## Docs

| Topic | Path |
|-------|------|
| Fix Command | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) |
| File Cache | [src/commands/fix/core/FILE-CACHE.md](src/commands/fix/core/FILE-CACHE.md) |
