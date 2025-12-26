/**
 * @module lib/@docs-cache/storage
 * @description SQLite-based documentation cache with FTS5 search
 *
 * Re-exports from storage/ submodules for backwards compatibility.
 * New code should import directly from './storage' or './storage/xxx'.
 */

export {
  // Cache management
  clearExpired,
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
  // Converters (for advanced use)
  rowToLibrary,
  rowToSection,
  saveLibrary,
  saveSection,
  // Search
  searchDocs,
  TTL_DAYS,
} from './storage/index';
