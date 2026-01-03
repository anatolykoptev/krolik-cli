/**
 * @module lib/@storage/memory
 * @description SQLite-based memory storage with FTS5 search
 *
 * Split structure:
 * - types.ts - Type definitions
 * - constants.ts - Default values and configuration
 * - converters.ts - Row to object converters
 * - crud.ts - Save, getById, remove, update operations
 * - search.ts - FTS5 full-text search with LIKE fallback
 * - smart-search.ts - Google-style context-aware ranking
 * - auto-tag.ts - Automatic tag extraction
 * - consolidation.ts - Duplicate detection and cleanup
 * - feature-search.ts - Semantic feature-based search for context injection
 * - query.ts - Recent memories and project listing
 * - stats.ts - Memory statistics
 */

// Auto-tagging
export {
  type EnrichedMemoryOptions,
  enrichMemoryOptions,
  extractFeatures,
  extractFiles,
  extractTags,
  suggestImportance,
  suggestMemoryType,
} from './auto-tag';
// Consolidation
export {
  analyzeConsolidation,
  type ConsolidationResult,
  cleanupStaleMemories,
  deleteMemory,
  findSimilarMemories,
  findStaleMemories,
  mergeMemories,
  type SimilarityMatch,
} from './consolidation';
// Constants
export {
  BM25_RELEVANCE_MULTIPLIER,
  DEFAULT_IMPORTANCE,
  DEFAULT_SEARCH_LIMIT,
  FEATURE_FALLBACK_RELEVANCE,
  HIGH_IMPORTANCE_LEVELS,
  LIKE_MATCH_RELEVANCE,
} from './constants';
// Converters (internal use, but exported for testing)
export { rowToMemory } from './converters';
// CRUD operations
export { getById, remove, save, update } from './crud';
// Feature search operations
export { searchByFeatures } from './feature-search';
// Query operations
export { getProjects, recent } from './query';
// Search operations
export { search, searchWithLike } from './search';
// Smart search
export {
  getContextMemories,
  getCriticalMemories,
  getRecentDecisions,
  type RelevanceBreakdown,
  type SmartSearchOptions,
  type SmartSearchResult,
  smartSearch,
} from './smart-search';
// Stats operations
export type { MemoryStats } from './stats';
export { stats } from './stats';
// Types
export type {
  Memory,
  MemoryContext,
  MemoryImportance,
  MemorySaveOptions,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryType,
} from './types';
