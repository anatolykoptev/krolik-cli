/**
 * @module tests/unit/commands/fix/core/conflict-detector
 * @description Unit tests for conflict detection algorithm
 */

import { describe, expect, it } from 'vitest';
import type { FixOperation, QualityIssue } from '../../../../../src/commands/fix/core';
import {
  computePriority,
  detectAndResolve,
  detectConflictType,
  type IndexedOperation,
  normalizeRange,
  type OperationWithIssue,
  rangeContains,
  rangesAdjacent,
  rangesIdentical,
  rangesOverlap,
} from '../../../../../src/commands/fix/core/conflict-detector';

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    file: '/test/file.ts',
    line: 10,
    severity: 'warning',
    category: 'lint',
    message: 'Test issue',
    ...overrides,
  };
}

function makeOperation(overrides: Partial<FixOperation> = {}): FixOperation {
  return {
    action: 'delete-line',
    file: '/test/file.ts',
    line: 10,
    ...overrides,
  };
}

function makeIndexedOp(
  operation: Partial<FixOperation>,
  issue: Partial<QualityIssue> = {},
  index = 0,
): IndexedOperation {
  const op = makeOperation(operation);
  const iss = makeIssue(issue);
  return {
    index,
    operation: op,
    issue: iss,
    priority: computePriority(iss, op),
    range: normalizeRange(op),
  };
}

function makeOpWithIssue(
  operation: Partial<FixOperation>,
  issue: Partial<QualityIssue> = {},
): OperationWithIssue {
  return {
    operation: makeOperation(operation),
    issue: makeIssue(issue),
  };
}

// ============================================================================
// RANGE NORMALIZATION TESTS
// ============================================================================

describe('normalizeRange', () => {
  it('should return range for delete-line', () => {
    const op = makeOperation({ action: 'delete-line', line: 10 });
    expect(normalizeRange(op)).toEqual({ start: 10, end: 10 });
  });

  it('should return range for replace-line', () => {
    const op = makeOperation({ action: 'replace-line', line: 15, newCode: 'test' });
    expect(normalizeRange(op)).toEqual({ start: 15, end: 15 });
  });

  it('should return range for replace-range with endLine', () => {
    const op = makeOperation({ action: 'replace-range', line: 5, endLine: 10, newCode: '' });
    expect(normalizeRange(op)).toEqual({ start: 5, end: 10 });
  });

  it('should return single-line range for replace-range without endLine', () => {
    const op = makeOperation({ action: 'replace-range', line: 5, newCode: '' });
    expect(normalizeRange(op)).toEqual({ start: 5, end: 5 });
  });

  it('should return range for insert-before', () => {
    const op = makeOperation({ action: 'insert-before', line: 20, newCode: 'test' });
    expect(normalizeRange(op)).toEqual({ start: 20, end: 20 });
  });

  it('should return range for insert-after', () => {
    const op = makeOperation({ action: 'insert-after', line: 20, newCode: 'test' });
    expect(normalizeRange(op)).toEqual({ start: 20, end: 20 });
  });

  it('should return null for split-file', () => {
    const op = makeOperation({ action: 'split-file', newFiles: [] });
    expect(normalizeRange(op)).toBeNull();
  });

  it('should return null for move-file', () => {
    const op = makeOperation({ action: 'move-file', moveTo: '/new/path.ts' });
    expect(normalizeRange(op)).toBeNull();
  });

  it('should return null for create-barrel', () => {
    const op = makeOperation({ action: 'create-barrel' });
    expect(normalizeRange(op)).toBeNull();
  });

  it('should return null for operation without line', () => {
    const op = makeOperation({ action: 'delete-line', line: undefined });
    expect(normalizeRange(op)).toBeNull();
  });
});

// ============================================================================
// RANGE OVERLAP TESTS
// ============================================================================

