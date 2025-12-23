# Krolik CLI Architecture Restructuring Proposal

> Airbnb-level architecture aligned with FIXER-ROADMAP phases

**Date:** 2025-12-22
**Status:** Proposal
**Estimated effort:** 2-3 weeks

---

## Executive Summary

Current state: **20,438 LOC** across **136 files** with:
- 3 files over 700 lines (critical)
- 24 files over 200 lines
- 5+ duplicate utility patterns
- ts-morph scattered across 8 files
- fs operations in 25 files (should use lib/fs.ts)

**Goal:** Create clean architecture that supports FIXER-ROADMAP phases and enables AI-native code quality pipeline.

---

## Current vs Proposed Structure

### Current Structure (Problems)

```
src/
├── commands/
│   ├── fix/
│   │   ├── index.ts (751 lines)      ← TOO LARGE
│   │   ├── ast-utils.ts (1014 lines) ← LARGEST FILE
│   │   ├── refactorings.ts (749)     ← TOO LARGE
│   │   └── strategies/shared/        ← Duplicate logic
│   ├── quality/
│   │   ├── analyzers/complexity.ts   ← createProject() duplicate
│   │   └── ai-format.ts (558)        ← TOO LARGE
│   └── context/
│       ├── formatters/ai/            ← escapeXml, truncate
│       └── parsers/                  ← Component parsing
├── lib/                              ← Good but incomplete
│   ├── fs.ts (207)
│   ├── git.ts (291)
│   └── ... (well organized)
└── config/
    └── domains.ts (305)              ← Duplicate with lib/domains.ts
```

### Proposed Structure (Airbnb-Level)

