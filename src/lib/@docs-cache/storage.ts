/**
 * @module lib/@docs-cache/storage
 * @description SQLite-based documentation cache with FTS5 search
 */

import { getDatabase } from '../@memory/database';
import type {
  CachedLibrary,
  DocSearchResult,
  DocSection,
  DocsCacheStats,
  DocsSearchOptions,
} from './types';

const TTL_DAYS = 7;

/**
 * Convert database row to CachedLibrary object
 */
function rowToLibrary(row: Record<string, unknown>): CachedLibrary {
  const expiresAtEpoch = Number(row.expires_at_epoch);
  const now = Date.now();
  const version = row.version as string | null;

  return {
    id: Number(row.id),
    libraryId: row.library_id as string,
    name: row.library_name as string,
    ...(version ? { version } : {}),
    fetchedAt: row.fetched_at as string,
    expiresAt: new Date(expiresAtEpoch).toISOString(),
    totalSnippets: Number(row.total_snippets ?? 0),
    isExpired: expiresAtEpoch < now,
  };
}

/**
 * Convert database row to DocSection object
 */
function rowToSection(row: Record<string, unknown>): DocSection {
  const topic = row.topic as string | null;

  return {
    id: Number(row.id),
    libraryId: row.library_id as string,
    ...(topic ? { topic } : {}),
    title: row.title as string,
    content: row.content as string,
    codeSnippets: JSON.parse((row.code_snippets as string) || '[]'),
    pageNumber: Number(row.page_number ?? 1),
  };
}

/**
 * Calculate expiration epoch (7 days from now)
 */
function getExpirationEpoch(): number {
  return Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Save library metadata with 7-day TTL
 */
export function saveLibrary(libraryId: string, name: string, version?: string): CachedLibrary {
  const db = getDatabase();
  const now = new Date();
  const nowEpoch = now.getTime();
  const expiresAtEpoch = getExpirationEpoch();

  // Check if library already exists
  const existing = db.prepare('SELECT id FROM library_docs WHERE library_id = ?').get(libraryId) as
    | { id: number }
    | undefined;

  if (existing) {
    // Update existing library and refresh expiration
    db.prepare(
      `UPDATE library_docs
       SET library_name = ?, version = ?, fetched_at = ?, fetched_at_epoch = ?, expires_at_epoch = ?
       WHERE library_id = ?`,
    ).run(name, version ?? null, now.toISOString(), nowEpoch, expiresAtEpoch, libraryId);

    // Get updated total snippets
    const totalRow = db
      .prepare('SELECT COUNT(*) as count FROM doc_sections WHERE library_id = ?')
      .get(libraryId) as { count: number };

    return {
      id: existing.id,
      libraryId,
      name,
      ...(version ? { version } : {}),
      fetchedAt: now.toISOString(),
      expiresAt: new Date(expiresAtEpoch).toISOString(),
      totalSnippets: totalRow.count,
      isExpired: false,
    };
  }

  // Insert new library
  const stmt = db.prepare(`
    INSERT INTO library_docs (library_id, library_name, version, fetched_at, fetched_at_epoch, expires_at_epoch, total_snippets)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);

  const result = stmt.run(
    libraryId,
    name,
    version ?? null,
    now.toISOString(),
    nowEpoch,
    expiresAtEpoch,
  );

  return {
    id: Number(result.lastInsertRowid),
    libraryId,
    name,
    ...(version ? { version } : {}),
    fetchedAt: now.toISOString(),
    expiresAt: new Date(expiresAtEpoch).toISOString(),
    totalSnippets: 0,
    isExpired: false,
  };
}

/**
 * Save a documentation section
 */
export function saveSection(
  libraryId: string,
  topic: string | undefined,
  title: string,
  content: string,
  codeSnippets: string[],
  pageNumber: number,
): DocSection {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Verify library exists
  const libRow = db.prepare('SELECT id FROM library_docs WHERE library_id = ?').get(libraryId) as
    | { id: number }
    | undefined;

  if (!libRow) {
    throw new Error(`Library ${libraryId} not found in cache`);
  }

  // Check if section already exists (by library + topic + title)
  const existing = db
    .prepare(
      "SELECT id FROM doc_sections WHERE library_id = ? AND COALESCE(topic, '') = COALESCE(?, '') AND title = ?",
    )
    .get(libraryId, topic ?? null, title) as { id: number } | undefined;

  if (existing) {
    // Update existing section
    db.prepare(
      `UPDATE doc_sections
       SET title = ?, content = ?, code_snippets = ?, created_at = ?
       WHERE id = ?`,
    ).run(title, content, JSON.stringify(codeSnippets), now, existing.id);

    return {
      id: existing.id,
      libraryId,
      ...(topic ? { topic } : {}),
      title,
      content,
      codeSnippets,
      pageNumber,
    };
  }

  // Insert new section
  const stmt = db.prepare(`
    INSERT INTO doc_sections (library_id, topic, title, content, code_snippets, page_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    libraryId,
    topic ?? null,
    title,
    content,
    JSON.stringify(codeSnippets),
    pageNumber,
    now,
  );

  // Update total snippets count
  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM doc_sections WHERE library_id = ?')
    .get(libraryId) as { count: number };

  db.prepare('UPDATE library_docs SET total_snippets = ? WHERE library_id = ?').run(
    totalRow.count,
    libraryId,
  );

  return {
    id: Number(result.lastInsertRowid),
    libraryId,
    ...(topic ? { topic } : {}),
    title,
    content,
    codeSnippets,
    pageNumber,
  };
}

/**
 * Get library by Context7 ID
 */
export function getLibrary(libraryId: string): CachedLibrary | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM library_docs WHERE library_id = ?').get(libraryId) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;
  return rowToLibrary(row);
}

/**
 * Get library by display name (case-insensitive)
 */
export function getLibraryByName(name: string): CachedLibrary | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM library_docs WHERE LOWER(library_name) = LOWER(?)')
    .get(name) as Record<string, unknown> | undefined;

  if (!row) return null;
  return rowToLibrary(row);
}