describe('rangesOverlap', () => {
  it('should detect exact overlap', () => {
    expect(rangesOverlap({ start: 5, end: 10 }, { start: 5, end: 10 })).toBe(true);
  });

  it('should detect partial overlap at start', () => {
    expect(rangesOverlap({ start: 5, end: 10 }, { start: 8, end: 15 })).toBe(true);
  });

  it('should detect partial overlap at end', () => {
    expect(rangesOverlap({ start: 8, end: 15 }, { start: 5, end: 10 })).toBe(true);
  });

  it('should detect nested ranges', () => {
    expect(rangesOverlap({ start: 1, end: 20 }, { start: 5, end: 10 })).toBe(true);
    expect(rangesOverlap({ start: 5, end: 10 }, { start: 1, end: 20 })).toBe(true);
  });

  it('should return false for non-overlapping ranges', () => {
    expect(rangesOverlap({ start: 1, end: 5 }, { start: 10, end: 15 })).toBe(false);
  });

  it('should return true for adjacent ranges (they touch at boundary)', () => {
    // Note: rangesOverlap returns true when end = start of next
    // [5,10] and [10,15] overlap at line 10
    expect(rangesOverlap({ start: 5, end: 10 }, { start: 10, end: 15 })).toBe(true);
  });

  it('should return false for strictly adjacent ranges', () => {
    // [5,9] and [10,15] don't overlap
    expect(rangesOverlap({ start: 5, end: 9 }, { start: 10, end: 15 })).toBe(false);
  });
});

describe('rangesAdjacent', () => {
  it('should detect adjacent ranges (a before b)', () => {
    expect(rangesAdjacent({ start: 5, end: 9 }, { start: 10, end: 15 })).toBe(true);
  });

  it('should detect adjacent ranges (b before a)', () => {
    expect(rangesAdjacent({ start: 10, end: 15 }, { start: 5, end: 9 })).toBe(true);
  });

  it('should return false for overlapping ranges', () => {
    expect(rangesAdjacent({ start: 5, end: 10 }, { start: 8, end: 15 })).toBe(false);
  });

  it('should return false for non-adjacent ranges', () => {
    expect(rangesAdjacent({ start: 5, end: 8 }, { start: 15, end: 20 })).toBe(false);
  });
});

describe('rangesIdentical', () => {
  it('should return true for identical ranges', () => {
    expect(rangesIdentical({ start: 5, end: 10 }, { start: 5, end: 10 })).toBe(true);
  });

  it('should return false for different start', () => {
    expect(rangesIdentical({ start: 5, end: 10 }, { start: 6, end: 10 })).toBe(false);
  });

  it('should return false for different end', () => {
    expect(rangesIdentical({ start: 5, end: 10 }, { start: 5, end: 11 })).toBe(false);
  });
});

describe('rangeContains', () => {
  it('should detect outer contains inner', () => {
    expect(rangeContains({ start: 1, end: 20 }, { start: 5, end: 10 })).toBe(true);
  });

  it('should return true for identical ranges', () => {
    expect(rangeContains({ start: 5, end: 10 }, { start: 5, end: 10 })).toBe(true);
  });

  it('should return false when inner extends beyond outer', () => {
    expect(rangeContains({ start: 5, end: 10 }, { start: 3, end: 8 })).toBe(false);
    expect(rangeContains({ start: 5, end: 10 }, { start: 8, end: 15 })).toBe(false);
  });
});

// ============================================================================
// CONFLICT TYPE DETECTION TESTS
// ============================================================================

describe('detectConflictType', () => {
  it('should return null for different files', () => {
    const a = makeIndexedOp({ file: '/file1.ts', line: 10 });
    const b = makeIndexedOp({ file: '/file2.ts', line: 10 });
    expect(detectConflictType(a, b)).toBeNull();
  });

  it('should return null for file-level operations', () => {
    const a = makeIndexedOp({ action: 'split-file', newFiles: [] });
    const b = makeIndexedOp({ line: 10 });
    expect(detectConflictType(a, b)).toBeNull();
  });

  it('should detect identical delete-line operations', () => {
    const a = makeIndexedOp({ action: 'delete-line', line: 10 }, {}, 0);
    const b = makeIndexedOp({ action: 'delete-line', line: 10 }, {}, 1);
    expect(detectConflictType(a, b)).toBe('identical');
  });

  it('should detect insert-collision for same-position inserts', () => {
    const a = makeIndexedOp({ action: 'insert-before', line: 10, newCode: 'a' }, {}, 0);
    const b = makeIndexedOp({ action: 'insert-before', line: 10, newCode: 'b' }, {}, 1);
    expect(detectConflictType(a, b)).toBe('insert-collision');
  });

  it('should detect overlap for different actions on same line', () => {
    const a = makeIndexedOp({ action: 'delete-line', line: 10 }, {}, 0);
    const b = makeIndexedOp({ action: 'replace-line', line: 10, newCode: 'x' }, {}, 1);
    expect(detectConflictType(a, b)).toBe('overlap');
  });

  it('should detect overlap for same action with different content', () => {
    const a = makeIndexedOp({ action: 'replace-line', line: 10, newCode: 'a' }, {}, 0);
    const b = makeIndexedOp({ action: 'replace-line', line: 10, newCode: 'b' }, {}, 1);
    expect(detectConflictType(a, b)).toBe('overlap');
  });

  it('should detect nested ranges', () => {
    const a = makeIndexedOp({ action: 'replace-range', line: 5, endLine: 15, newCode: '' }, {}, 0);
    const b = makeIndexedOp({ action: 'delete-line', line: 10 }, {}, 1);
    expect(detectConflictType(a, b)).toBe('nested');
  });

  it('should detect overlapping ranges', () => {
    const a = makeIndexedOp({ action: 'replace-range', line: 5, endLine: 10, newCode: '' }, {}, 0);
    const b = makeIndexedOp({ action: 'replace-range', line: 8, endLine: 12, newCode: '' }, {}, 1);
    expect(detectConflictType(a, b)).toBe('overlap');
  });

  it('should detect adjacent ranges', () => {
    const a = makeIndexedOp({ action: 'delete-line', line: 10 }, {}, 0);
    const b = makeIndexedOp({ action: 'delete-line', line: 11 }, {}, 1);
    expect(detectConflictType(a, b)).toBe('adjacent');
  });

  it('should return null for non-conflicting operations', () => {
    const a = makeIndexedOp({ action: 'delete-line', line: 5 }, {}, 0);
    const b = makeIndexedOp({ action: 'delete-line', line: 15 }, {}, 1);
    expect(detectConflictType(a, b)).toBeNull();
  });
});