```
src/
├── lib/                              # CORE UTILITIES (shared across all commands)
│   ├── index.ts                      # Re-export all
│   │
│   ├── ast/                          # AST UTILITIES (centralized ts-morph)
│   │   ├── index.ts                  # Re-export
│   │   ├── project.ts                # createProject(), getSourceFile()
│   │   ├── analysis.ts               # findAncestor(), getContext()
│   │   ├── extraction.ts             # extractFunction(), extractImports()
│   │   ├── transformation.ts         # invertCondition(), wrapInTry()
│   │   └── validation.ts             # hasValidSyntax(), checkTypes()
│   │
│   ├── formatters/                   # OUTPUT FORMATTERS (DRY)
│   │   ├── index.ts
│   │   ├── json.ts                   # formatAsJson<T>()
│   │   ├── markdown.ts               # formatAsMarkdown<T>()
│   │   ├── xml.ts                    # escapeXml(), wrapXml()
│   │   └── table.ts                  # formatTable(), alignColumns()
│   │
│   ├── discovery/                    # PATH DISCOVERY (centralized)
│   │   ├── index.ts
│   │   ├── project.ts                # findProjectRoot(), detectMonorepo()
│   │   ├── schema.ts                 # findSchemaDir(), findPrismaSchema()
│   │   ├── routes.ts                 # findRoutersDir(), findApiRoutes()
│   │   └── patterns.ts               # matchGlob(), filterByExtension()
│   │
│   ├── fs.ts                         # File system (existing, good)
│   ├── git.ts                        # Git operations (existing, good)
│   ├── github.ts                     # GitHub API (existing, good)
│   ├── shell.ts                      # Shell execution (existing, good)
│   ├── logger.ts                     # Logging (existing, good)
│   └── domains.ts                    # Domain detection (consolidate here)
│
├── commands/
│   ├── fix/                          # FIX COMMAND (aligned with FIXER-ROADMAP)
│   │   ├── index.ts (<200)           # Command entry point only
│   │   ├── types.ts                  # Type definitions
│   │   │
│   │   ├── collector/                # PHASE 1: Unified Collector
│   │   │   ├── index.ts              # Main collector orchestrator
│   │   │   ├── sources/
│   │   │   │   ├── typescript.ts     # ← Move from shared/typescript.ts
│   │   │   │   ├── biome.ts          # ← Move from shared/biome.ts
│   │   │   │   └── quality.ts        # Wrap quality analyzers
│   │   │   ├── deduplicator.ts       # Remove duplicate errors
│   │   │   ├── prioritizer.ts        # Score calculation
│   │   │   └── types.ts              # UnifiedError, CollectorResult
│   │   │
│   │   ├── pipeline/                 # PHASE 2: Pipeline Orchestrator
│   │   │   ├── index.ts              # Pipeline runner
│   │   │   ├── steps/
│   │   │   │   ├── backup.ts         # ← Move from git-backup.ts
│   │   │   │   ├── collect.ts        # Error collection step
│   │   │   │   ├── auto-fix.ts       # Auto-fix step
│   │   │   │   ├── verify.ts         # Verification step
│   │   │   │   └── report.ts         # AI report generation
│   │   │   ├── state.ts              # State persistence
│   │   │   └── types.ts              # PipelineState, Step
│   │   │
│   │   ├── strategies/               # PHASE 3: Fix Strategies (refactored)
│   │   │   ├── index.ts              # Strategy registry
│   │   │   ├── lint/
│   │   │   │   ├── index.ts
│   │   │   │   ├── console.ts        # console.log removal
│   │   │   │   ├── debugger.ts       # debugger removal
│   │   │   │   └── alert.ts          # alert removal
│   │   │   ├── type-safety/
│   │   │   │   ├── index.ts
│   │   │   │   ├── any-fix.ts        # any → unknown
│   │   │   │   └── ignore-fix.ts     # @ts-ignore → @ts-expect-error
│   │   │   ├── complexity/
│   │   │   │   ├── index.ts
│   │   │   │   ├── extract.ts        # Function extraction
│   │   │   │   ├── flatten.ts        # Nesting reduction
│   │   │   │   └── split.ts          # File splitting
│   │   │   ├── hardcoded/
│   │   │   │   ├── index.ts
│   │   │   │   ├── numbers.ts        # Magic numbers
│   │   │   │   ├── strings.ts        # Magic strings
│   │   │   │   └── naming.ts         # Constant naming
│   │   │   └── formatting/
│   │   │       ├── index.ts
│   │   │       ├── prettier.ts       # Prettier integration
│   │   │       └── imports.ts        # Import organization
│   │   │
│   │   ├── refactorings/             # SPLIT from refactorings.ts (749 lines)
│   │   │   ├── index.ts              # Re-export all
│   │   │   ├── if-chains.ts          # If-else chain → switch/map
│   │   │   ├── switch-cases.ts       # Switch optimization
│   │   │   ├── guard-clauses.ts      # Early returns
│   │   │   └── extraction.ts         # Extract method/variable
│   │   │
│   │   ├── applier.ts                # Apply fixes (existing, good size)
│   │   └── context.ts                # Code context (existing, good size)
│   │
│   ├── quality/                      # QUALITY COMMAND
│   │   ├── index.ts (<200)           # Command entry only
│   │   ├── types.ts
│   │   │
│   │   ├── analyzers/                # Keep existing structure
│   │   │   ├── index.ts
│   │   │   ├── complexity.ts         # ← Use lib/ast/project.ts
│   │   │   ├── lint-rules.ts
│   │   │   ├── type-safety.ts
│   │   │   ├── hardcoded.ts
│   │   │   ├── srp.ts
│   │   │   └── concerns.ts
│   │   │
│   │   ├── formatters/               # PHASE 4: AI Report
│   │   │   ├── index.ts
│   │   │   ├── ai-report.ts          # ← Refactor from ai-format.ts (558)
│   │   │   ├── text.ts
│   │   │   └── json.ts
│   │   │
│   │   └── recommendations/          # Keep existing
│   │       └── rules/
│   │
│   ├── context/                      # CONTEXT COMMAND (already refactored)
│   │   ├── index.ts (<200)
│   │   ├── types.ts
│   │   ├── domains.ts                # ← Remove (use lib/domains.ts)
│   │   ├── formatters/
│   │   │   ├── text.ts
│   │   │   └── ai/                   # Already well structured
│   │   ├── helpers/
│   │   │   ├── discovery.ts          # ← Move to lib/discovery/
│   │   │   ├── files.ts
│   │   │   ├── paths.ts              # ← Move to lib/discovery/
│   │   │   └── tree.ts
│   │   └── parsers/
│   │       ├── components.ts
│   │       ├── zod.ts
│   │       ├── tests.ts
│   │       └── types-parser.ts
│   │
│   ├── schema/                       # SCHEMA COMMAND
│   ├── routes/                       # ROUTES COMMAND
│   ├── review/                       # REVIEW COMMAND
│   └── status/                       # STATUS COMMAND
│
├── config/
│   ├── index.ts
│   ├── loader.ts
│   ├── detect.ts
│   ├── defaults.ts
│   └── domains.ts                    # ← Remove (use lib/domains.ts)
│
├── types/                            # Global types
│   ├── index.ts
│   ├── config.ts
│   └── commands.ts
│
├── mcp/                              # MCP Server
│   ├── index.ts
│   └── server.ts
│
└── bin/
    └── cli.ts
```

---

## Migration Plan

