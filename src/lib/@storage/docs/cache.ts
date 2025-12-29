/**
 * @module lib/@storage/docs/cache
 * @description Cache management operations (delete, clear, stats)
 */

import { getDatabase } from '../database';
import type { DocsCacheStats } from './types';

/**
 * Delete library and its sections
 */
export function deleteLibrary(libraryId: string): boolean {
  const db = getDatabase();

  // Delete sections first (cascade should handle this, but explicit is safer)
  db.prepare('DELETE FROM doc_sections WHERE library_id = ?').run(libraryId);

  // Delete library
  const result = db.prepare('DELETE FROM library_docs WHERE library_id = ?').run(libraryId);

  return result.changes > 0;
}

/**
 * Delete all expired entries
 */
export function clearExpired(): { librariesDeleted: number; sectionsDeleted: number } {
  const db = getDatabase();
  const nowEpoch = Date.now();

  // Get expired library IDs
  const expiredLibs = db
    .prepare('SELECT library_id FROM library_docs WHERE expires_at_epoch < ?')
    .all(nowEpoch) as Array<{ library_id: string }>;

  let sectionsDeleted = 0;
  for (const lib of expiredLibs) {
    const result = db.prepare('DELETE FROM doc_sections WHERE library_id = ?').run(lib.library_id);
    sectionsDeleted += result.changes;
  }

  // Delete expired libraries
  const libsResult = db
    .prepare('DELETE FROM library_docs WHERE expires_at_epoch < ?')
    .run(nowEpoch);

  return {
    librariesDeleted: libsResult.changes,
    sectionsDeleted,
  };
}

/**
 * Get cache statistics
 */
export function getStats(): DocsCacheStats {
  const db = getDatabase();
  const nowEpoch = Date.now();

  // Total libraries
  const totalLibsRow = db.prepare('SELECT COUNT(*) as count FROM library_docs').get() as {
    count: number;
  };

  // Total sections
  const totalSectionsRow = db.prepare('SELECT COUNT(*) as count FROM doc_sections').get() as {
    count: number;
  };

  // Expired libraries
  const expiredLibsRow = db
    .prepare('SELECT COUNT(*) as count FROM library_docs WHERE expires_at_epoch < ?')
    .get(nowEpoch) as { count: number };

  // Oldest and newest entries
  const oldestRow = db.prepare('SELECT MIN(fetched_at) as oldest FROM library_docs').get() as {
    oldest: string | null;
  };
  const newestRow = db.prepare('SELECT MAX(fetched_at) as newest FROM library_docs').get() as {
    newest: string | null;
  };

  return {
    totalLibraries: totalLibsRow.count,
    totalSections: totalSectionsRow.count,
    expiredCount: expiredLibsRow.count,
    ...(oldestRow.oldest ? { oldestFetch: oldestRow.oldest } : {}),
    ...(newestRow.newest ? { newestFetch: newestRow.newest } : {}),
  };
}
