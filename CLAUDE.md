# KROLIK CLI — Development Guide

> Internal guide for developing krolik-cli. For **usage** docs, see root `CLAUDE.md`.

**Version:** 0.7.0 | **Node:** >=20 | **Package Manager:** pnpm

## Architecture Principles

| Rule | Enforcement |
|------|-------------|
| SRP | One purpose per file |
| Max lines | 200 |
| Paths | Dynamic detection via `detectSrcPaths()`, never hardcoded |
| Dependencies | Explicit injection |
| Functions | Pure first |
| CLI flags | Extend existing, never add new |

## ⛔ FORBIDDEN: Regex for Code Analysis

**NEVER use regex to analyze or transform code.** Regex cannot reliably distinguish:
- JSX attributes vs object properties vs function arguments
- String literals in different contexts
- Nested structures and edge cases

| ❌ Forbidden | ✅ Required |
|-------------|-------------|
| Regex patterns for parsing | SWC for fast analysis (`lib/@swc`) |
| String matching for context | ts-morph AST for transformations (`lib/@ast`) |
| Line-by-line text replacement | AST-based node replacement |

**Why:** Regex leads to exponential edge cases (11+ patterns for i18n alone). AST gives 100% accuracy via `SyntaxKind`.

**Example — i18n string replacement:**
```typescript
// ❌ WRONG: Regex-based (breaks constantly)
if (/^\w+:\s*["']/.test(line)) { /* object property? maybe... */ }

// ✅ CORRECT: AST-based (always accurate)
if (parent.getKind() === SyntaxKind.PropertyAssignment) { /* definitely object property */ }
```

**See:** [ast-transformer.ts](src/lib/@i18n/ast-transformer.ts) for reference implementation.

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
| **Before writing utilities** | `krolik_modules` | `action: "search", query: "..."` |
| **API routes questions** | `krolik_routes` | — |
| **DB schema questions** | `krolik_schema` | — |
| **Code quality audit** | `krolik_audit` | — |
| **Quality issues found** | `krolik_fix` | `dryRun: true` first |
| **Find duplicates/structure** | `krolik_refactor` |  |
| **After code changes** | `krolik_review` | `staged: true` |
| **Get recent memories** | `krolik_mem_recent` | `limit: 5` |
| **Save decision/pattern/bugfix** | `krolik_mem_save` | `type: "decision", title: "..."` |
| **Search memories by query** | `krolik_mem_search` | `query: "authentication"` |
| **Multi-agent orchestration** | `krolik_agent` | `orchestrate: true, task: "..."` |

<!-- krolik:end -->

---

## Project Structure

```
krolik-cli/
├── src/
│   ├── bin/            # CLI entry point (cli.ts)
│   ├── cli/            # Command registration
│   ├── commands/       # Command implementations
│   │   ├── agent/      # Multi-agent orchestration
│   │   ├── audit/      # Code quality audit
│   │   ├── codegen/    # Code generation
│   │   ├── context/    # AI-context generation
│   │   ├── docs/       # Library documentation cache
│   │   ├── fix/        # Auto-fix quality issues
│   │   ├── init/       # Project initialization
│   │   ├── issue/      # GitHub issue parsing
│   │   ├── memory/     # Persistent memory
│   │   ├── refactor/   # Module refactoring
│   │   ├── review/     # Code review
│   │   ├── routes/     # tRPC routes analysis
│   │   ├── schema/     # Prisma schema analysis
│   │   ├── security/   # Security audit
│   │   ├── setup/      # Plugin installation
│   │   ├── status/     # Project diagnostics
│   │   └── sync/       # Sync operations
│   ├── config/         # Config loading (cosmiconfig)
│   ├── lib/            # Shared utilities
│   │   ├── @agents/    # Agent definitions & orchestration
│   │   ├── @ast/       # ts-morph AST pool (CRITICAL!)
│   │   ├── @vcs/       # Version Control System (Git/GitHub)
│   │   ├── @patterns/  # Dynamic pattern detection
│   │   ├── @prisma/    # Prisma schema parsing
│   │   ├── @ranking/   # PageRank for file importance
│   │   ├── @swc/       # SWC-based fast parsing
│   │   ├── @tokens/    # Token counting (gpt-tokenizer)
│   │   ├── cache/      # SQLite caching layer
│   │   ├── claude/     # Claude Code integration
│   │   ├── constants/  # Shared constants
│   │   ├── core/       # Foundation: fs, shell, logger, time
│   │   ├── discovery/  # File & pattern discovery
│   │   ├── format/     # Formatters: markdown, xml, json
│   │   ├── integrations/ # External: context7
│   │   ├── modules/    # Module analysis
│   │   ├── parsing/    # Zod schema parsing
│   │   ├── security/   # Sanitization, env detection
│   │   └── storage/    # Memory storage (SQLite)
│   ├── mcp/            # MCP server
│   │   ├── tools/      # MCP tool implementations
│   │   ├── handlers.ts
│   │   ├── resources.ts
│   │   └── server.ts
│   └── types/          # TypeScript types
├── tests/
│   ├── unit/           # Unit tests (mirror src/)
│   ├── integration/    # Integration tests
│   ├── fixtures/       # Test data
│   └── helpers/        # Test utilities
└── docs/               # Documentation
```