### Phase 0: Foundation (Days 1-2)

Create shared utilities foundation before any other changes.

#### 0.1 Create lib/ast/ Module

Extract from `fix/ast-utils.ts` (1014 lines):

```typescript
// lib/ast/project.ts (~50 lines)
export function createProject(options?: ProjectOptions): Project;
export function createSourceFile(code: string): SourceFile;
export function parseFile(filePath: string): SourceFile;

// lib/ast/analysis.ts (~100 lines)
export function findAncestor(node: Node, kind: SyntaxKind): Node | null;
export function getContext(node: Node): CodeContext;
export function isInsideString(node: Node): boolean;
export function isInsideComment(node: Node): boolean;

// lib/ast/extraction.ts (~150 lines)
export function extractFunction(node: Node): ExtractedFunction;
export function extractImports(sourceFile: SourceFile): ImportInfo[];
export function extractExports(sourceFile: SourceFile): ExportInfo[];
export function getUsedIdentifiers(node: Node): string[];

// lib/ast/transformation.ts (~100 lines)
export function invertCondition(expr: Expression): string;
export function wrapInTryCatch(block: Block): string;
export function addImport(source: SourceFile, module: string, names: string[]): void;
```

#### 0.2 Create lib/formatters/ Module

Consolidate from 5+ command formatters:

```typescript
// lib/formatters/json.ts
export function formatAsJson<T>(data: T, options?: JsonOptions): string;

// lib/formatters/markdown.ts
export function formatAsMarkdown(sections: MarkdownSection[]): string;
export function formatTable(rows: TableRow[], headers: string[]): string;

// lib/formatters/xml.ts
export function escapeXml(text: string): string;
export function wrapXml(tag: string, content: string, attrs?: Record<string, string>): string;
export function buildXmlDocument(elements: XmlElement[]): string;
```

#### 0.3 Create lib/discovery/ Module

Consolidate path discovery:

```typescript
// lib/discovery/project.ts
export function findProjectRoot(startPath: string): string;
export function detectMonorepo(projectRoot: string): MonorepoInfo | null;
export function findPackageJson(startPath: string): string | null;

// lib/discovery/schema.ts
export function findSchemaDir(projectRoot: string): string | null;
export function findPrismaSchema(projectRoot: string): string | null;
export function findZodSchemas(dir: string): string[];

// lib/discovery/routes.ts
export function findRoutersDir(projectRoot: string): string | null;
export function findApiRoutes(projectRoot: string): string[];
export function findTrpcRouters(projectRoot: string): string[];
```

### Phase 1: Fix Module Restructuring (Days 3-5)

Align with FIXER-ROADMAP Phase 1-2.

#### 1.1 Create collector/ Module

New module for unified error collection:

```
fix/collector/
├── index.ts           # Main collector
├── sources/
│   ├── typescript.ts  # ← Adapt from shared/typescript.ts
│   ├── biome.ts       # ← Adapt from shared/biome.ts
│   └── quality.ts     # Wrap quality analyzers
├── deduplicator.ts    # Remove duplicates
├── prioritizer.ts     # Score calculation
└── types.ts           # UnifiedError, CollectorResult
```

#### 1.2 Create pipeline/ Module

New module for step-by-step execution:

```
fix/pipeline/
├── index.ts           # Pipeline runner
├── steps/
│   ├── backup.ts      # Git backup step
│   ├── collect.ts     # Collection step
│   ├── auto-fix.ts    # Auto-fix step
│   ├── verify.ts      # Verification step
│   └── report.ts      # Report generation
├── state.ts           # Persistence (.krolik/state.json)
└── types.ts           # PipelineState
```

#### 1.3 Split refactorings.ts (749 lines)

Break into focused modules:

```
fix/refactorings/
├── index.ts           # Re-export all
├── if-chains.ts       # If-else chain refactoring (~150 lines)
├── switch-cases.ts    # Switch optimization (~100 lines)
├── guard-clauses.ts   # Early returns (~100 lines)
├── extraction.ts      # Method/variable extraction (~150 lines)
└── types.ts           # Refactoring types (~50 lines)
```

### Phase 2: Quality Module Cleanup (Days 6-7)

#### 2.1 Refactor ai-format.ts (558 lines)

Split into:

```
quality/formatters/
├── index.ts
├── ai-report.ts       # AI-specific formatting (~200 lines)
├── sections.ts        # Report sections (~150 lines)
├── priorities.ts      # Priority calculation (~100 lines)
└── helpers.ts         # Shared helpers (~50 lines)
```

#### 2.2 Update Analyzers to Use lib/ast/

