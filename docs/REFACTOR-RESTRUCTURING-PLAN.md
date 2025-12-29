# Krolik CLI Refactor Command - Restructuring Plan

> Generated: 2025-12-29
> Author: Claude AI Analysis
> Purpose: Comprehensive plan for improving code quality and scalability of the refactor command

---

## Executive Summary

The `refactor` command in krolik-cli has grown organically and accumulated technical debt that hinders maintainability and feature addition. This document outlines a phased restructuring plan based on deep analysis of the current architecture.

### Key Metrics (Current State)

| Metric | Value | Target |
|--------|-------|--------|
| Structure Score | 66/100 | 85/100 |
| Architecture Score | 95/100 | 98/100 |
| Function Duplicates | 190 | <20 |
| Circular Dependencies | 5 | 0 |
| Oversized Files (>300 LOC) | 41 | <10 |
| Critical Files (>800 LOC) | 1 | 0 |

---

## Part 1: Root Cause Analysis

### 1.1 The `analyzeFileSizes` Output Issue

**Symptom:** File size analysis doesn't appear in final report despite being executed.

**Root Cause:** Conditional storage logic in `enhanced.ts:214-216`:

```typescript
// PROBLEM: Only stores if issues exist
if (fileSizeAnalysis && fileSizeAnalysis.issues.length > 0) {
  result.fileSizeAnalysis = fileSizeAnalysis;
}
```

**Secondary Issue:** Silent exception handling in `enhanced.ts:185`:

```typescript
try {
  fileSizeAnalysis = analyzeFileSizes(srcRoot, projectRoot);
} catch {
  // Silently skip if file size analysis fails ← NO LOGGING
}
```

**Impact:**
- Users can't distinguish between "no issues found" and "analysis failed"
- Empty `<file-size-analysis />` in output is ambiguous

### 1.2 Architectural Issues

#### Circular Dependencies in Migration Module

```
orchestrator.ts ←→ barrel-handler.ts
orchestrator.ts ←→ delete-handler.ts
orchestrator.ts ←→ import-handler.ts
orchestrator.ts ←→ merge-handler.ts
orchestrator.ts ←→ move-handler.ts
```

**Fix:** Extract shared types to `migration/types.ts` and use dependency injection.

#### Oversized Files (Critical/Error)

| File | Lines | Severity | Action |
|------|-------|----------|--------|
| `fix/analyzers/unified-swc.ts` | 966 | CRITICAL | Split into 7 modules |
| `refactor/analyzers/i18n/analyzer.ts` | 778 | ERROR | Split into 6 modules |
| `context/index.ts` | 639 | ERROR | Extract helpers |
| `fix/analyzers/complexity-swc.ts` | 564 | ERROR | Split by concern |
| `docs/index.ts` | 554 | ERROR | Extract formatters |
| `context/repomap/tag-extractor.ts` | 541 | ERROR | Split by AST type |
| `agent/orchestrator.ts` | 540 | ERROR | Extract utilities |

### 1.3 Duplicate Code Hotspots

**Top Duplicates in Refactor Command:**

| Function | Locations | Fix |
|----------|-----------|-----|
| `sourceFiles` | 5 files | Move to `shared/helpers.ts` |
| `files` | 3 files | Merge to single location |
| `tokens` | 3 files | Extract to `shared/tokenization.ts` |
| `calculateGroupSimilarity` | 2 files | Keep in `shared/similarity.ts` |
| `visualizeStructure` | 2 files | Keep in `output/text.ts` only |

### 1.4 Output Pipeline Gaps

**Missing Formatters:**
- `structure` field - collected but not formatted
- `StandardsCompliance` - never formatted

**Inconsistent Limits:**
- `hotspots`: hardcoded to 10 (should use `SectionLimits`)
- `couplingMetrics`: hardcoded to 10
- `safeOrderPhases`: hardcoded to 10
- `reusableModules`: hardcoded to 15
- `fileSizeIssues`: NO LIMIT applied

---

## Part 2: Restructuring Plan

