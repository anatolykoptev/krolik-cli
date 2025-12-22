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
| `context` | Generate AI context | `--issue=N`, `--feature=X` |
| `schema` | Analyze Prisma schema | `--save`, `--json` |
| `routes` | Analyze tRPC routes | `--save`, `--json` |
| `review` | Code review | `--pr=N`, `--staged` |
| `issue` | Parse GitHub issue | `--output=format` |
| `codegen` | Generate code | `--schemas`, `--hooks`, `--tests` |
| `security` | Security audit | `--fix` |

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

## Autofixer Development Guide

> Writing safe, reliable code fixers using ts-morph AST

### Overview

Autofixer transforms code to fix quality issues. It uses **ts-morph** (TypeScript Compiler API wrapper) for safe AST-based transformations.

```
strategies/
├── shared/           # Shared utilities (DRY)
│   ├── line-utils.ts     # Line extraction
│   ├── pattern-utils.ts  # Pattern matching
│   ├── formatting.ts     # Prettier + validation
│   └── operations.ts     # FixOperation factories
├── lint/             # console, debugger, alert
├── type-safety/      # @ts-ignore, any
├── complexity/       # Nesting, long functions
├── srp/              # File splitting
└── hardcoded/        # Magic numbers, URLs
```

---

### Rule 1: ALWAYS Use AST, Never Regex

**Why:** Regex matches text inside strings, comments, and other invalid contexts.

```typescript
// ❌ WRONG: Regex-based detection
function hasDebugger(code: string): boolean {
  return /\bdebugger\b/.test(code);
}
// Matches: "debugger" in strings, /debugger/ in regex, comments

// ✅ CORRECT: AST-based detection
function hasDebugger(content: string, line: number): boolean {
  const project = createProject();
  const sourceFile = project.createSourceFile('temp.ts', content);

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.DebuggerStatement)
    .some(stmt => stmt.getStartLineNumber() === line);
}
// Only matches actual debugger statements in executable code
```

**Common AST patterns:**

| Target | SyntaxKind | Method |
|--------|------------|--------|
| `debugger;` | `DebuggerStatement` | `getDescendantsOfKind()` |
| `console.log()` | `CallExpression` | Check expression text |
| `42` | `NumericLiteral` | `getLiteralValue()` |
| `"url"` | `StringLiteral` | `getLiteralValue()` |
| `function foo()` | `FunctionDeclaration` | `getFunctions()` |
| `if (x) {}` | `IfStatement` | `getThenStatement()` |
| `const x = 1` | `VariableDeclaration` | `getVariableDeclarations()` |

---

### Rule 2: Use Shared Utilities

**Don't duplicate code** — use the shared module:

```typescript
import {
  // Line utilities
  getLineContext,        // Get line content + metadata
  lineStartsWith,        // Check line prefix
  lineEndsWith,          // Check line suffix

  // Pattern utilities
  extractNumber,         // Extract number from message
  matchNumberInRange,    // Check if number in range
  containsKeyword,       // Case-insensitive keyword check

  // AST checks
  hasDebuggerStatementAtLine,  // Real debugger statement?
  hasConsoleCallAtLine,        // Real console call?

  // Fix operations
  createDeleteLine,      // Delete a line
  createReplaceLine,     // Replace line content
  createFullFileReplace, // Replace entire file
  createSplitFile,       // Split into multiple files

  // Formatting
  validateAndFormat,     // Validate syntax + Prettier
} from '../shared';
```

---

### Rule 3: Strategy Structure

Every strategy follows this pattern:

```typescript
// strategies/[category]/index.ts

import type { QualityIssue } from '../../../quality/types';
import type { FixOperation, FixStrategy } from '../../types';

export const myStrategy: FixStrategy = {
  // Which issue categories this handles
  categories: ['my-category'],

  // Can this issue be fixed?
  canFix(issue: QualityIssue, content: string): boolean {
    // 1. Check message patterns
    if (!containsKeyword(issue.message, ['pattern1', 'pattern2'])) {
      return false;
    }

    // 2. Check thresholds
    if (!matchNumberInRange(issue.message, /(\d+)/, { min: 10, max: 100 })) {
      return false;
    }

    return true;
  },

  // Generate the fix operation
  async generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> {
    const { file, line, message } = issue;
    if (!file || !line) return null;

    try {
      // 1. AST-based detection
      if (!hasRealProblemAtLine(content, line)) {
        return null;
      }

      // 2. Generate fix
      const result = applyASTTransformation(content, file, line);
      if (!result.success) return null;

      // 3. Validate and format
      const validated = await validateAndFormat(result.newCode, file);
      if (!validated) return null;

      // 4. Return operation
      return createFullFileReplace(file, content, validated);
    } catch {
      return null; // Fail safely
    }
  },
};
```

---

### Rule 4: Split into Modules

For complex strategies, split by responsibility:

```
strategies/complexity/
├── index.ts           # Main strategy export
├── patterns.ts        # Constants, thresholds
├── helpers.ts         # Utility functions
├── nesting-fix.ts     # Early return transforms
├── complexity-fix.ts  # If-chain transforms
└── long-function-fix.ts # Block extraction
```

**Module template:**

```typescript
// patterns.ts - Constants only
export const PATTERNS = {
  NESTING: /nesting depth/i,
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,
} as const;

export const THRESHOLDS = {
  COMPLEXITY: { min: 10, max: 120 },
} as const;
```

```typescript
// helpers.ts - Pure utility functions
export function findFunctionEnd(content: string, startLine: number): number {
  // Implementation
}

export function generateFunctionName(content: string): string {
  // Implementation
}
```

