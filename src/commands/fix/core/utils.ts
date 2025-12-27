/**
 * @module commands/fix/core/utils
 * @description Unified utilities for fixers
 *
 * Re-exports shared utilities from strategies/shared for use by fixers.
 * This module serves as the canonical import point for all fixer utilities.
 *
 * @example
 * ```ts
 * import {
 *   getLineContext,
 *   lineStartsWith,
 *   lineEndsWith,
 *   splitLines,
 *   createDeleteLine,
 *   createReplaceLine,
 * } from '../core/utils';
 * ```
 */

// ============================================================================
// LINE UTILITIES
// ============================================================================

export {
  // Line extraction
  countLines,
  getLineContext,
  getLines,
  // Line checks
  isComment,
  isEmptyLine,
  joinLines,
  // Types
  type LineContext,
  lineContains,
  lineEndsWith,
  lineStartsWith,
  splitLines,
} from '../strategies/shared/line-utils';

// ============================================================================
// FIX OPERATIONS
// ============================================================================

export {
  createDeleteLine,
  createFullFileReplace,
  createReplaceLine,
  createReplaceRange,
  createSplitFile,
  isNoOp,
  withMetadata,
} from '../strategies/shared/operations';

// ============================================================================
// PATTERN UTILITIES
// ============================================================================

export {
  containsKeyword,
  extractNumber,
  extractString,
  findMatchingPattern,
  inRange,
  matchesAll,
  matchesAny,
  matchNumberInRange,
  type NumberRange,
  type PatternMatch,
} from '../strategies/shared/pattern-utils';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get line at specific line number (1-indexed)
 * Convenience wrapper around getLineContext for simple use cases
 *
 * @deprecated Use getLineContext() for richer context
 */
export function getLine(content: string, lineNum: number): string | null {
  const lines = content.split('\n');
  return lines[lineNum - 1] ?? null;
}

/**
 * Check if line starts with any of the prefixes (convenience alias)
 *
 * @deprecated Use lineStartsWith() directly
 */
export function startsWithAny(line: string, prefixes: string[]): boolean {
  const trimmed = line.trim();
  return prefixes.some((p) => trimmed.startsWith(p));
}

/**
 * Check if line ends with any of the suffixes (convenience alias)
 *
 * @deprecated Use lineEndsWith() directly
 */
export function endsWithAny(line: string, suffixes: string[]): boolean {
  const trimmed = line.trim();
  return suffixes.some((s) => trimmed.endsWith(s));
}
