# Krolik-CLI Architecture Migration

> **Architecture Score:** 66/100 → Target: 85+
> **Total Effort:** ~140 hours

---

## Global Migration: Directory Tree

### Current Structure (Problems)

```
src/
├── bin/                           # OK
├── cli/commands/                  # OK
├── config/                        # OK
├── mcp/                           # OK (needs error unification)
├── types/                         # PROBLEM: 43 dependents on index.ts
│
├── commands/                      # PROBLEM: Mixed shared/domain code
│   ├── agent/                     # OK but no caching, magic strings
│   ├── audit/                     # OK
│   ├── codegen/                   # OK
│   ├── context/                   # PROBLEM: 17 sync file reads
│   ├── docs/                      # OK
│   ├── fix/                       # PROBLEM: types.ts has 49 dependents, 590 lines
│   │   ├── analyzers/             # Duplicates lib/@detectors logic
│   │   ├── core/                  # registry.ts duplicated 3x
│   │   └── types.ts               # HOT FILE: 49 dependents
│   ├── issue/                     # OK
│   ├── memory/                    # OK
│   ├── refactor/                  # PROBLEM: core/index.ts has 60 dependents
│   │   ├── core/                  # HOT FILE: index.ts 60 dependents
│   │   │   ├── index.ts           # DELETE: barrel with 47 exports
│   │   │   ├── types.ts           # Split needed
│   │   │   ├── types-ai.ts        # Split needed
│   │   │   └── options.ts         # Keep
│   │   └── migration/             # PROBLEM: 5 circular deps
│   ├── review/                    # OK
│   ├── routes/                    # OK
│   ├── schema/                    # OK
│   ├── security/                  # OK
│   ├── setup/                     # OK
│   ├── status/                    # OK
│   └── sync/                      # OK
│
└── lib/                           # PROBLEM: index.ts has 53 dependents, 200+ exports
    ├── index.ts                   # HOT FILE: DELETE this barrel
    ├── @agents/                   # OK but needs categories centralized
    ├── @ast/                      # OK (swc + ts-morph justified)
    ├── @cache/                    # OK
    ├── @claude/                   # OK
    ├── @constants/                # MERGE → @core
    ├── @core/                     # EXPAND: add registry, text, patterns
    │   ├── fs/                    # OK
    │   ├── logger/                # OK
    │   ├── shell/                 # OK
    │   ├── time/                  # OK
    │   └── utils/                 # OK
    ├── @detectors/                # OK but some duplicates with fix/analyzers
    ├── @discovery/                # MERGE subfolders
    ├── @format/                   # MERGE subfolders
    ├── @git/                      # OK
    ├── @i18n/                     # OK
    ├── @integrations/context7/    # MERGE 4 subfolders → 1
    ├── @prisma/                   # OK
    ├── @ranking/                  # OK (but O(n²) issue)
    ├── @security/                 # OK
    ├── @storage/                  # MERGE subfolders
    └── @tokens/                   # OK
```

### Target Structure