### Phase 1: Critical Fixes (Week 1)

#### 1.1 Fix `analyzeFileSizes` Output Issue

**File:** `src/commands/refactor/analyzers/enhanced.ts`

**Changes:**

```typescript
// BEFORE (line 214-216)
if (fileSizeAnalysis && fileSizeAnalysis.issues.length > 0) {
  result.fileSizeAnalysis = fileSizeAnalysis;
}

// AFTER - Always include analysis results
if (fileSizeAnalysis) {
  result.fileSizeAnalysis = fileSizeAnalysis;
}
```

**Add logging for exceptions:**

```typescript
// BEFORE (line 185)
catch {
  // Silently skip
}

// AFTER
catch (error) {
  logger?.warn?.(`File size analysis failed: ${error instanceof Error ? error.message : 'unknown'}`);
}
```

#### 1.2 Break Circular Dependencies

**Create:** `src/commands/refactor/migration/types.ts`

```typescript
// Extract shared interfaces
export interface MigrationOrchestrator {
  execute(actions: MigrationAction[]): Promise<MigrationResult>;
}

export interface MigrationHandler {
  handle(action: MigrationAction, ctx: MigrationContext): Promise<void>;
}

export interface MigrationContext {
  projectRoot: string;
  dryRun: boolean;
  orchestrator: MigrationOrchestrator;
}
```

**Update handlers to import from types.ts instead of orchestrator.ts**

### Phase 2: Consolidate Duplicates (Week 2)

#### 2.1 Create Shared Utilities Module

**Create:** `src/commands/refactor/shared/index.ts`

```typescript
// Re-export all shared utilities
export * from './helpers';
export * from './similarity';
export * from './tokenization';
export * from './file-operations';
```

**Move functions:**

| From | To | Functions |
|------|-----|-----------|
| `analyzers/core/duplicates/parsing.ts` | `shared/file-operations.ts` | `sourceFiles`, `files` |
| `analyzers/core/duplicates/extraction.ts` | `shared/tokenization.ts` | `tokens` |
| `analyzers/core/duplicates/similarity.ts` | `shared/similarity.ts` | `calculateGroupSimilarity` |
| `analyzers/shared/helpers.ts` | `shared/helpers.ts` | Keep all |

#### 2.2 Merge Type Duplicates

| Duplicate Type | Keep In | Remove From |
|----------------|---------|-------------|
| `MigrationOptions` | `core/options.ts` | `runner/migration.ts` |
| `AnalysisMode/RefactorMode` | `core/options.ts` | `output/ai-native.ts` |
| `PackageJson` | `shared/helpers.ts` | `analyzers/context/standards.ts` |

### Phase 3: Split Oversized Files (Week 3)

#### 3.1 Split `unified-swc.ts` (966 lines → 7 modules)

**New structure:**

```
src/commands/fix/analyzers/
├── unified-swc/
│   ├── index.ts           # Main exports
│   ├── detector.ts        # Core detection logic
│   ├── console.ts         # Console detection
│   ├── debugger.ts        # Debugger detection
│   ├── any-type.ts        # Any type detection
│   ├── ts-ignore.ts       # TS ignore detection
│   ├── eval.ts            # Eval detection
│   └── equality.ts        # Equality detection
└── unified-swc.ts         # DEPRECATED - re-exports from unified-swc/
```

#### 3.2 Split `i18n/analyzer.ts` (778 lines → 6 modules)

**New structure:**

```
src/commands/refactor/analyzers/i18n/
├── index.ts               # Main exports
├── analyzer.ts            # SLIM: orchestration only
├── scanner.ts             # File scanning
├── extractor.ts           # String extraction
├── validator.ts           # Key validation
├── reporter.ts            # Report generation
└── types.ts               # Type definitions
```

### Phase 4: Output Pipeline Improvements (Week 4)

#### 4.1 Add Missing Formatters

**Create:** `src/commands/refactor/output/sections/structure.ts`

