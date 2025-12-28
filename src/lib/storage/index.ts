/**
 * @module lib/storage
 * @description Unified SQLite-based storage system
 *
 * This module provides persistent storage for:
 * - Memory system (AI context, decisions, patterns, bugfixes)
 * - Documentation cache (Context7 library docs with FTS5 search)
 *
 * Structure:
 * - database.ts - Shared SQLite database with migrations
 * - memory/ - Memory storage operations
 * - docs/ - Documentation cache operations
 */

// Shared database
export {
  clearStatementCache,
  closeDatabase,
  getDatabase,
  getDatabasePath,
  getDatabaseStats,
  prepareStatement,
} from './database';
// Docs cache storage
export {
  // Types
  type CachedLibrary,
  // Cache management
  clearExpired,
  type DocSearchResult,
  type DocSection,
  type DocsCacheStats,
  type DocsSearchOptions,
  deleteLibrary,
  // Constants
  getExpirationEpoch,
  // Library operations
  getLibrary,
  getLibraryByName,
  // Section operations
  getSectionsByLibrary,
  getStats,
  listLibraries,
  // Converters
  rowToLibrary,
  rowToSection,
  saveLibrary,
  saveSection,
  // Search operations
  searchDocs,
  TTL_DAYS,
} from './docs';
// Memory storage
export {
  // Constants
  BM25_RELEVANCE_MULTIPLIER,
  DEFAULT_IMPORTANCE,
  DEFAULT_SEARCH_LIMIT,
  FEATURE_FALLBACK_RELEVANCE,
  // CRUD
  getById,
  getProjects,
  HIGH_IMPORTANCE_LEVELS,
  LIKE_MATCH_RELEVANCE,
  // Types
  type Memory,
  type MemoryContext,
  type MemoryImportance,
  type MemorySaveOptions,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryStats,
  type MemoryType,
  recent,
  remove,
  // Converters
  rowToMemory,
  save,
  search,
  searchByFeatures,
  searchWithLike,
  stats,
  update,
} from './memory';
