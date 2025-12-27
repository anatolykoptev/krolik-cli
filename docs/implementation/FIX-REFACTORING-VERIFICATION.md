# Fix Refactoring Verification Checklist

> Verifies that FIX-REFACTORING-PLAN.md phases integrate correctly with batch fix infrastructure

**Created:** 2025-12-26
**Status:** Analysis Complete

---

## Integration Points Analysis

### 1. conflict-detector.ts

**Location:** `src/commands/fix/core/conflict-detector.ts`

**fixerId Usage:** The conflict-detector does NOT directly use `fixerId`. Instead, it operates on:
- `OperationWithIssue` containing `{ operation: FixOperation, issue: QualityIssue }`
- Priority is computed from `issue.category`, `issue.message`, and `operation.action`

**Key Function:** `computePriority(issue, operation, customPriorityFn)`
- Uses `getFixDifficulty(issue)` which looks at `issue.category` and `issue.message`
- Priority weights: `trivial: 100`, `safe: 50`, `risky: 10`
- Does NOT require fixerId for conflict resolution

**Impact on Refactoring:** SAFE - conflict-detector works independently of fixerId.

---

### 2. parallel-executor.ts

**Location:** `src/commands/fix/parallel-executor.ts`

**fixerId Usage:** Does NOT use fixerId at all. It operates on:
- `FixPlan[]` - array of plans per file
- `FixPlanItem { issue, operation, difficulty }`

**Key Functions:**
- `applyFixesParallel(plans, options, logger)` - main entry point
- `executeParallel(plans, options)` - parallel execution across files
- `processFile(plan, options)` - sequential within file (bottom-to-top)

**Impact on Refactoring:** SAFE - parallel-executor only needs FixOperation, not fixerId.

---

### 3. plan.ts

**Location:** `src/commands/fix/plan.ts`

**fixerId Usage:** CRITICAL - this is where fixerId matters!

**Current Flow (lines 140-165):**
```typescript
// Try to use fixer from registry first (new architecture)
let operation: FixOperation | null = null;

if (issue.fixerId) {
  const fixer = registry.get(issue.fixerId);
  if (fixer) {
    operation = await fixer.fix(issue, content);
  }
}

// Fall back to legacy strategies if fixer not available
if (!operation) {
  const strategyResult = findStrategyDetailed(issue, content);
  // ... fallback to strategies
}
```

**Issue Found:** TypeCheck error reveals `findStrategyDetailed` is missing!
```
src/commands/fix/plan.ts(154,30): error TS2304: Cannot find name 'findStrategyDetailed'.
```

**Impact on Refactoring:** After Phase 1, all issues will have fixerId, so the strategy fallback can be removed.

---

### 4. unified-swc.ts (Current fixerId Assignments)

**Location:** `src/commands/fix/analyzers/unified-swc.ts`

**NOTE:** The code has ALREADY been updated with O(1) lookup maps (lines 431-453).
The fixerId values NOW match the fixer registry IDs.

**Current fixerId Lookup Maps (CORRECT):**

```typescript
const LINT_FIXER_IDS = new Map([
  ['console', 'console'],
  ['debugger', 'debugger'],
  ['alert', 'alert'],
  ['eval', 'eval'],
  ['empty-catch', 'empty-catch'],
]);

const TYPE_SAFETY_FIXER_IDS = new Map([
  ['any-annotation', 'any-type'],
  ['any-assertion', 'any-type'],
  ['any-param', 'any-type'],
  ['any-array', 'any-type'],
  ['non-null', 'non-null-assertion'],
  ['double-assertion', 'double-assertion'],
]);

const SECURITY_FIXER_IDS = new Map([
  ['command-injection', 'command-injection'],
  ['path-traversal', 'path-traversal'],
]);

const MODERNIZATION_FIXER_IDS = new Map([
  ['require', 'require'],
]);
```

