# Context Command Refactoring Plan

## Current State

### Overview

| File | Lines | Issues |
|------|-------|--------|
| `index.ts` | 1,022 | SRP violations, mixed concerns |
| `buildAiContextData()` | 239 | 9 responsibilities in single function |
| `loadLibraryDocs()` | 110 | 5 responsibilities |
| `formatters/` | 3,742 | 22 files, over-consolidated |
| `details.ts` | 666 | 10 formatters in one file |

### Legacy Code (Unused)

4 regex parsers that are no longer used:

```
formatters/
├── components.ts    # Legacy component parser
├── zod.ts           # Legacy Zod schema parser
├── tests.ts         # Legacy test file parser
└── types-parser.ts  # Legacy types parser
```

---

## Problems

### 1. SRP Violations in `buildAiContextData()`

The function handles 9 distinct responsibilities that should be separate modules:

| # | Responsibility | Lines | Description |
|---|----------------|-------|-------------|
| 1 | Mode resolution | ~15 | Determining quick/deep/full mode |
| 2 | Git information | ~25 | Branch, status, recent commits |
| 3 | Project tree | ~30 | Directory structure scanning |
| 4 | Schema loading | ~20 | Prisma schema parsing |
| 5 | Routes loading | ~20 | tRPC routes extraction |
| 6 | Memory retrieval | ~25 | Recent decisions/patterns |
| 7 | Library docs | ~35 | Context7 documentation |
| 8 | GitHub issues | ~40 | Issue fetching and formatting |
| 9 | Quality audit | ~30 | Code quality checks |

**Example of violation** (pseudo-code):

```typescript
// Current: Everything in one function
async function buildAiContextData(options: ContextOptions) {
  // Mode resolution
  const mode = resolveMode(options);

  // Git info - should be in builders/git-info.ts
  const gitInfo = await getGitStatus();
  const commits = await getRecentCommits();

  // Schema - should be in sections/core.ts
  const schema = await loadPrismaSchema();

  // Routes - should be in sections/core.ts
  const routes = await loadTrpcRoutes();

  // Memory - should be in sections/memory.ts
  const memories = await getRecentMemories();

  // Library docs - should be in sections/library-docs.ts
  const docs = await loadLibraryDocs();

  // GitHub - should be in sections/github.ts
  const issues = await fetchGitHubIssues();

  // Quality - should be in sections/quality.ts
  const audit = await runAudit();

  // ... 200+ more lines
}
```

### 2. Legacy Parsers (Dead Code)

These parsers are no longer called from anywhere in the codebase:

| File | Original Purpose | Status |
|------|-----------------|--------|
| `components.ts` | Parse React component structure | **Unused** - replaced by AST analysis |
| `zod.ts` | Parse Zod validation schemas | **Unused** - schema info from Prisma |
| `tests.ts` | Parse test file structure | **Unused** - not needed for context |
| `types-parser.ts` | Parse TypeScript type definitions | **Unused** - replaced by modules tool |

**Action:** Delete all 4 files in Tier 1.

### 3. Formatters Over-Consolidation

`details.ts` at 666 lines contains 10 different formatters:

```typescript
// formatters/details.ts - 666 lines
export function formatSchemaDetails() { /* 80 lines */ }
export function formatRouteDetails() { /* 70 lines */ }
export function formatGitDetails() { /* 60 lines */ }
export function formatMemoryDetails() { /* 55 lines */ }
export function formatIssueDetails() { /* 75 lines */ }
export function formatAuditDetails() { /* 65 lines */ }
export function formatTreeDetails() { /* 50 lines */ }
export function formatDocsDetails() { /* 70 lines */ }
export function formatEnvDetails() { /* 45 lines */ }
export function formatDepsDetails() { /* 60 lines */ }
// + helpers and utilities
```

---

## Proposed Structure

