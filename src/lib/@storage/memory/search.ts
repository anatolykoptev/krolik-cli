/**
 * @module lib/@storage/memory/search
 * @description Full-text search operations (FTS5 and LIKE fallback)
 *
 * Supports hybrid memory architecture:
 * - Project-scoped search with optional global inclusion
 * - Global-only search
 * - Scope filtering
 */

import { getDatabase } from '../database';
import { BM25_RELEVANCE_MULTIPLIER, DEFAULT_SEARCH_LIMIT, LIKE_MATCH_RELEVANCE } from './constants';
import { rowToMemory } from './converters';
import { buildFtsQuery, buildLikePattern } from './sanitize';
import type { MemorySearchOptions, MemorySearchResult } from './types';

/**
 * Search memories with FTS5 and filters
 * Supports hybrid search: project + global memories
 *
 * @param options - Search options including query, filters, and limit
 * @returns Array of search results with relevance scores
 */
export function search(options: MemorySearchOptions): MemorySearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build scope/project conditions for hybrid search
  if (options.scope) {
    // Explicit scope filter
    conditions.push('m.scope = ?');
    params.push(options.scope);
    if (options.scope === 'project' && options.project) {
      conditions.push('m.project = ?');
      params.push(options.project);
    }
  } else if (options.project) {
    // Default hybrid behavior: include project + global
    const includeGlobal = options.includeGlobal !== false; // Default true
    if (includeGlobal) {
      conditions.push("(m.project = ? OR m.scope = 'global')");
      params.push(options.project);
    } else {
      conditions.push('m.project = ?');
      params.push(options.project);
    }
  }

  if (options.type) {
    conditions.push('m.type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('m.importance = ?');
    params.push(options.importance);
  }

  // Source filter
  if (options.source) {
    conditions.push('m.source = ?');
    params.push(options.source);
  }

  // Tag filter (check if any tag matches)
  if (options.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map(() => 'json_each.value = ?');
    conditions.push(`EXISTS (
      SELECT 1 FROM json_each(m.tags)
      WHERE ${tagConditions.join(' OR ')}
    )`);
    params.push(...options.tags);
  }

  // Feature filter (check if any feature matches)
  if (options.features && options.features.length > 0) {
    const featureConditions = options.features.map(() => "json_each.value LIKE ? ESCAPE '\\'");
    conditions.push(`EXISTS (
      SELECT 1 FROM json_each(m.features)
      WHERE ${featureConditions.join(' OR ')}
    )`);
    // Security: Escape LIKE special characters to prevent pattern injection
    params.push(...options.features.map((f) => buildLikePattern(f, 'contains')));
  }

  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;

  // If query provided, use FTS5 with ranking
  if (options.query?.trim()) {
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Security: Sanitize FTS5 query and add prefix matching
    const ftsQuery = buildFtsQuery(options.query);

    const sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts
      JOIN memories m ON memories_fts.rowid = m.id
      WHERE memories_fts MATCH ?
      ${whereClause}
      ORDER BY rank
      LIMIT ?
    `;

    params.unshift(ftsQuery);
    params.push(limit);

    try {
      const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

      return rows.map((row) => ({
        memory: rowToMemory(row),
        relevance: Math.abs(row.rank as number) * BM25_RELEVANCE_MULTIPLIER,
      }));
    } catch {
      // FTS query failed, fall back to LIKE search
      return searchWithLike(options);
    }
  }

  // No query - just filter and sort by date
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT *
    FROM memories m
    ${whereClause}
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `;

  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    relevance: 0,
  }));
}

/**
 * Fallback LIKE-based search when FTS fails
 * Supports hybrid search: project + global memories
 *
 * @param options - Search options
 * @returns Array of search results with default relevance
 */
export function searchWithLike(options: MemorySearchOptions): MemorySearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build scope/project conditions for hybrid search
  if (options.scope) {
    conditions.push('scope = ?');
    params.push(options.scope);
    if (options.scope === 'project' && options.project) {
      conditions.push('project = ?');
      params.push(options.project);
    }
  } else if (options.project) {
    const includeGlobal = options.includeGlobal !== false;
    if (includeGlobal) {
      conditions.push("(project = ? OR scope = 'global')");
      params.push(options.project);
    } else {
      conditions.push('project = ?');
      params.push(options.project);
    }
  }

  if (options.type) {
    conditions.push('type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('importance = ?');
    params.push(options.importance);
  }

  if (options.source) {
    conditions.push('source = ?');
    params.push(options.source);
  }

  if (options.query) {
    conditions.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
    // Security: Escape LIKE special characters to prevent pattern injection
    const likePattern = buildLikePattern(options.query, 'contains');
    params.push(likePattern, likePattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;

  const sql = `
    SELECT *
    FROM memories
    ${whereClause}
    ORDER BY usage_count DESC, created_at_epoch DESC
    LIMIT ?
  `;

  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    relevance: LIKE_MATCH_RELEVANCE,
  }));
}
