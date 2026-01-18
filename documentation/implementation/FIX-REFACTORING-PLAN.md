# Fix Command Refactoring Plan

> Eliminate duplication between legacy analyzers/strategies and new fixers architecture

**Created:** 2025-12-27
**Status:** Proposed

---

## Current Problems

### 1. Double Analysis (Performance)

In `analyze.ts:108-123`, two parallel systems run:

```typescript
// Run legacy analyzers
const analysis = analyzeFile(file, projectRoot, options);  // ← System 1

// Run new fixer-based analysis
const fixerResult = runFixerAnalysis(content, file, fixerOptions);  // ← System 2

// Merge with deduplication (wasteful!)
```

**Impact:** ~2x analysis time, unnecessary memory allocation.

### 2. Duplicate Detection Logic

| Detection | Legacy (`unified-swc.ts`) | New Fixer | Status |
|-----------|---------------------------|-----------|--------|
| console | `detectLintIssue` | `consoleFixer.analyze()` | ⚠️ DUPLICATE |
| debugger | `detectLintIssue` | `debuggerFixer.analyze()` | ⚠️ DUPLICATE |
| alert | `detectLintIssue` | `alertFixer.analyze()` | ⚠️ DUPLICATE |
| eval | `detectLintIssue` | `evalFixer.analyze()` | ⚠️ DUPLICATE |
| any type | `detectTypeSafetyIssue` | `anyTypeFixer.analyze()` | ⚠️ DUPLICATE |
| @ts-ignore | `detectTypeSafetyIssue` | `tsIgnoreFixer.analyze()` | ⚠️ DUPLICATE |
| magic numbers | `detectHardcodedValue` | `magicNumbersFixer.analyze()` | ⚠️ DUPLICATE |
| hardcoded URLs | `detectHardcodedValue` | `hardcodedUrlsFixer.analyze()` | ⚠️ DUPLICATE |

### 3. Utility Function Duplication

Fixers re-implement utilities that exist in `strategies/shared/`:

```typescript
// fixers/console/fixer.ts - DUPLICATES:
function getLine(content, lineNum) { ... }     // ← strategies/shared/line-utils.ts
function startsWithAny(line, prefixes) { ... } // ← strategies/shared/line-utils.ts
function endsWithAny(line, suffixes) { ... }   // ← strategies/shared/line-utils.ts
```

### 4. Two Parallel Architectures

| Architecture | Files | Purpose |
|--------------|-------|---------|
| `strategies/` | ~2000 LOC | Legacy: separate analyze + generateFix |
| `fixers/` | ~1500 LOC | New: combined analyze() + fix() |

Strategies are still used as fallback in `plan.ts:150-163` for issues without `fixerId`.

---

## Proposed Refactoring

### Phase 1: Eliminate Double Detection (Priority: P0)

**Goal:** Run analysis only once.

**Changes:**

1. **Modify `analyze.ts`:**
   - Remove `runFixerAnalysis()` call
   - Keep only `analyzeFile()` for detection
   - Set `fixerId` based on issue category/message pattern

2. **Migrate detection flags:**
   ```typescript
   // Current: issues from unified-swc have NO fixerId
   // After: issues from unified-swc HAVE fixerId

   // In unified-swc.ts, add:
   issue.fixerId = mapIssueToFixer(issue);
   ```

3. **Create mapping function:**
   ```typescript
   function mapIssueToFixer(issue: QualityIssue): string | undefined {
     if (issue.category === 'lint') {
       if (issue.message.includes('console')) return 'console';
       if (issue.message.includes('debugger')) return 'debugger';
       if (issue.message.includes('alert')) return 'alert';
     }
     // ... etc
   }
   ```

**Result:** ~50% reduction in analysis time.

### Phase 2: Consolidate Utilities (Priority: P1)

**Goal:** Single source of truth for utilities.

**Changes:**

1. **Create `fix/core/utils.ts`:**
   - Re-export from `strategies/shared/`
   - Or move utilities to `fix/core/`

2. **Update all fixers to use shared utilities:**
   ```typescript
   // Before (fixers/console/fixer.ts):
   function getLine(content, lineNum) { ... }

   // After:
   import { getLineContext } from '../core/utils';
   ```

3. **Delete duplicate implementations from fixers/**

**Result:** ~300 LOC reduction.

### Phase 3: Deprecate Legacy Strategies (Priority: P2)

**Goal:** Single architecture for fixing.

**Changes:**

1. **Ensure all issues have `fixerId`:**
   - After Phase 1, all issues will have fixerId
   - Fallback to strategies becomes unnecessary

2. **Remove strategy fallback from `plan.ts`:**
   ```typescript
   // Remove lines 150-163 (strategy fallback)
   ```

3. **Mark strategies as deprecated:**
   - Add deprecation notices
   - Plan for removal in future version

4. **Long-term: Delete `strategies/` folder**

**Result:** ~2000 LOC reduction, simpler architecture.

### Phase 4: Create Missing Fixers (Priority: P3)

**Goal:** Cover all detection categories.

Currently legacy-only (no fixers):
- `empty-catch` - empty catch blocks
- `as-any` - as any casting
- `non-null-assertion` - `!` operator
- `security/*` - command injection, path traversal
- `modernization/*` - require(), legacy patterns

**Changes:**
- Create fixer for each category
- Move detection logic from `unified-swc.ts` to fixer's `analyze()`
- Remove from legacy analyzer

---

## Migration Path

```
Week 1: Phase 1 - Eliminate double detection
        ├── Modify unified-swc.ts to set fixerId
        └── Remove runFixerAnalysis() from analyze.ts

Week 2: Phase 2 - Consolidate utilities
        ├── Create fix/core/utils.ts
        └── Update all fixers

Week 3: Phase 3 - Deprecate strategies
        ├── Remove fallback from plan.ts
        └── Mark strategies as deprecated

Ongoing: Phase 4 - Create missing fixers
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Analysis time | ~2x (double run) | 1x |
| Duplicate LOC | ~800 | 0 |
| Architecture | 2 parallel systems | 1 unified |
| Strategy fallback usage | ~30% issues | 0% |

---

## Files to Modify

### Phase 1
- `src/commands/fix/analyze.ts`
- `src/commands/fix/analyzers/unified-swc.ts`

### Phase 2
- `src/commands/fix/core/utils.ts` (new)
- `src/commands/fix/fixers/*/fixer.ts` (all)

### Phase 3
- `src/commands/fix/plan.ts`
- `src/commands/fix/strategies/` (deprecate)

---

## Risks

1. **Breaking changes:** Issues without fixerId will fail to fix
   - Mitigation: Ensure mapIssueToFixer covers all cases

2. **Test coverage:** Need tests for migration
   - Mitigation: Add tests for fixerId assignment

3. **Performance regression:** If mapping is slow
   - Mitigation: Use O(1) lookup tables, not pattern matching
