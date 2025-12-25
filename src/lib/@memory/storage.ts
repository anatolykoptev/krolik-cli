/**
 * @module lib/@memory/storage
 * @description SQLite-based memory storage with FTS5 search
 */

import { getDatabase } from './database';
import type {
  Memory,
  MemoryContext,
  MemoryImportance,
  MemorySaveOptions,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryType,
} from './types';

/**
 * Convert database row to Memory object
 */
function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id),
    type: row.type as MemoryType,
    title: row.title as string,
    description: row.description as string,
    importance: row.importance as MemoryImportance,
    project: row.project as string,
    branch: row.branch as string | undefined,
    commit: row.commit_hash as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    files: JSON.parse((row.files as string) || '[]'),
    features: JSON.parse((row.features as string) || '[]'),
    createdAt: row.created_at as string,
    metadata: JSON.parse((row.metadata as string) || '{}'),
  };
}

/**
 * Save memory to database
 */
export function save(options: MemorySaveOptions, context: MemoryContext): Memory {
  const db = getDatabase();
  const now = new Date();

  const stmt = db.prepare(`
    INSERT INTO memories (
      type, title, description, importance, project, branch, commit_hash,
      tags, files, features, metadata, created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    options.type,
    options.title,
    options.description,
    options.importance ?? 'medium',
    context.project,
    context.branch ?? null,
    context.commit ?? null,
    JSON.stringify(options.tags ?? []),
    JSON.stringify(options.files ?? []),
    JSON.stringify(options.features ?? []),
    JSON.stringify(options.metadata ?? {}),
    now.toISOString(),
    now.getTime(),
  );

  return {
    id: String(result.lastInsertRowid),
    type: options.type,
    title: options.title,
    description: options.description,
    importance: options.importance ?? 'medium',
    project: context.project,
    branch: context.branch,
    commit: context.commit,
    tags: options.tags ?? [],
    files: options.files,
    features: options.features,
    createdAt: now.toISOString(),
    metadata: options.metadata,
  };
}

/**
 * Search memories with FTS5 and filters
 */
export function search(options: MemorySearchOptions): MemorySearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build WHERE conditions
  if (options.project) {
    conditions.push('m.project = ?');
    params.push(options.project);
  }

  if (options.type) {
    conditions.push('m.type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('m.importance = ?');
    params.push(options.importance);
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
    const featureConditions = options.features.map(() => 'json_each.value LIKE ?');
    conditions.push(`EXISTS (
      SELECT 1 FROM json_each(m.features)
      WHERE ${featureConditions.join(' OR ')}
    )`);
    // Use LIKE for partial matching
    params.push(...options.features.map((f) => `%${f}%`));
  }

  const limit = options.limit ?? 10;

  // If query provided, use FTS5 with ranking
  if (options.query?.trim()) {
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Escape FTS5 special characters and add prefix matching
    const ftsQuery = options.query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((word) => `${word}*`)
      .join(' OR ');

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
        relevance: Math.abs(row.rank as number) * 100,
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
 */
function searchWithLike(options: MemorySearchOptions): MemorySearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.project) {
    conditions.push('project = ?');
    params.push(options.project);
  }

  if (options.type) {
    conditions.push('type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('importance = ?');
    params.push(options.importance);
  }

  if (options.query) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    const likePattern = `%${options.query}%`;
    params.push(likePattern, likePattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 10;

  const sql = `
    SELECT *
    FROM memories
    ${whereClause}
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `;

  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    relevance: 50, // Default relevance for LIKE matches
  }));
}

/**
 * Get recent memories
 */
export function recent(project?: string, limit = 10, type?: MemoryType): Memory[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (project) {
    conditions.push('project = ?');
    params.push(project);
  }

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT *
    FROM memories
    ${whereClause}
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `;

  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map(rowToMemory);
}

/**
 * Get memory stats
 */
export function stats(project?: string): {
  total: number;
  byType: Record<MemoryType, number>;
  byImportance: Record<MemoryImportance, number>;
  byProject: Record<string, number>;
} {
  const db = getDatabase();

  // Total count
  let totalSql = 'SELECT COUNT(*) as count FROM memories';
  const totalParams: unknown[] = [];
  if (project) {
    totalSql += ' WHERE project = ?';
    totalParams.push(project);
  }
  const totalRow = db.prepare(totalSql).get(...totalParams) as { count: number };

  // By type
  let typeSql = 'SELECT type, COUNT(*) as count FROM memories';
  const typeParams: unknown[] = [];
  if (project) {
    typeSql += ' WHERE project = ?';
    typeParams.push(project);
  }
  typeSql += ' GROUP BY type';
  const typeRows = db.prepare(typeSql).all(...typeParams) as Array<{ type: string; count: number }>;

  const byType: Record<MemoryType, number> = {
    observation: 0,
    decision: 0,
    pattern: 0,
    bugfix: 0,
    feature: 0,
  };
  for (const row of typeRows) {
    byType[row.type as MemoryType] = row.count;
  }

  // By importance
  let importanceSql = 'SELECT importance, COUNT(*) as count FROM memories';
  const importanceParams: unknown[] = [];
  if (project) {
    importanceSql += ' WHERE project = ?';
    importanceParams.push(project);
  }
  importanceSql += ' GROUP BY importance';
  const importanceRows = db.prepare(importanceSql).all(...importanceParams) as Array<{
    importance: string;
    count: number;
  }>;

  const byImportance: Record<MemoryImportance, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const row of importanceRows) {
    byImportance[row.importance as MemoryImportance] = row.count;
  }

  // By project
  const projectSql = 'SELECT project, COUNT(*) as count FROM memories GROUP BY project';
  const projectRows = db.prepare(projectSql).all() as Array<{ project: string; count: number }>;

  const byProject: Record<string, number> = {};
  for (const row of projectRows) {
    byProject[row.project] = row.count;
  }

  return {
    total: totalRow.count,
    byType,
    byImportance,
    byProject,
  };
}

/**
 * Get memory by ID
 */
export function getById(id: string): Memory | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(Number(id)) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;
  return rowToMemory(row);
}

/**
 * Delete memory by ID
 */
export function remove(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

/**
 * Update memory
 */
export function update(
  id: string,
  updates: Partial<Omit<Memory, 'id' | 'createdAt'>>,
): Memory | null {
  const db = getDatabase();
  const existing = getById(id);

  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }
  if (updates.importance !== undefined) {
    fields.push('importance = ?');
    params.push(updates.importance);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    params.push(updates.type);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.files !== undefined) {
    fields.push('files = ?');
    params.push(JSON.stringify(updates.files));
  }
  if (updates.features !== undefined) {
    fields.push('features = ?');
    params.push(JSON.stringify(updates.features));
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    params.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) return existing;

  params.push(Number(id));
  db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getById(id);
}

/**
 * Get all unique projects
 */
export function getProjects(): string[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT DISTINCT project FROM memories ORDER BY project').all() as Array<{
    project: string;
  }>;
  return rows.map((r) => r.project);
}

/**
 * Semantic search by features (for context injection)
 */
export function searchByFeatures(
  project: string,
  features: string[],
  limit = 10,
): MemorySearchResult[] {
  const db = getDatabase();

  if (features.length === 0) {
    // Return recent high-importance memories
    const rows = db
      .prepare(
        `
      SELECT *, 0 as relevance
      FROM memories
      WHERE project = ? AND importance IN ('high', 'critical')
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `,
      )
      .all(project, limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      memory: rowToMemory(row),
      relevance: 50,
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
        relevance: Math.abs(row.rank as number) * 100,
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
    relevance: 30,
  }));
}
