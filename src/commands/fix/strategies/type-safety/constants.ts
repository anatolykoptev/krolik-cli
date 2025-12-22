/**
 * @module commands/fix/strategies/type-safety/constants
 * @description Constants and patterns for type-safety fixes
 */

// ============================================================================
// FIXABLE KEYWORDS
// ============================================================================

/**
 * Keywords that indicate fixable type-safety issues
 */
export const TYPE_SAFETY_KEYWORDS = {
  TS_IGNORE: ['@ts-ignore'],
  TS_NOCHECK: ['@ts-nocheck'],
  EXPLICIT_ANY: ['explicit any', ': any'],
} as const;

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Patterns for @ts-ignore comments
 */
export const TS_IGNORE_PATTERNS = {
  /** Standalone comment line */
  STANDALONE: /^\s*\/\/\s*@ts-ignore\s*$/,
  /** Block comment */
  BLOCK: /^\s*\/\*\s*@ts-ignore\s*\*\/\s*$/,
  /** Inline line comment */
  INLINE_LINE: /\/\/\s*@ts-ignore\s*/g,
  /** Inline block comment */
  INLINE_BLOCK: /\/\*\s*@ts-ignore\s*\*\/\s*/g,
} as const;

/**
 * Patterns for @ts-nocheck comments
 */
export const TS_NOCHECK_PATTERNS = {
  /** Contains @ts-nocheck */
  ANY: /@ts-nocheck/,
} as const;

/**
 * Patterns for explicit 'any' type annotations
 *
 * These patterns match type annotations that use 'any'
 * and should be replaced with 'unknown' for better type safety.
 */
export const ANY_TYPE_PATTERNS = [
  /:\s*any\b/g,           // : any
  /:\s*any\[\]/g,         // : any[]
  /:\s*any\s*\|/g,        // : any |
  /\|\s*any\b/g,          // | any
  /<any>/g,               // <any>
  /<any,/g,               // <any,
  /,\s*any>/g,            // , any>
] as const;
