/**
 * @module lib/@docs-cache/storage
 * @description SQLite-based documentation cache with FTS5 search
 *
 * Split structure:
 * - constants.ts - TTL and configuration
 * - converters.ts - Row to object converters
 * - library.ts - Library CRUD operations
 * - sections.ts - Section CRUD operations
 * - search.ts - FTS5 full-text search
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

// Search operations
export { searchDocs } from './search';
// Section operations
export { getSectionsByLibrary, saveSection } from './sections';
