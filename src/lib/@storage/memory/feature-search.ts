/**
 * @module lib/@storage/memory/feature-search
 * @description Semantic search by features (for context injection)
 */

import { getDatabase } from '../database';
import {
  BM25_RELEVANCE_MULTIPLIER,
  DEFAULT_SEARCH_LIMIT,
  FEATURE_FALLBACK_RELEVANCE,
  HIGH_IMPORTANCE_LEVELS,
  LIKE_MATCH_RELEVANCE,
} from './constants';
import { rowToMemory } from './converters';
import type { MemorySearchResult } from './types';

/**
 * Semantic search by features (for context injection)
 * @param project - Project name to search in
 * @param features - Feature keywords to match
 * @param limit - Maximum results to return
 * @returns Array of search results with relevance scores
 */
export function searchByFeatures(
  project: string,
  features: string[],
  limit = DEFAULT_SEARCH_LIMIT,
): MemorySearchResult[] {
  const db = getDatabase();

  if (features.length === 0) {
    // Return recent high-importance memories
    const importancePlaceholders = HIGH_IMPORTANCE_LEVELS.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `
      SELECT *, 0 as relevance
      FROM memories
      WHERE project = ? AND importance IN (${importancePlaceholders})
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `,
      )
      .all(project, ...HIGH_IMPORTANCE_LEVELS, limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      memory: rowToMemory(row),
      relevance: LIKE_MATCH_RELEVANCE,
    }));
  }

  // Build FTS query from features
  const ftsQuery = features
    .map((f) => f.toLowerCase().replace(/['"]/g, ''))
    .map((f) => `${f}*`)
    .join(' OR ');

  try {
    const rows = db
      .prepare(
        `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts
      JOIN memories m ON memories_fts.rowid = m.id
      WHERE memories_fts MATCH ?
        AND m.project = ?
      ORDER BY rank
      LIMIT ?
    `,
      )
      .all(ftsQuery, project, limit) as Array<Record<string, unknown>>;

    if (rows.length > 0) {
      return rows.map((row) => ({
        memory: rowToMemory(row),
        relevance: Math.abs(row.rank as number) * BM25_RELEVANCE_MULTIPLIER,
      }));
    }
  } catch {
    // FTS failed, continue to fallback
  }

  // Fallback: search in features JSON array
  const placeholders = features.map(() => 'json_each.value LIKE ?').join(' OR ');
  const likePatterns = features.map((f) => `%${f.toLowerCase()}%`);

  const rows = db
    .prepare(
      `
    SELECT DISTINCT m.*
    FROM memories m, json_each(m.features)
    WHERE m.project = ? AND (${placeholders})
    ORDER BY m.created_at_epoch DESC
    LIMIT ?
  `,
    )
    .all(project, ...likePatterns, limit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    relevance: FEATURE_FALLBACK_RELEVANCE,
  }));
}
