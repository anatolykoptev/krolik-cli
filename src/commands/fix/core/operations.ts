/**
 * @module commands/fix/core/operations
 * @description Factory functions for creating fix operations
 */

import { countLines } from './line-utils';
import type { FixOperation } from './types';

// ============================================================================
// LINE OPERATIONS
// ============================================================================

/**
 * Create a delete-line operation
 */
export function createDeleteLine(file: string, line: number, oldCode: string): FixOperation {
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
  file: string,
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
  file: string,
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
  file: string,
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
  file: string,
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