/**
 * List all cached libraries with expiry status
 */
export function listLibraries(): CachedLibrary[] {
  const db = getDatabase();

  const rows = db.prepare('SELECT * FROM library_docs ORDER BY fetched_at DESC').all() as Array<
    Record<string, unknown>
  >;

  return rows.map(rowToLibrary);
}

/**
 * FTS5 search with bm25 ranking
 */
export function searchDocs(options: DocsSearchOptions): DocSearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build WHERE conditions
  if (options.library) {
    // Try to find library by name
    const libRow = db
      .prepare('SELECT library_id FROM library_docs WHERE LOWER(library_name) = LOWER(?)')
      .get(options.library) as { library_id: string } | undefined;

    if (libRow) {
      conditions.push('s.library_id = ?');
      params.push(libRow.library_id);
    } else {
      // No matching library, return empty results
      return [];
    }
  }

  if (options.topic) {
    conditions.push('s.topic = ?');
    params.push(options.topic);
  }

  const limit = options.limit ?? 10;
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  // Escape FTS5 special characters and add prefix matching
  const ftsQuery = options.query
    .replace(/['"]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word) => `${word}*`)
    .join(' OR ');

  const sql = `
    SELECT s.*, l.library_name, bm25(docs_fts) as rank
    FROM docs_fts
    JOIN doc_sections s ON docs_fts.rowid = s.id
    JOIN library_docs l ON s.library_id = l.library_id
    WHERE docs_fts MATCH ?
    ${whereClause}
    ORDER BY rank
    LIMIT ?
  `;

  params.unshift(ftsQuery);
  params.push(limit);

  try {
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      section: rowToSection(row),
      libraryName: row.library_name as string,
      relevance: Math.abs(row.rank as number) / 100,
    }));
  } catch {
    // FTS query failed, fall back to LIKE search
    return searchDocsWithLike(options);
  }
}

/**
 * Fallback LIKE-based search when FTS fails
 */
function searchDocsWithLike(options: DocsSearchOptions): DocSearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.library) {
    const libRow = db
      .prepare('SELECT library_id FROM library_docs WHERE LOWER(library_name) = LOWER(?)')
      .get(options.library) as { library_id: string } | undefined;

    if (libRow) {
      conditions.push('s.library_id = ?');
      params.push(libRow.library_id);
    } else {
      return [];
    }
  }

  if (options.topic) {
    conditions.push('s.topic = ?');
    params.push(options.topic);
  }

  if (options.query) {
    conditions.push('(s.title LIKE ? OR s.content LIKE ?)');
    const likePattern = `%${options.query}%`;
    params.push(likePattern, likePattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 10;

  const sql = `
    SELECT s.*, l.library_name
    FROM doc_sections s
    JOIN library_docs l ON s.library_id = l.library_id
    ${whereClause}
    ORDER BY s.page_number ASC
    LIMIT ?
  `;

  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    section: rowToSection(row),
    libraryName: row.library_name as string,
    relevance: 0.5,
  }));
}

/**
 * Get sections for a library, optionally filtered by topic
 */
export function getSectionsByLibrary(libraryId: string, topic?: string): DocSection[] {
  const db = getDatabase();
  const params: unknown[] = [libraryId];
  let sql = 'SELECT * FROM doc_sections WHERE library_id = ?';

  if (topic) {
    sql += ' AND topic = ?';
    params.push(topic);
  }

  sql += ' ORDER BY page_number ASC';

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToSection);
}

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
