/**
 * @module commands/fix/strategies/srp/constants
 * @description Constants and patterns for SRP (Single Responsibility) fixes
 */

import type { NumberRange } from '../../core';

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Patterns for detecting SRP issues in messages
 */
export const SRP_PATTERNS = {
  EXPORTS: /(\d+)\s*exports/i,
  FUNCTIONS: /(\d+)\s*functions/i,
  LINES: /(\d+)\s*lines/i,
  MIXED: /mixed\s*concerns/i,
} as const;

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Range for file size (lines) that can be split
 * Too small = not worth splitting
 * Too large = too complex for automatic splitting
 */
export const SIZE_RANGE: NumberRange = {
  min: 400,
  max: 2000,
};

/**
 * Range for export count that can be split
 * Too few = not worth splitting
 * Too many = too complex for automatic splitting
 */
export const EXPORTS_RANGE: NumberRange = {
  min: 10,
  max: 50,
};

/**
 * Range for function count that can be grouped
 */
export const FUNCTIONS_RANGE: NumberRange = {
  min: 10,
  max: 40,
};
