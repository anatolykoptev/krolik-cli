---
"@anatolykoptev/krolik-cli": minor
---

## Architecture Migration: Scalability Improvements

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
