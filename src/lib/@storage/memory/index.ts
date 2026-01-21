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
 * - semantic-search.ts - Embedding-based semantic search
 * - embeddings.ts - Local embedding generation (transformers.js)
 * - links.ts - Memory graph relationships
 * - auto-tag.ts - Automatic tag extraction
 * - consolidation.ts - Duplicate detection and cleanup
 * - feature-search.ts - Semantic feature-based search for context injection
 * - query.ts - Recent memories and project listing
 * - stats.ts - Memory statistics
 */

// Cosine similarity (from shared semantic-search)
export { cosineSimilarity } from '../semantic-search';
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
export {
  getById,
  getCountsByScope,
  getCountsBySource,
  getGlobalMemories,
  incrementUsage,
  promote,
  remove,
  save,
  saveGlobal,
  update,
} from './crud';
// Embedding pool (direct access for advanced use)
export type { EmbeddingPoolStatus } from './embedding-pool';
// Embeddings (worker thread based - non-blocking)
export {
  EMBEDDING_DIMENSION,
  type EmbeddingResult,
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingsError,
  getEmbeddingsStatus,
  isEmbeddingsAvailable,
  isEmbeddingsLoading,
  preloadEmbedder,
  preloadEmbeddingPool,
} from './embeddings';
// Feature search operations
export { searchByFeatures } from './feature-search';
// Memory links (graph)
export {
  ALL_LINK_TYPES,
  createLink,
  deleteAllLinks,
  deleteLink,
  getAllLinks,
  getLink,
  getLinkedFrom,
  getLinkedTo,
  getLinkStats,
  getMemoryChain,
  getSupersededMemories,
  getSupersedingMemory,
  isSuperseded,
  type LinkedMemory,
  type LinkType,
  type MemoryLink,
} from './links';
// Query operations
export { getProjects, recent } from './query';
// Search operations
export { search, searchWithLike } from './search';
// Semantic search (hybrid BM25 + embeddings)
export {
  backfillEmbeddings,
  deleteEmbedding,
  getEmbedding,
  getEmbeddingsCount,
  getMissingEmbeddingsCount,
  type HybridSearchOptions,
  hasEmbedding,
  hybridSearch,
  isVec0SearchAvailable,
  migrateToVec0,
  type SemanticSearchResult,
  semanticSearch,
  storeEmbedding,
} from './semantic-search';
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
  GlobalMemorySaveOptions,
  GlobalMemoryType,
  Memory,
  MemoryContext,
  MemoryImportance,
  MemorySaveOptions,
  MemoryScope,
  MemorySearchOptions,
  MemorySearchResult,
  MemorySource,
  MemoryType,
  ProjectMemoryType,
} from './types';
// Type helpers
export {
  ALL_MEMORY_TYPES,
  GLOBAL_MEMORY_TYPES,
  inferScope,
  isGlobalType,
  isProjectType,
  PROJECT_MEMORY_TYPES,
} from './types';
