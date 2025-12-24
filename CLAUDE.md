# KROLIK CLI — Development Rules

> Universal CLI toolkit for AI-assisted development.
> **Version:** 1.0.0 | **Node:** >=20.0.0 | **CLI:** `krolik`

## Project Overview

**Purpose:** Универсальный CLI для AI-assisted разработки. Работает с любым TypeScript/JavaScript проектом.

**Key Features:** `status`, `audit`, `fix`, `context`, `review`, `schema`, `routes`, `codegen`, `issue`, MCP server

---

## Architecture Rules

### Core Principles

| Rule | Description |
|------|-------------|
| **SRP** | Each file has ONE purpose |
| **200 lines max** | Split files exceeding 200 lines |
| **No hardcoded paths** | Use config, CLI args, or env vars |
| **Dependency injection** | Pass deps explicitly, no singletons |
| **Pure functions first** | Minimize side effects |

### File Structure

```
krolik-cli/
├── bin/cli.ts              # Entry point
├── src/
│   ├── commands/           # Command implementations (status/, review/, fix/, etc.)
│   ├── lib/                # Shared utilities (logger, shell, fs, git, github)
│   ├── config/             # Config loading and validation
│   ├── types/              # TypeScript types
│   └── mcp/                # MCP server for Claude Code
├── templates/              # Code generation templates
└── tests/                  # Unit tests
```

---

## Coding Standards

```typescript
// Explicit types, no `any` — use `unknown` for external data
function analyze(files: string[]): AnalysisResult { }

// Named exports only (no default)
export { runStatus } from './status';

// Import order: node: → external → @/ → ./
import * as fs from 'node:fs';
import { Command } from 'commander';
import { getConfig } from '@/config';
import { formatOutput } from './output';

// Result type for recoverable errors
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
```

---

## Commands Quick Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `status` | Project diagnostics | `--fast` |
| `audit` | Code quality audit | `--path`, `--show-fixes` |
| `fix` | Auto-fix code issues | `--dry-run`, `--from-audit`, `--quick`, `--deep`, `--full` |
| `context` | Generate AI context | `--issue`, `--feature`, `--with-audit`, `--full` |
| `review` | Code review | `--pr`, `--staged` |
| `schema` | Analyze Prisma schema | `--save`, `--json` |
| `routes` | Analyze tRPC routes | `--save`, `--json` |
| `issue` | Parse GitHub issue | `--url` |
| `codegen` | Generate code | `<target>`, `--dry-run` |
| `refine` | Reorganize lib/ | `--apply`, `--dry-run` |
| `refactor` | AST analysis, duplicates, migrations | `--path`, `--apply`, `--ai` |
| `setup` | Install plugins & agents | `--all`, `--mem`, `--mcp`, `--agents` |
| `security` | Security audit | `--fix` |
| `agent` | Run AI agents | `--list`, `--category` |
| `mcp` | Start MCP server | — |

**Full options:** `krolik <command> --help`

### Key Workflows

```bash
# Audit → Fix pipeline
krolik audit --show-fixes          # Audit with fix previews
krolik fix --from-audit --dry-run  # Preview fixes from audit
krolik fix --from-audit --yes      # Apply fixes

# Fix presets
krolik fix --quick    # Fast: console/debugger + Biome + typecheck
krolik fix --deep     # Safe fixes + Biome + typecheck
krolik fix --full     # All fixes + backup

# Context for AI
krolik context --feature booking              # Feature context
krolik context --feature booking --with-audit # Context + quality issues
krolik context --issue 123 --full             # Full context for issue
```

---

## Config File

`krolik.config.ts`:

```typescript
import { defineConfig } from 'krolik-cli';

export default defineConfig({
  name: 'my-project',
  paths: { web: 'apps/web', api: 'packages/api', db: 'packages/db' },
  features: { prisma: true, trpc: true, nextjs: true },
  prisma: { schemaDir: 'packages/db/prisma/schema' },
});
```

---

## Testing & Performance

```bash
pnpm test              # Run all tests (211+ tests across 13 files)
pnpm test:watch        # Watch mode
pnpm build && node dist/bin/cli.js status  # Test build
```

**Performance Optimizations:**
- **Lazy command loading** - Commands loaded on-demand
- **Parallel checks** - Multiple analysis tasks run concurrently
- **File caching** - Session-scoped cache reduces I/O by ~75%
- **AST pooling** - Reusable ts-morph Project prevents memory leaks
- **Path validation** - Security checks prevent path traversal attacks

---

## Git Commits

```
feat(status): add fast mode
fix(review): handle empty diff
refactor(lib): split utils
```

---

## Documentation Index

| Guide | Location |
|-------|----------|
| **Autofixer** | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) |
| **Quality Analyzer** | `src/commands/quality/` |
| **MCP Server** | `src/mcp/` |

---

*Last updated: 2025-12-23*
