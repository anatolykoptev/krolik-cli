# Refactor Component Cleanup Plan

> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Status:** Phase 1-4 Complete
> **Estimated Effort:** ~48 hours (8h remaining)

## Overview

This plan addresses technical debt in the `src/commands/refactor/` component identified through multi-agent analysis and manual code review.

## Progress Summary

| Phase | Status | Duration |
|-------|--------|----------|
| Phase 1: Cleanup | ✅ Complete | ~30 min |
| Phase 2: Architecture | ✅ Complete | ~45 min |
| Phase 3: Complexity | ✅ Complete | ~20 min |
| Phase 4: Quality | ✅ Complete | ~10 min |

## Current State (After Phase 3)

| Metric | Before | After Phase 2 | After Phase 3 |
|--------|--------|---------------|---------------|
| Files | ~100 | ~98 | ~115 (split) |
| Deprecated Shims | 10 | 0 | 0 |
| Runner Systems | 2 (dual) | 1 (unified) | 1 (unified) |
| enhanced.ts | 313 lines | DELETED | - |
| safe-order.ts | 486 lines | - | 226 lines |
| swc-parser.ts | 462 lines | - | 17 lines (barrel) |
| duplicates/analyzer.ts | 452 lines | - | 120 lines |

## Phase 1: Cleanup (Quick Wins) ✅ COMPLETE

### 1.1 Delete Deprecated Shims

| File | Action | Impact |
|------|--------|--------|
| `analyzers/file-size.ts` | DELETE | Update imports to `./metrics/file-size` |
| `core/file-cache.ts` | REMOVE deprecated functions | Keep only `clearResolverCache()` |
| `shared/helpers.ts:171` | REMOVE `getProject()` | Use `lib/@ast` directly |

**Estimated:** 2 hours

### 1.2 Remove Deprecated Options

In `core/options.ts`, remove:
- `duplicatesOnly` → use `mode='default'`
- `quickMode` → use `mode='quick'`
- `deepMode` → use `mode='deep'`
- `includeI18n` → use `mode='deep'`

**Estimated:** 1 hour

### 1.3 Update Imports After Shim Removal

Search and replace all imports pointing to deleted shims.

**Estimated:** 1 hour

---

## Phase 2: Architecture Consolidation ✅ COMPLETE

### 2.1 Unify Runner Systems

**Problem:** Two parallel systems existed:
- `enhanced.ts` → `createEnhancedAnalysis()`
- `runner/registry-runner.ts` → `runRegistryAnalysis()`

**Solution:** Migrate `enhanced.ts` logic into registry-based analyzers:

| Enhanced Function | Target Analyzer |
|-------------------|-----------------|
| Reusable modules | `reusable.analyzer.ts` (exists) |
| File size | `file-size.analyzer.ts` (exists) |
| i18n | `i18n.analyzer.ts` (exists) |
| API routes | `api.analyzer.ts` (exists) |
| Ranking | `ranking.analyzer.ts` (exists) |

After migration, `enhanced.ts` becomes a thin wrapper or gets deleted.

**Estimated:** 8 hours

### 2.2 Consolidate Entry Points

Current:
```
CLI → command.ts → runner/index.ts → enhanced.ts + registry-runner.ts
MCP → mcp/tools/refactor → runner/index.ts → ...
```

Target:
```
CLI → command.ts → runner/registry-runner.ts (single path)
MCP → mcp/tools/refactor → runner/registry-runner.ts (same path)
```

**Estimated:** 4 hours

---

## Phase 3: Complexity Reduction ✅ COMPLETE

### 3.1 Split Large Files

| File | Before | After | Modules Created |
|------|--------|-------|-----------------|
| `ranking/safe-order.ts` | 486 | 226 | `tarjan.ts` (93), `kahn.ts` (80), `classification.ts` (173) |
| `core/swc-parser.ts` | 462 | 17 | `swc-parser/types.ts`, `visitors.ts`, `shared.ts`, `function-extraction.ts`, `type-extraction.ts` |
| `core/duplicates/analyzer.ts` | 452 | 120 | `strategies/filters.ts`, `helpers.ts`, `name-duplicates.ts`, `body-duplicates.ts`, `structural-clones.ts` |

### 3.2 Findings: Duplicate Utilities ✅ RESOLVED

During Phase 3, identified consolidation opportunities with `@/lib/@ast/swc`:

| In swc-parser/ | Status | Action |
|----------------|--------|--------|
| `offsetToPosition()` | ✅ Consolidated | Now imports from `@/lib/@ast/swc` |
| `extractTypeText()` | ✅ Kept | Different purpose (span extraction vs AST reconstruction) |

**Resolution:**
- `offsetToPosition` — migrated to use `@/lib/@ast/swc` (same implementation)
- `extractTypeText` — kept as-is (extracts raw text for comparison, unlike `extractTypeString` which reconstructs from AST)

---

## Phase 4: Code Quality ✅ COMPLETE

### 4.1 Consolidate Duplicate Utilities

Migrated `offsetToPosition` to use shared `@/lib/@ast/swc` implementation.
Analyzed `extractTypeText` vs `extractTypeString` — kept separate (different purposes).

### 4.2 Remaining Work (Deferred)

For future iterations:
- Address functions with complexity > 10: `runRegistryAnalysis` (24)
- Add missing tests for registry-based analyzer system

---

## Implementation Order

```
Phase 1.1 → Phase 1.2 → Phase 1.3 → BUILD & TEST
     ↓
Phase 2.1 → Phase 2.2 → BUILD & TEST
     ↓
Phase 3.1 → Phase 3.2 → BUILD & TEST
     ↓
Phase 4.1 → Phase 4.2 → FINAL TEST
```

## Files to Delete (Phase 1)

```
src/commands/refactor/analyzers/file-size.ts  # Shim → ./metrics/
```

## Files to Modify (Phase 1)

```
src/commands/refactor/core/file-cache.ts      # Remove deprecated functions
src/commands/refactor/core/options.ts         # Remove deprecated options
src/commands/refactor/shared/helpers.ts       # Remove deprecated getProject()
```

## Success Criteria

- [x] Zero deprecated shims remaining
- [x] Single runner system (registry-based)
- [x] All files under 300 lines (largest: safe-order.ts at 226 lines)
- [ ] All functions with complexity < 15
- [x] Build passes
- [x] Tests pass (659 tests)

## Notes

- Always run `pnpm build` after each phase
- Commit after each sub-phase with descriptive message
- Keep backwards compatibility during transition (temporary re-exports OK)