```typescript
// nesting-fix.ts - Single fix generator
import { reduceNesting } from '../../ast-utils';
import { createFullFileReplace } from '../shared';

export function generateNestingFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const result = reduceNesting(content, file, targetLine);

  if (!result.success || !result.newContent) {
    return null;
  }

  return createFullFileReplace(file, content, result.newContent);
}
```

---

### Rule 5: AST Best Practices

**1. Use in-memory file system:**

```typescript
const project = new Project({
  useInMemoryFileSystem: true,  // Fast, no disk I/O
  compilerOptions: {
    allowJs: true,
    checkJs: false,
  },
});
```

**2. Find nodes efficiently:**

```typescript
// Get all nodes of a type
const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement);

// Get specific node
const func = sourceFile.getFunction('myFunction');

// Traverse ancestors
function findAncestor(node: Node, predicate: (p: Node) => boolean): Node | null {
  let parent = node.getParent();
  while (parent) {
    if (predicate(parent)) return parent;
    parent = parent.getParent();
  }
  return null;
}
```

**3. Check context:**

```typescript
// Is inside a type definition?
function isInsideType(node: Node): boolean {
  const typeKinds = new Set([
    SyntaxKind.InterfaceDeclaration,
    SyntaxKind.TypeAliasDeclaration,
    SyntaxKind.EnumDeclaration,
  ]);
  return hasAncestor(node, p => typeKinds.has(p.getKind()));
}

// Is inside a const object literal (mapping)?
function isInsideConstObjectLiteral(node: NumericLiteral): boolean {
  const objLiteral = findAncestor(node,
    p => p.getKind() === SyntaxKind.ObjectLiteralExpression);
  if (!objLiteral) return false;

  // Check if assigned to CONST_CASE variable
  const varDecl = findAncestor(objLiteral,
    p => p.getKind() === SyntaxKind.VariableDeclaration);
  if (varDecl) {
    const name = varDecl.asKind(SyntaxKind.VariableDeclaration)?.getName();
    return /^[A-Z][A-Z0-9_]*$/.test(name || '');
  }
  return false;
}
```

**4. Transform safely:**

```typescript
// Replace ALL occurrences (from last to first to preserve positions)
const candidates = sourceFile
  .getDescendantsOfKind(SyntaxKind.NumericLiteral)
  .filter(n => n.getLiteralValue() === targetValue);

// Replace from end to start
for (let i = candidates.length - 1; i >= 0; i--) {
  candidates[i].replaceWithText(constName);
}
```

---

### Rule 6: Validation Pipeline

**Always validate before returning:**

```typescript
async generateFix(issue, content): Promise<FixOperation | null> {
  try {
    // 1. Generate transformation
    const newCode = transform(content);

    // 2. Validate syntax (catches broken transformations)
    if (!validateSyntax(newCode, issue.file)) {
      return null;
    }

    // 3. Format with Prettier (consistent output)
    const formatted = await formatWithPrettier(newCode, issue.file);

    // 4. Check it's not a no-op
    if (formatted === content) {
      return null;
    }

    return createFullFileReplace(issue.file, content, formatted);
  } catch {
    return null; // Fail safely
  }
}
```

---

### Rule 7: Testing Fixers

**Test file structure:**

```typescript
// __tests__/strategies/lint.test.ts
import { describe, it, expect } from 'vitest';
import { lintStrategy } from '../strategies/lint';

describe('lintStrategy', () => {
  describe('canFix', () => {
    it('returns true for debugger message', () => {
      const issue = { message: 'Unexpected debugger statement', ... };
      expect(lintStrategy.canFix(issue, '')).toBe(true);
    });

    it('returns false for debugger in regex', () => {
      const content = 'const pattern = /debugger/;';
      const issue = { message: 'debugger', line: 1, ... };
      expect(lintStrategy.canFix(issue, content)).toBe(false);
    });
  });

  describe('generateFix', () => {
    it('removes standalone debugger', async () => {
      const content = 'function test() {\n  debugger;\n  return 1;\n}';
      const issue = { message: 'debugger', line: 2, file: 'test.ts', ... };

      const fix = await lintStrategy.generateFix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix.action).toBe('delete-line');
    });
  });
});
```

---

### Common Patterns

**1. Extract constant from magic number:**

```typescript
// Before
const timeout = 3600;

// After
const TIMEOUT_SECONDS = 3600;
const timeout = TIMEOUT_SECONDS;
```

**2. Remove debugger:**

```typescript
// Before
function test() {
  debugger;
  return value;
}

// After
function test() {
  return value;
}
```

**3. Early return for nesting:**

```typescript
// Before
function process(x) {
  if (x) {
    if (x.value) {
      doSomething(x.value);
    }
  }
}

// After
function process(x) {
  if (!x) return;
  if (!x.value) return;
  doSomething(x.value);
}
```

**4. Replace any with unknown:**

```typescript
// Before
function parse(data: any): Result {}

// After
function parse(data: unknown): Result {}
```

---

### Checklist for New Fixer

- [ ] Uses AST (not regex) for code detection
- [ ] Uses shared utilities from `../shared`
- [ ] Has `canFix()` that checks thresholds
- [ ] Has `generateFix()` that returns null on failure
- [ ] Validates syntax before returning
- [ ] Formats with Prettier
- [ ] Handles edge cases (no file, no line)
- [ ] Has try-catch for safety
- [ ] Split into modules if > 150 lines
- [ ] Has unit tests

---

*Last updated: 2025-12-22*