```typescript
export function formatStructure(
  lines: string[],
  structure: StructureAnalysis,
  limits?: SectionLimits
): void {
  if (!structure) return;

  lines.push('');
  lines.push('<!-- STRUCTURE ANALYSIS -->');
  lines.push(`<structure-analysis score="${structure.score}">`);

  // Format flat files, namespaced folders, issues
  // ...
}
```

**Create:** `src/commands/refactor/output/sections/standards.ts`

```typescript
export function formatStandardsCompliance(
  lines: string[],
  standards: StandardsCompliance
): void {
  // Format standards compliance data
}
```

#### 4.2 Unify Limit Application

**Update:** `src/commands/refactor/output/sections/ranking.ts`

```typescript
// BEFORE (hardcoded)
const topHotspots = hotspots.slice(0, 10);

// AFTER (from limits)
const topHotspots = hotspots.slice(0, limits?.hotspots ?? 10);
```

**Apply same pattern to:**
- `couplingMetrics` limit
- `safeOrderPhases` limit
- `reusableModules` limit
- `fileSizeIssues` limit (NEW)

#### 4.3 Add File Size Limits to SectionLimits

**Update:** `src/commands/refactor/output/helpers/limits.ts`

```typescript
export interface SectionLimits {
  // ... existing
  fileSizeIssues: number;  // NEW
}

export const LIMITS: Record<OutputLevel, SectionLimits> = {
  summary: {
    // ...
    fileSizeIssues: 5,
  },
  standard: {
    // ...
    fileSizeIssues: 20,
  },
  full: {
    // ...
    fileSizeIssues: Infinity,
  },
};
```

---

## Part 3: New Module Architecture

### Proposed Directory Structure

```
src/commands/refactor/
│
├── index.ts                          # Public API exports
├── command.ts                        # CLI entry point
│
├── core/                             # Foundation types & options
│   ├── index.ts                      # Barrel exports
│   ├── types.ts                      # RefactorAnalysis types
│   ├── types-enhanced.ts             # EnhancedRefactorAnalysis types
│   ├── options.ts                    # Mode resolution & flags
│   └── constants.ts                  # Thresholds, defaults
│
├── shared/                           # Shared utilities (NEW)
│   ├── index.ts                      # Barrel exports
│   ├── helpers.ts                    # File ops, project utils
│   ├── similarity.ts                 # Similarity algorithms
│   ├── tokenization.ts               # Code tokenization
│   ├── file-operations.ts            # File discovery
│   └── hashing.ts                    # Hash computations
│
├── analyzers/                        # Analysis modules
│   ├── index.ts                      # Exports all analyzers
│   ├── enhanced.ts                   # Orchestrator: createEnhancedAnalysis()
│   │
│   ├── core/                         # Core duplicate detection
│   │   ├── index.ts
│   │   ├── duplicates/               # Function duplicates
│   │   │   ├── index.ts
│   │   │   ├── analyzer.ts           # Main analysis
│   │   │   └── extraction.ts         # AST extraction
│   │   └── type-duplicates.ts        # Type duplicates
│   │
│   ├── metrics/                      # Quantitative analysis
│   │   ├── index.ts
│   │   ├── file-size.ts              # analyzeFileSizes()
│   │   ├── reusable.ts               # Reusable module detection
│   │   └── recommendations.ts        # Recommendation generation
│   │
│   ├── architecture/                 # Structural analysis
│   │   ├── index.ts
│   │   ├── health.ts                 # analyzeArchHealth()
│   │   ├── domains.ts                # Domain classification
│   │   ├── structure.ts              # Structure analysis
│   │   └── namespace/                # Namespace analysis
│   │       ├── index.ts
│   │       ├── analysis.ts
│   │       └── scoring.ts
│   │
│   ├── context/                      # Project context
│   │   ├── index.ts
│   │   ├── detector.ts               # Project type detection
│   │   ├── navigation.ts             # AI navigation hints
│   │   └── standards.ts              # Standards compliance
│   │
│   ├── ranking/                      # PageRank analysis
│   │   ├── index.ts
│   │   ├── pagerank.ts               # PageRank computation
│   │   ├── hotspots.ts               # Hotspot detection
│   │   ├── coupling.ts               # Coupling metrics
│   │   └── safe-order.ts             # Safe refactor order
│   │
│   └── i18n/                         # i18n analysis
│       ├── index.ts
│       ├── scanner.ts
│       ├── extractor.ts
│       ├── validator.ts
│       └── reporter.ts
│
├── output/                           # Output formatters
│   ├── index.ts                      # Unified dispatcher
│   ├── ai-native.ts                  # AI-optimized XML
│   ├── text.ts                       # Human-readable text
│   ├── json.ts                       # JSON format
│   ├── xml.ts                        # Standard XML
│   │
│   ├── helpers/                      # Output helpers
│   │   ├── index.ts
│   │   ├── limits.ts                 # SectionLimits
│   │   ├── deduplication.ts          # Output dedup
│   │   └── priority.ts               # Priority calculation
│   │
│   └── sections/                     # Section formatters
│       ├── index.ts                  # Exports all
│       ├── stats.ts
│       ├── project-context.ts
│       ├── ai-config.ts
│       ├── architecture.ts
│       ├── ranking.ts
│       ├── recommendations.ts
│       ├── domains.ts
│       ├── duplicates.ts
│       ├── migration.ts
│       ├── reusable-modules.ts
│       ├── file-size.ts
│       ├── navigation.ts
│       ├── structure.ts              # NEW
│       └── standards.ts              # NEW
│
├── migration/                        # Migration execution
│   ├── index.ts
│   ├── types.ts                      # NEW: Shared types
│   ├── planning.ts
│   ├── security.ts
│   ├── imports.ts
│   │
│   ├── core/                         # Core orchestration
│   │   ├── index.ts
│   │   └── orchestrator.ts
│   │
│   └── handlers/                     # Action handlers
│       ├── index.ts
│       ├── barrel-handler.ts
│       ├── delete-handler.ts
│       ├── import-handler.ts
│       ├── merge-handler.ts
│       └── move-handler.ts
│
├── runner/                           # Execution orchestration
│   ├── index.ts
│   ├── analysis.ts                   # runRefactor(), printAnalysis()
│   └── migration.ts                  # applyMigrations()
│
├── paths/                            # Path resolution
│   ├── index.ts
│   └── resolver.ts
│
└── utils/                            # Command utilities
    ├── index.ts
    └── summary.ts
```

