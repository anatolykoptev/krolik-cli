/**
 * @module lib/constants/lint
 * @description Unified lint constants - single source of truth
 *
 * Used by:
 * - lib/@patterns/lint.ts (lint rule definitions)
 * - commands/fix/strategies/lint/constants.ts (fix strategies)
 * - commands/fix/strategies/lint/fixes.ts (fix generators)
 */

// ============================================================================
// FIXABLE KEYWORDS
// ============================================================================

/**
 * Keywords that indicate fixable lint issues
 */
export const LINT_KEYWORDS = {
  DEBUGGER: ['debugger'],
  ALERT: ['alert'],
  CONSOLE: ['console'],
} as const;

// ============================================================================
// CONSOLE PATTERNS
// ============================================================================

/**
 * Console methods that are likely intentional output (not debug logs)
 */
export const INTENTIONAL_CONSOLE_METHODS = [
  'console.error',
  'console.warn',
  'console.info',
  'console.table',
] as const;

/**
 * Console methods that are typically debug statements
 */
export const DEBUG_CONSOLE_METHODS = [
  'console.log',
  'console.debug',
  'console.trace',
  'console.dir',
  'console.count',
  'console.time',
  'console.timeEnd',
] as const;

// ============================================================================
// LINE PATTERNS
// ============================================================================

/**
 * Console line patterns for deletion
 */
export const CONSOLE_LINE_PATTERNS = {
  STANDALONE: /^console\.\w+\([^)]*\);?$/,
  COMPLETE: /;$|^\)/,
} as const;

/**
 * Debugger line patterns
 */
export const DEBUGGER_LINE_PATTERNS = {
  STANDALONE: /^debugger;?$/,
  INLINE: /\bdebugger;?\s*/g,
} as const;

/**
 * Alert line patterns
 */
export const ALERT_LINE_PATTERNS = {
  STANDALONE: /^alert\([^)]*\);?$/,
} as const;
