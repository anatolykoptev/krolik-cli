/**
 * @module commands/fix/strategies/shared/operations
 * @description Factory functions for creating fix operations
 */

import type { FixOperation } from '../../types';
import { countLines } from './line-utils';

// ============================================================================
// LINE OPERATIONS
// ============================================================================

/**
 * Create a delete-line operation
 */
export function createDeleteLine(
  file: string | undefined,
  line: number,
  oldCode: string,
): FixOperation {
  return {
    action: 'delete-line',
    file,
    line,
    oldCode,
  };
}

/**
 * Create a replace-line operation
 */
export function createReplaceLine(
  file: string | undefined,
  line: number,
  oldCode: string,
  newCode: string,
): FixOperation {
  return {
    action: 'replace-line',
    file,
    line,
    oldCode,
    newCode,
  };
}

// ============================================================================
// RANGE OPERATIONS
// ============================================================================

/**
 * Create a replace-range operation for specific lines
 */
export function createReplaceRange(
  file: string | undefined,
  startLine: number,
  endLine: number,
  oldCode: string,
  newCode: string,
): FixOperation {
  return {
    action: 'replace-range',
    file,
    line: startLine,
    endLine,
    oldCode,
    newCode,
  };
}

/**
 * Create a replace-range operation for full file replacement
 */
export function createFullFileReplace(
  file: string | undefined,
  oldContent: string,
  newContent: string,
): FixOperation {
  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: countLines(oldContent),
    oldCode: oldContent,
    newCode: newContent,
  };
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Create a split-file operation
 */
export function createSplitFile(
  file: string | undefined,
  newFiles: Array<{ path: string; content: string }>,
): FixOperation {
  return {
    action: 'split-file',
    file,
    newFiles,
  };
}

// ============================================================================
// OPERATION HELPERS
// ============================================================================

/**
 * Add additional metadata to an operation
 */
export function withMetadata(
  operation: FixOperation,
  metadata: { functionName?: string; description?: string },
): FixOperation {
  return {
    ...operation,
    ...metadata,
  };
}

/**
 * Check if operation would be a no-op
 */
export function isNoOp(operation: FixOperation): boolean {
  if (operation.action === 'replace-line' || operation.action === 'replace-range') {
    return operation.oldCode === operation.newCode;
  }
  return false;
}