```
context/
├── index.ts              # Entry point, command registration (~100 lines)
├── constants.ts          # All paths, limits, defaults
│
├── modes/                # Mode-specific logic
│   ├── index.ts          # Mode resolver
│   ├── minimal.ts        # Minimal context (architecture only)
│   ├── quick.ts          # Quick context (+ git, tree, schema, routes)
│   └── deep.ts           # Deep context (+ imports, types, env)
│
├── sections/             # Data gathering by domain
│   ├── core.ts           # Schema + routes (always loaded)
│   ├── memory.ts         # Memory retrieval
│   ├── library-docs.ts   # Context7 docs loading
│   ├── github.ts         # Issues fetching
│   └── quality.ts        # Audit integration
│
├── builders/             # Context assembly
│   ├── ai-context.ts     # Main context builder
│   └── git-info.ts       # Git status, commits, diff
│
└── formatters/           # Output formatting (refactored)
    ├── index.ts          # Format coordinator
    ├── schema.ts         # Schema formatting
    ├── routes.ts         # Routes formatting
    ├── git.ts            # Git info formatting
    ├── memory.ts         # Memory formatting
    ├── issues.ts         # GitHub issues formatting
    ├── audit.ts          # Audit results formatting
    ├── tree.ts           # Directory tree formatting
    ├── docs.ts           # Library docs formatting
    └── utils.ts          # Shared formatting utilities
```

### File Size Targets

| File | Target Lines | Responsibility |
|------|--------------|----------------|
| `index.ts` | ~100 | Command registration only |
| `modes/*.ts` | ~50 each | Mode-specific section selection |
| `sections/*.ts` | ~80-120 each | Single domain data loading |
| `builders/*.ts` | ~100-150 each | Context assembly logic |
| `formatters/*.ts` | ~60-80 each | Single formatter per file |
| `constants.ts` | ~50 | All configuration values |

---

## Refactoring Tiers

### Tier 1: Delete Dead Code

**Effort:** Low | **Risk:** None | **Impact:** -400 lines

Delete the 4 unused legacy parsers:

```bash
# Files to delete
rm formatters/components.ts  # ~100 lines
rm formatters/zod.ts         # ~100 lines
rm formatters/tests.ts       # ~100 lines
rm formatters/types-parser.ts # ~100 lines
```

**Verification:**
1. Search for imports of these files
2. Run tests to confirm no breakage
3. Commit with message: "chore: remove unused legacy parsers"

### Tier 2: Split & Reorganize

**Effort:** Medium | **Risk:** Low | **Impact:** Better maintainability

#### 2.1 Split `details.ts` into individual formatters

```typescript
// Before: formatters/details.ts (666 lines)
// After: 10 separate files (~60-80 lines each)

// formatters/schema.ts
export function formatSchemaDetails(schema: PrismaSchema): string {
  // ... 80 lines
}

// formatters/routes.ts
export function formatRouteDetails(routes: TrpcRoutes): string {
  // ... 70 lines
}

// etc.
```

#### 2.2 Extract `diff-utils.ts` from `git.ts`

```typescript
// builders/git-info.ts - main git operations
export async function getGitInfo(): Promise<GitInfo> { }
export async function getRecentCommits(): Promise<Commit[]> { }

// builders/diff-utils.ts - diff parsing and formatting
export function parseDiffOutput(diff: string): DiffEntry[] { }
export function formatDiffSummary(entries: DiffEntry[]): string { }
```

### Tier 3: Full Architectural Restructuring

**Effort:** High | **Risk:** Medium | **Impact:** Clean architecture

#### 3.1 Create mode handlers

```typescript
// modes/index.ts
export type ContextMode = 'minimal' | 'quick' | 'deep' | 'full';

export function resolveMode(options: ContextOptions): ContextMode {
  if (options.mapOnly) return 'minimal';
  if (options.quick) return 'quick';
  if (options.deep) return 'deep';
  if (options.full) return 'full';
  return 'quick'; // default
}

export function getSectionsForMode(mode: ContextMode): SectionName[] {
  const sections: Record<ContextMode, SectionName[]> = {
    minimal: ['architecture'],
    quick: ['architecture', 'git', 'tree', 'schema', 'routes'],
    deep: ['architecture', 'git', 'tree', 'schema', 'routes', 'imports', 'types', 'env'],
    full: ['architecture', 'git', 'tree', 'schema', 'routes', 'imports', 'types', 'env', 'memory', 'docs', 'issues', 'audit'],
  };
  return sections[mode];
}
```

