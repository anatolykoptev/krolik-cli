# Context Command

> `krolik context` — generate AI-optimized codebase context for LLM agents

## Architecture

```
context/
├── index.ts              # Main entry, buildAiContextData()
├── types.ts              # AiContextData, ContextOptions, ContextMode
├── domains.ts            # Domain detection from task/feature
├── smart-context.ts      # PageRank-based file ranking
├── collectors/           # Data collectors (Phase 6-7)
│   ├── entrypoints.ts    # detectEntryPoints() — WHERE to start
│   ├── data-flow.ts      # generateDataFlows() — HOW data moves
│   └── constraints.ts    # collectConstraints() — WHAT to avoid
├── repomap/              # Aider-style repository map
│   ├── tag-extractor.ts  # SWC-based symbol extraction
│   ├── ranking.ts        # PageRank algorithm
│   ├── formatter.ts      # XML output, deduplication
│   └── types.ts          # Tag, Signature, RankedFile
├── formatters/ai/        # XML output formatting
│   ├── index.ts          # formatAiPrompt(), applyDomainFiltering()
│   ├── constants.ts      # Mode limits (quick/deep/full)
│   ├── filters.ts        # matchesDomain(), modelMatchesDomain()
│   └── sections/         # ⭐ ADD SECTIONS HERE
├── parsers/              # File content parsers
└── helpers/              # Shared utilities
```

## Context Modes

```
┌─────────────────────────────────────────────────────────────┐
│ Mode     │ Tokens │ Sections                                │
├─────────────────────────────────────────────────────────────┤
│ minimal  │ ~1500  │ quick-ref, summary, git, memory         │
│ quick    │ ~2500  │ + repo-map, schema-highlights, routes   │
│ deep     │ ~4000  │ + types, imports, env, api-contracts    │
│ full     │ ~6000  │ + audit, all sections                   │
└─────────────────────────────────────────────────────────────┘
```

## Section Priority (P0 → P3)

```
P0 (Critical ~400 tokens):
├── quick-ref      — hot files, staged changes, next-actions
├── ptcf           — Persona, Task, Context, Format (AI grounding)
├── summary        — task, domains, recommendations
└── constraints    — cascade, concurrency, validation rules

P1 (High — core understanding):
├── git            — branch, changed files, recent commits
├── repo-map       — PageRank-ranked files with signatures
├── schema         — Prisma models (filtered by domain)
├── routes         — tRPC routers (filtered by domain)
├── entrypoints    — WHERE to start (backend/frontend/database)
└── data-flow      — HOW data moves through the system

P2 (Medium — context enrichment):
├── memory         — Previous session decisions/patterns
├── lib-modules    — Reusable lib/@* modules
└── architecture   — Detected patterns (hooks, stores, etc.)

P3 (Low — details on demand):
├── tree           — Directory structure
├── github-issues  — Open issues from gh CLI
├── todos          — TODO/FIXME comments
└── library-docs   — Context7 documentation
```

## Data Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ CLI Options  │ ─► │ buildAiData  │ ─► │ formatPrompt │
│ --feature    │    │              │    │              │
│ --quick      │    │ collectors   │    │ sections     │
│ --project    │    │ smart-context│    │ filters      │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ AiContextData│
                    │ - domains    │
                    │ - schema     │
                    │ - routes     │
                    │ - repoMap    │
                    │ - entryPoints│
                    └──────────────┘
```

## Adding a Section

### 1. Create `formatters/ai/sections/<name>.ts`

```typescript
import type { AiContextData } from '../../../types';

export function formatMySection(lines: string[], data: AiContextData): void {
  if (!data.myData || data.myData.length === 0) return;

  lines.push('  <my-section>');
  for (const item of data.myData.slice(0, 10)) {
    lines.push(`    <item name="${escapeXml(item.name)}" />`);
  }
  lines.push('  </my-section>');
}
```

### 2. Export in `formatters/ai/sections/index.ts`

```typescript
export { formatMySection } from './my-section';
```

### 3. Call in `formatters/ai/index.ts`

```typescript
// P2: Medium priority
formatMySection(lines, filteredData);
```

## Adding a Collector

### 1. Create `collectors/<name>.ts`

```typescript
export interface MyData {
  name: string;
  value: number;
}

export async function collectMyData(
  projectRoot: string,
  domains: string[],
): Promise<MyData[]> {
  // Collect data...
  return results;
}
```

### 2. Export in `collectors/index.ts`

```typescript
export { collectMyData } from './my-data';
```

### 3. Call in `index.ts` (buildAiContextData)

```typescript
const myData = await collectMyData(projectRoot, result.domains);
if (myData.length > 0) {
  aiData.myData = myData;
}
```

## Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `buildAiContextData()` | index.ts | Main orchestrator |
| `buildSmartContext()` | smart-context.ts | PageRank repo-map |
| `formatAiPrompt()` | formatters/ai/index.ts | XML output |
| `applyDomainFiltering()` | formatters/ai/index.ts | ~40% token reduction |
| `detectEntryPoints()` | collectors/entrypoints.ts | Find entry files |
| `generateDataFlows()` | collectors/data-flow.ts | Data flow diagrams |
| `collectConstraints()` | collectors/constraints.ts | Critical rules |
| `deduplicateSignatures()` | repomap/formatter.ts | Remove re-exports |

## Domain Filtering

When `--feature booking` is used, ALL sections are filtered:

```typescript
// Before: 78 models, 83 routers, 50 files
// After:  4 models,  8 routers, 15 files (~40% reduction)

const filteredData = applyDomainFiltering(data);
```

Functions in `filters.ts`:
- `matchesDomain(fileName, domains)` — file name contains domain
- `modelMatchesDomain(model, domains)` — Prisma model matches
- `routerMatchesDomain(router, domains)` — tRPC router matches

## Signature Sorting (Usage-Based)

Exports are sorted by reference count (most-used first):

```typescript
// In smart-context.ts
const refs = graph.references.get(tag.name)?.length ?? 0;

// Sort by refs descending
.sort((a, b) => (b.refs ?? 0) - (a.refs ?? 0))
```

## Best Practices

```typescript
// ✅ DO
if (!data.mySection || data.mySection.length === 0) return;
lines.push(`<item name="${escapeXml(name)}" />`);
const limited = items.slice(0, limits.maxItems);

// ❌ DON'T
// Skip early return — wastes tokens on empty sections
// Forget escapeXml — breaks XML parsing
// Ignore mode limits — exceeds token budget
```

## Mode-Based Limits

From `constants.ts`:

```typescript
const MODE_LIMITS = {
  quick:   { maxFiles: 30, sigsPerFile: 5, summaryOnly: true },
  deep:    { maxFiles: 40, sigsPerFile: 8, summaryOnly: false },
  full:    { maxFiles: 50, sigsPerFile: 10, summaryOnly: false },
  minimal: { maxFiles: 10, sigsPerFile: 3, summaryOnly: true },
};
```

## Testing

```bash
# Quick test with domain filter
krolik context --project piternow-wt-fix --quick --feature booking

# Full context
krolik context --project piternow-wt-fix --full

# Check token count
krolik context --quick | wc -c
```

## Related

- Smart Context plan: `docs/SMART-CONTEXT-PLAN.md`
- Repomap types: `repomap/types.ts`
- Section constants: `formatters/ai/constants.ts`