```
src/
├── bin/                           # UNCHANGED
├── cli/commands/                  # UNCHANGED
├── config/                        # UNCHANGED
├── mcp/
│   └── tools/core/
│       ├── error-handler.ts       # NEW: unified error handling
│       └── action-tool.ts         # NEW: multi-action framework
│
├── types/                         # RESTRUCTURED
│   ├── index.ts                   # MINIMAL: re-export только severity
│   ├── severity.ts                # UNCHANGED
│   ├── output.ts                  # NEW: OutputFormat extracted
│   ├── common.ts                  # NEW: RiskLevel, EffortLevel
│   ├── commands/                  # UNCHANGED
│   └── config/                    # UNCHANGED
│
├── commands/
│   ├── agent/
│   │   ├── index.ts               # UNCHANGED
│   │   ├── loader.ts              # UPDATE: add caching
│   │   ├── orchestrator.ts        # UPDATE: import from lib/@agents
│   │   └── categories.ts          # UPDATE: import from lib/@agents
│   │
│   ├── fix/
│   │   ├── core/
│   │   │   ├── types/             # NEW FOLDER
│   │   │   │   ├── index.ts       # Re-export all
│   │   │   │   ├── analysis.ts    # QualityIssue, FileAnalysis
│   │   │   │   ├── fix.ts         # FixAction, FixOperation
│   │   │   │   └── categories.ts  # QualityCategory, FixDifficulty
│   │   │   ├── filtering/         # NEW FOLDER
│   │   │   │   └── impl.ts        # getFixDifficulty, isFixerEnabled
│   │   │   └── registry.ts        # UPDATE: extends lib/@core/registry
│   │   ├── analyzers/             # UPDATE: use lib/@ast/swc
│   │   └── types.ts               # DELETE after migration
│   │
│   └── refactor/
│       ├── core/
│       │   ├── index.ts           # DELETE after migration
│       │   ├── types/             # NEW FOLDER
│       │   │   ├── index.ts       # Re-export
│       │   │   ├── duplicate.ts   # DuplicateInfo, DuplicateLocation
│       │   │   ├── structure.ts   # StructureAnalysis
│       │   │   └── migration.ts   # MigrationAction, MigrationPlan
│       │   ├── types-enhanced/    # NEW FOLDER (renamed from types-ai)
│       │   │   ├── index.ts       # Re-export
│       │   │   ├── context.ts     # ProjectContext, TechStack
│       │   │   ├── architecture.ts # ArchHealth, ArchViolation
│       │   │   └── recommendations.ts
│       │   ├── options.ts         # UNCHANGED
│       │   └── constants.ts       # UNCHANGED
│       ├── migration/
│       │   ├── types.ts           # NEW: ExecutionResult (breaks cycles)
│       │   └── handlers/          # UPDATE imports
│       ├── analyzers/
│       │   └── registry/
│       │       └── registry.ts    # UPDATE: extends lib/@core/registry
│       └── output/
│           └── registry/
│               └── registry.ts    # UPDATE: extends lib/@core/registry
│
└── lib/                           # RESTRUCTURED: 49 → ~25 modules
    ├── index.ts                   # DELETE (no barrel)
    │
    ├── @core/                     # LAYER 0 - NO DEPS
    │   ├── index.ts               # Export all
    │   ├── fs.ts                  # Merged from fs/
    │   ├── logger.ts              # Merged from logger/
    │   ├── shell.ts               # Merged from shell/
    │   ├── time.ts                # Merged from time/
    │   ├── utils.ts               # Merged from utils/
    │   ├── registry.ts            # NEW: generic Registry<T>
    │   ├── text.ts                # NEW: line operations
    │   └── patterns.ts            # NEW: pattern matching utils
    │
    ├── @format/                   # LAYER 1 - depends: @core
    │   ├── index.ts               # Export all
    │   ├── xml.ts                 # Merged from xml/
    │   ├── json.ts                # Merged from core/
    │   ├── markdown.ts            # Merged from core/
    │   └── text.ts                # Merged from core/
    │
    ├── @cache/                    # LAYER 1 - depends: @core
    │   └── index.ts               # UNCHANGED
    │
    ├── @security/                 # LAYER 1 - depends: @core
    │   └── index.ts               # UNCHANGED
    │
    ├── @ast/                      # LAYER 2 - depends: @core, @format
    │   ├── index.ts               # Export all
    │   ├── swc/
    │   │   ├── index.ts
    │   │   ├── parser.ts          # UPDATE: LRU cache 100→500
    │   │   ├── visitor.ts
    │   │   ├── extractors.ts
    │   │   └── unified-analyzer.ts # NEW: consolidated from fix/refactor
    │   └── ts-morph/
    │       ├── index.ts
    │       ├── pool.ts            # UPDATE: add memory budgets
    │       └── project.ts
    │
    ├── @detectors/                # LAYER 2 - depends: @core, @format, @ast
    │   ├── index.ts               # Export all
    │   ├── analysis-types.ts      # NEW: shared AnalysisMetadata, FunctionMetadata
    │   ├── complexity/
    │   ├── hardcoded/
    │   ├── lint/
    │   ├── secrets/
    │   ├── security/
    │   ├── type-safety/
    │   └── issue-factory/
    │
    ├── @git/                      # LAYER 2 - depends: @core
    │   └── index.ts               # UNCHANGED
    │
    ├── @tokens/                   # LAYER 2 - depends: @core
    │   └── index.ts               # UNCHANGED
    │
    ├── @discovery/                # LAYER 3 - depends: @core, @ast
    │   ├── index.ts               # Merged exports
    │   ├── architecture.ts        # Merged from architecture/
    │   └── reusables.ts           # Merged from reusables/
    │
    ├── @storage/                  # LAYER 3 - depends: @core
    │   ├── index.ts               # Merged exports
    │   ├── docs.ts                # Merged from docs/
    │   └── memory.ts              # Merged from memory/
    │
    ├── @agents/                   # LAYER 4 - depends: @core
    │   ├── index.ts               # Export all
    │   ├── categories.ts          # NEW: centralized AGENT_CATEGORIES
    │   ├── types.ts               # AgentDefinition, etc.
    │   └── task-keywords.ts       # NEW: TASK_KEYWORDS mapping
    │
    ├── @integrations/             # LAYER 4 - depends: @core, @storage
    │   └── context7/
    │       ├── index.ts           # Merged: adapters + core + fetcher + registry
    │       ├── client.ts
    │       └── types.ts
    │
    ├── @claude/                   # LAYER 4 - depends: @core, @format, @discovery
    │   └── ...                    # UNCHANGED
    │
    ├── @ranking/                  # LAYER 4 - depends: @core
    │   ├── index.ts
    │   └── pagerank.ts            # UPDATE: fix O(n²) dangling sum
    │
    ├── @i18n/                     # LAYER 4 - depends: @core
    │   └── ...                    # UNCHANGED
    │
    └── @prisma/                   # LAYER 4 - depends: @core
        └── ...                    # UNCHANGED
```

