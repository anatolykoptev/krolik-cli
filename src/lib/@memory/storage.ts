/**
 * @module lib/@memory/storage
 * @description SQLite-based memory storage with FTS5 search
 *
 * This module re-exports from the split storage/ directory.
 * See storage/index.ts for the full module structure.
 */

export type { MemoryStats } from './storage/index';
export {
  // Constants
  BM25_RELEVANCE_MULTIPLIER,
  DEFAULT_IMPORTANCE,
  DEFAULT_SEARCH_LIMIT,
  FEATURE_FALLBACK_RELEVANCE,
  // CRUD operations
  getById,
  // Query operations
  getProjects,
  HIGH_IMPORTANCE_LEVELS,
  LIKE_MATCH_RELEVANCE,
  recent,
  remove,
  // Converters
  rowToMemory,
  save,
  // Search operations
  search,
  searchByFeatures,
  searchWithLike,
  // Stats operations
  stats,
  update,
} from './storage/index';
