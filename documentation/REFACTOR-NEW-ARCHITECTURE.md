# Refactor Command: New Architecture Proposal

## Problem Statement

Current architecture has **logic split across multiple files**:

```
enhanced.ts:214  → if (fileSizeAnalysis.issues.length > 0) { store }
file-size.ts:27  → if (issues.length === 0) { output empty tag }
```

This makes debugging impossible — you don't know:
- Did the analyzer run?
- Did it find anything?
- Did it fail silently?

---

## Solution: Registry-Based Architecture

Inspired by the existing `FixerRegistry` in `commands/fix/core/registry.ts`.

### Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW                             │
│                                                                 │
│  enhanced.ts                                                     │
│  ├─ detectProjectContext()     ← hardcoded call                  │
│  ├─ analyzeArchHealth()        ← hardcoded call                  │
│  ├─ classifyDomains()          ← hardcoded call                  │
│  ├─ analyzeFileSizes()         ← hardcoded call + silent catch   │
│  ├─ analyzeRanking()           ← hardcoded call + silent catch   │
│  └─ ... manual assembly ...                                      │
│                                                                 │
│  PROBLEMS:                                                       │
│  - God object knows about all analyzers                          │
│  - Silent failures                                               │
│  - No status tracking                                            │
│  - Logic duplicated in formatters                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          NEW FLOW                                │
│                                                                 │
│  AnalyzerRegistry                                                │
│  ├─ register(fileSizeAnalyzer)                                   │
│  ├─ register(rankingAnalyzer)                                    │
│  ├─ register(domainsAnalyzer)                                    │
│  └─ runAll() → Map<string, AnalyzerResult>                       │
│                                                                 │
│  SectionRegistry                                                 │
│  ├─ register(fileSizeSection)                                    │
│  ├─ register(rankingSection)                                     │
│  └─ formatAll(results) → string[]                                │
│                                                                 │
│  BENEFITS:                                                       │
│  - Each analyzer is independent                                  │
│  - Status tracking (success/skipped/error)                       │
│  - Single point of decision (registry)                           │
│  - Easy to add new modules                                       │
│  - Debug mode shows what ran and why                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Analyzer Interface

```typescript
// src/commands/refactor/analyzers/registry/types.ts

export type AnalyzerStatus = 'success' | 'skipped' | 'error';

export interface AnalyzerResult<T = unknown> {
  status: AnalyzerStatus;
  data?: T;
  error?: string;
  durationMs?: number;
}

export interface AnalyzerContext {
  projectRoot: string;
  targetPath: string;
  baseAnalysis: RefactorAnalysis;
  options: RefactorOptions;
  logger?: Logger;
}

export interface AnalyzerMetadata {
  id: string;
  name: string;
  description: string;
  /** Dependencies on other analyzers (run after them) */
  dependsOn?: string[];
  /** Default enabled state */
  defaultEnabled?: boolean;
  /** CLI flag to enable/disable */
  cliFlag?: string;
}

export interface Analyzer<T = unknown> {
  metadata: AnalyzerMetadata;

  /** Should this analyzer run given current options? */
  shouldRun(ctx: AnalyzerContext): boolean;

  /** Execute analysis */
  analyze(ctx: AnalyzerContext): Promise<AnalyzerResult<T>>;
}
```

### 2. Analyzer Registry