---

## Migration Map

### Phase 1: Files to DELETE

```yaml
delete_files:
  - path: src/lib/index.ts
    reason: "Barrel with 200+ exports, 53 dependents"
    after: "All imports updated to specific modules"

  - path: src/commands/refactor/core/index.ts
    reason: "Barrel with 47 exports, 60 dependents"
    after: "All imports updated to types/, types-enhanced/"

  - path: src/commands/fix/types.ts
    reason: "590 lines mixing types and logic"
    after: "Split into core/types/ and core/filtering/"
```

### Phase 2: Files to CREATE

```yaml
create_files:
  # Break circular deps
  - path: src/commands/refactor/migration/types.ts
    content: ExecutionResult, MigrationExecutionResult

  # Generic registry
  - path: src/lib/@core/registry.ts
    content: |
      export class Registry<T extends Identifiable> { ... }

  # Shared analysis types
  - path: src/lib/@detectors/analysis-types.ts
    content: AnalysisMetadata, FunctionMetadata, FunctionAnalysis

  # Centralized agent categories
  - path: src/lib/@agents/categories.ts
    content: AGENT_CATEGORIES, AgentCategory type, CATEGORY_INFO

  - path: src/lib/@agents/task-keywords.ts
    content: TASK_KEYWORDS mapping

  # Fix command restructure
  - path: src/commands/fix/core/types/index.ts
  - path: src/commands/fix/core/types/analysis.ts
  - path: src/commands/fix/core/types/fix.ts
  - path: src/commands/fix/core/types/categories.ts
  - path: src/commands/fix/core/filtering/impl.ts

  # Refactor command restructure
  - path: src/commands/refactor/core/types/index.ts
  - path: src/commands/refactor/core/types/duplicate.ts
  - path: src/commands/refactor/core/types/structure.ts
  - path: src/commands/refactor/core/types/migration.ts
  - path: src/commands/refactor/core/types-enhanced/index.ts
  - path: src/commands/refactor/core/types-enhanced/context.ts
  - path: src/commands/refactor/core/types-enhanced/architecture.ts
  - path: src/commands/refactor/core/types-enhanced/recommendations.ts

  # MCP improvements
  - path: src/mcp/tools/core/error-handler.ts
  - path: src/mcp/tools/core/action-tool.ts

  # Types restructure
  - path: src/types/output.ts
  - path: src/types/common.ts

  # Core utilities
  - path: src/lib/@core/text.ts
  - path: src/lib/@core/patterns.ts
```

