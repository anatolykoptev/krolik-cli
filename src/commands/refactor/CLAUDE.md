# Refactor Command — Development Guide

> `krolik refactor` — analyze codebase structure and suggest improvements

## Architecture Overview

```
refactor/
├── core/                 # Types, options, constants
├── analyzers/
│   ├── registry/         # ⭐ AnalyzerRegistry infrastructure
│   ├── modules/          # ⭐ ADD NEW ANALYZERS HERE
│   ├── metrics/          # Low-level analysis functions
│   ├── architecture/     # Architecture analysis
│   ├── context/          # Project context detection
│   └── ranking/          # PageRank-based analysis
├── output/
│   ├── registry/         # ⭐ SectionRegistry infrastructure
│   ├── sections/         # ⭐ ADD NEW SECTIONS HERE
│   ├── helpers/          # Formatting helpers, limits
│   └── *.ts              # Legacy formatters (being migrated)
├── runner/               # Execution orchestration
├── migration/            # Migration planning & execution
└── paths/                # Path resolution
```

## Registry-Based Architecture

### Core Concept

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      AnalyzerRegistry       │     │      SectionRegistry        │
├─────────────────────────────┤     ├─────────────────────────────┤
│ register(analyzer)          │     │ register(section)           │
│ runAll(ctx) → results       │ ──► │ formatAll(ctx) → lines      │
└─────────────────────────────┘     └─────────────────────────────┘
         │                                    │
         ▼                                    ▼
  Map<id, AnalyzerResult>              string[] (XML lines)
```

### Key Principle: Explicit Status

Every analyzer returns explicit status — **NEVER silent failures**:

```typescript
interface AnalyzerResult<T> {
  status: 'success' | 'skipped' | 'error';  // ← Always explicit
  data?: T;
  error?: string;
  durationMs?: number;
}
```

## Creating an Analyzer

### 1. Create `analyzers/modules/<name>.analyzer.ts`

```typescript
import type { Analyzer, AnalyzerResult } from '../registry';
import type { MyAnalysisData } from '../../core';

/**
 * @module commands/refactor/analyzers/modules/<name>.analyzer
 * @description Brief description of what this analyzer does
 */
export const myAnalyzer: Analyzer<MyAnalysisData> = {
  metadata: {
    id: 'my-analyzer',
    name: 'My Analyzer',
    description: 'Analyzes something important',
    defaultEnabled: true,
    cliFlag: '--include-my-analyzer',
    dependsOn: [],  // IDs of analyzers this depends on
  },

  shouldRun(ctx) {
    return ctx.options.includeMyAnalyzer !== false;
  },

  async analyze(ctx): Promise<AnalyzerResult<MyAnalysisData>> {
    // Perform analysis
    const data = doAnalysis(ctx.targetPath, ctx.projectRoot);

    // ALWAYS return success, even if no issues found
    return {
      status: 'success',
      data,
    };
  },
};
```

### 2. Register in `analyzers/modules/index.ts`

```typescript
import { analyzerRegistry } from '../registry';
import { myAnalyzer } from './my-analyzer.analyzer';

analyzerRegistry.register(myAnalyzer);

export { myAnalyzer };
```

### 3. Verify

```bash
npx tsx scripts/test-registry.ts
# Should show: ✓ my-analyzer (XXms) [has data]
```

## Creating a Section

### 1. Create `output/sections/<name>.section.ts`

```typescript
import type { Section, SectionContext } from '../registry';
import type { MyAnalysisData } from '../../core';
import { escapeXml } from '../../../../lib/@format';

/**
 * @module commands/refactor/output/sections/<name>.section
 * @description Renders the my-analysis section
 */
export const mySection: Section = {
  metadata: {
    id: 'my-section',
    name: 'My Analysis',
    description: 'Shows my analysis results',
    order: 50,  // Lower = renders earlier
    requires: ['my-analyzer'],  // Depends on this analyzer
    showWhen: 'always',  // 'always' | 'has-data' | 'has-issues' | 'on-success'
  },

  shouldRender(ctx) {
    const result = ctx.results.get('my-analyzer');
    return result?.status !== 'skipped';
  },

  render(lines, ctx) {
    const result = ctx.results.get('my-analyzer');

    // Handle error case
    if (result?.status === 'error') {
      lines.push(`  <my-analysis status="error">`);
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown')}</error>`);
      lines.push(`  </my-analysis>`);
      return;
    }

    const data = result?.data as MyAnalysisData | undefined;

    // Handle no data
    if (!data) {
      lines.push(`  <my-analysis status="no-data" />`);
      return;
    }

    // Normal rendering
    lines.push(`  <my-analysis count="${data.items.length}">`);
    // ... render data ...
    lines.push(`  </my-analysis>`);
    lines.push('');
  },
};
```

### 2. Register in `output/sections/modules.ts`

```typescript
import { sectionRegistry } from '../registry';
import { mySection } from './my-section.section';

