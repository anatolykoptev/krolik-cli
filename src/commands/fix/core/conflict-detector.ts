/**
 * @module commands/fix/core/conflict-detector
 * @description Conflict detection and resolution for fix operations
 *
 * Prevents code corruption when multiple fixes target overlapping line ranges.
 */

import { getFixDifficulty } from './difficulty';
import type { QualityIssue } from './types/analysis';
import type { FixAction, FixDifficulty, FixOperation } from './types/fix';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Line range (1-indexed, inclusive)
 */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * Types of conflicts between operations
 */
export type ConflictType =
  | 'identical' // Same action on exact same lines
  | 'overlap' // Different actions on overlapping ranges
  | 'nested' // One range fully contains another
  | 'adjacent' // Ranges touch (may affect each other)
  | 'insert-collision'; // Multiple inserts at same position

/**
 * Resolution strategies
 */
export type ResolutionStrategy =
  | 'keep-first' // Keep the first operation (by priority)
  | 'keep-second' // Keep the second operation
  | 'skip-both' // Skip both conflicting operations
  | 'merge' // Combine operations (when possible)
  | 'allow'; // Allow both (adjacent, no real conflict)

/**
 * Operation paired with its issue for context
 */
export interface OperationWithIssue {
  operation: FixOperation;
  issue: QualityIssue;
}

/**
 * Indexed operation with computed priority
 */
export interface IndexedOperation extends OperationWithIssue {
  index: number;
  priority: number;
  range: LineRange | null;
}

/**
 * A detected conflict between two operations
 */
export interface Conflict {
  type: ConflictType;
  operationA: IndexedOperation;
  operationB: IndexedOperation;
  resolution: Resolution;
}

/**
 * Resolution decision for a conflict
 */
export interface Resolution {
  strategy: ResolutionStrategy;
  reason: string;
  winner?: IndexedOperation;
  loser?: IndexedOperation;
  merged?: FixOperation; // If strategy is 'merge'
}

/**
 * Options for conflict detection
 */
export interface ConflictOptions {
  /** Resolution strategy for conflicts */
  strategy: 'skip-lower-priority' | 'skip-all-conflicts' | 'merge-when-possible';
  /** Treat adjacent lines as potential conflict (default: false) */
  treatAdjacentAsConflict?: boolean;
  /** Custom priority function (higher = more important) */
  priorityFn?: (issue: QualityIssue) => number;
}

/**
 * Result of conflict detection and resolution
 */
export interface ConflictResolutionResult {
  /** Operations safe to apply */
  applicable: OperationWithIssue[];
  /** Operations skipped due to conflicts */
  skipped: SkippedOperation[];
  /** Merged operations (if any) */
  merged: FixOperation[];
  /** Detected conflicts */
  conflicts: Conflict[];
  /** Summary statistics */
  stats: ConflictStats;
}

/**
 * Information about a skipped operation
 */
export interface SkippedOperation {
  operation: OperationWithIssue;
  reason: string;
  conflictsWith: OperationWithIssue[];
}

/**
 * Summary statistics
 */
