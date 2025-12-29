/**
 * @module lib/@detectors/types
 * @description Shared types for pattern matching
 */

import { Severity } from '@/types/severity';

// Re-export Severity for backwards compatibility
export { Severity };

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
 * Detected hardcoded value
 */
export interface HardcodedValue {
  value: string | number;
  type: HardcodedType;
  line: number;
  column: number;
  context?: string;
}

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
