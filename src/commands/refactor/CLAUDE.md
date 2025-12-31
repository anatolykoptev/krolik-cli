# Refactor Command

> `krolik refactor` — analyze codebase structure and suggest improvements

## Architecture

```
refactor/
├── core/                 # Types, options, constants
├── analyzers/
│   ├── registry/         # AnalyzerRegistry
│   ├── modules/          # ⭐ ADD ANALYZERS HERE
│   ├── core/duplicates/  # Duplicate detection
│   └── metrics/          # Low-level functions
├── output/
│   ├── registry/         # SectionRegistry
│   ├── sections/         # ⭐ ADD SECTIONS HERE
│   └── helpers/          # Formatting, limits
├── runner/               # Execution orchestration
└── migration/            # Migration planning
```

## Registry Pattern

```
AnalyzerRegistry              SectionRegistry
┌─────────────────┐          ┌─────────────────┐
│ register()      │          │ register()      │
│ runAll() → Map  │ ──────►  │ formatAll()     │
└─────────────────┘          └─────────────────┘
```

```typescript
interface AnalyzerResult<T> {
  status: 'success' | 'skipped' | 'error';
  data?: T;
}
```

## Analyzer → Section Mapping

| Analyzer | Section | Order | Data |
|----------|---------|-------|------|
| — | stats | 1 | Aggregates all |
| project-context | project-context | 5 | Tech stack |
| architecture | architecture | 40 | Health score |
| ranking | ranking | 45 | PageRank |
| domains | domains | 50 | Coherence |
| arch + domains | ai-config | 55 | Namespaces |
| recommendations | recommendations | 60 | Fixes |
| i18n | i18n | 65 | Translations |
| api | api | 68 | tRPC routes |
| migration | migration | 70 | Imports |
| duplicates | duplicates | 80 | Clones |
| reusable | reusable | 85 | Modules |
| file-size | file-size | 90 | Size |
| navigation | navigation | 95 | AI hints |

## Adding an Analyzer

### 1. Create `analyzers/modules/<name>.analyzer.ts`

```typescript
export const myAnalyzer: Analyzer<MyData> = {
  metadata: { id: 'my-analyzer', name: 'My Analyzer', dependsOn: [] },
  shouldRun: (ctx) => true,
  analyze: async (ctx) => ({ status: 'success', data }),
};
```

### 2. Register in `analyzers/modules/index.ts`

```typescript
analyzerRegistry.register(myAnalyzer);
```

### 3. Create `output/sections/<name>.section.ts`

```typescript
export const mySection: Section = {
  metadata: { id: 'my-section', order: 50, requires: ['my-analyzer'] },
  shouldRender: (ctx) => ctx.results.get('my-analyzer')?.status === 'success',
  render: (lines, ctx) => { /* XML output */ },
};
```

### 4. Register in `output/sections/modules.ts`

```typescript
sectionRegistry.register(mySection);
```

## Best Practices

```typescript
// ✅ DO
return { status: 'success', data };
return { status: 'error', error: msg };
lines.push(`<item name="${escapeXml(name)}" />`);

// ❌ DON'T
catch { /* silent */ }              // Always handle errors
data.slice(0, 10)                   // Use ctx.limits
if (data?.length) { ... }           // Check status, not data
```

## Checklist

### New Analyzer
- [ ] `analyzers/modules/<name>.analyzer.ts`
- [ ] Unique `id` in metadata
- [ ] `analyze()` returns `{ status, data }`
- [ ] Registered in `index.ts`

### New Section
- [ ] `output/sections/<name>.section.ts`
- [ ] Correct `order` and `requires`
- [ ] Handles: error, no-data, success
- [ ] Registered in `modules.ts`

## Testing

```bash
npx tsx scripts/test-registry.ts
# ✓ file-size (124ms) [has data]
# ○ my-analyzer (skipped)
# ✗ broken-analyzer → Error message
```

## Related

- Duplicate detection: `lib/@detectors/CLAUDE.md`
- Dependencies: see `analyzers/modules/index.ts`
