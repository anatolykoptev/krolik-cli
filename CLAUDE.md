# KROLIK CLI — Development Rules

> Universal CLI toolkit for AI-assisted development.
> **Version:** 1.0.0 | **Node:** >=20.0.0 | **CLI:** `krolik`

---

## Project Overview

**Purpose:** Универсальный CLI для AI-assisted разработки. Работает с любым TypeScript/JavaScript проектом.

**Name:** KROLIK — быстрый как кролик, умный как AI.

**Key Features:**
- Project diagnostics (`status`)
- Code review (`review`)
- Schema/routes analysis (`schema`, `routes`)
- Code generation (`codegen`)
- GitHub integration (`issue`)
- MCP server for Claude Code

---

## Architecture Principles

### 1. Single Responsibility (SRP)

Each file has ONE purpose:

```
src/lib/logger.ts      → Only logging
src/lib/shell.ts       → Only shell execution
src/lib/fs.ts          → Only file system operations
src/config/loader.ts   → Only config loading
```

### 2. Maximum 200 Lines Per File

If file exceeds 200 lines → split into smaller modules.

**Example split:**
```
# Before (300+ lines)
src/commands/codegen.ts

# After
src/commands/codegen/
├── index.ts           # Re-exports (10 lines)
├── schemas.ts         # Zod schema generation (80 lines)
├── tests.ts           # Test file generation (80 lines)
├── barrels.ts         # Barrel export generation (60 lines)
└── types.ts           # Shared types (30 lines)
```

### 3. No Hardcoded Values

All paths and settings come from:
1. **Config file** (`krolik.config.ts`)
2. **CLI arguments** (`--project-root`)
3. **Environment variables** (`KROLIK_*`)

```typescript
// ❌ Bad
const ROOT = '/Users/john/project';
const WEB_DIR = path.join(ROOT, 'apps/web');

// ✅ Good
import { getConfig } from '../config';
const config = getConfig();
const webDir = config.paths.web;
```

### 4. Dependency Injection

Pass dependencies explicitly, don't import singletons:

```typescript
// ❌ Bad
import { logger } from '../lib/logger';
function doSomething() {
  logger.info('...');
}

// ✅ Good
import type { Logger } from '../types';
function doSomething(logger: Logger) {
  logger.info('...');
}
```

### 5. Pure Functions First

Prefer pure functions over side-effectful ones:

```typescript
// ❌ Bad - side effect
function analyzeSchema() {
  const files = fs.readdirSync(schemaDir);
  console.log(files);
  return files;
}

// ✅ Good - pure
function parseSchema(content: string): SchemaModel[] {
  return content.split('model').map(parseModel);
}
```

---

## File Structure

```
krolik-cli/
├── bin/
│   └── cli.ts              # Entry point with shebang
├── src/
│   ├── index.ts            # Public API exports
│   ├── cli.ts              # CLI setup (commander.js)
│   ├── commands/           # Command implementations
│   │   ├── status/
│   │   │   ├── index.ts    # Command entry
│   │   │   ├── checks.ts   # Health checks
│   │   │   └── output.ts   # Output formatting
│   │   ├── review/
│   │   │   ├── index.ts
│   │   │   ├── analyzer.ts # Code analysis
│   │   │   ├── patterns.ts # Security/perf patterns
│   │   │   └── output.ts
│   │   └── .../
│   ├── lib/                # Shared utilities
│   │   ├── logger.ts       # Colored logging
│   │   ├── shell.ts        # Shell execution
│   │   ├── fs.ts           # File system helpers
│   │   ├── git.ts          # Git operations
│   │   ├── github.ts       # GitHub API (gh CLI)
│   │   └── spinner.ts      # Progress indicators
│   ├── config/             # Configuration
│   │   ├── loader.ts       # Config file loading
│   │   ├── defaults.ts     # Default values
│   │   ├── schema.ts       # Zod validation
│   │   └── detect.ts       # Auto-detection
│   ├── types/              # TypeScript types
│   │   ├── index.ts        # Re-exports
│   │   ├── config.ts       # Config types
│   │   ├── commands.ts     # Command types
│   │   └── project.ts      # Project types
│   └── mcp/                # MCP server
│       ├── server.ts       # Main server
│       ├── tools.ts        # Tool definitions
│       └── resources.ts    # Resource definitions
├── templates/              # Code generation templates
│   ├── hooks/              # React hooks
│   ├── schemas/            # Zod schemas
│   └── tests/              # Test files
└── tests/                  # Unit tests
```