```typescript
// src/commands/refactor/analyzers/registry/registry.ts

export class AnalyzerRegistry {
  private analyzers = new Map<string, Analyzer>();

  register(analyzer: Analyzer): void {
    this.analyzers.set(analyzer.metadata.id, analyzer);
  }

  /**
   * Run all enabled analyzers in dependency order
   * Returns a map of analyzer id -> result
   */
  async runAll(ctx: AnalyzerContext): Promise<Map<string, AnalyzerResult>> {
    const results = new Map<string, AnalyzerResult>();
    const sorted = this.topologicalSort();

    for (const analyzer of sorted) {
      const start = performance.now();

      // Check if should run
      if (!analyzer.shouldRun(ctx)) {
        results.set(analyzer.metadata.id, {
          status: 'skipped',
          durationMs: 0,
        });
        continue;
      }

      // Check dependencies
      const depsFailed = analyzer.metadata.dependsOn?.some(
        dep => results.get(dep)?.status === 'error'
      );

      if (depsFailed) {
        results.set(analyzer.metadata.id, {
          status: 'skipped',
          error: 'Dependency failed',
        });
        continue;
      }

      // Run analyzer
      try {
        const result = await analyzer.analyze(ctx);
        results.set(analyzer.metadata.id, {
          ...result,
          durationMs: performance.now() - start,
        });
      } catch (error) {
        // NEVER silent! Always log and record error
        const errorMsg = error instanceof Error ? error.message : String(error);
        ctx.logger?.warn?.(`Analyzer '${analyzer.metadata.id}' failed: ${errorMsg}`);

        results.set(analyzer.metadata.id, {
          status: 'error',
          error: errorMsg,
          durationMs: performance.now() - start,
        });
      }
    }

    return results;
  }

  private topologicalSort(): Analyzer[] {
    // Sort by dependencies
    // ...implementation
  }
}

export const analyzerRegistry = new AnalyzerRegistry();
```

### 3. Example Analyzer: File Size

```typescript
// src/commands/refactor/analyzers/modules/file-size.analyzer.ts

import type { Analyzer, AnalyzerContext, AnalyzerResult } from '../registry/types';
import type { FileSizeAnalysis } from '../../core';
import { analyzeFileSizes } from '../metrics/file-size';

export const fileSizeAnalyzer: Analyzer<FileSizeAnalysis> = {
  metadata: {
    id: 'file-size',
    name: 'File Size Analysis',
    description: 'Detects oversized files that should be split',
    defaultEnabled: true,
    cliFlag: '--include-file-size',
  },

  shouldRun(ctx) {
    // Configurable via options
    return ctx.options.includeFileSize !== false;
  },

  async analyze(ctx): Promise<AnalyzerResult<FileSizeAnalysis>> {
    const srcRoot = path.dirname(ctx.targetPath);
    const analysis = analyzeFileSizes(srcRoot, ctx.projectRoot);

    // ALWAYS return success, even if no issues
    // The decision to show or not is in the formatter
    return {
      status: 'success',
      data: analysis,
    };
  },
};
```

### 4. Section Interface

```typescript
// src/commands/refactor/output/registry/types.ts

export interface SectionContext {
  results: Map<string, AnalyzerResult>;
  limits: SectionLimits;
  outputLevel: OutputLevel;
}

export interface SectionMetadata {
  id: string;
  name: string;
  /** Render order (lower = earlier) */
  order: number;
  /** Required analyzer IDs */
  requires?: string[];
  /** When to show this section */
  showWhen?: 'always' | 'has-data' | 'has-issues';
}

export interface Section {
  metadata: SectionMetadata;

  /** Should this section be rendered? */
  shouldRender(ctx: SectionContext): boolean;

  /** Render section to lines */
  render(lines: string[], ctx: SectionContext): void;
}
```

### 5. Section Registry

```typescript
// src/commands/refactor/output/registry/registry.ts

export class SectionRegistry {
  private sections = new Map<string, Section>();

  register(section: Section): void {
    this.sections.set(section.metadata.id, section);
  }

  /**
   * Format all sections in order
   */
  formatAll(ctx: SectionContext): string[] {
    const lines: string[] = [];

    // Sort by order
    const sorted = [...this.sections.values()]
      .sort((a, b) => a.metadata.order - b.metadata.order);

    for (const section of sorted) {
      // Check requirements
      const requirementsMet = section.metadata.requires?.every(
        req => ctx.results.get(req)?.status === 'success'
      ) ?? true;

      if (!requirementsMet) {
        // Add comment explaining why skipped
        lines.push(`  <!-- ${section.metadata.name}: skipped (dependency not available) -->`);
        continue;
      }

      // Check if should render
      if (!section.shouldRender(ctx)) {
        continue;
      }

      // Render section
      section.render(lines, ctx);
    }

    return lines;
  }
}

export const sectionRegistry = new SectionRegistry();
```

