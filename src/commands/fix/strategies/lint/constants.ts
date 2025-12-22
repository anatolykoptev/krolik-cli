/**
 * @module commands/fix/strategies/lint/constants
 * @description Constants and patterns for lint fixes
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
// FILE PATTERNS
// ============================================================================

/**
 * File patterns where console output is intentional
 */
export const CLI_FILE_PATTERNS = [
  '/cli/',
  '/commands/',
  '/bin/',
  'cli.ts',
  'cli.js',
] as const;

/**
 * File patterns for test files
 */
export const TEST_FILE_PATTERNS = [
  '.test.',
  '.spec.',
  '__tests__',
  '/test/',
  '/tests/',
] as const;

/**
 * File patterns for output/logger files
 */
export const OUTPUT_FILE_PATTERNS = [
  '/output.',
  '/output/',
  '/logger.',
  '/logger/',
  '/logging/',
  'output.ts',
  'logger.ts',
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
