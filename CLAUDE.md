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
