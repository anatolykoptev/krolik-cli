# Context Command

> `krolik context` — generate AI-optimized codebase context

## Structure

```text
context/
├── index.ts              # buildAiContextData()
├── types.ts              # AiContextData, ContextOptions
├── domains.ts            # Domain detection
├── smart-context.ts      # PageRank file ranking
├── collectors/           # entrypoints, data-flow, constraints
├── repomap/              # tag-extractor, ranking, formatter
├── formatters/ai/        # XML output, sections/
└── parsers/              # File content parsers
```

## Context Modes

| Mode    | ~Tokens | Sections                             |
|---------|---------|--------------------------------------|
| minimal | 1500    | quick-ref, summary, git, memory      |
| quick   | 2500    | + repo-map, schema, routes           |
| deep    | 4000    | + types, imports, env, api-contracts |
| full    | 6000    | + audit, all sections                |

## Section Priority

**P0 (Critical):** quick-ref, ptcf, summary, constraints
**P1 (High):** git, repo-map, schema, routes, entrypoints, data-flow
**P2 (Medium):** memory, lib-modules, architecture
**P3 (Low):** tree, github-issues, todos, library-docs

## Adding a Section

1. Create `formatters/ai/sections/<name>.ts`:

```typescript
export function formatMySection(lines: string[], data: AiContextData): void {
  if (!data.myData?.length) return;
  lines.push('  <my-section>');
  for (const item of data.myData.slice(0, 10)) {
    lines.push(`    <item name="${escapeXml(item.name)}" />`);
  }
  lines.push('  </my-section>');
}
```

1. Export in `sections/index.ts`
1. Call in `formatters/ai/index.ts`

## Adding a Collector

1. Create `collectors/<name>.ts`:

```typescript
export async function collectMyData(
  projectRoot: string,
  domains: string[],
): Promise<MyData[]> {
  return results;
}
```

1. Export in `collectors/index.ts`
1. Call in `buildAiContextData()` in `index.ts`

## Key Functions

| Function                  | Purpose              |
|---------------------------|----------------------|
| `buildAiContextData()`    | Main orchestrator    |
| `buildSmartContext()`     | PageRank repo-map    |
| `formatAiPrompt()`        | XML output           |
| `applyDomainFiltering()`  | ~40% token reduction |
| `deduplicateSignatures()` | Remove re-exports    |

## Domain Filtering

With `--feature booking`, all sections are filtered:

```text
Before: 78 models, 83 routers, 50 files
After:  4 models,  8 routers, 15 files (~40% reduction)
```

## Mode Limits (constants.ts)

```typescript
const MODE_LIMITS = {
  quick:   { maxFiles: 30, sigsPerFile: 5 },
  deep:    { maxFiles: 40, sigsPerFile: 8 },
  full:    { maxFiles: 50, sigsPerFile: 10 },
  minimal: { maxFiles: 10, sigsPerFile: 3 },
};
```

## Best Practices

```typescript
if (!data.mySection?.length) return;           // Early return for empty
lines.push(`<x name="${escapeXml(name)}" />`); // Always escape XML
const limited = items.slice(0, limits.max);    // Respect mode limits
```
