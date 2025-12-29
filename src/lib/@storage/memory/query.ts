/**
 * @module lib/@storage/memory/query
 * @description Query operations (recent, getProjects)
 */

import { getDatabase } from '../database';
import { DEFAULT_SEARCH_LIMIT } from './constants';
import { rowToMemory } from './converters';
import type { Memory, MemoryType } from './types';

/**
 * Get recent memories
 * @param project - Optional project filter
 * @param limit - Maximum results to return
 * @param type - Optional memory type filter
 * @returns Array of Memory objects sorted by creation date (newest first)
 */
export function recent(
  project?: string,
  limit = DEFAULT_SEARCH_LIMIT,
  type?: MemoryType,
): Memory[] {
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
 * Get all unique projects
 * @returns Array of project names sorted alphabetically
 */
export function getProjects(): string[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT DISTINCT project FROM memories ORDER BY project').all() as Array<{
    project: string;
  }>;
  return rows.map((r) => r.project);
}