// ============================================================================
// PRIORITY TESTS
// ============================================================================

describe('computePriority', () => {
  it('should give higher priority to trivial fixes', () => {
    const trivialIssue = makeIssue({ category: 'lint', message: 'console.log' });
    const riskyIssue = makeIssue({ category: 'complexity', message: 'High complexity' });
    const op = makeOperation();

    const trivialPriority = computePriority(trivialIssue, op);
    const riskyPriority = computePriority(riskyIssue, op);

    expect(trivialPriority).toBeGreaterThan(riskyPriority);
  });

  it('should give higher priority to simpler actions', () => {
    const issue = makeIssue();
    const deleteOp = makeOperation({ action: 'delete-line' });
    const extractOp = makeOperation({ action: 'extract-function' });

    const deletePriority = computePriority(issue, deleteOp);
    const extractPriority = computePriority(issue, extractOp);

    expect(deletePriority).toBeGreaterThan(extractPriority);
  });

  it('should give bonus to smaller ranges', () => {
    const issue = makeIssue();
    const smallRange = makeOperation({ action: 'replace-range', line: 5, endLine: 6, newCode: '' });
    const largeRange = makeOperation({
      action: 'replace-range',
      line: 5,
      endLine: 20,
      newCode: '',
    });

    const smallPriority = computePriority(issue, smallRange);
    const largePriority = computePriority(issue, largeRange);

    expect(smallPriority).toBeGreaterThan(largePriority);
  });

  it('should use custom priority function when provided', () => {
    const issue = makeIssue();
    const op = makeOperation();
    const customFn = () => 999;

    expect(computePriority(issue, op, customFn)).toBe(999);
  });
});

// ============================================================================
// FULL DETECTION AND RESOLUTION TESTS
// ============================================================================

