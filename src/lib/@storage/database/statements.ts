/**
 * @module lib/@storage/database/statements
 * @description Prepared statement cache for SQLite performance
 */

import type { Database, Statement } from 'better-sqlite3';

/**
 * Cache for prepared statements to avoid re-preparing the same SQL
 * Key format: `${dbPath}:${sql}`
 */
const stmtCache = new Map<string, Statement<unknown[], unknown>>();

/**
 * Get or create a prepared statement from cache
 *
 * @param db - Database instance
 * @param sql - SQL query string
 * @returns Cached or newly prepared statement
 */
export function prepareStatement<BindParams extends unknown[] = unknown[], Result = unknown>(
  db: Database,
  sql: string,
): Statement<BindParams, Result> {
  const dbPath = db.name;
  const key = `${dbPath}:${sql}`;

  let stmt = stmtCache.get(key);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(key, stmt);
  }

  return stmt as Statement<BindParams, Result>;
}

/**
 * Clear statement cache
 *
 * Call this after schema changes (migrations) or when closing databases.
 *
 * @param dbPath - Optional database path to clear cache for specific DB only
 */
export function clearStatementCache(dbPath?: string): void {
  if (dbPath) {
    const prefix = `${dbPath}:`;
    for (const key of stmtCache.keys()) {
      if (key.startsWith(prefix)) {
        stmtCache.delete(key);
      }
    }
  } else {
    stmtCache.clear();
  }
}

/**
 * Get statement cache size (for debugging/stats)
 */
export function getStatementCacheSize(): number {
  return stmtCache.size;
}
