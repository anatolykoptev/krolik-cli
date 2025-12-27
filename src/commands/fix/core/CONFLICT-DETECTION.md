# Conflict Detection for Fix Operations

> Algorithm design for detecting and resolving conflicts when multiple fixes target overlapping line ranges.

## Problem Statement

When multiple fix operations target the same or overlapping lines in a file, applying them sequentially can corrupt the code. For example:

```typescript
// Original file
console.log('debug');  // Line 10
console.log('trace');  // Line 11

// Operation A: Delete line 10
// Operation B: Replace line 11 with 'logger.info(...)'

// If we apply A first, line 11 becomes line 10
// Then applying B to "line 11" will modify the wrong line
```

## Solution Overview

The `ConflictDetector` module provides:

1. **Conflict Detection** - Identify overlapping operations before applying
2. **Conflict Resolution** - Decide which operations to keep/skip/merge
3. **Safe Application** - Only apply non-conflicting operations

## Types

### LineRange

```typescript
interface LineRange {
  start: number;  // 1-indexed, inclusive
  end: number;    // 1-indexed, inclusive
}
```

### ConflictType

| Type | Description | Example |
|------|-------------|---------|
| `identical` | Same action on exact same lines | Two delete-line(10) |
| `overlap` | Different actions on overlapping ranges | delete-line(10) + replace-line(10) |
| `nested` | One range fully contains another | replace-range(5-15) + delete-line(10) |
| `adjacent` | Ranges touch (line N and N+1) | delete-line(10) + delete-line(11) |
| `insert-collision` | Multiple inserts at same position | insert-before(10) + insert-before(10) |

### Resolution Strategy

| Strategy | When Used | Effect |
|----------|-----------|--------|
| `keep-first` | One operation wins | Keep higher priority, skip lower |
| `keep-second` | Explicit preference | Keep second, skip first |
| `skip-both` | Unresolvable conflict | Skip both operations |
| `merge` | Compatible operations | Combine into single operation |
| `allow` | No real conflict | Allow both (adjacent lines) |

## Algorithm

### 1. Normalize Operations to Ranges

```typescript
function normalizeRange(op: FixOperation): LineRange | null {
  // File-level operations (split-file, move-file) return null
  // Line-based operations return { start, end }
}
```

### 2. Detect Conflicts

```typescript
function detectConflictType(a: IndexedOperation, b: IndexedOperation): ConflictType | null {
  // Different files → null
  // Same file + overlapping ranges → conflict type
}
```

### 3. Compute Priority

Higher priority operations win in conflicts:

```typescript
priority = difficultyScore + actionScore + specificityBonus

// Difficulty: trivial (100) > safe (50) > risky (10)
// Action: delete (30) > replace (25) > insert (15) > extract (10)
// Specificity: smaller range = higher bonus
```

### 4. Resolve Conflicts

```typescript
function resolveConflict(conflict: Conflict, options: ConflictOptions): Resolution {
  // identical → deduplicate (keep-first)
  // adjacent (default) → allow both
  // overlap/nested → use strategy from options
}
```

### 5. Filter Operations

```typescript
function detectAndResolve(operations: OperationWithIssue[], options?: ConflictOptions): ConflictResolutionResult {
  // 1. Index and prioritize operations
  // 2. Group by file
  // 3. Detect all conflicts (O(n^2) per file)
  // 4. Resolve each conflict
  // 5. Build list of applicable/skipped operations
}
```

## Usage

### Basic Usage

```typescript
import { detectAndResolve } from './conflict-detector';

const operations: OperationWithIssue[] = [...];
const result = detectAndResolve(operations);

// Apply only safe operations
for (const { operation, issue } of result.applicable) {
  applyFix(operation, issue);
}

// Report skipped operations
for (const skipped of result.skipped) {
  console.log(`Skipped: ${skipped.reason}`);
}
```

### With Options

```typescript
const result = detectAndResolve(operations, {
  strategy: 'skip-all-conflicts',     // Skip all conflicting ops
  treatAdjacentAsConflict: true,      // Treat adjacent as conflict
  priorityFn: (issue) => issue.line,  // Custom priority function
});
```

## Edge Cases Handled

1. **Same line, same action, same content** → Deduplicate
2. **Same line, same action, different content** → Conflict
3. **Same line, different actions** → Conflict
4. **Overlapping ranges** → Conflict
5. **Nested ranges** → Conflict (outer contains inner)
6. **Adjacent lines** → Safe (by default)
7. **Multiple inserts at same position** → Insert collision
8. **Operations without line numbers** → No line conflict
9. **Different files** → No conflict
10. **Three-way conflicts** → All pairs detected, priority wins

## Integration with Applier

The `applier.ts` should be updated to use conflict detection:

```typescript
export function applyFixes(
  file: string,
  operations: Array<{ operation: FixOperation; issue: QualityIssue }>,
  options: { backup?: boolean; dryRun?: boolean } = {},
): FixResult[] {
  // NEW: Detect and resolve conflicts first
  const { applicable, skipped } = detectAndResolve(operations);

  // Report skipped operations
  for (const skip of skipped) {
    console.warn(`Skipped: ${skip.reason}`);
  }

  // Apply only non-conflicting operations (sorted bottom-to-top)
  const sorted = [...applicable].sort((a, b) => {
    const lineA = a.operation.line || 0;
    const lineB = b.operation.line || 0;
    return lineB - lineA;
  });

  // ... rest of application logic
}
```

## Performance

- **Time Complexity**: O(n^2) per file for conflict detection
- **Space Complexity**: O(n) for storing operations and conflicts
- **Optimization**: Could use interval tree for O(n log n) if needed

For typical use cases (< 100 operations per file), O(n^2) is acceptable.

## Test Coverage

See `tests/unit/commands/fix/core/conflict-detector.test.ts`:

- 60 test cases covering all conflict types
- Edge cases (empty list, single operation, three-way conflicts)
- Resolution strategies
- Priority calculation
- Range utilities
