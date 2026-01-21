/**
 * @module lib/@storage/docs
 * @description SQLite-based documentation cache with FTS5 and semantic search
 *
 * Split structure:
 * - types.ts - Type definitions
 * - constants.ts - TTL and configuration
 * - converters.ts - Row to object converters
 * - library.ts - Library CRUD operations
 * - sections.ts - Section CRUD operations
 * - search.ts - FTS5 full-text search
 * - semantic-search.ts - Semantic search with embeddings
 * - migrate-embeddings.ts - Background migration for embeddings
 * - cache.ts - Cache management (delete, clear, stats)
 */

// Cache management
export { clearExpired, deleteLibrary, getStats } from './cache';
// Constants
export { getExpirationEpoch, TTL_DAYS } from './constants';
// Converters (internal use, but exported for testing)
export { rowToLibrary, rowToSection } from './converters';
// Library operations
export { getLibrary, getLibraryByName, listLibraries, saveLibrary } from './library';
// Migration utilities
export { ensureDocEmbeddingsMigrated, isDocMigrationComplete } from './migrate-embeddings';
// Search operations
export { searchDocs } from './search';
// Section operations
export { getSectionsByLibrary, saveSection } from './sections';
// Semantic search operations
export {
  backfillDocEmbeddings,
  deleteDocEmbedding,
  getDocEmbedding,
  getDocEmbeddingsCount,
  getMissingDocEmbeddingsCount,
  hasDocEmbedding,
  hybridDocSearch,
  semanticDocSearch,
  storeDocEmbedding,
} from './semantic-search';
// Types
export type {
  CachedLibrary,
  DocSearchResult,
  DocSection,
  DocsCacheStats,
  DocsHybridSearchOptions,
  DocsSearchOptions,
  SemanticSearchResult,
} from './types';
