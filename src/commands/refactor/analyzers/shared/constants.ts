/**
 * @module commands/refactor/analyzers/shared/constants
 * @description Shared constants for duplicate detection analyzers
 */

/**
 * Similarity thresholds for duplicate detection
 * Used by both function and type duplicate analyzers
 */
export const SIMILARITY_THRESHOLDS = {
  /** >80% similar = merge candidates (identical or nearly identical) */
  MERGE: 0.8,
  /** >50% similar = consider rename for types (conservative) */
  RENAME_TYPES: 0.5,
  /** >30% similar = consider rename for functions */
  RENAME_FUNCTIONS: 0.3,
  /** Max 50% length difference for body comparison */
  LENGTH_DIFF: 0.5,
  /**
   * Minimum normalized body size in characters.
   * Filters out trivial one-liners like `return x`, `() => value`, etc.
   * ~40 chars filters single-line returns but keeps multi-line functions.
   */
  MIN_BODY_LENGTH: 40,
} as const;

/**
 * Resource limits for analysis
 */
export const LIMITS = {
  /** Maximum files to analyze in a single run */
  MAX_FILES: 5000,
  /** Maximum file size in bytes (1MB) */
  MAX_FILE_SIZE: 1024 * 1024,
  /** Minimum structure length for type comparison */
  MIN_STRUCTURE_LENGTH: 5,
} as const;

/**
 * Directories to skip during analysis
 */
export const SKIP_DIRS = ['node_modules', 'dist', 'build', '.next', 'coverage', '.git'] as const;

/**
 * TypeScript file extensions to analyze
 */
export const TS_EXTENSIONS = ['.ts', '.tsx'] as const;

export type SimilarityThresholds = typeof SIMILARITY_THRESHOLDS;
export type Limits = typeof LIMITS;