---

## Part 4: Module Plugin Architecture (Future)

### Goal: Easy Addition of New Analyzers

**Create analyzer registry:**

```typescript
// src/commands/refactor/analyzers/registry.ts

export interface AnalyzerPlugin {
  name: string;
  description: string;

  // When to run this analyzer
  shouldRun(options: RefactorOptions): boolean;

  // Execute analysis
  analyze(ctx: AnalysisContext): Promise<AnalysisResult>;

  // Dependencies on other analyzers
  dependencies?: string[];
}

export class AnalyzerRegistry {
  private plugins = new Map<string, AnalyzerPlugin>();

  register(plugin: AnalyzerPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  async runAll(ctx: AnalysisContext): Promise<EnhancedRefactorAnalysis> {
    // Topologically sort by dependencies
    // Run in parallel where possible
    // Merge results
  }
}
```

**Example plugin:**

```typescript
// src/commands/refactor/analyzers/metrics/file-size.plugin.ts

export const fileSizePlugin: AnalyzerPlugin = {
  name: 'file-size',
  description: 'Analyzes file sizes and detects oversized files',

  shouldRun: (options) => options.includeFileSize !== false,

  analyze: async (ctx) => {
    const analysis = analyzeFileSizes(ctx.srcRoot, ctx.projectRoot);
    return {
      fileSizeAnalysis: analysis,
    };
  },

  dependencies: [], // No dependencies
};
```

### Output Section Registry