describe('detectAndResolve', () => {
  it('should return all operations when no conflicts', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ line: 5 }),
      makeOpWithIssue({ line: 15 }),
      makeOpWithIssue({ line: 25 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.stats.conflicts).toBe(0);
  });

  it('should skip duplicate operations', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.stats.conflicts).toBe(1);
  });

  it('should skip lower priority on conflict', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue(
        { action: 'delete-line', line: 10 },
        { category: 'lint', message: 'console' },
      ), // trivial
      makeOpWithIssue(
        { action: 'replace-line', line: 10, newCode: 'x' },
        { category: 'complexity' },
      ), // risky
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-lower-priority' });

    expect(result.applicable).toHaveLength(1);
    expect(result.applicable[0].operation.action).toBe('delete-line'); // trivial wins
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].operation.operation.action).toBe('replace-line');
  });

  it('should skip both when strategy is skip-all-conflicts', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'replace-line', line: 10, newCode: 'x' }),
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-all-conflicts' });

    expect(result.applicable).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });

  it('should allow adjacent operations by default', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'delete-line', line: 11 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('should treat adjacent as conflict when option is set', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'delete-line', line: 11 }),
    ];

    const result = detectAndResolve(ops, {
      strategy: 'skip-all-conflicts',
      treatAdjacentAsConflict: true,
    });

    expect(result.applicable).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });

  it('should handle multiple files independently', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ file: '/file1.ts', line: 10 }),
      makeOpWithIssue({ file: '/file1.ts', line: 10 }), // duplicate in file1
      makeOpWithIssue({ file: '/file2.ts', line: 10 }), // same line, different file
      makeOpWithIssue({ file: '/file2.ts', line: 10 }), // duplicate in file2
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(2); // one from each file
    expect(result.skipped).toHaveLength(2); // one duplicate from each file
  });

  it('should handle nested range conflicts', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'replace-range', line: 5, endLine: 15, newCode: 'outer' }),
      makeOpWithIssue({ action: 'delete-line', line: 10 }), // nested inside outer
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-lower-priority' });

    expect(result.applicable).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.stats.conflicts).toBe(1);
  });

  it('should handle overlapping ranges', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'replace-range', line: 5, endLine: 10, newCode: 'a' }),
      makeOpWithIssue({ action: 'replace-range', line: 8, endLine: 12, newCode: 'b' }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it('should provide conflict information in skipped operations', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue(
        { action: 'delete-line', line: 10 },
        { category: 'lint', message: 'console' },
      ),
      makeOpWithIssue(
        { action: 'replace-line', line: 10, newCode: 'x' },
        { category: 'complexity' },
      ),
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-lower-priority' });

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Conflict');
    expect(result.skipped[0].conflictsWith).toHaveLength(1);
  });

  it('should handle file-level operations without conflicts', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'split-file', newFiles: [] }),
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(2);
    expect(result.stats.conflicts).toBe(0);
  });

  it('should provide correct statistics', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ line: 5 }),
      makeOpWithIssue({ line: 10 }),
      makeOpWithIssue({ line: 10 }), // duplicate
      makeOpWithIssue({ line: 15 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.stats).toEqual({
      total: 4,
      applicable: 3,
      skipped: 1,
      merged: 0,
      conflicts: 1,
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  it('should handle empty operations list', () => {
    const result = detectAndResolve([]);

    expect(result.applicable).toHaveLength(0);
    expect(result.stats.total).toBe(0);
  });

  it('should handle single operation', () => {
    const ops: OperationWithIssue[] = [makeOpWithIssue({ line: 10 })];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(1);
    expect(result.stats.conflicts).toBe(0);
  });

  it('should handle operations without line numbers', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: undefined }),
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
    ];

    const result = detectAndResolve(ops);

    expect(result.applicable).toHaveLength(2);
  });

  it('should handle three-way conflicts', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue(
        { action: 'delete-line', line: 10 },
        { category: 'lint', message: 'console' },
      ),
      makeOpWithIssue(
        { action: 'replace-line', line: 10, newCode: 'a' },
        { category: 'complexity' },
      ),
      makeOpWithIssue({ action: 'replace-line', line: 10, newCode: 'b' }, { category: 'srp' }),
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-lower-priority' });

    // Only one should win (the trivial one)
    expect(result.applicable).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.stats.conflicts).toBe(3); // 3 pairs: (a,b), (a,c), (b,c)
  });

  it('should handle chain of adjacent operations', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'delete-line', line: 11 }),
      makeOpWithIssue({ action: 'delete-line', line: 12 }),
      makeOpWithIssue({ action: 'delete-line', line: 13 }),
    ];

    const result = detectAndResolve(ops);

    // All adjacent, but should be allowed by default
    expect(result.applicable).toHaveLength(4);
  });

  it('should handle insert-before and insert-after on same line', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'insert-before', line: 10, newCode: 'before' }),
      makeOpWithIssue({ action: 'insert-after', line: 10, newCode: 'after' }),
    ];

    const result = detectAndResolve(ops);

    // Different actions on same line should conflict
    expect(result.stats.conflicts).toBe(1);
  });

  it('should handle replace-range that spans multiple single-line operations', () => {
    const ops: OperationWithIssue[] = [
      makeOpWithIssue({ action: 'replace-range', line: 5, endLine: 15, newCode: 'block' }),
      makeOpWithIssue({ action: 'delete-line', line: 7 }),
      makeOpWithIssue({ action: 'delete-line', line: 10 }),
      makeOpWithIssue({ action: 'delete-line', line: 13 }),
    ];

    const result = detectAndResolve(ops, { strategy: 'skip-lower-priority' });

    // All single-line ops are nested in the range
    expect(result.stats.conflicts).toBe(3);
  });
});
