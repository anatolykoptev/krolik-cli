# lib/ — Shared Library

## Golden Rules

1. **Import from barrels only**: `import { x } from '@/lib/@module'`
2. **No circular imports**: Lower layers cannot import from higher
3. **New code → existing module first**, new @-folder only if needed

## Layers

```
Layer 0: @core          — fs, logger, shell, time, utils (NO deps)
Layer 1: @format        — xml, json, markdown, frontmatter
         @security      — escape, path, regex, validation
         @cache         — file caching
Layer 2: @ast           — swc/ (fast), ts-morph/ (types)
         @detectors     — lint, hardcoded, secrets, security, complexity
         @git           — git operations, github API
         @tokens        — LLM token counting
         @ranking       — PageRank algorithms
Layer 3: @discovery     — project, schema, routes, architecture, reusables
         @storage       — docs/, memory/ (SQLite)
Layer 4: @integrations  — context7/
Layer 5: @claude        — CLAUDE.md generation
         @agents        — agent marketplace
```

**Rule**: Layer N can only import from layers 0..(N-1)

## Where to Put New Code

| Type | Location |
|------|----------|
| Utility without deps | `@core/utils/` |
| File operations | `@core/fs/` |
| Output formatting | `@format/` |
| Input validation | `@security/` |
| Code pattern detection | `@detectors/<category>/` |
| AST parsing/analysis | `@ast/` |
| Project scanning | `@discovery/` |
| External API client | `@integrations/<name>/` |

## New Module Checklist

```
[ ] Can it live in existing module?
[ ] Layer dependencies respected?
[ ] Has index.ts barrel export?
[ ] Added to lib/index.ts if public?
[ ] pnpm typecheck passes?
```

## File Structure

```typescript
// @module/index.ts — barrel export
export { functionA, functionB } from './impl';
export type { TypeA, TypeB } from './types';

// Types next to implementation, not in separate types/ folder
```