### 6. Example Section: File Size

```typescript
// src/commands/refactor/output/sections/file-size.section.ts

import type { Section, SectionContext } from '../registry/types';
import type { FileSizeAnalysis } from '../../core';

export const fileSizeSection: Section = {
  metadata: {
    id: 'file-size',
    name: 'File Size Analysis',
    order: 90, // Near the end
    requires: ['file-size'], // Requires file-size analyzer
    showWhen: 'always', // Always show, even if no issues
  },

  shouldRender(ctx) {
    const result = ctx.results.get('file-size');

    // Show if analyzer ran (success or error)
    // Skip only if analyzer was skipped
    return result?.status !== 'skipped';
  },

  render(lines, ctx) {
    const result = ctx.results.get('file-size');

    // Handle error case
    if (result?.status === 'error') {
      lines.push(`  <file-size-analysis status="error">`);
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push(`  </file-size-analysis>`);
      return;
    }

    const data = result?.data as FileSizeAnalysis | undefined;

    // Handle no data (shouldn't happen but be safe)
    if (!data) {
      lines.push(`  <file-size-analysis status="no-data" />`);
      return;
    }

    // Handle no issues - STILL SHOW with count
    if (data.issues.length === 0) {
      lines.push(`  <!-- File size analysis: all files within limits -->`);
      lines.push(`  <file-size-analysis total-files="${data.totalFiles}" issues="0" status="healthy" />`);
      return;
    }

    // Normal rendering with issues
    // ... existing logic ...
  },
};
```

---

## New File Structure

```
src/commands/refactor/
├── index.ts
├── command.ts
│
├── core/
│   ├── types.ts
│   └── options.ts
│
├── analyzers/
│   ├── index.ts                    # Exports all + registers
│   │
│   ├── registry/                   # NEW: Registry infrastructure
│   │   ├── types.ts                # Analyzer interfaces
│   │   ├── registry.ts             # AnalyzerRegistry class
│   │   └── index.ts
│   │
│   └── modules/                    # NEW: Individual analyzers
│       ├── project-context.analyzer.ts
│       ├── architecture.analyzer.ts
│       ├── domains.analyzer.ts
│       ├── duplicates.analyzer.ts
│       ├── file-size.analyzer.ts
│       ├── ranking.analyzer.ts
│       ├── reusable.analyzer.ts
│       └── index.ts                # Auto-registers all
│
├── output/
│   ├── index.ts
│   │
│   ├── registry/                   # NEW: Section registry
│   │   ├── types.ts                # Section interfaces
│   │   ├── registry.ts             # SectionRegistry class
│   │   └── index.ts
│   │
│   └── sections/                   # Refactored sections
│       ├── stats.section.ts
│       ├── project-context.section.ts
│       ├── architecture.section.ts
│       ├── domains.section.ts
│       ├── duplicates.section.ts
│       ├── file-size.section.ts
│       ├── ranking.section.ts
│       ├── reusable.section.ts
│       ├── migration.section.ts
│       └── index.ts                # Auto-registers all
│
└── runner/
    └── analysis.ts                 # Uses registries
```

---

## New Main Flow

