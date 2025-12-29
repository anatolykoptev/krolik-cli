/**
 * @module lib/@integrations/context7/adapters/sqlite-registry-repository
 * @description SQLite-based registry storage adapter
 *
 * This adapter provides database access for the Context7 registry module.
 * It uses an injected database getter function instead of importing directly
 * from the storage layer, maintaining proper layer separation.
 *
 * The registry stores:
 * - Library ID mappings (npm name -> Context7 ID)
 * - Library topics with usage tracking
 */

import type { Database } from 'better-sqlite3';

/**
 * Database getter function type for dependency injection.
 */
export type DatabaseGetter = () => Database;

// Injected database getter - set via configureRegistryDatabase()
let databaseGetter: DatabaseGetter | null = null;

/**
 * Configure the database getter for the registry.
 * Must be called before using getRegistryDatabase().
 *
 * @param getter - Function that returns the database instance
 *
 * @example
 * ```ts
 * import { getDatabase } from '@/lib/@storage';
 * configureRegistryDatabase(getDatabase);
 * ```
 */
export function configureRegistryDatabase(getter: DatabaseGetter): void {
  databaseGetter = getter;
}

/**
 * Get the shared SQLite database instance.
 *
 * This function provides access to the application's shared database
 * for registry operations. The database getter must be configured
 * via configureRegistryDatabase() before use.
 *
 * @returns SQLite database instance
 * @throws Error if database getter is not configured
 *
 * @example
 * ```ts
 * const db = getRegistryDatabase();
 * db.exec('CREATE TABLE IF NOT EXISTS ...');
 * ```
 */
export function getRegistryDatabase(): Database {
  if (!databaseGetter) {
    throw new Error(
      'Registry database not configured. Call configureRegistryDatabase() first, ' +
        'or use the factory from context7/factory.ts',
    );
  }
  return databaseGetter();
}

/**
 * Reset the database configuration (useful for testing).
 */
export function resetRegistryDatabase(): void {
  databaseGetter = null;
}
