/**
 * @module commands/refactor/analyzers/core/duplicates/strategies
 * @description Duplicate detection strategies
 *
 * Each strategy handles a different type of duplicate detection:
 * - Name-based: Same function name in multiple files
 * - Body hash: Identical function bodies with different names
 * - Structural: Same structure with renamed variables
 */

// Detection strategies
export { findBodyHashDuplicates } from './body-duplicates';
// Filters (used by multiple strategies)
export { areIntentionalVerbNounPatterns, haveDifferentArchPatterns } from './filters';
// Helpers (used by strategies)
export {
  areAllInDifferentRouteSegments,
  deduplicateLocations,
  isLargeEnoughForDuplication,
  isNextJsPageFile,
  sortNamesByExportStatus,
} from './helpers';
export { findNameBasedDuplicates } from './name-duplicates';
export { findSemanticClones, type SemanticCloneOptions } from './semantic-clones';
export { findStructuralClones } from './structural-clones';