```typescript
// src/commands/refactor/runner/analysis.ts

import { analyzerRegistry } from '../analyzers/registry';
import { sectionRegistry } from '../output/registry';

export async function runRefactorAnalysis(
  projectRoot: string,
  targetPath: string,
  options: RefactorOptions,
): Promise<string> {
  // 1. Create context
  const ctx: AnalyzerContext = {
    projectRoot,
    targetPath,
    baseAnalysis: await createBaseAnalysis(targetPath, options),
    options,
    logger: createLogger(options),
  };

  // 2. Run all analyzers
  const results = await analyzerRegistry.runAll(ctx);

  // 3. Log summary (debug mode)
  if (options.verbose) {
    logAnalyzerSummary(results);
  }

  // 4. Format output
  const sectionCtx: SectionContext = {
    results,
    limits: getLimits(options.outputLevel),
    outputLevel: options.outputLevel ?? 'standard',
  };

  const lines = sectionRegistry.formatAll(sectionCtx);

  return wrapInXml(lines, options);
}

function logAnalyzerSummary(results: Map<string, AnalyzerResult>): void {
  console.log('\nAnalyzer Summary:');
  for (const [id, result] of results) {
    const icon = result.status === 'success' ? '✓'
               : result.status === 'skipped' ? '○'
               : '✗';
    const time = result.durationMs ? ` (${result.durationMs.toFixed(0)}ms)` : '';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`  ${icon} ${id}${time}${error}`);
  }
}
```

---

## Benefits

### 1. Single Point of Decision

- Analyzer decides: should I run?
- Registry decides: execute and track status
- Section decides: should I render?

No duplicate logic!

### 2. Explicit Status Tracking

Every analyzer returns:
```typescript
{ status: 'success' | 'skipped' | 'error', data?, error?, durationMs? }
```

### 3. Never Silent Failures

```typescript
// OLD
catch { /* Silently skip */ }

// NEW
catch (error) {
  logger.warn(`Analyzer failed: ${error.message}`);
  return { status: 'error', error: error.message };
}
```

### 4. Debug Mode

```
Analyzer Summary:
  ✓ project-context (12ms)
  ✓ architecture (45ms)
  ✓ domains (23ms)
  ✓ duplicates (156ms)
  ✓ file-size (8ms) ← NOW WE KNOW IT RAN
  ○ ranking (skipped - no dependency graph)
  ✓ reusable (234ms)
```

### 5. Easy Extension

Adding a new analyzer:

```typescript
// 1. Create analyzer
export const myAnalyzer: Analyzer<MyData> = {
  metadata: { id: 'my-analyzer', name: 'My Analyzer', order: 50 },
  shouldRun: () => true,
  analyze: async (ctx) => ({ status: 'success', data: await myLogic(ctx) }),
};

// 2. Register (auto via index.ts)
analyzerRegistry.register(myAnalyzer);

// 3. Create section
export const mySection: Section = {
  metadata: { id: 'my-section', requires: ['my-analyzer'], order: 55 },
  shouldRender: (ctx) => ctx.results.get('my-analyzer')?.status === 'success',
  render: (lines, ctx) => { /* ... */ },
};

// 4. Register section
sectionRegistry.register(mySection);
```

That's it! No changes to `enhanced.ts` or `ai-native.ts` needed.

---

## Migration Path

### Phase 1: Infrastructure (1-2 days)
- Create `analyzers/registry/` with types and registry
- Create `output/registry/` with types and registry
- Add tests for registries

### Phase 2: First Analyzer Migration (1 day)
- Migrate `file-size` analyzer as proof of concept
- Migrate `file-size` section
- Verify output matches current

### Phase 3: Remaining Analyzers (2-3 days)
- Migrate all other analyzers
- Migrate all other sections
- Deprecate `enhanced.ts`

### Phase 4: Cleanup (1 day)
- Remove old code
- Update documentation
- Add verbose/debug output

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Decision points | 2+ per module | 1 per module |
| Error handling | Silent catch | Logged + tracked |
| Status visibility | None | Explicit status |
| Adding modules | Modify 3+ files | Create 2 files |
| Debug capability | None | Full summary |
| Testability | Hard | Easy (mock registry) |
