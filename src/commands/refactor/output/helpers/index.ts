/**
 * @module commands/refactor/output/helpers
 * @description Shared helper utilities for XML output formatting
 */

export {
  type AffectedFileLike,
  type DuplicateLike,
  deduplicateAffectedFiles,
  deduplicateByKey,
  deduplicateDuplicates,
  deduplicateMigrationActions,
  deduplicateMisplacedFiles,
  deduplicateRecommendations,
  deduplicateViolations,
  type MigrationActionLike,
  type MisplacedFileLike,
  type RecommendationLike,
  type ViolationLike,
} from './deduplication';

export {
  calculatePriority,
  getSeverityWeight,
  type PriorityFactors,
  SEVERITY_WEIGHTS,
  type SeverityLevel,
  sortByOrder,
  sortByPriority,
  sortByScore,
  sortBySeverity,
  sortBySimilarity,
} from './priority';