```typescript
// src/commands/refactor/output/sections/registry.ts

export interface SectionFormatter {
  name: string;
  order: number;

  // Conditional rendering
  shouldRender(analysis: EnhancedRefactorAnalysis, limits: SectionLimits): boolean;

  // Format section
  format(lines: string[], analysis: EnhancedRefactorAnalysis, limits: SectionLimits): void;
}

export class SectionRegistry {
  private sections = new Map<string, SectionFormatter>();

  register(section: SectionFormatter): void {
    this.sections.set(section.name, section);
  }

  formatAll(analysis: EnhancedRefactorAnalysis, limits: SectionLimits): string[] {
    const lines: string[] = [];

    // Sort by order, filter by shouldRender, format each
    [...this.sections.values()]
      .sort((a, b) => a.order - b.order)
      .filter(s => s.shouldRender(analysis, limits))
      .forEach(s => s.format(lines, analysis, limits));

    return lines;
  }
}
```

---

## Part 5: Implementation Checklist

### Phase 1: Critical Fixes ✅

- [ ] Fix `analyzeFileSizes` conditional storage
- [ ] Add error logging in enhanced.ts catch block
- [ ] Extract migration types to break circular dependencies
- [ ] Add unit tests for file size output

### Phase 2: Consolidate Duplicates

- [ ] Create `shared/` directory with index.ts
- [ ] Move shared utilities (5 functions)
- [ ] Merge duplicate type definitions (3 types)
- [ ] Update all imports
- [ ] Run typecheck & tests

### Phase 3: Split Oversized Files

- [ ] Split `unified-swc.ts` into 7 modules
- [ ] Split `i18n/analyzer.ts` into 6 modules
- [ ] Split `context/index.ts` into helpers
- [ ] Deprecate old files with re-exports
- [ ] Update imports across codebase

### Phase 4: Output Pipeline

- [ ] Create `structure.ts` section formatter
- [ ] Create `standards.ts` section formatter
- [ ] Add `fileSizeIssues` to SectionLimits
- [ ] Unify hardcoded limits to use SectionLimits
- [ ] Update ai-native.ts to use new sections

### Phase 5: Plugin Architecture (Future)

- [ ] Design AnalyzerPlugin interface
- [ ] Create AnalyzerRegistry
- [ ] Migrate existing analyzers to plugins
- [ ] Design SectionFormatter interface
- [ ] Create SectionRegistry
- [ ] Migrate existing formatters to plugins

---

## Part 6: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing CLI behavior | HIGH | Add backward-compatible re-exports |
| Import path changes | MEDIUM | Use barrel exports, update tsconfig paths |
| Test failures | MEDIUM | Run test suite after each phase |
| Performance regression | LOW | Benchmark before/after |
| Type compatibility | MEDIUM | Strict TypeScript, no `any` |

---

## Appendix A: File Size Thresholds

| Severity | Lines | Action |
|----------|-------|--------|
| Warning | 300-499 | Consider splitting |
| Error | 500-799 | Should split |
| Critical | 800+ | Must split immediately |

Ideal file size: **150 lines** (configurable)

---

## Appendix B: Current vs Target Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|---------|
| Structure Score | 66 | 68 | 75 | 82 | 85 |
| Duplicates | 190 | 185 | 50 | 30 | 20 |
| Circular Deps | 5 | 0 | 0 | 0 | 0 |
| Oversized Files | 41 | 40 | 35 | 15 | 10 |
| Critical Files | 1 | 1 | 1 | 0 | 0 |

---

## Appendix C: Related Files

**Core Files to Modify:**

1. `src/commands/refactor/analyzers/enhanced.ts` - Main orchestrator
2. `src/commands/refactor/output/ai-native.ts` - Output formatter
3. `src/commands/refactor/output/helpers/limits.ts` - Section limits
4. `src/commands/refactor/migration/core/orchestrator.ts` - Migration
5. `src/commands/refactor/core/types-ai.ts` - Type definitions

**Test Files:**

1. `tests/unit/commands/refactor/analyzers/enhanced.test.ts`
2. `tests/unit/commands/refactor/output/sections/file-size.test.ts`
3. `tests/integration/refactor/command.test.ts`

---

*This document should be reviewed and updated after each phase completion.*