| Detection Type | fixerId (NEW) | Registry Match? |
|---------------|---------------|-----------------|
| console | `console` | YES |
| debugger | `debugger` | YES |
| alert | `alert` | YES |
| eval | `eval` | YES |
| empty-catch | `empty-catch` | NO (fixer missing) |
| any-annotation | `any-type` | YES |
| non-null | `non-null-assertion` | NO (fixer missing) |
| double-assertion | `double-assertion` | NO (fixer missing) |
| command-injection | `command-injection` | NO (fixer missing) |
| path-traversal | `path-traversal` | NO (fixer missing) |
| require | `require` | NO (fixer missing) |

**Note:** `@ts-ignore` still uses a constant `TS_IGNORE_FIXER_ID` (line 771+)

---

### 5. Fixer Registry IDs

**Location:** `src/commands/fix/fixers/*/index.ts`

| Fixer | metadata.id | Category |
|-------|-------------|----------|
| consoleFixer | `console` | lint |
| debuggerFixer | `debugger` | lint |
| alertFixer | `alert` | lint |
| tsIgnoreFixer | `ts-ignore` | type-safety |
| anyTypeFixer | `any-type` | type-safety |
| equalityFixer | `equality` | type-safety |
| evalFixer | `eval` | type-safety |
| unusedImportsFixer | `unused-imports` | lint |
| magicNumbersFixer | `magic-numbers` | hardcoded |
| hardcodedUrlsFixer | `hardcoded-urls` | hardcoded |
| complexityFixer | `complexity` | complexity |
| longFunctionsFixer | `long-functions` | complexity |
| srpFixer | `srp` | srp |
| refineFixer | `refine` | refine |

---

## CRITICAL MISMATCH DETECTED

**Problem:** unified-swc.ts assigns fixerId values that do NOT match registry IDs!

| unified-swc.ts assigns | Registry has | Match? |
|------------------------|--------------|--------|
| `no-console` | `console` | NO |
| `no-debugger` | `debugger` | NO |
| `no-alert` | `alert` | NO |
| `no-eval` | `eval` | NO |
| `no-any` | `any-type` | NO |
| `no-ts-ignore` | `ts-ignore` | NO |

**This means:** When plan.ts tries `registry.get(issue.fixerId)`, it will FAIL because:
- Issue has `fixerId: 'no-console'`
- Registry has ID `'console'`
- `registry.get('no-console')` returns `undefined`
- Falls back to strategies (which may also fail)

---

## Phase 1 Requirements

### fixerId Mapping Table (CORRECTED)

The following mapping should be used in unified-swc.ts:

| Detection | Current fixerId | Should Be | Fixer Exists? |
|-----------|-----------------|-----------|---------------|
| console | `no-console` | `console` | YES |
| debugger | `no-debugger` | `debugger` | YES |
| alert | `no-alert` | `alert` | YES |
| eval | `no-eval` | `eval` | YES |
| empty-catch | `no-empty-catch` | - | NO (create) |
| any-annotation | `no-any` | `any-type` | YES |
| any-assertion | `no-any` | `any-type` | YES |
| any-param | `no-any` | `any-type` | YES |
| any-array | `no-any` | `any-type` | YES |
| non-null | `no-non-null-assertion` | - | NO (create) |
| double-assertion | `no-double-assertion` | - | NO (create) |
| @ts-ignore | `no-ts-ignore` | `ts-ignore` | YES |
| command-injection | `no-command-injection` | - | NO (create) |
| path-traversal | `no-path-traversal` | - | NO (create) |
| require | `no-require` | - | NO (create) |

---

## Verification Checklist

### Pre-Refactoring (Current State)

- [x] conflict-detector.ts works without fixerId - VERIFIED
- [x] parallel-executor.ts works without fixerId - VERIFIED
- [x] plan.ts uses fixerId for fixer lookup - VERIFIED
- [ ] All issues from unified-swc have correct fixerId - MISMATCH DETECTED
- [ ] plan.ts works without strategy fallback - BLOCKED (TypeCheck error)
- [ ] All tests pass - BLOCKED (TypeCheck error)