Replace local `createProject()` with:

```typescript
// Before (complexity.ts)
import { Project } from 'ts-morph';
function createProject() { ... }

// After
import { createProject, parseFile } from '@/lib/ast';
```

### Phase 3: Context Module Cleanup (Day 8)

#### 3.1 Move discovery helpers to lib/

```typescript
// Move from context/helpers/paths.ts to lib/discovery/
findSchemaDir() → lib/discovery/schema.ts
findRoutersDir() → lib/discovery/routes.ts
```

#### 3.2 Remove duplicate domains.ts

```typescript
// Remove: commands/context/domains.ts
// Remove: config/domains.ts
// Keep only: lib/domains.ts (single source of truth)
```

### Phase 4: Config Consolidation (Day 9)

#### 4.1 Merge domain configurations

```typescript
// lib/domains.ts - Single source of truth
export const DOMAIN_PATTERNS = { ... };
export function detectDomains(files: string[]): string[];
export function matchDomain(path: string): string | null;
```

---

## File Size Targets

After restructuring, all files should follow:

| Category | Max Lines | Current Violations |
|----------|-----------|-------------------|
| **Entry points** | 50 | 0 |
| **Type definitions** | 100 | 0 |
| **Utilities** | 150 | 0 |
| **Feature modules** | 200 | 24 files |
| **Complex analyzers** | 250 | Exception |

---

## Dependency Graph (Target)

```
                    ┌─────────────────────────────────────────┐
                    │               CLI Entry                  │
                    │              bin/cli.ts                  │
                    └─────────────────┬───────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │    Commands   │       │    Commands   │       │    Commands   │
    │      fix/     │       │   quality/    │       │   context/    │
    └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │              lib/ (shared)               │
                    ├─────────────────────────────────────────┤
                    │  ast/  │ formatters/ │ discovery/ │ fs  │
                    │  git   │   github    │   shell    │ ... │
                    └─────────────────────────────────────────┘
```

**Rules:**
1. Commands depend on lib/, never on each other
2. lib/ modules are independent
3. No circular dependencies
4. Types in types/ or co-located

---

## Migration Checklist

### Foundation (lib/)

- [ ] Create lib/ast/project.ts
- [ ] Create lib/ast/analysis.ts
- [ ] Create lib/ast/extraction.ts
- [ ] Create lib/ast/transformation.ts
- [ ] Create lib/formatters/json.ts
- [ ] Create lib/formatters/markdown.ts
- [ ] Create lib/formatters/xml.ts
- [ ] Create lib/discovery/project.ts
- [ ] Create lib/discovery/schema.ts
- [ ] Create lib/discovery/routes.ts
- [ ] Consolidate lib/domains.ts

### Fix Command

- [ ] Create fix/collector/index.ts
- [ ] Create fix/collector/sources/typescript.ts
- [ ] Create fix/collector/sources/biome.ts
- [ ] Create fix/collector/deduplicator.ts
- [ ] Create fix/collector/prioritizer.ts
- [ ] Create fix/pipeline/index.ts
- [ ] Create fix/pipeline/steps/*.ts
- [ ] Create fix/pipeline/state.ts
- [ ] Split fix/refactorings.ts → fix/refactorings/*.ts
- [ ] Split fix/ast-utils.ts → lib/ast/*.ts
- [ ] Update fix/index.ts to use new modules

### Quality Command

- [ ] Split quality/ai-format.ts → quality/formatters/*.ts
- [ ] Update analyzers to use lib/ast/
- [ ] Remove duplicate createProject()

### Context Command

- [ ] Move discovery helpers to lib/discovery/
- [ ] Remove context/domains.ts (use lib/)
- [ ] Update imports

### Config

- [ ] Remove config/domains.ts (use lib/)
- [ ] Update config/detect.ts to use lib/

---

## Benefits

1. **FIXER-ROADMAP Aligned**
   - collector/ ready for Phase 1
   - pipeline/ ready for Phase 2
   - strategies/ organized for Phase 3
   - formatters/ ready for Phase 4

2. **Code Quality**
   - All files under 200 lines (250 for complex)
   - Zero code duplication
   - Single source of truth for utilities

3. **Developer Experience**
   - Clear module boundaries
   - Easy to find code
   - Predictable import paths

4. **Maintainability**
   - Changes localized to modules
   - Easy testing (isolated units)
   - Clear dependency graph

---

## Next Steps

1. **Review this proposal**
2. **Create GitHub issues for each phase**
3. **Start with Phase 0 (Foundation)**
4. **Run tests after each phase**

---

*Generated: 2025-12-22*
