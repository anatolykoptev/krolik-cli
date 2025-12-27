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
} from './line-utils';

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
} from './operations';

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
} from './pattern-utils';
