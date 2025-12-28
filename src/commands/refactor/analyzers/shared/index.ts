/**
 * @module commands/refactor/analyzers/shared
 * @description Shared utilities for analyzers
 */

// Shared constants for duplicate detection
export {
  LIMITS,
  type Limits,
  SIMILARITY_THRESHOLDS,
  type SimilarityThresholds,
  SKIP_DIRS,
  TS_EXTENSIONS,
} from './constants';
// Shared hashing utilities
export { hashContent } from './hashing';
// Helper functions
export type { PackageJson } from './helpers';
export {
  createSharedProject,
  findDir,
  findFile,
  findTsConfig,
  getAllDependencies,
  getSubdirectories,
  hasDir,
  hasFile,
  listDirectory,
  readPackageJson,
} from './helpers';

// Shared similarity algorithms
export {
  calculateGroupSimilarity,
  calculateStringSimilarity,
  jaccardSimilarity,
  tokenize,
} from './similarity';

// Shared types for analyzers
export type {
  BaseDuplicateInfo,
  DuplicateDetectionOptions,
  DuplicateLocation,
  DuplicateRecommendation,
} from './types';
