---
"@anatolykoptev/krolik-cli": minor
---

## Refactor component major cleanup

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
