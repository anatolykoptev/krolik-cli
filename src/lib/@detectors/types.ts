/**
 * @module lib/@detectors/types
 * @description Shared types for pattern matching
 *
 * NOTE: QualityCategory, QualityIssue, HardcodedType, and HardcodedValue
 * are canonically defined in ./issue-factory/types.ts and re-exported here.
 */

import { Severity } from '@/types/severity';

// Re-export Severity for backwards compatibility
export { Severity };

// Re-export canonical types from issue-factory
export type {
  HardcodedType,
  HardcodedValue,
  QualityCategory,
} from './patterns/issue-factory/types';

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