### Phase 3: Files to MERGE

```yaml
merge_operations:
  # @core consolidation
  - from: src/lib/@core/fs/
    to: src/lib/@core/fs.ts

  - from: src/lib/@core/logger/
    to: src/lib/@core/logger.ts

  - from: src/lib/@core/shell/
    to: src/lib/@core/shell.ts

  - from: src/lib/@core/time/
    to: src/lib/@core/time.ts

  - from: src/lib/@core/utils/
    to: src/lib/@core/utils.ts

  # @format consolidation
  - from: src/lib/@format/core/
    to: src/lib/@format/

  - from: src/lib/@format/xml/
    to: src/lib/@format/xml.ts

  # @storage consolidation
  - from: src/lib/@storage/docs/
    to: src/lib/@storage/docs.ts

  - from: src/lib/@storage/memory/
    to: src/lib/@storage/memory.ts

  # @discovery consolidation
  - from: src/lib/@discovery/architecture/
    to: src/lib/@discovery/architecture.ts

  - from: src/lib/@discovery/reusables/
    to: src/lib/@discovery/reusables.ts

  # @integrations/context7 consolidation
  - from:
      - src/lib/@integrations/context7/adapters/
      - src/lib/@integrations/context7/core/
      - src/lib/@integrations/context7/fetcher/
      - src/lib/@integrations/context7/registry/
    to: src/lib/@integrations/context7/
```

### Phase 4: Import Updates

```yaml
import_migrations:
  # lib/index.ts elimination (53 files)
  - pattern: "from '@/lib'"
    files: 53
    replacements:
      escapeXml: "from '@/lib/@format'"
      formatAsXml: "from '@/lib/@format'"
      formatAsJson: "from '@/lib/@format'"
      fileCache: "from '@/lib/@cache'"
      withSourceFile: "from '@/lib/@ast'"
      parseFile: "from '@/lib/@ast/swc'"
      detectHardcoded: "from '@/lib/@detectors/hardcoded'"
      detectComplexity: "from '@/lib/@detectors/complexity'"
      getSchema: "from '@/lib/@discovery'"
      getRoutes: "from '@/lib/@discovery'"

  # refactor/core/index.ts elimination (60 files)
  - pattern: "from '../core'"
    context: commands/refactor/
    files: 60
    replacements:
      DuplicateInfo: "from '../core/types/duplicate'"
      FunctionSignature: "from '../core/types/duplicate'"
      StructureAnalysis: "from '../core/types/structure'"
      MigrationAction: "from '../core/types/migration'"
      ProjectContext: "from '../core/types-enhanced/context'"
      ArchHealth: "from '../core/types-enhanced/architecture'"
      RefactorOptions: "from '../core/options'"

  # fix/types.ts elimination (49 files)
  - pattern: "from '../types'|from './types'"
    context: commands/fix/
    files: 49
    replacements:
      QualityIssue: "from './core/types/analysis'"
      FileAnalysis: "from './core/types/analysis'"
      FixAction: "from './core/types/fix'"
      QualityCategory: "from './core/types/categories'"
      getFixDifficulty: "from './core/filtering/impl'"
      isFixerEnabled: "from './core/filtering/impl'"

  # types/index.ts reduction (43 files)
  - pattern: "from '@/types'"
    files: 43
    replacements:
      OutputFormat: "from '@/types/output'"
      RiskLevel: "from '@/types/common'"
      EffortLevel: "from '@/types/common'"
      Severity: "from '@/types/severity'"

  # Agent categories centralization
  - pattern: "AGENT_CATEGORIES|AgentCategory"
    context: commands/agent/
    replacement: "from '@/lib/@agents/categories'"

  # Circular deps fix
  - pattern: "from '../core/orchestrator'"
    context: commands/refactor/migration/handlers/
    replacement: "from '../types'"
```