### Phase 1 Checklist

- [ ] Update unified-swc.ts fixerId values to match registry IDs
- [ ] Create missing fixers for: empty-catch, non-null-assertion, double-assertion, command-injection, path-traversal, require
- [ ] Fix plan.ts TypeCheck error (findStrategyDetailed missing)
- [ ] Verify registry.get() returns correct fixer for each issue
- [ ] Run `pnpm typecheck` - passes
- [ ] Run `pnpm test` - passes

### Phase 2 Checklist

- [ ] Consolidate utilities in fix/core/utils.ts
- [ ] Update fixers to use shared utilities
- [ ] Delete duplicate implementations

### Phase 3 Checklist

- [ ] Remove strategy fallback from plan.ts
- [ ] Mark strategies/ as deprecated
- [ ] All issues use fixerId pathway only

---

## TypeCheck Results

```
src/commands/fix/plan.ts(108,9): error TS2741: Property 'noFixer' is missing in type
src/commands/fix/plan.ts(154,30): error TS2304: Cannot find name 'findStrategyDetailed'
```

**Root Cause:** The codebase is in an intermediate refactoring state:
1. `SkipStats` type requires `noFixer` property but it's not being set
2. `findStrategyDetailed` function exists in `strategies/index.ts` but import is missing from `plan.ts`

**Fix for error 2:** Add import in plan.ts:
```typescript
import { findStrategyDetailed } from './strategies';
```

---

## Test Results

```
tests/unit/commands/fix/analyzers/fixer-id-mapping.test.ts (19 tests | 13 failed)
```

**Failed Tests (summary):**
- `assigns "no-console" fixerId` - Expected `no-console`, got `console`
- `assigns "no-debugger" fixerId` - Expected `no-debugger`, got `debugger`
- `assigns "no-alert" fixerId` - Expected `no-alert`, got `alert`
- `assigns "no-eval" fixerId` - Expected `no-eval`, got `eval`
- `assigns "no-any" fixerId` - Expected `no-any`, got `any-type` (for any-type fixer)
- etc.

**Interpretation:** The tests EXPECT the `no-` prefix format (ESLint-style naming), but unified-swc.ts was ALREADY UPDATED to use the short fixer IDs that match the registry (`console`, `debugger`, etc.).

This is a TEST vs CODE mismatch, not a bug in the code. The code is CORRECT - it uses `console` which matches `registry.get('console')`.

**Decision Required:**
1. Update tests to expect short IDs (e.g., `console` not `no-console`) - RECOMMENDED
2. OR update unified-swc.ts back to `no-` prefixed IDs AND update registry to match

**Recommendation:** Update the tests to match the current code behavior, as the short IDs are cleaner and already match the fixer registry

---

## Recommendations

1. **IMMEDIATE:** Fix TypeCheck errors before proceeding:
   - Add `noFixer: 0` to skipStats initialization in plan.ts
   - Either restore `findStrategyDetailed` import or remove the fallback code

2. **Phase 1 Priority:** Fix fixerId mismatch between unified-swc.ts and registry:
   - Change `no-console` -> `console`
   - Change `no-debugger` -> `debugger`
   - Change `no-alert` -> `alert`
   - Change `no-eval` -> `eval`
   - Change `no-any` -> `any-type`
   - Change `no-ts-ignore` -> `ts-ignore`

3. **Create Missing Fixers:** Before removing strategy fallback:
   - empty-catch fixer
   - non-null-assertion fixer
   - double-assertion fixer
   - command-injection fixer
   - path-traversal fixer
   - require fixer

---

## Conclusion

The refactoring plan is sound, but there are critical issues that must be addressed:

1. **fixerId naming mismatch** between unified-swc.ts and registry - this is why fixes may be failing silently
2. **TypeCheck errors** indicate incomplete refactoring state
3. **Missing fixers** for several detection types

The conflict-detector and parallel-executor are correctly designed and will work seamlessly once fixerId issues are resolved.