export interface ConflictStats {
  total: number;
  applicable: number;
  skipped: number;
  merged: number;
  conflicts: number;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: ConflictOptions = {
  strategy: 'skip-lower-priority',
  treatAdjacentAsConflict: false,
};

// ============================================================================
// PRIORITY CALCULATION
// ============================================================================

/**
 * Priority weights for difficulty levels (higher = more important to apply)
 */
const DIFFICULTY_PRIORITY: Record<FixDifficulty, number> = {
  trivial: 100, // Most important - always safe
  safe: 50, // Medium priority
  risky: 10, // Lowest priority - skip if conflicts
};

/**
 * Priority weights for action types
 */
const ACTION_PRIORITY: Record<FixAction, number> = {
  'delete-line': 30, // Simple, safe
  'replace-line': 25,
  'replace-range': 20,
  'insert-before': 15,
  'insert-after': 15,
  'extract-function': 10, // Complex
  'wrap-function': 10,
  'split-file': 5, // File-level
  'move-file': 5,
  'create-barrel': 5,
};

/**
 * Compute priority for an operation (higher = more important)
 */
export function computePriority(
  issue: QualityIssue,
  operation: FixOperation,
  customPriorityFn?: (issue: QualityIssue) => number,
): number {
  if (customPriorityFn) {
    return customPriorityFn(issue);
  }

  const difficulty = getFixDifficulty(issue);
  const difficultyScore = DIFFICULTY_PRIORITY[difficulty] || 0;
  const actionScore = ACTION_PRIORITY[operation.action] || 0;

  // Smaller line ranges are more specific = higher priority
  const rangeSize =
    operation.endLine && operation.line ? operation.endLine - operation.line + 1 : 1;
  const specificityBonus = Math.max(0, 20 - rangeSize);

  return difficultyScore + actionScore + specificityBonus;
}

// ============================================================================
// RANGE OPERATIONS
// ============================================================================

/**
 * Normalize a fix operation to a line range
 * Returns null for file-level operations (no line conflict possible)
 */
export function normalizeRange(op: FixOperation): LineRange | null {
  const { action, line, endLine } = op;

  // File-level operations have no line-based conflicts
  if (action === 'split-file' || action === 'move-file' || action === 'create-barrel') {
    return null;
  }

  // Operations that require a line number
  if (line === undefined) {
    return null;
  }

  switch (action) {
    case 'delete-line':
    case 'replace-line':
    case 'insert-before':
    case 'insert-after':
    case 'extract-function':
    case 'wrap-function':
      return { start: line, end: line };

    case 'replace-range':
      return { start: line, end: endLine ?? line };

    default:
      return null;
  }
}

/**
 * Check if two ranges overlap (inclusive)
 *
 * Ranges [a, b] and [c, d] overlap if: a <= d AND c <= b
 */
export function rangesOverlap(a: LineRange, b: LineRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Check if range A fully contains range B
 */
export function rangeContains(outer: LineRange, inner: LineRange): boolean {
  return outer.start <= inner.start && outer.end >= inner.end;
}

/**
 * Check if two ranges are adjacent (touching but not overlapping)
 */
export function rangesAdjacent(a: LineRange, b: LineRange): boolean {
  return a.end + 1 === b.start || b.end + 1 === a.start;
}

/**
 * Check if ranges are identical
 */
export function rangesIdentical(a: LineRange, b: LineRange): boolean {
  return a.start === b.start && a.end === b.end;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Detect the type of conflict between two operations (if any)
 */
export function detectConflictType(a: IndexedOperation, b: IndexedOperation): ConflictType | null {
  // Different files = no conflict
  if (a.operation.file !== b.operation.file) {
    return null;
  }

  // File-level operations don't conflict on lines
  if (a.range === null || b.range === null) {
    return null;
  }

  // Check for identical ranges first
  if (rangesIdentical(a.range, b.range)) {
    // Same position inserts are collisions
    if (
      (a.operation.action === 'insert-before' && b.operation.action === 'insert-before') ||
      (a.operation.action === 'insert-after' && b.operation.action === 'insert-after')
    ) {
      return 'insert-collision';
    }

    // Same action on same range
    if (a.operation.action === b.operation.action) {
      // Check if content is identical (true duplicate)
      if (a.operation.newCode === b.operation.newCode) {
        return 'identical';
      }
    }

    // Different actions or different content on same line = overlap
    return 'overlap';
  }

  // Check for nested ranges
  if (rangeContains(a.range, b.range)) {
    return 'nested';
  }
  if (rangeContains(b.range, a.range)) {
    return 'nested';
  }

  // Check for overlap
  if (rangesOverlap(a.range, b.range)) {
    return 'overlap';
  }

  // Check for adjacent
  if (rangesAdjacent(a.range, b.range)) {
    return 'adjacent';
  }

  // No conflict
  return null;
}

/**
 * Determine resolution for a conflict
 */
export function resolveConflict(conflict: Conflict, options: ConflictOptions): Resolution {
  const { type, operationA, operationB } = conflict;

  // Identical operations can be deduplicated
  if (type === 'identical') {
    return {
      strategy: 'keep-first',
      reason: 'Duplicate operation - keeping first',
      winner: operationA,
      loser: operationB,
    };
  }

  // Adjacent ranges are usually safe
  if (type === 'adjacent' && !options.treatAdjacentAsConflict) {
    return {
      strategy: 'allow',
      reason: 'Adjacent ranges - both can be applied',
    };
  }

  // Handle based on strategy
  switch (options.strategy) {
    case 'skip-all-conflicts':
      return {
        strategy: 'skip-both',
        reason: `Conflict (${type}) - skipping both operations`,
      };

    case 'skip-lower-priority': {
      const winner = operationA.priority >= operationB.priority ? operationA : operationB;
      const loser = winner === operationA ? operationB : operationA;
      return {
        strategy: 'keep-first',
        reason: `Conflict (${type}) - keeping higher priority (${winner.priority} vs ${loser.priority})`,
        winner,
        loser,
      };
    }

    case 'merge-when-possible': {
      // Try to merge consecutive deletes
      if (
        operationA.operation.action === 'delete-line' &&
        operationB.operation.action === 'delete-line' &&
        operationA.range &&
        operationB.range
      ) {
        const merged = tryMergeDeletes(operationA, operationB);
        if (merged) {
          return {
            strategy: 'merge',
            reason: 'Merged consecutive delete operations',
            merged,
          };
        }
      }

      // Fall back to priority-based resolution
      const winner = operationA.priority >= operationB.priority ? operationA : operationB;
      const loser = winner === operationA ? operationB : operationA;
      return {
        strategy: 'keep-first',
        reason: `Cannot merge (${type}) - keeping higher priority`,
        winner,
        loser,
      };
    }

    default:
      return {
        strategy: 'skip-both',
        reason: 'Unknown strategy - skipping both',
      };
  }
}

/**
 * Try to merge two delete operations into a range delete
 */
function tryMergeDeletes(a: IndexedOperation, b: IndexedOperation): FixOperation | null {
  if (!a.range || !b.range) return null;

  // Check if ranges are consecutive or overlapping
  const minStart = Math.min(a.range.start, b.range.start);
  const maxEnd = Math.max(a.range.end, b.range.end);

  // If the combined range is at most 1 larger than the sum, they're mergeable
  const combinedSize = maxEnd - minStart + 1;
  const separateSize = a.range.end - a.range.start + 1 + (b.range.end - b.range.start + 1);

  if (combinedSize <= separateSize + 1) {
    return {
      action: 'replace-range',
      file: a.operation.file,
      line: minStart,
      endLine: maxEnd,
      newCode: '', // Delete entire range
    };
  }

  return null;
}

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect and resolve conflicts in a list of operations
 */
export function detectAndResolve(
  operations: OperationWithIssue[],
  options: Partial<ConflictOptions> = {},
): ConflictResolutionResult {
  const opts: ConflictOptions = { ...DEFAULT_OPTIONS, ...options };

  // Index and prioritize operations
  const indexed: IndexedOperation[] = operations.map((op, index) => ({
    ...op,
    index,
    priority: computePriority(op.issue, op.operation, opts.priorityFn),
    range: normalizeRange(op.operation),
  }));

  // Group by file for efficient comparison
  const byFile = new Map<string, IndexedOperation[]>();
  for (const op of indexed) {
    const file = op.operation.file;
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(op);
  }

  // Detect conflicts
  const conflicts: Conflict[] = [];
  for (const fileOps of Array.from(byFile.values())) {
    // Compare all pairs O(n^2) - could be optimized with interval tree
    for (let i = 0; i < fileOps.length; i++) {
      for (let j = i + 1; j < fileOps.length; j++) {
        const opA = fileOps[i];
        const opB = fileOps[j];
        if (!opA || !opB) continue;

        const type = detectConflictType(opA, opB);
        if (type !== null) {
          const conflict: Conflict = {
            type,
            operationA: opA,
            operationB: opB,
            resolution: { strategy: 'allow', reason: '' }, // Placeholder
          };
          conflict.resolution = resolveConflict(conflict, opts);
          conflicts.push(conflict);
        }
      }
    }
  }

  // Determine which operations to skip
  const skippedIndices = new Set<number>();
  const skippedReasons = new Map<number, { reason: string; conflictsWith: OperationWithIssue[] }>();
  const mergedOps: FixOperation[] = [];

  for (const conflict of conflicts) {
    const { resolution, operationA, operationB } = conflict;

    switch (resolution.strategy) {
      case 'skip-both':
        addSkipped(operationA.index, resolution.reason, [operationB]);
        addSkipped(operationB.index, resolution.reason, [operationA]);
        break;

      case 'keep-first':
        if (resolution.loser) {
          addSkipped(resolution.loser.index, resolution.reason, [resolution.winner!]);
        }
        break;

      case 'keep-second':
        if (resolution.winner && resolution.loser) {
          addSkipped(resolution.loser.index, resolution.reason, [resolution.winner]);
        }
        break;

      case 'merge':
        if (resolution.merged) {
          skippedIndices.add(operationA.index);
          skippedIndices.add(operationB.index);
          mergedOps.push(resolution.merged);
        }
        break;

      case 'allow':
        // Both operations are allowed
        break;
    }
  }

  function addSkipped(index: number, reason: string, conflictsWith: IndexedOperation[]) {
    skippedIndices.add(index);
    const existing = skippedReasons.get(index);
    if (existing) {
      existing.conflictsWith.push(...conflictsWith);
    } else {
      skippedReasons.set(index, { reason, conflictsWith });
    }
  }

  // Build result
  const applicable: OperationWithIssue[] = [];
  const skipped: SkippedOperation[] = [];

  for (const op of indexed) {
    if (skippedIndices.has(op.index)) {
      const info = skippedReasons.get(op.index);
      skipped.push({
        operation: { operation: op.operation, issue: op.issue },
        reason: info?.reason || 'Conflict detected',
        conflictsWith:
          info?.conflictsWith.map((c) => ({ operation: c.operation, issue: c.issue })) || [],
      });
    } else {
      applicable.push({ operation: op.operation, issue: op.issue });
    }
  }

  return {
    applicable,
    skipped,
    merged: mergedOps,
    conflicts,
    stats: {
      total: operations.length,
      applicable: applicable.length,
      skipped: skipped.length,
      merged: mergedOps.length,
      conflicts: conflicts.length,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConflictDetector = {
  detectAndResolve,
  normalizeRange,
  rangesOverlap,
  rangesAdjacent,
  rangesIdentical,
  rangeContains,
  detectConflictType,
  resolveConflict,
  computePriority,
};

export default ConflictDetector;
