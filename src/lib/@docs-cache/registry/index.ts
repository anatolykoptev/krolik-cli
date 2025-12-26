/**
 * @module lib/@docs-cache/registry
 * @description Registry submodules for library resolution
 *
 * Split structure:
 * - defaults.ts: Static configuration for common libraries
 * - scoring.ts: Search result scoring algorithm
 * - database.ts: Database operations (mappings, topics)
 * - api.ts: Context7 API resolution
 * - resolve.ts: Library ID resolution functions
 * - topics.ts: Topic management
 */

// API resolution
export { getClient, resolveViaApi } from './api';
// Database operations
export {
  clearRegistry,
  ensureRegistryTables,
  getAllMappings,
  getCachedMapping,
  getCachedTopics,
  getRegistryStats,
  getUniqueLibraryIds,
  saveMappingToCache,
  saveTopicToCache,
  seedDefaultMappings,
  seedDefaultTopics,
} from './database';
// Defaults
export { DEFAULT_MAPPINGS, DEFAULT_TOPICS } from './defaults';
// Library ID resolution
export { registerMapping, resolveLibraryIdDynamic, resolveLibraryIdSync } from './resolve';
// Scoring
export {
  MIN_CONFIDENCE_THRESHOLD,
  MIN_SNIPPETS_FOR_BONUS,
  MIN_STARS_FOR_BONUS,
  SCORING_WEIGHTS,
  scoreSearchResult,
  selectBestResult,
} from './scoring';

// Topic management
export { addTopicsForLibrary, getTopicsForLibrary, recordTopicUsage } from './topics';