---

## Layer Dependencies Contract

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: Application Services                                    │
│ @agents, @integrations, @claude, @ranking, @i18n, @prisma       │
│ CAN IMPORT: Layer 0-3                                           │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: Domain Services                                         │
│ @discovery, @storage                                            │
│ CAN IMPORT: Layer 0-2                                           │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: Analysis Tools                                          │
│ @ast, @detectors, @git, @tokens                                 │
│ CAN IMPORT: Layer 0-1                                           │
│ ⚠️ @ast MUST be isolated (no @detectors imports)                │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 1: Utilities                                               │
│ @format, @cache, @security                                      │
│ CAN IMPORT: Layer 0 only                                        │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 0: Core (ZERO EXTERNAL DEPS)                              │
│ @core (fs, logger, shell, time, utils, registry, text, patterns)│
│ CANNOT IMPORT: anything from lib/                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Epic 0: Break Circular Dependencies
**Priority:** P0 | **Effort:** 2h | **Risk:** Low

### Tasks

```yaml
- id: E0-T1
  action: CREATE
  file: src/commands/refactor/migration/types.ts
  content: |
    /**
     * @module commands/refactor/migration/types
     */
    import type { MigrationOptions } from '../core/options';

    export interface ExecutionResult {
      success: boolean;
      message: string;
    }

    export interface MigrationExecutionResult {
      success: boolean;
      results: string[];
    }

    export type MigrationExecutionOptions = MigrationOptions;

- id: E0-T2
  action: UPDATE
  files:
    - src/commands/refactor/migration/handlers/barrel-handler.ts
    - src/commands/refactor/migration/handlers/delete-handler.ts
    - src/commands/refactor/migration/handlers/import-handler.ts
    - src/commands/refactor/migration/handlers/merge-handler.ts
    - src/commands/refactor/migration/handlers/move-handler.ts
  change: |
    // FROM:
    import type { ExecutionResult } from '../core/orchestrator';
    // TO:
    import type { ExecutionResult } from '../types';

- id: E0-T3
  action: UPDATE
  file: src/commands/refactor/migration/core/orchestrator.ts
  change: "Import from '../types', re-export for backwards compat"

- id: E0-T4
  action: UPDATE
  file: src/commands/refactor/migration/index.ts
  change: "Re-export from './types'"
```

### Verification
```bash
pnpm typecheck  # 0 errors
```

---

## Epic 1: Decouple Hot Files
**Priority:** P0 | **Effort:** 40h | **Risk:** High

### Task 1.1: Split refactor/core/index.ts (60 dependents)

```yaml
- id: E1-T1.1
  action: CREATE
  files:
    - src/commands/refactor/core/types/index.ts
    - src/commands/refactor/core/types/duplicate.ts
    - src/commands/refactor/core/types/structure.ts
    - src/commands/refactor/core/types/migration.ts
    - src/commands/refactor/core/types-enhanced/index.ts
    - src/commands/refactor/core/types-enhanced/context.ts
    - src/commands/refactor/core/types-enhanced/architecture.ts
    - src/commands/refactor/core/types-enhanced/recommendations.ts

- id: E1-T1.2
  action: BULK_UPDATE
  count: 60
  pattern: "from '../core'"
  codemod: jscodeshift or manual

- id: E1-T1.3
  action: DELETE
  file: src/commands/refactor/core/index.ts
```

### Task 1.2: Eliminate lib/index.ts (53 dependents)

```yaml
- id: E1-T2.1
  action: BULK_UPDATE
  count: 53
  pattern: "from '@/lib'"
  codemod: jscodeshift or manual

- id: E1-T2.2
  action: DELETE
  file: src/lib/index.ts
```

### Task 1.3: Split fix/types.ts (49 dependents)