sectionRegistry.register(mySection);

export { mySection };
```

## Core Imports

```typescript
// Registry
import { analyzerRegistry, type Analyzer } from './analyzers/registry';
import { sectionRegistry, type Section } from './output/registry';

// Types
import type { RefactorAnalysis, EnhancedRefactorAnalysis } from './core';

// Helpers
import { escapeXml, optimizeXml } from '@/lib/@format';
import { getLimits, type SectionLimits } from './output/limits';

// Running
import { runRegistryAnalysis } from './runner/registry-runner';
```

## Section Order Ranges

| Range | Category | Examples |
|-------|----------|----------|
| 0-19 | Header/Stats | stats, project-context |
| 20-39 | Config | ai-config |
| 40-59 | Architecture | architecture-health, ranking |
| 60-79 | Analysis | recommendations, domains |
| 80-99 | Details | duplicates, migration, file-size |
| 100+ | Footer | ai-navigation |

## Analyzer Dependencies

```
projectContext ─────────────────────────────┐
     │                                       │
     ├───► architecture ───► domains         │
     │           │                           │
     │           └───► ranking               │
     │                    │                  │
     └───► recommendations ◄─────────────────┘

fileSize ─────────► (independent)
reusable ─────────► (independent)
duplicates ───────► (independent)
```

## Best Practices

### DO ✅

```typescript
// Return explicit status
return { status: 'success', data };

// Log errors (never silent)
ctx.logger?.warn?.(`Analysis failed: ${error.message}`);
return { status: 'error', error: error.message };

// Check analyzer results by status, not data
if (result?.status === 'success') { ... }

// Show healthy state when no issues
lines.push(`<my-analysis issues="0" status="healthy" />`);

// Use escapeXml for user data
lines.push(`<item name="${escapeXml(item.name)}" />`);
```

### DON'T ❌

```typescript
// Silent catch
catch { /* silently skip */ }  // ❌ NEVER

// Check data existence for logic
if (data && data.issues.length > 0) { store }  // ❌ Use status

// Duplicate logic in multiple places
if (issues.length > 0) // in analyzer
if (issues.length === 0) // in section  // ❌ Single point of decision

// Hardcoded limits
const items = data.slice(0, 10);  // ❌ Use limits from context
const items = data.slice(0, ctx.limits.myLimit);  // ✅
```

## Checklist

### New Analyzer

- [ ] Created `analyzers/modules/<name>.analyzer.ts`
- [ ] Metadata has unique `id`, descriptive `name`, `description`
- [ ] `shouldRun()` checks options correctly
- [ ] `analyze()` ALWAYS returns `{ status, data }`, never throws silently
- [ ] Registered in `analyzers/modules/index.ts`
- [ ] Shows in test: `npx tsx scripts/test-registry.ts`

### New Section

- [ ] Created `output/sections/<name>.section.ts`
- [ ] Metadata has correct `order` and `requires`
- [ ] `shouldRender()` checks analyzer status
- [ ] `render()` handles: error, no-data, no-issues, has-issues
- [ ] Uses `escapeXml()` for all user data
- [ ] Registered in `output/sections/modules.ts`

### Testing

- [ ] Run `pnpm typecheck`
- [ ] Run `npx tsx scripts/test-registry.ts`
- [ ] Verify output contains new section
- [ ] Check verbose mode shows analyzer status

## Debug Mode

```bash
# Run with verbose output
npx tsx scripts/test-registry.ts

# Output shows:
# ✓ file-size (124ms) [has data]
# ○ my-analyzer (skipped) → Analyzer returned false from shouldRun()
# ✗ broken-analyzer (5ms) → Error message here
```

## Migration from Legacy

When migrating from `enhanced.ts` to registry:

1. **Extract analyzer logic** → `modules/<name>.analyzer.ts`
2. **Extract format logic** → `sections/<name>.section.ts`
3. **Remove from enhanced.ts** — delete the direct call
4. **Remove from ai-native.ts** — delete the direct format call
5. **Test** — verify output matches

## Files Reference

| File | Purpose |
|------|---------|
| `analyzers/registry/types.ts` | Analyzer, AnalyzerResult, AnalyzerContext |
| `analyzers/registry/registry.ts` | AnalyzerRegistry class |
| `output/registry/types.ts` | Section, SectionContext, OutputLevel |
| `output/registry/registry.ts` | SectionRegistry class |
| `runner/registry-runner.ts` | Integration runner with debug output |
| `scripts/test-registry.ts` | Test script for new architecture |
