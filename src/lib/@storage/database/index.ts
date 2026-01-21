/**
 * @module lib/@storage/database
 * @description SQLite database manager for storage system
 *
 * This module provides:
 * - Connection management (global and project-scoped databases)
 * - Prepared statement caching for performance
 * - Schema migrations (17 versions)
 * - Database statistics
 *
 * Architecture:
 * - Global database (~/.krolik/memory/memories.db): patterns, library docs, agents
 * - Project database ({project}/.krolik/memory/krolik.db): decisions, bugs, features
 *
 * @example
 * ```typescript
 * import {
 *   getDatabase,
 *   getGlobalDatabase,
 *   prepareStatement,
 * } from '@/lib/@storage/database';
 *
 * // Get global database
 * const db = getGlobalDatabase();
 *
 * // Use prepared statement for better performance
 * const stmt = prepareStatement(db, 'SELECT * FROM memories WHERE id = ?');
 * const memory = stmt.get(123);
 * ```
 */

// Connection management
export {
  closeAllDatabases,
  closeDatabase,
  databaseExists,
  getDatabase,
  getEffectiveDbPath,
  getGlobalDatabase,
  getOpenDatabasePaths,
  getProjectDatabase,
} from './connection';
// Migrations
export { CURRENT_VERSION, getSchemaVersion, rollbackMigration, runMigrations } from './migrations';
export type { DocumentType, ImportanceLevel, MemoryType, ModelName } from './migrations/types';
// Migration types (for reference)
export { DOCUMENT_TYPES, IMPORTANCE_LEVELS, MEMORY_TYPES, MODEL_NAMES } from './migrations/types';
// Prepared statements
export { clearStatementCache, getStatementCacheSize, prepareStatement } from './statements';
// Statistics
export { getDatabasePath, getDatabaseStats } from './stats';
// Types
export type {
  DatabaseOptions,
  DatabaseScope,
  DatabaseStats,
  Migration,
  MigrationFn,
} from './types';
