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
<!-- version: 4.0.0 | auto-updated -->

## 🐰 Krolik

**Start:** krolik_status → krolik_mem_recent → krolik_context

**Context:** `.krolik/CONTEXT.xml` (missing? run `krolik_context -q`)



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

## Docs

| Topic | Path |
|-------|------|
| Fix Command | [src/commands/fix/CLAUDE.md](src/commands/fix/CLAUDE.md) |
| File Cache | [src/commands/fix/core/FILE-CACHE.md](src/commands/fix/core/FILE-CACHE.md) |
