/**
 * @module commands/refactor/analyzers/shared/types
 * @description Shared types for analyzer modules
 */

import type { Project } from '../../../../lib/@ast';

/**
 * Common options for duplicate detection
 */
export interface DuplicateDetectionOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Ignore test files (.test.ts, .spec.ts) */
  ignoreTests?: boolean;
  /** Shared ts-morph Project instance for performance */
  project?: Project;
}

/**
 * Location of a duplicate item in the codebase
 */
export interface DuplicateLocation {
  /** File path (relative to project root) */
  file: string;
  /** Line number in the file */
  line: number;
  /** Whether the item is exported */
  exported: boolean;
  /** Optional item name for disambiguation */
  name?: string;
}

/**
 * Recommendation for handling duplicates
 */
export type DuplicateRecommendation = 'merge' | 'rename' | 'keep-both';

/**
 * Base interface for duplicate info
 * Extended by FunctionDuplicateInfo and TypeDuplicateInfo
 */
export interface BaseDuplicateInfo {
  /** Name of the duplicated item */
  name: string;
  /** All locations where the duplicate appears */
  locations: DuplicateLocation[];
  /** Similarity score (0-1) between duplicates */
  similarity: number;
  /** Recommended action */
  recommendation: DuplicateRecommendation;
}
