/**
 * @module lib/constants/complexity
 * @description Constants for complexity analysis and fixes
 */

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Number range type
 */
export interface NumberRange {
  min: number;
  max: number;
}

/**
 * Complexity range we can handle (10-120)
 */
export const COMPLEXITY_RANGE: NumberRange = {
  min: 10,
  max: 120,
};

/**
 * Line count range for long function fixes (50-200)
 */
export const LONG_FUNCTION_RANGE: NumberRange = {
  min: 50,
  max: 200,
};

/**
 * Minimum block size for extraction (5+ lines)
 */
export const MIN_BLOCK_SIZE = 5;

/**
 * Minimum complexity for block extraction
 */
export const MIN_BLOCK_COMPLEXITY = 2;

/**
 * Minimum conditions for if-chain to map conversion
 */
export const MIN_IF_CHAIN_LENGTH = 4;

/**
 * Minimum statements for early return transformation
 */
export const MIN_STATEMENTS_FOR_EARLY_RETURN = 3;

/**
 * Default max nesting depth
 */
export const DEFAULT_MAX_NESTING = 4;

/**
 * Default max function complexity
 */
export const DEFAULT_MAX_COMPLEXITY = 10;

// ============================================================================
// DETECTION PATTERNS (for fix strategies)
// ============================================================================

/**
 * Patterns to detect fixable complexity issues from quality messages
 */
export const COMPLEXITY_DETECTION_PATTERNS = {
  /** Matches: "nesting depth" */
  NESTING: /nesting depth/i,
  /** Matches: "has complexity 25 (max: 10)" - captures the number */
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,
  /** Matches: "has 50 lines" or "function ... 50 lines" - captures the number */
  LONG_FUNCTION: /(\d+)\s*lines/i,
} as const;
