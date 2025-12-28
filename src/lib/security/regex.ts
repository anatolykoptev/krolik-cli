/**
 * @module lib/security/regex
 * @description Regex escaping utilities for safe string operations
 *
 * Used by: fix, refactor commands for pattern matching
 */

/**
 * Escape special regex characters in a string
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 *
 * @example
 * ```ts
 * const pattern = new RegExp(escapeRegex('foo.bar') + '\\s+');
 * // Creates /foo\.bar\s+/
 * ```
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape $ in replacement strings
 *
 * In String.replace(), $ has special meaning ($1, $2, etc).
 * Use this to escape literal $ characters in replacement strings.
 *
 * @param str - Replacement string to escape
 * @returns Escaped string safe for use in replace()
 *
 * @example
 * ```ts
 * content.replace(/price/g, escapeReplacement('$100'));
 * // Replaces with literal "$100" instead of "$1" + "00"
 * ```
 */
export function escapeReplacement(str: string): string {
  return str.replace(/\$/g, '$$$$');
}

/**
 * Create a safe replacement function that escapes special characters
 *
 * @param literal - Literal string to use as replacement
 * @returns Function suitable for String.replace()
 */
export function literalReplacer(literal: string): () => string {
  return () => literal;
}