#### 3.2 Create section loaders

```typescript
// sections/core.ts
export async function loadCoreContext(project: Project): Promise<CoreContext> {
  const [schema, routes] = await Promise.all([
    loadPrismaSchema(project),
    loadTrpcRoutes(project),
  ]);
  return { schema, routes };
}

// sections/memory.ts
export async function loadMemoryContext(project: Project, limit = 10): Promise<MemoryContext> {
  const memories = await getRecentMemories(project.name, limit);
  return { memories };
}

// sections/library-docs.ts
export async function loadLibraryDocsContext(project: Project): Promise<LibraryDocsContext> {
  const docs = await searchCachedDocs(project);
  return { docs };
}

// sections/github.ts
export async function loadGitHubContext(project: Project): Promise<GitHubContext> {
  const issues = await fetchRecentIssues(project);
  return { issues };
}

// sections/quality.ts
export async function loadQualityContext(project: Project): Promise<QualityContext> {
  const audit = await runQuickAudit(project);
  return { audit };
}
```

#### 3.3 Refactor main builder

```typescript
// builders/ai-context.ts
import { resolveMode, getSectionsForMode } from '../modes';
import * as sections from '../sections';

export async function buildAiContextData(options: ContextOptions): Promise<AiContext> {
  const mode = resolveMode(options);
  const sectionNames = getSectionsForMode(mode);

  const loaders: Record<SectionName, () => Promise<unknown>> = {
    architecture: () => loadArchitecture(options.project),
    git: () => getGitInfo(options.project),
    tree: () => loadProjectTree(options.project),
    schema: () => sections.loadCoreContext(options.project).then(c => c.schema),
    routes: () => sections.loadCoreContext(options.project).then(c => c.routes),
    memory: () => sections.loadMemoryContext(options.project),
    docs: () => sections.loadLibraryDocsContext(options.project),
    issues: () => sections.loadGitHubContext(options.project),
    audit: () => sections.loadQualityContext(options.project),
  };

  const results = await Promise.all(
    sectionNames.map(name => loaders[name]())
  );

  return assembleSections(sectionNames, results);
}
```

#### 3.4 Extract constants

```typescript
// constants.ts
export const CONTEXT_LIMITS = {
  DEFAULT_TOKEN_BUDGET: 2000,
  MAX_TREE_DEPTH: 4,
  MAX_COMMITS: 10,
  MAX_ISSUES: 5,
  MAX_MEMORIES: 10,
  MAX_DOCS: 5,
} as const;

export const CONTEXT_PATHS = {
  CACHE_FILE: '.krolik/CONTEXT.xml',
  SCHEMA_GLOB: '**/prisma/schema.prisma',
  ROUTES_GLOB: '**/router/**/*.ts',
} as const;

export const CONTEXT_DEFAULTS = {
  mode: 'quick' as const,
  includeMemory: true,
  includeDocs: true,
} as const;
```

---

## Migration Path

### Phase 1: Cleanup (1-2 hours)
1. Delete 4 legacy parsers
2. Remove unused imports
3. Run tests, commit

### Phase 2: Split Formatters (2-3 hours)
1. Create individual formatter files
2. Move functions from `details.ts`
3. Update imports
4. Delete `details.ts`
5. Run tests, commit

### Phase 3: Create New Structure (4-6 hours)
1. Create `modes/`, `sections/`, `builders/` directories
2. Extract mode logic to `modes/`
3. Extract section loaders to `sections/`
4. Refactor `buildAiContextData()` to use new structure
5. Move constants to `constants.ts`
6. Update all imports
7. Run full test suite
8. Commit with detailed message

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| `index.ts` lines | 1,022 | ~100 |
| Largest file | 666 lines | <150 lines |
| Average file size | ~170 lines | ~80 lines |
| Dead code | 4 files | 0 files |
| SRP violations | 9 in one function | 0 |
| Test coverage | N/A | >80% per module |

---

## Notes

- All file paths are relative to `krolik-cli/src/commands/context/`
- Line counts are approximate based on current codebase analysis
- Tier 1 can be done immediately with zero risk
- Tier 2 and 3 should be done in separate PRs for easier review