```yaml
- id: E1-T3.1
  action: CREATE
  files:
    - src/commands/fix/core/types/index.ts
    - src/commands/fix/core/types/analysis.ts
    - src/commands/fix/core/types/fix.ts
    - src/commands/fix/core/types/categories.ts
    - src/commands/fix/core/filtering/impl.ts

- id: E1-T3.2
  action: BULK_UPDATE
  count: 49
  pattern: "from '../types'|from './types'"

- id: E1-T3.3
  action: DELETE
  file: src/commands/fix/types.ts
```

### Verification
```bash
pnpm typecheck  # 0 errors
# Max dependents < 15
```

---

## Epic 2: Consolidate Duplicates
**Priority:** P0 | **Effort:** 22h | **Risk:** Medium

### Task 2.1: Generic Registry

```yaml
- id: E2-T1
  action: CREATE
  file: src/lib/@core/registry.ts
  content: |
    export interface Identifiable {
      metadata: { id: string };
    }

    export class Registry<T extends Identifiable> {
      private readonly items = new Map<string, T>();

      register(item: T): void {
        if (this.items.has(item.metadata.id)) {
          throw new Error(`Duplicate: ${item.metadata.id}`);
        }
        this.items.set(item.metadata.id, item);
      }

      get(id: string): T | undefined {
        return this.items.get(id);
      }

      all(): T[] {
        return Array.from(this.items.values());
      }

      has(id: string): boolean {
        return this.items.has(id);
      }

      clear(): void {
        this.items.clear();
      }
    }

- id: E2-T2
  action: REFACTOR
  files:
    - src/commands/fix/core/registry.ts
    - src/commands/refactor/analyzers/registry/registry.ts
    - src/commands/refactor/output/registry/registry.ts
  change: "extends Registry<T>"
```

### Task 2.2: Shared Analysis Types

```yaml
- id: E2-T3
  action: CREATE
  file: src/lib/@detectors/analysis-types.ts
  content: |
    import type { Severity } from '@/types/severity';

    export interface AnalysisMetadata {
      file: string;
      line?: number;
      severity?: Severity;
      category?: string;
      message: string;
      suggestion?: string;
      snippet?: string;
    }

    export interface FunctionMetadata {
      name: string;
      startLine: number;
      endLine: number;
      lines: number;
      params: number;
      isExported: boolean;
      isAsync: boolean;
      hasJSDoc: boolean;
    }

    export interface FunctionAnalysis extends FunctionMetadata {
      complexity?: number;
      bodyHash?: string;
      normalizedBody?: string;
    }

- id: E2-T4
  action: UPDATE
  files:
    - src/commands/fix/core/types/analysis.ts
    - src/commands/refactor/core/types/duplicate.ts
  change: "extends AnalysisMetadata / FunctionMetadata"
```

### Task 2.3: Centralize Agent Categories

```yaml
- id: E2-T5
  action: CREATE
  file: src/lib/@agents/categories.ts
  content: |
    export const AGENT_CATEGORIES = [
      'security', 'performance', 'architecture', 'quality',
      'debugging', 'docs', 'frontend', 'backend', 'database',
      'devops', 'testing'
    ] as const;

    export type AgentCategory = typeof AGENT_CATEGORIES[number];

    export interface CategoryInfo {
      label: string;
      description: string;
      aliases: string[];
      plugins: string[];
      primaryAgents: string[];
    }

    export const CATEGORY_INFO: Record<AgentCategory, CategoryInfo> = { ... };

- id: E2-T6
  action: CREATE
  file: src/lib/@agents/task-keywords.ts
  content: TASK_KEYWORDS mapping from orchestrator.ts

- id: E2-T7
  action: UPDATE
  files:
    - src/commands/agent/categories.ts
    - src/commands/agent/orchestrator.ts
    - src/mcp/tools/agent/index.ts
  change: "import from '@/lib/@agents'"
```

### Verification
```bash
krolik refactor --duplicates-only  # 0 duplicates
```

---

## Epic 3: Module Consolidation
**Priority:** P1 | **Effort:** 16h | **Risk:** High

### Task 3.1: Consolidate @core

