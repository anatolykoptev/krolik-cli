/**
 * @module commands/refactor/analyzers/core/duplicates/constants
 * @description Structural patterns for generic name detection
 */

/**
 * Linguistic patterns that indicate generic/anonymous naming
 * These are structural patterns, not word lists
 */
export const GENERIC_STRUCTURAL_PATTERNS = [
  /^[a-z]$/, // Single letter: a, b, x, y
  /^[a-z]{1,2}\d*$/, // Short with optional number: fn, cb, x1
  /^_+$/, // Underscores only
  /^[a-z]{3}$/, // 3-letter all-lowercase (likely abbreviation)
];