## Coding Standards

```typescript
// Types: explicit, never any
function analyze(files: string[]): AnalysisResult { }

// Exports: named only
export { runStatus } from './status';

// Imports order: node: → external → @/ → ./
import * as fs from 'node:fs';
import { Command } from 'commander';
import { getConfig } from '@/config';
import { format } from './output';

// Errors: Result type
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

## Critical: AST System

**ALWAYS use the unified pool from `lib/@ast` to prevent memory leaks.**

```typescript
// RECOMMENDED: Auto-cleanup callback pattern
import { withSourceFile } from '@/lib/@ast';

const count = withSourceFile(content, 'temp.ts', (sourceFile) => {
  return sourceFile.getFunctions().length;
});

// ADVANCED: Manual project management
import { getProject, releaseProject } from '@/lib/@ast';

const project = getProject({ tsConfigPath: './tsconfig.json' });
try {
  // ... use project
} finally {
  releaseProject(project);
}
```

**Key points:**
- Pool reuses Project instances to avoid memory leaks
- `withSourceFile()` — single-file operations
- `getProject()` + `releaseProject()` — multi-file operations
- Never use deprecated `createProject()` directly

## Critical: Pattern Detection

**NEVER hardcode patterns.** Use `lib/@patterns` for dynamic detection:

```typescript
import { detectPatterns, getProjectPatterns } from '@/lib/@patterns';

// Auto-detect project conventions
const patterns = await getProjectPatterns(projectRoot);
const apiDir = patterns.apiDirectory;
const components = patterns.componentPatterns;
```

## SWC Fast Parsing

For performance-critical parsing (10-50x faster than ts-morph):

```typescript
import { parseFile, extractFunctions } from '@/lib/@swc';

const ast = await parseFile(filePath);
const functions = extractFunctions(ast);
```

## Refactor Command Architecture

**Path detection is ALWAYS dynamic.** The refactor command analyzes ALL source directories, not just `lib/`.

### Key Principles

| Rule | Implementation |
|------|----------------|
| Dynamic paths | Use `detectSrcPaths()` from config |
| No hardcoded dirs | Pattern-based detection |
| No new CLI flags | Extend existing infrastructure |
| Multi-path analysis | Parallel scanning + merge |

### Source Path Detection

```typescript
// config/detect.ts
export function detectSrcPaths(projectRoot: string, pkgPath: string): string[]
// Scans pkgPath for directories containing .ts/.tsx files
// Returns: ['apps/web/lib', 'apps/web/components', 'apps/web/app', ...]
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    refactor command                          │
├─────────────────────────────────────────────────────────────┤
│  1. resolvePaths()                                          │
│     ├─ Monorepo? → detectMonorepoPackages() → srcPaths     │
│     └─ Single?   → detectSrcPaths(projectRoot, 'src')       │
│                                                              │
│  2. runRefactor()                                            │
│     ├─ Parallel analysis on each path                        │
│     └─ mergeDuplicates() + mergeStructures()                │
│                                                              │
│  3. Output: path shows all analyzed dirs                     │
│     p="src/lib, src/commands, src/mcp, src/config"          │
└─────────────────────────────────────────────────────────────┘
```

### File Locations

| File | Purpose |
|------|---------|
| [src/config/detect.ts](src/config/detect.ts) | `detectSrcPaths()`, `MonorepoPackage.srcPaths` |
| [src/commands/refactor/paths/resolver.ts](src/commands/refactor/paths/resolver.ts) | Path resolution for mono/single |
| [src/commands/refactor/runner/analysis.ts](src/commands/refactor/runner/analysis.ts) | Parallel analysis + merge utils |

### Examples

**Monorepo (piternow):**
```
📦 Monorepo detected. Analyzing: web [__tests__, app, components, lib]
   Available packages: mobile, web, api, ui