---

## Coding Standards

### TypeScript

```typescript
// Explicit types, no `any`
function analyze(files: string[]): AnalysisResult { }

// Use `unknown` for external data
function parse(data: unknown): Config { }

// Prefer interfaces for objects
interface Config {
  projectRoot: string;
  paths: PathConfig;
}

// Use type for unions/primitives
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

### Imports

```typescript
// 1. Node.js built-ins
import * as fs from 'node:fs';
import * as path from 'node:path';

// 2. External packages
import { Command } from 'commander';
import chalk from 'chalk';

// 3. Internal absolute
import { getConfig } from '@/config';
import type { Logger } from '@/types';

// 4. Relative
import { formatOutput } from './output';
```

### Exports

```typescript
// Named exports only (no default)
export { runStatus } from './status';
export { runReview } from './review';
export type { StatusResult, ReviewResult } from './types';
```

### Error Handling

```typescript
// Custom error classes
export class ConfigError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// Use Result type for recoverable errors
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function loadConfig(): Result<Config, ConfigError> {
  // ...
}
```

### Async/Await

```typescript
// Always use async/await, not callbacks or .then()
async function fetchIssue(number: number): Promise<Issue> {
  const data = await gh.issue.get(number);
  return parseIssue(data);
}
```

---

## CLI Best Practices

### 1. Exit Codes

```typescript
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  CONFIG_ERROR: 2,
  NOT_FOUND: 3,
  PERMISSION_DENIED: 4,
} as const;
```

### 2. Output Modes

```typescript
// Support multiple output formats
type OutputFormat = 'text' | 'json' | 'markdown';

// JSON for piping to other tools
if (options.json) {
  console.log(JSON.stringify(result));
  return;
}
```

### 3. Progress Indicators

```typescript
import ora from 'ora';

const spinner = ora('Analyzing...').start();
try {
  const result = await analyze();
  spinner.succeed('Analysis complete');
} catch (error) {
  spinner.fail('Analysis failed');
}
```

### 4. Help Text

```typescript
command
  .name('krolik')
  .description('KROLIK — fast AI-assisted development toolkit')
  .version('1.0.0')
  .option('-c, --config <path>', 'Config file path')
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output');
```

---

## Config File Format

`krolik.config.ts` in project root:

```typescript
import { defineConfig } from 'krolik-cli';

