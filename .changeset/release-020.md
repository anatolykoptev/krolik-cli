---
"@anatolykoptev/krolik-cli": patch
---

## v0.2.0 Release

### ✨ Highlights

- **Batch Fix with Parallel Execution** - Process multiple files simultaneously with automatic conflict detection
- **Major Cleanup** - Removed 65+ lines of dead code from analyzers
- **Consolidated Utilities** - Moved `strategies/shared/` utilities to `core/` for cleaner architecture
- **Single AST Pass** - 5x faster analysis with unified SWC analyzer

### 🔧 Technical Improvements

- Eliminated double analysis in fix workflow
- Added O(1) Map lookup tables for fixer ID mapping
- Deprecated old utility locations with backward-compatible re-exports
