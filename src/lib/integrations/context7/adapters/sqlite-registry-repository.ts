/**
 * @module lib/integrations/context7/adapters/sqlite-registry-repository
 * @description SQLite-based registry storage adapter
 *
 * This adapter provides database access for the Context7 registry module.
 * It wraps the shared database from storage layer, providing a clean
 * interface for registry-specific operations.
 *
 * The registry stores:
 * - Library ID mappings (npm name -> Context7 ID)
 * - Library topics with usage tracking
 */

import type { Database } from 'better-sqlite3';
import { getDatabase as storageGetDatabase } from '@/lib/storage';

/**
 * Get the shared SQLite database instance.
 *
 * This function provides access to the application's shared database
 * for registry operations. It delegates to the storage layer's
 * database management.
 *
 * @returns SQLite database instance
 *
 * @example
 * ```ts
 * const db = getRegistryDatabase();
 * db.exec('CREATE TABLE IF NOT EXISTS ...');
 * ```
 */
export function getRegistryDatabase(): Database {
  return storageGetDatabase();
}