```

**Single project (krolik-cli):**
```
📁 Single project. Analyzing: [bin, cli, commands, config, lib, mcp, types]
```

## Adding New Command

1. Create folder in `src/commands/<name>/`
2. Structure:
   ```
   commands/<name>/
   ├── index.ts      # Command registration
   ├── run.ts        # Main logic
   ├── types.ts      # Types
   └── CLAUDE.md     # (optional) Command-specific docs
   ```
3. Register in `src/commands/index.ts`
4. Add MCP tool in `src/mcp/tools/<name>/`

## Adding MCP Tool

1. Create folder in `src/mcp/tools/<name>/`
2. Structure:
   ```
   tools/<name>/
   ├── index.ts      # Tool definition
   ├── handler.ts    # Handler logic
   └── schema.ts     # Zod schema for params
   ```
3. Register in `src/mcp/tools/index.ts`

## Testing

```bash
pnpm test              # Watch mode
pnpm test:run          # Single run
pnpm test:coverage     # With coverage
```

- Tests in `tests/unit/` mirror `src/` structure
- Fixtures in `tests/fixtures/`
- Name pattern: `*.test.ts`

## Development

```bash
pnpm dev              # Watch mode (tsx)
pnpm build            # Build to dist/
pnpm typecheck        # Type check
pnpm lint             # Lint (biome)
pnpm check:fix        # Fix lint + format

# Test CLI locally
./dist/bin/cli.js status --fast
./dist/bin/cli.js context --quick
```

## ⛔ Release: ONLY via Changesets

**NEVER manually change version in package.json!**

| ❌ Forbidden | ✅ Required |
|-------------|-------------|
| `npm version patch/minor/major` | `pnpm changeset` |
| Edit `package.json` version | Create `.changeset/*.md` file |
| Manual `npm publish` | Push to GitHub → Actions publish |

**Release workflow:**

```bash
# 1. Create changeset (describes changes)
pnpm changeset

# 2. Commit and push
git add .changeset/*.md
git commit -m "chore: add changeset for <feature>"
git push

# 3. GitHub Actions automatically:
#    - Runs changeset version (bumps package.json)
#    - Publishes to npm via Trusted Publisher
#    - Creates GitHub release
```

**Why:** Trusted Publisher uses OIDC (no npm tokens), ensures provenance, publishes to both npm and GitHub releases atomically.

## Key Locations

| What | Path |
|------|------|
| CLI Entry | [src/bin/cli.ts](src/bin/cli.ts) |
| MCP Server | [src/mcp/server.ts](src/mcp/server.ts) |
| MCP Tools | [src/mcp/tools/](src/mcp/tools/) |
| AST Pool | [src/lib/@ast/](src/lib/@ast/) |
| Pattern Detection | [src/lib/@patterns/](src/lib/@patterns/) |
| Agent System | [src/lib/@agents/](src/lib/@agents/) |
| Fix Command Docs | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) |

## Dependencies

**Core:**
- `commander` — CLI framework
- `cosmiconfig` — Config loading
- `ts-morph` — AST analysis (pooled)
- `better-sqlite3` — Memory/cache storage
- `gpt-tokenizer` — Token counting
- `zod` — Schema validation

**Dev:**
- `@swc/core` — Fast parsing
- `biome` — Lint + format
- `vitest` — Testing
- `tsup` — Build

## Related CLAUDE.md Files

### Krolik CLI (this project)

| File | Purpose |
|------|---------|
| [CLAUDE.md](CLAUDE.md) | This file — development guide |
| [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) | Fix command internals |

### Workspace Root

| File | Purpose |
|------|---------|
| [../CLAUDE.md](../CLAUDE.md) | Main workspace rules, Krolik usage |

### Piternow Project (target project)

| File | Purpose |
|------|---------|
| [../piternow-wt-fix/CLAUDE.md](../piternow-wt-fix/CLAUDE.md) | Main project rules |
| [../piternow-wt-fix/apps/web/CLAUDE.md](../piternow-wt-fix/apps/web/CLAUDE.md) | Next.js web app |
| [../piternow-wt-fix/apps/mobile/CLAUDE.md](../piternow-wt-fix/apps/mobile/CLAUDE.md) | Expo mobile app |
| [../piternow-wt-fix/packages/api/CLAUDE.md](../piternow-wt-fix/packages/api/CLAUDE.md) | tRPC API package |
| [../piternow-wt-fix/packages/db/CLAUDE.md](../piternow-wt-fix/packages/db/CLAUDE.md) | Prisma database |
| [../piternow-wt-fix/packages/shared/CLAUDE.md](../piternow-wt-fix/packages/shared/CLAUDE.md) | Shared utilities |
| [../piternow-wt-fix/packages/ui/CLAUDE.md](../piternow-wt-fix/packages/ui/CLAUDE.md) | UI components |
| [../piternow-wt-fix/packages/api/src/lib/integrations/CLAUDE.md](../piternow-wt-fix/packages/api/src/lib/integrations/CLAUDE.md) | API integrations |
| [../piternow-wt-fix/packages/api/src/lib/observability/CLAUDE.md](../piternow-wt-fix/packages/api/src/lib/observability/CLAUDE.md) | Observability |

### Other Tools

| File | Purpose |
|------|---------|
| [../claude-mem/CLAUDE.md](../claude-mem/CLAUDE.md) | Claude memory plugin |
| [../cal.com/CLAUDE.md](../cal.com/CLAUDE.md) | Cal.com reference |
