# @anatolykoptev/krolik-cli

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
