/**
 * @module commands/fix/strategies/type-safety/fixes
 * @description Fix generators for type-safety issues
 */

import type { QualityIssue } from '../../types';
import type { FixOperation } from '../../types';
import {
  getLineContext,
  lineContains,
  createDeleteLine,
  createReplaceLine,
} from '../shared';
import {
  TS_IGNORE_PATTERNS,
  TS_NOCHECK_PATTERNS,
  ANY_TYPE_PATTERNS,
} from './constants';

// ============================================================================
// TS-EXPECT-ERROR FIX
// ============================================================================

/**
 * Fix @ts-expect-error comments
 *
 * Removes @ts-expect-error comments which suppress type errors.
 * Better to fix the actual type error than suppress it.
 */
export function fixTsIgnore(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  // Standalone line comment: // @ts-expect-error
  if (TS_IGNORE_PATTERNS.STANDALONE.test(lineCtx.line)) {
    return createDeleteLine(issue.file, issue.line, lineCtx.line);
  }

  // Standalone block comment: /* @ts-expect-error */
  if (TS_IGNORE_PATTERNS.BLOCK.test(lineCtx.line)) {
    return createDeleteLine(issue.file, issue.line, lineCtx.line);
  }

  // Inline @ts-expect-error - remove just the comment
  if (lineContains(lineCtx.line, ['@ts-ignore'])) {
    const newLine = lineCtx.line
      .replace(TS_IGNORE_PATTERNS.INLINE_LINE, '')
      .replace(TS_IGNORE_PATTERNS.INLINE_BLOCK, '');

    return createReplaceLine(issue.file, issue.line, lineCtx.line, newLine);
  }

  return null;
}

// ============================================================================
// ============================================================================

/**
 * Fix @ts-nocheck comments
 *
 * Removes @ts-nocheck which disables type checking for entire file.
 * This should never be used in production code.
 */
export function fixTsNocheck(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  // Delete the @ts-nocheck line
  if (TS_NOCHECK_PATTERNS.ANY.test(lineCtx.line)) {
    return createDeleteLine(issue.file, issue.line, lineCtx.line);
  }

  return null;
}

// ============================================================================
// EXPLICIT ANY FIX
// ============================================================================

/**
 * Fix explicit 'any' type annotations
 *
 * Replaces `: any` with `: unknown` which is safer.
 * `unknown` requires type narrowing before use, unlike `any`.
 */
export function fixAnyType(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  let newLine = lineCtx.line;
  let replaced = false;

  // Apply all any-type patterns
  for (const pattern of ANY_TYPE_PATTERNS) {
    // Need to create new RegExp to reset lastIndex for global patterns
    const freshPattern = new RegExp(pattern.source, pattern.flags);

    if (freshPattern.test(lineCtx.line)) {
      // Reset pattern again for replace
      const replacePattern = new RegExp(pattern.source, pattern.flags);
      newLine = newLine.replace(replacePattern, (match) => {
        replaced = true;
        return match.replace(/\bany\b/, 'unknown');
      });
    }
  }

  if (replaced) {
    return createReplaceLine(issue.file, issue.line, lineCtx.line, newLine);
  }

  return null;
}
