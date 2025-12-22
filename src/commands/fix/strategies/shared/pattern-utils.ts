/**
 * @module commands/fix/strategies/shared/pattern-utils
 * @description Pattern matching utilities for fix strategies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NumberRange {
  min: number;
  max: number;
}

export interface PatternMatch<T = string> {
  matched: boolean;
  value?: T;
  fullMatch?: string;
}

// ============================================================================
// NUMBER EXTRACTION
// ============================================================================

/**
 * Extract a number from a message using a pattern
 * Pattern should have a capture group for the number
 *
 * @example
 * extractNumber('has complexity 25', /has\s+complexity\s+(\d+)/i)
 * // { matched: true, value: 25, fullMatch: 'has complexity 25' }
 */
export function extractNumber(
  message: string,
  pattern: RegExp,
): PatternMatch<number> {
  const match = message.match(pattern);

  if (!match) {
    return { matched: false };
  }

  const value = parseInt(match[1] ?? '0', 10);

  return {
    matched: true,
    value,
    fullMatch: match[0],
  };
}

/**
 * Extract a string from a message using a pattern
 * Pattern should have a capture group for the string
 */
export function extractString(
  message: string,
  pattern: RegExp,
): PatternMatch<string> {
  const match = message.match(pattern);

  if (!match) {
    return { matched: false };
  }

  return {
    matched: true,
    value: match[1] ?? '',
    fullMatch: match[0],
  };
}

// ============================================================================
// RANGE CHECKS
// ============================================================================

/**
 * Check if a number is within a range (inclusive)
 */
export function inRange(value: number, range: NumberRange): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Extract number and check if it's in range
 *
 * @example
 * matchNumberInRange('has complexity 25', /complexity\s+(\d+)/i, { min: 10, max: 100 })
 * // true
 */
export function matchNumberInRange(
  message: string,
  pattern: RegExp,
  range: NumberRange,
): boolean {
  const result = extractNumber(message, pattern);

  if (!result.matched || result.value === undefined) {
    return false;
  }

  return inRange(result.value, range);
}

// ============================================================================
// PATTERN TESTING
// ============================================================================

/**
 * Test if message matches any of the patterns
 */
export function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

/**
 * Test if message matches all of the patterns
 */
export function matchesAll(message: string, patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(message));
}

/**
 * Find the first matching pattern and return its name
 */
export function findMatchingPattern<T extends string>(
  message: string,
  patterns: Record<T, RegExp>,
): T | null {
  for (const [name, pattern] of Object.entries(patterns) as [T, RegExp][]) {
    if (pattern.test(message)) {
      return name;
    }
  }
  return null;
}

// ============================================================================
// MESSAGE CHECKS
// ============================================================================

/**
 * Check if message contains any of the keywords (case-insensitive)
 */
export function containsKeyword(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}
