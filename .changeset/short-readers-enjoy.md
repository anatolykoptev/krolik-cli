---
"@anatolykoptev/krolik-cli": minor
---

## 🚀 Major Performance & i18n Improvements

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
