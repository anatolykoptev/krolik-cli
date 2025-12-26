/**
 * @module lib/@docs-cache/registry
 * @description Dynamic library registry with Context7 API fallback
 *
 * Re-exports from registry/ submodules for backwards compatibility.
 * New code should import directly from './registry' or './registry/xxx'.
 */

export {
  // Topic management
  addTopicsForLibrary,
  // Database operations
  clearRegistry,
  // Defaults
  DEFAULT_MAPPINGS,
  DEFAULT_TOPICS,
  getAllMappings,
  getRegistryStats,
  getTopicsForLibrary,
  getUniqueLibraryIds,
  recordTopicUsage,
  // Manual registration
  registerMapping,
  // Resolution functions
  resolveLibraryIdDynamic,
  resolveLibraryIdSync,
  // Seed functions
  seedDefaultMappings,
  seedDefaultTopics,
  // Scoring (exported for advanced use)
  selectBestResult,
} from './registry/index';

/**
 * Initialize registry with default mappings.
 * Call this on startup for optimal performance.
 */
export function initializeRegistry(): void {
  // Use dynamic import to get functions
  const { seedDefaultMappings, seedDefaultTopics } = require('./registry/database') as {
    seedDefaultMappings: () => void;
    seedDefaultTopics: () => void;
  };
  seedDefaultMappings();
  seedDefaultTopics();
}