```yaml
- id: E3-T1
  action: MERGE
  operations:
    - from: src/lib/@core/fs/
      to: src/lib/@core/fs.ts
    - from: src/lib/@core/logger/
      to: src/lib/@core/logger.ts
    - from: src/lib/@core/shell/
      to: src/lib/@core/shell.ts
    - from: src/lib/@core/time/
      to: src/lib/@core/time.ts
    - from: src/lib/@core/utils/
      to: src/lib/@core/utils.ts
```

### Task 3.2: Consolidate other modules

```yaml
- id: E3-T2
  action: MERGE
  operations:
    - from: [src/lib/@format/core/, src/lib/@format/xml/]
      to: src/lib/@format/
    - from: [src/lib/@storage/docs/, src/lib/@storage/memory/]
      to: src/lib/@storage/
    - from: [src/lib/@discovery/architecture/, src/lib/@discovery/reusables/]
      to: src/lib/@discovery/
    - from: [src/lib/@integrations/context7/*/]
      to: src/lib/@integrations/context7/
```

### Task 3.3: Layer Enforcement

```yaml
- id: E3-T3
  action: CREATE
  file: .eslintrc.layers.js
  content: Layer boundary rules
```

### Verification
```bash
ls -d src/lib/@*/ | wc -l  # ~25
eslint --config .eslintrc.layers.js src/lib/  # 0 violations
```

---

## Epic 4: Performance Optimization
**Priority:** P1 | **Effort:** 8h | **Risk:** Low

### Tasks

```yaml
- id: E4-T1
  action: REFACTOR
  file: src/commands/refactor/runner/analysis.ts
  change: "O(n²) → O(n) duplicate merging with Map"

- id: E4-T2
  action: REFACTOR
  file: src/commands/agent/loader.ts
  change: "Add agent caching with TTL"

- id: E4-T3
  action: REFACTOR
  file: src/lib/@ast/swc/parser.ts
  change: "LRU cache 100 → 500, use lru-cache library"

- id: E4-T4
  action: ADD
  file: src/mcp/server.ts
  change: "Idle cleanup hooks for memory management"
```

---

## Epic 5: MCP Unification
**Priority:** P2 | **Effort:** 10h | **Risk:** Medium

### Tasks

```yaml
- id: E5-T1
  action: CREATE
  file: src/mcp/tools/core/error-handler.ts

- id: E5-T2
  action: CREATE
  file: src/mcp/tools/core/action-tool.ts

- id: E5-T3
  action: REFACTOR
  files:
    - src/mcp/tools/docs/index.ts
    - src/mcp/tools/modules/index.ts
    - src/mcp/tools/memory/index.ts
  change: "Use ActionBasedTool framework"
```

---

## Epic 6: Cleanup
**Priority:** P2 | **Effort:** 3h | **Risk:** Low

### Tasks

```yaml
- id: E6-T1
  action: REMOVE
  file: package.json
  dependencies:
    - "@typescript-eslint/parser"
    - "jscodeshift"
```

---

## Epic 7: Test Infrastructure
**Priority:** P2 | **Effort:** 40h | **Risk:** Low

### Priority Tests

```yaml
tests_to_add:
  - src/lib/@core/registry.ts
  - src/commands/agent/orchestrator.ts
  - src/commands/refactor/runner/analysis.ts
  - src/mcp/tools/core/action-tool.ts
  - src/lib/@agents/categories.ts
```

---

## Execution Order

```
Week 1:
├── Epic 0: Circular deps (2h)
└── Epic 4: Performance quick wins (8h)

Week 2-3:
└── Epic 1: Hot files decoupling (40h)

Week 4:
└── Epic 2: Duplicates consolidation (22h)

Week 5:
├── Epic 3: Module consolidation (16h)
└── Epic 5: MCP unification (10h)

Week 6+:
├── Epic 6: Cleanup (3h)
└── Epic 7: Tests (40h, ongoing)
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Circular Dependencies | 5 | 0 |
| Max Dependents/File | 60 | <15 |
| Function Duplicates | 138 | 0 |
| Type Duplicates | 60 | 0 |
| Lib Modules | 49 | ~25 |
| Architecture Score | 66 | 85+ |
| Test Coverage | 2.4% | 30%+ |
