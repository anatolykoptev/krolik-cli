# @anatolykoptev/krolik-cli

## 0.16.0

### Minor Changes

- [`5069f19`](https://github.com/anatolykoptev/krolik-cli/commit/5069f196e79e47178554bdba50c8147a1e555f79) - Smarter fix command with context-aware analysis

  ### Console analyzer improvements
  - Context-aware classification: distinguishes debug logging from error handling
  - Skips `console.error`/`console.warn` in catch blocks and error handlers
  - Recognizes structured logging patterns (logger, winston, pino, bunyan)
  - Different severity levels: debug → warning (auto-fix), error in handler → info (review)

  ### Magic numbers analyzer improvements
  - Smart constant name suggestions based on value patterns
  - Time values: `86400000` → `ONE_DAY_MS`, `5000` → `FIVE_SECONDS_MS`
  - File sizes: `1048576` → `ONE_MB`, `5242880` → `FIVE_MB`
  - Context-aware names: `setTimeout(fn, 3000)` → `DELAY_3000MS`

## 0.15.1

### Patch Changes

- [`a49ef4d`](https://github.com/anatolykoptev/krolik-cli/commit/a49ef4d897ffec09674b8caaf37b3c8d0c76d46c) - Cleaned up README: removed verbose sections, added changelog

## 0.15.0

### Minor Changes

- [`9cd40a3`](https://github.com/anatolykoptev/krolik-cli/commit/9cd40a3bf8b1ee2f0598575998b9528966c4cf6a) - ## Refactor component major cleanup

  ### Architecture
  - Unified runner system: migrated from dual (enhanced.ts + registry-runner) to single registry-based system
  - Deleted deprecated `enhanced.ts` (313 lines) - all functionality now in registry analyzers

  ### Code Quality
  - Split large files into focused modules:
    - `safe-order.ts` (486→226 lines): extracted `tarjan.ts`, `kahn.ts`, `classification.ts`
    - `swc-parser.ts` (462→17 lines): split into 6 modules in `swc-parser/` directory
    - `analyzer.ts` (452→120 lines): split into 6 modules in `strategies/` directory
  - Consolidated `offsetToPosition` with shared `@/lib/@ast/swc` implementation
  - Removed 10 deprecated shims and functions

  ### Duplicate Detection
  - Added 20+ new verb prefixes to filter intentional patterns (extract, find, analyze, escape, etc.)
  - Reduced false positives from 63 to 59 (-6.3%)
  - Improved structural clone detection accuracy

- [`06d949f`](https://github.com/anatolykoptev/krolik-cli/commit/06d949febe255a3e420ecd94fffbab9490d346d7) - feat(agent): add semantic matching for smarter agent selection

  ### New Features
  - **Semantic Agent Matching**: Uses Xenova embeddings to find semantically similar agents
  - **Graceful Fallback**: Falls back to keyword-only matching if embeddings unavailable
  - **Score Transparency**: Shows semantic similarity percentage in score breakdown

  ### Scoring Changes

  New scoring breakdown (0-100, normalized):
  - Keyword match: 0-40 points (unchanged)
  - **Semantic match: 0-15 points (NEW)**
  - Context boost: 0-30 points (unchanged)
  - History boost: 0-20 points (unchanged)
  - Freshness bonus: 0-10 points (unchanged)

  ### How It Works
  1. Task description is embedded using all-MiniLM-L6-v2 model
  2. Agent descriptions are embedded and cached (in-memory)
  3. Cosine similarity is calculated between task and each agent
  4. Similarity thresholds determine score (calibrated for MiniLM-L6-v2):
     - 0.50+ = 15 points (very similar)
     - 0.35-0.50 = 10 points (similar)
     - 0.25-0.35 = 5 points (somewhat similar)

  ### Benefits
  - "optimize" now finds "performance-engineer" (no keyword overlap needed)
  - "fix bugs" now finds "debugger" (semantic understanding)
  - Better agent recommendations for natural language queries

- [`33000d5`](https://github.com/anatolykoptev/krolik-cli/commit/33000d578ca477b547dbe27177609828c430f686) - feat(memory): add worker thread architecture for non-blocking embeddings

  ### New Features
  - **Worker Thread Pool**: Model loading now happens in isolated worker thread, preventing MCP server blocking
  - **Preload at Startup**: `preloadEmbeddingPool()` fires model loading immediately when MCP server starts
  - **Graceful Fallback**: BM25 search works instantly while model loads in background
  - **Idle Timeout**: Worker releases after 5 minutes of inactivity (~23MB memory savings)
  - **Hybrid Search**: Automatic mode selection between BM25-only and hybrid (BM25 + semantic)

  ### Performance Improvements
  - MCP server responds instantly during model initialization
  - First semantic search no longer blocks for 2-3 seconds
  - Memory efficient: worker only active when needed

  ### Technical Details
  - New `embedding-worker.ts` for isolated model loading
  - New `embedding-pool.ts` for worker lifecycle management
  - Updated `embeddings.ts` to use worker pool
  - Separate tsup bundle for worker thread
  - Added `sharp` and `protobufjs` to pnpm.onlyBuiltDependencies

  ### Bug Fixes
  - Fixed worker path resolution for both development (tsx) and production (dist) environments
  - Worker path now correctly resolves from `import.meta.url` in all scenarios

## 0.14.1

### Patch Changes

- [`1d804b1`](https://github.com/anatolykoptev/krolik-cli/commit/1d804b1499d75baa7eb1c486bdddc0db05e170ee) - ### Fix: Critical dependency issue for new installations

  **CRITICAL FIX**: Previously, new users installing `krolik-cli` globally would get runtime errors:

  ```
  Cannot find module '@swc/core'
  ```

  This happened because `@swc/core` was incorrectly placed in `devDependencies` instead of `dependencies`, even though it's used at runtime for AST parsing.

  **Changes:**
  - Move `@swc/core` from `devDependencies` to `dependencies`
  - Remove `@swc/core-darwin-arm64` (platform-specific, auto-installed by `@swc/core`)
  - Remove unused `ora` dependency
  - Add `@swc/core` to `pnpm.onlyBuiltDependencies` for proper native module compilation

## 0.14.0

### Minor Changes

- [`ca7f38a`](https://github.com/anatolykoptev/krolik-cli/commit/ca7f38a06e77b2f68efc3f4a6fa4d670a315a367) - ### CLI Architecture Refactoring
  - **Builder Pattern**: New `builders/` module with reusable option builders:
    - `addProjectOption` - Multi-project workspace support
    - `addPathOption` - Path filtering
    - `addModeSwitch` - Quick/deep mode switches
    - `addDryRunOption`, `addForceOption` - Action modifiers
  - **Parsers Module**: New `parsers/` module with centralized parsing utilities:
    - `parseMode` - Mode option parsing
    - `resolveOutputFormat` - Output format resolution
    - `parseIntOption`, `parseStringArray` - Common parsers
  - **Unified Types**: Expanded `types.ts` with comprehensive CLI type definitions
  - **Command Migration**: All 18 command files now use builder pattern
  - **Removed**: Deprecated `quality` command (use `audit` instead)
  - **Improved**: Duplicate detection with architectural pattern awareness

## 0.12.0

### Minor Changes

- [`296cccc`](https://github.com/anatolykoptev/krolik-cli/commit/296cccc2e0eee3fb87a1647f02720479f27732e3) - Add smart AI-optimized output formats for schema and routes commands

  **Schema command:**
  - New default smart format (-71% output size)
  - Hides standard fields (id, createdAt, updatedAt)
  - Hides obvious defaults (cuid, now, false, 0)
  - Groups fields by importance: keys, data, meta
  - Compact field notation: `name?`, `email!`, `status:BookingStatus`
  - New `--compact` flag for minimal overview
  - New `--full` flag for verbose legacy format

  **Routes command:**
  - New default smart format (-58% output size)
  - Dynamic domain detection from file paths (37 domains vs 5 hardcoded)
  - Groups procedures by type (queries/mutations) on single line
  - Shows only unprotected as exceptions (75% are protected)
  - New `--compact` flag for router counts only
  - New `--full` flag for verbose legacy format

  **CLI:**
  - Added `--project` option to both schema and routes commands

## 0.11.0

### Minor Changes

- [`2d94267`](https://github.com/anatolykoptev/krolik-cli/commit/2d94267671f15bd244baf729b56a3221e6087051) - feat(schema): Add filters, compact mode, and smart domain detection

  **New features:**
  - `--model <name>` - Filter by model name (partial match, case-insensitive)
  - `--domain <name>` - Filter by domain name
  - `--compact` - Compact output showing only model names and relations (86% size reduction)

  **Improvements:**
  - Dynamic domain inference from filenames (works with any schema structure)
  - Foundation for smart relation-based domain detection (#28)

## 0.10.1

### Patch Changes

- [`3702c6f`](https://github.com/anatolykoptev/krolik-cli/commit/3702c6f60b0a418851162b90b79143602db2f506) - docs: Update README with new v0.10.0 features
  - Added `--search` and `--changed-only` options to context command examples
  - Added `krolik modules` command section
  - Added audit modes (release, queries, pre-commit)

## 0.10.0

### Minor Changes

- [`ba502cd`](https://github.com/anatolykoptev/krolik-cli/commit/ba502cd93f23d241e77911f3f9b46ac13260b4b7) - ### New Features

  **Context command improvements:**
  - Add `--search <pattern>` option to find files/code matching pattern (uses ripgrep or grep)
  - Add `--changed-only` option to include only files changed in git
  - Improved lib-modules section with function signatures for all modules

  **Modules command:**
  - Fixed signature extraction for files with UTF-8/Russian text (byte offset vs char index bug)
  - AST-based type reconstruction via `typeNodeToString()` function
  - Proper handling of complex TypeScript types

  **Audit command:**
  - New `mode=queries` to detect duplicate Prisma/tRPC queries
  - Pattern-based detection for consolidation opportunities

- [`fc18455`](https://github.com/anatolykoptev/krolik-cli/commit/fc184552bfabfcab60c84e9b61a0400556d557ef) - ### New Features

  **Context command improvements:**
  - Add `--search <pattern>` option to find files/code matching pattern (uses ripgrep or grep)
  - Add `--changed-only` option to include only files changed in git
  - Improved lib-modules section with function signatures for all modules

  **Modules command:**
  - Fixed signature extraction for files with UTF-8/Russian text (byte offset vs char index bug)
  - AST-based type reconstruction via `typeNodeToString()` function
  - Proper handling of complex TypeScript types

  **Audit command:**
  - New `mode=queries` to detect duplicate Prisma/tRPC queries
  - Pattern-based detection for consolidation opportunities

## 0.9.0

### Minor Changes

- feat(agent): modular architecture + constants extraction
  - Refactored agent command into modular structure (context/, orchestrator/)
  - Extracted all magic numbers to centralized constants.ts
  - Added smart memory search with relevance ranking
  - Improved context enrichment with library docs
  - Added execution history persistence

## 0.8.0

### Minor Changes

- ### Features
  - feat(context): Smart Context v2 with PageRank ranking and domain filtering

## 0.7.0

### Minor Changes

- [`2c5679c`](https://github.com/anatolykoptev/krolik-cli/commit/2c5679c1628b69b567c389447edc79a590997144) - ## 0.6.0 - Structural Clone Detection

  ### Features
  - **Structural Clone Detection** - New fingerprint-based algorithm for detecting renamed clones
    - Catches functions with same logic but different variable/function names
    - Uses AST normalization + MD5 hashing for structural comparison
    - Integrated into `refactor` command output as `[structural clone]` entries

  ### Fixes
  - **SWC Parser Fix** - Fixed critical bug with accumulating span offsets
    - SWC's `parseSync` accumulates byte offsets across multiple calls
    - Now uses centralized `parseFile` from `@ast/swc/parser` with `baseOffset` normalization

  ### Changes
  - **Fixers Risk Assessment** - All fixers marked as `risky` (not production-ready)
    - 16 fixers updated to prevent accidental code modifications
    - Use `--all` flag to enable risky fixers explicitly

## 0.6.0

### Minor Changes

- **Structural Clone Detection** - New fingerprint-based algorithm for detecting renamed clones
  - Catches functions with same logic but different variable/function names
  - Uses AST normalization + MD5 hashing for structural comparison
  - Integrated into `refactor` command output as `[structural clone]` entries
  - Found 82 structural clone groups in krolik-cli codebase

- **SWC Parser Fix** - Fixed critical bug with accumulating span offsets
  - SWC's `parseSync` accumulates byte offsets across multiple calls
  - Now uses centralized `parseFile` from `@ast/swc/parser` with `baseOffset` normalization
  - All span-dependent operations (body extraction, fingerprinting) now work correctly

- **Fixers Risk Assessment** - All fixers marked as `risky` (not production-ready)
  - 16 fixers updated: console, debugger, alert, ts-ignore, any-type, equality, etc.
  - Prevents accidental code modifications until fixers are properly tested
  - Use `--all` flag to enable risky fixers explicitly

### Technical Details

- Added `fingerprint` and `complexity` fields to `FunctionSignature` type
- Integrated `generateFingerprint()` in duplicate parsing pipeline
- Added fingerprint-based grouping in `analyzer.ts` for structural clone detection
- Fixed `extractFunctionsSwc`, `extractTypesSwc` and related functions to use `baseOffset`

## 0.5.0

### Minor Changes

- [`8b3b6d1`](https://github.com/anatolykoptev/krolik-cli/commit/8b3b6d1b458664630e1c43cd1133b1cf1ecb0fbc) - ## Architecture Migration: Scalability Improvements

  ### Epic 0: Circular Dependencies (13 fixed)
  - Fixed cycles in @ast/swc, @i18n, refactor/core, codegen, context, migration handlers
  - Extracted types to separate files to break dependency cycles

  ### Epic 1: Hot Files Decoupling
  - Decoupled refactor/core/index.ts (47→12 exports)
  - Updated lib/index.ts imports (44 files to direct imports)
  - Split fix/types.ts into core/types/ folder structure
  - Decoupled types/index.ts barrel file

  ### Epic 2: Duplicates Consolidation
  - Created generic Registry<T> in lib/@core/registry/
  - Removed MCP tools duplicates (truncate, escapeXml, escapeShellArg)
  - Consolidated storage type duplicates
  - Unified QualityCategory across 3 locations
  - Created groupBy utilities in lib/@core/utils/grouping.ts

  ### Epic 3: Module Consolidation
  - Renamed @git → @vcs (13 files updated)
  - Merged @constants → @core/constants
  - Created @detectors/patterns module
  - Minimized lib/index.ts (200+ → ~20 exports)
  - Simplified @integrations/context7 (4→2 folders)
  - Reorganized @detectors into lint/security/quality/patterns structure

  ### Epic 4: Performance Optimization
  - Fixed 6 O(n²) algorithms in ranking and architecture modules
  - Converted array.find() in loops to Map lookups

  ### Epic 5: MCP Unification
  - Added formatToolError, withErrorHandler, validateActionRequirements
  - Standardized error handling across MCP tools

  ### Epic 6: Cleanup
  - Removed 2 unused dependencies (@typescript-eslint/parser, jscodeshift)
  - Reduced node_modules by 31 packages

  ### Results
  - 0 circular dependencies (was 13)
  - 4 hot barrel files decoupled
  - 198 duplicates consolidated
  - 5-layer architecture established

## 0.4.0

### Minor Changes

- [`ef70c3b`](https://github.com/anatolykoptev/krolik-cli/commit/ef70c3b839d0b6a0b4999f9875cb8f25c8466f38) - ## 🚀 Major Performance & i18n Improvements

  ### ⚡ Performance (4x Speedup)
  - **SWC replaces ts-morph** for type analysis - deep mode: 30s → 7.5s
  - **Quick mode optimized** - skips heavy operations (affected imports, XML gen)
  - **PageRank ranking** now included in quick mode without performance penalty
  - Performance comparison:
    - Quick: 4.4s (was 6.9s) — 35% faster
    - Default: 5.2s (unchanged)
    - Deep: 7.5s (was ~30s) — 4x faster

  ### 🌍 Enterprise i18n (Google/Airbnb Standard)
  - **Catalog-first workflow** — check existing translations before code changes
  - **LocaleCatalog module** — fast reverse lookup (value → key) via indexed maps
  - **KeyResolver** — collision detection with automatic suffix generation
  - **Fixer lifecycle hooks** — `onStart()` / `onComplete()` for stateful fixers
  - **Pluggable language system** — LanguagePlugin interface for extensibility
  - **GOST 7.79-2000** transliteration standard for Russian

  ### 📊 PageRank Analysis
  - **Dependency hotspots** using PageRank algorithm
  - **Coupling metrics** — Ca (afferent), Ce (efferent), Instability index
  - **Safe refactoring order** — topological sort with Kahn's algorithm
  - **Cycle detection** — Tarjan's SCC algorithm
  - **Node classification** — leaf/intermediate/core based on centrality

  ### 🏗️ Architecture Improvements
  - **Token budget-aware output** — summary (~10K), standard (~25K), full modes
  - **Registry-based sections** — modular output generation
  - **Hexagonal architecture** — better layer separation with DI
  - **Boundary file recognition** — architecture analyzer improvements

  ### 🐛 Bug Fixes
  - Fix UI action patterns filter (openDialog, closeModal, etc.)
  - Fix duplicate detection false positives
  - Fix test expectations for key-generator transliteration
  - Remove obsolete tests for deleted modules

## 0.3.0

### Minor Changes

- [`66954fe`](https://github.com/anatolykoptev/krolik-cli/commit/66954fe58e1f75b3f607c6c7d5c2b1508b439160) - ## SWC AST for Accurate Analysis
  - **Architecture analyzer**: Uses SWC AST instead of regex for import detection
  - Properly skips type-only imports and re-exports
  - Architecture score improved from 35 → 70

  ## Duplicate Detection Improvements
  - Fixed false positives for arrow functions in object literals
  - Duplicates reduced from 33 → 0

  ## New Features
  - XML optimization with 4 levels for AI context
  - Context modes: --minimal, --quick, --deep
  - Library docs caching via Context7
  - Updated README with new commands

## 0.2.1

### Patch Changes

- [`0c25550`](https://github.com/anatolykoptev/krolik-cli/commit/0c25550f0e1d525a7d927923cd684e3026d9316c) - ## v0.2.0 Release

  ### ✨ Highlights
  - **Batch Fix with Parallel Execution** - Process multiple files simultaneously with automatic conflict detection
  - **Major Cleanup** - Removed 65+ lines of dead code from analyzers
  - **Consolidated Utilities** - Moved `strategies/shared/` utilities to `core/` for cleaner architecture
  - **Single AST Pass** - 5x faster analysis with unified SWC analyzer

  ### 🔧 Technical Improvements
  - Eliminated double analysis in fix workflow
  - Added O(1) Map lookup tables for fixer ID mapping
  - Deprecated old utility locations with backward-compatible re-exports

## 0.1.5

### Patch Changes

- [`ed192c3`](https://github.com/anatolykoptev/krolik-cli/commit/ed192c30d8d669ab78fc2c8822832fda464b0426) - Added release instructions to CONTRIBUTING.md:
  - Changesets workflow documentation
  - npm Trusted Publishers setup guide
  - Manual and automated publishing instructions
  - Release checklist

## 0.1.4

### Patch Changes

- Consolidate duplicate code via multi-agent orchestration:
  - Extracted shared scanDir utility for directory traversal
  - Consolidated formatJson/formatMarkdown formatting utilities
  - Merged domain detection functions into single module
  - Unified agent utilities (forceRescan, readAgentFile, parseEnv)
  - Consolidated CommandOptions type into single source
  - Merged Git types into unified git types module
  - Consolidated parser types (ZodSchema, Relation, etc.)
  - Fixed MCP server TOOLS export for backward compatibility

  Net reduction: ~641 lines of code

## 0.1.3

### Patch Changes

- [`c84b8dc`](https://github.com/anatolykoptev/krolik-cli/commit/c84b8dc238640ba335c1fc98739f9e5276fd8374) - ## v0.1.2
  - Simplified README with focus on benefits
  - Fixed TypeScript errors across codebase
  - All 14 MCP tools documented
  - All 12 agent categories listed

## 0.1.1

### Patch Changes

- [`86ebc59`](https://github.com/anatolykoptev/krolik-cli/commit/86ebc59d53934bbdd4b40f200fd7383ec90bc110) - CI/CD setup complete: dual registry publishing (npmjs.org + GitHub Packages)
