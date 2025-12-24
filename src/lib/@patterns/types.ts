/**
 * @module lib/@patterns/types
 * @description Shared types for pattern matching
 */

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Start index in the string */
  index: number;
  /** Matched text */
  text: string;
  /** Captured groups */
  groups?: Record<string, string>;
}

/**
 * Hardcoded value types
 */
export type HardcodedType = 'number' | 'url' | 'color' | 'string';
/**
 * Quality categories
 */
export type QualityCategory =
  | 'lint'
  | 'type-safety'
  | 'complexity'
  | 'hardcoded'
  | 'srp'
  | 'documentation';
