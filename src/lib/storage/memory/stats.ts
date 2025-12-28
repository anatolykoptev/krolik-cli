/**
 * @module lib/storage/memory/stats
 * @description Memory statistics operations
 */

import { getDatabase } from '../database';
import type { MemoryImportance, MemoryType } from './types';

/**
 * Memory statistics result
 */
export interface MemoryStats {
  /** Total number of memories */
  total: number;
  /** Count by memory type */
  byType: Record<MemoryType, number>;
  /** Count by importance level */
  byImportance: Record<MemoryImportance, number>;
  /** Count by project name */
  byProject: Record<string, number>;
}

/**
 * Get memory stats
 * @param project - Optional project filter
 * @returns Statistics object with counts by type, importance, and project
 */
export function stats(project?: string): MemoryStats {
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
