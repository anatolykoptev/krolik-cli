/**
 * @module lib/@storage/database/stats
 * @description Database statistics and diagnostics
 */

import * as fs from 'node:fs';
import { getDatabase, getEffectiveDbPath } from './connection';
import { getSchemaVersion } from './migrations';
import { prepareStatement } from './statements';
import type { DatabaseOptions, DatabaseStats } from './types';

/**
 * Get database path (for diagnostics)
 *
 * @param options - Database options
 */
export function getDatabasePath(options?: DatabaseOptions): string {
  return getEffectiveDbPath(options);
}

/**
 * Get database stats
 *
 * @param options - Database options
 */
export function getDatabaseStats(options?: DatabaseOptions): DatabaseStats {
  const db = getDatabase(options);
  const dbPath = getEffectiveDbPath(options);

  let sizeBytes = 0;
  try {
    const stats = fs.statSync(dbPath);
    sizeBytes = stats.size;
  } catch {
    // File doesn't exist yet
  }

  // Count tables
  const tableCountSql = "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'";
  const tableRow = prepareStatement<[], { count: number }>(db, tableCountSql).get();
  const tables = tableRow?.count ?? 0;

  const schemaVersion = getSchemaVersion(db);

  return {
    path: dbPath,
    sizeBytes,
    tables,
    schemaVersion,
  };
}
