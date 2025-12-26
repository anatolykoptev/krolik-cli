/**
 * @module lib/@docs-cache/storage/search
 * @description FTS5 full-text search with fallback
 */

import { getDatabase, prepareStatement } from '../../@memory/database';
import type { DocSearchResult, DocsSearchOptions } from '../types';
import { rowToSection } from './converters';

/** Default relevance score for LIKE fallback */
const LIKE_FALLBACK_RELEVANCE = 0.5;

/** Relevance normalization divisor */
const RELEVANCE_DIVISOR = 100;

/** Cached SQL for library lookup - used frequently */
const LIBRARY_LOOKUP_SQL =
  'SELECT library_id FROM library_docs WHERE LOWER(library_name) = LOWER(?)';

/**
 * FTS5 search with bm25 ranking
 */
export function searchDocs(options: DocsSearchOptions): DocSearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build WHERE conditions
  if (options.library) {
    // Try to find library by name (using cached statement)
    const stmt = prepareStatement<[string], { library_id: string }>(db, LIBRARY_LOOKUP_SQL);
    const libRow = stmt.get(options.library);

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
      relevance: Math.abs(row.rank as number) / RELEVANCE_DIVISOR,
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
    // Use cached statement for library lookup
    const stmt = prepareStatement<[string], { library_id: string }>(db, LIBRARY_LOOKUP_SQL);
    const libRow = stmt.get(options.library);

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
    relevance: LIKE_FALLBACK_RELEVANCE,
  }));
}