export default defineConfig({
  // Project name (for display)
  name: 'my-project',

  // Path mappings
  paths: {
    web: 'apps/web',
    api: 'packages/api',
    db: 'packages/db',
  },

  // Feature detection
  features: {
    prisma: true,
    trpc: true,
    nextjs: true,
  },

  // Prisma settings
  prisma: {
    schemaDir: 'packages/db/prisma/schema',
  },

  // Custom templates
  templates: {
    hook: 'templates/hook.hbs',
    test: 'templates/test.hbs',
  },
});
```

---

## Commands Reference

| Command | Description | Key Options |
|---------|-------------|-------------|
| `status` | Project diagnostics | `--fast`, `--json` |
| `context` | Generate AI context | `--issue=N`, `--feature=X`, `--ai` |
| `quality` | Code quality analysis | `--path`, `--ai`, `--category` |
| `fix` | Auto-fix code issues | `--dry-run`, `--biome`, `--typecheck` |
| `schema` | Analyze Prisma schema | `--save`, `--json` |
| `routes` | Analyze tRPC routes | `--save`, `--json` |
| `review` | Code review | `--pr=N`, `--staged` |
| `issue` | Parse GitHub issue | `--output=format` |
| `codegen` | Generate code | `--schemas`, `--hooks`, `--tests` |
| `security` | Security audit | `--fix` |

### Quality Analysis (`krolik quality`)

Analyzes code for quality issues:

```bash
krolik quality                    # Analyze entire project
krolik quality --path=src/        # Analyze specific path
krolik quality --ai               # AI-friendly XML output
krolik quality --category=lint    # Filter by category
krolik quality --ignore-cli-console  # Ignore console in CLI files
krolik quality -j                 # JSON output
```

**Categories analyzed:**
- `srp` — Single Responsibility violations (too many functions/exports)
- `complexity` — High cyclomatic complexity, long functions (with **split suggestions**)
- `type-safety` — `any`, `@ts-ignore`, type assertions
- `lint` — `console`, `debugger`, `alert` statements
- `hardcoded` — Magic numbers, hardcoded strings/URLs
- `documentation` — Missing JSDoc on exports
- `size` — Files exceeding line limits

**Smart CLI detection:**
Console statements are auto-ignored in:
- `bin/`, `cli/`, `scripts/` directories
- `*.cli.ts`, `cli.ts`, `bin.ts` files
- Command handler files (`commands/*/index.ts`)
- MCP server files (`mcp/`)

**Complexity Split Suggestions:**
For functions with complexity > 10, krolik suggests specific extraction points:
```
🔧 src/commands/fix/index.ts::formatPlan (complexity: 22)
   → Extract handleEmptyResult() — if-block (lines 394-436)
   → Extract processItems() — loop (lines 358-391)
```

### Auto-Fix (`krolik fix`)

Automatically fixes code issues:

```bash
krolik fix                        # Full pipeline (tsc + biome + custom)
krolik fix --dry-run              # Preview changes
krolik fix --dry-run --diff       # Preview with unified diff output
krolik fix --typecheck-only       # Only TypeScript check
krolik fix --biome-only           # Only Biome fixes
krolik fix --no-biome             # Skip Biome
krolik fix --path=src/commands    # Fix specific path
krolik fix --trivial              # Only trivial fixes (console, debugger)
```

**Fix pipeline:**
1. TypeScript type check (`tsc --noEmit`)
2. Biome auto-fix (if available)
3. Custom strategies (lint, type-safety, complexity)

**Unified diff output:**
Use `--diff` with `--dry-run` to see full context:
```diff
--- a/src/lib/utils.ts
+++ b/src/lib/utils.ts
@@ -42,1 +42,0 @@
   // Context before
-  console.log('debug');
   // Context after
```

---

## Testing

### Unit Tests

```typescript
// tests/lib/logger.test.ts
import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/lib/logger';

describe('logger', () => {
  it('formats info messages correctly', () => {
    const output: string[] = [];
    const logger = createLogger({
      write: (msg) => output.push(msg)
    });

    logger.info('Hello');
    expect(output[0]).toContain('Hello');
  });
});
```

### Test Commands

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
pnpm test:coverage # With coverage
```

---

## Git Commits

```bash
feat(status): add fast mode for status command
fix(review): handle empty diff correctly
refactor(lib): split utils into smaller modules
docs: update CLI examples
chore: update dependencies
```

---

## Dependencies

### Runtime
- `commander` — CLI framework
- `chalk` — Colored output
- `ora` — Spinners
- `cosmiconfig` — Config loading
- `zod` — Validation

### Development
- `typescript`
- `vitest`
- `@biomejs/biome`
- `tsx`

---

## Performance Guidelines

1. **Lazy loading** — Import commands only when used
2. **Caching** — Cache expensive operations (typecheck, lint)
3. **Streaming** — Use streams for large files
4. **Parallel** — Run independent checks in parallel

```typescript
// Lazy command loading
program.command('status').action(async () => {
  const { runStatus } = await import('./commands/status');
  await runStatus();
});

// Parallel checks
const [typecheck, lint] = await Promise.all([
  checkTypecheck(),
  checkLint(),
]);
```

---

## Documentation Index

> Detailed guides for specific subsystems

| Guide | Location | Description |
|-------|----------|-------------|
| **Autofixer** | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) | AST-based code transformations, ts-morph vs jscodeshift |
| **Quality Analyzer** | `src/commands/quality/` | Code quality detection rules |
| **MCP Server** | `src/mcp/` | Claude Code integration |

---

*Last updated: 2025-12-22 (added CLI console detection, split suggestions, diff output)*
