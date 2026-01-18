/**
 * @module lib/@storage/ralph/guardrails
 * @description CRUD operations for Ralph Loop guardrails
 *
 * All Ralph data is stored at project level: {project}/.krolik/memory/krolik.db
 */

import { prepareStatement } from '../database';
import type { MemoryType } from '../memory/types';
import { getRalphDatabase } from './database';
import type {
  GuardrailCategory,
  GuardrailSeverity,
  RalphGuardrail,
  RalphGuardrailCreate,
  RalphGuardrailRow,
} from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

function rowToGuardrail(row: RalphGuardrailRow): RalphGuardrail {
  return {
    id: row.id,
    project: row.project,
    type: (row.type as MemoryType) || 'pattern', // Default to pattern/guardrail if missing
    category: row.category as GuardrailCategory,
    severity: row.severity as GuardrailSeverity,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    example: row.example ?? undefined,
    tags: JSON.parse(row.tags || '[]') as string[],
    relatedTasks: JSON.parse(row.related_tasks || '[]') as string[],
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at ?? undefined,
    supersededBy: row.superseded_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new guardrail
 */
export function createGuardrail(options: RalphGuardrailCreate): number {
  const db = getRalphDatabase();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO ralph_guardrails (
      project, type, category, severity, title, problem, solution,
      example, tags, related_tasks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const stmt = prepareStatement<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string | null,
      string,
      string,
      string,
      string,
    ]
  >(db, sql);

  const result = stmt.run(
    options.project,
    options.type || 'guardrail', // Default type
    options.category,
    options.severity,
    options.title,
    options.problem,
    options.solution,
    options.example ?? null,
    JSON.stringify(options.tags ?? []),
    JSON.stringify(options.relatedTasks ?? []),
    now,
    now,
  );

  return Number(result.lastInsertRowid);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get guardrail by ID
 */
export function getGuardrailById(id: number): RalphGuardrail | undefined {
  const db = getRalphDatabase();

  const sql = 'SELECT * FROM ralph_guardrails WHERE id = ?';
  const stmt = prepareStatement<[number], RalphGuardrailRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToGuardrail(row) : undefined;
}

/**
 * Get guardrails for a project
 */
export function getGuardrailsByProject(
  project: string,
  options?: {
    category?: GuardrailCategory;
    severity?: GuardrailSeverity;
    includeSuperseded?: boolean;
  },
): RalphGuardrail[] {
  const db = getRalphDatabase();

  let sql = 'SELECT * FROM ralph_guardrails WHERE project = ?';
  const params: (string | number)[] = [project];

  if (!options?.includeSuperseded) {
    sql += ' AND superseded_by IS NULL';
  }

  if (options?.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }

  if (options?.severity) {
    sql += ' AND severity = ?';
    params.push(options.severity);
  }

  sql += ' ORDER BY usage_count DESC, created_at DESC';

  const stmt = prepareStatement<(string | number)[], RalphGuardrailRow>(db, sql);
  const rows = stmt.all(...params);

  return rows.map(rowToGuardrail);
}

/**
 * Search guardrails using FTS5
 */
export function searchGuardrails(project: string, query: string, limit = 10): RalphGuardrail[] {
  const db = getRalphDatabase();

  const sql = `
    SELECT g.* FROM ralph_guardrails g
    JOIN ralph_guardrails_fts fts ON g.id = fts.rowid
    WHERE g.project = ? AND ralph_guardrails_fts MATCH ?
    AND g.superseded_by IS NULL
    ORDER BY bm25(ralph_guardrails_fts) 
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, string, number], RalphGuardrailRow>(db, sql);
  const rows = stmt.all(project, query, limit);

  return rows.map(rowToGuardrail);
}

/**
 * Get relevant guardrails for a task
 */
export function getRelevantGuardrails(
  project: string,
  tags: string[],
  limit = 5,
): RalphGuardrail[] {
  if (tags.length === 0) {
    return getGuardrailsByProject(project).slice(0, limit);
  }

  const db = getRalphDatabase();

  // Search by tags using FTS
  const tagQuery = tags.join(' OR ');
  const sql = `
    SELECT g.* FROM ralph_guardrails g
    JOIN ralph_guardrails_fts fts ON g.id = fts.rowid
    WHERE g.project = ? AND ralph_guardrails_fts MATCH ?
    AND g.superseded_by IS NULL
    ORDER BY bm25(ralph_guardrails_fts), g.usage_count DESC
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, string, number], RalphGuardrailRow>(db, sql);
  const rows = stmt.all(project, tagQuery, limit);

  return rows.map(rowToGuardrail);
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Record guardrail usage
 */
export function recordGuardrailUsage(id: number): boolean {
  const db = getRalphDatabase();
  const now = new Date().toISOString();

  const sql = `
    UPDATE ralph_guardrails 
    SET usage_count = usage_count + 1, last_used_at = ?, updated_at = ?
    WHERE id = ?
  `;

  const stmt = prepareStatement<[string, string, number]>(db, sql);
  const result = stmt.run(now, now, id);

  return result.changes > 0;
}

/**
 * Supersede a guardrail with a new one
 */
export function supersedeGuardrail(oldId: number, newId: number): boolean {
  const db = getRalphDatabase();
  const now = new Date().toISOString();

  const sql = `
    UPDATE ralph_guardrails 
    SET superseded_by = ?, updated_at = ?
    WHERE id = ?
  `;

  const stmt = prepareStatement<[number, string, number]>(db, sql);
  const result = stmt.run(newId, now, oldId);

  return result.changes > 0;
}

/**
 * Add related task to guardrail
 */
export function addRelatedTask(guardrailId: number, taskId: string): boolean {
  const guardrail = getGuardrailById(guardrailId);
  if (!guardrail) return false;

  const relatedTasks = [...guardrail.relatedTasks, taskId];
  const db = getRalphDatabase();
  const now = new Date().toISOString();

  const sql = 'UPDATE ralph_guardrails SET related_tasks = ?, updated_at = ? WHERE id = ?';
  const stmt = prepareStatement<[string, string, number]>(db, sql);
  const result = stmt.run(JSON.stringify(relatedTasks), now, guardrailId);

  return result.changes > 0;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a guardrail
 */
export function deleteGuardrail(id: number): boolean {
  const db = getRalphDatabase();

  const sql = 'DELETE FROM ralph_guardrails WHERE id = ?';
  const stmt = prepareStatement<[number]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get guardrail statistics for a project
 */
export function getGuardrailStats(
  project: string,
  projectPath?: string,
): {
  total: number;
  byCategory: Record<GuardrailCategory, number>;
  bySeverity: Record<GuardrailSeverity, number>;
  mostUsed: RalphGuardrail[];
} {
  const db = getRalphDatabase(projectPath);

  const totalSql = `
    SELECT COUNT(*) as count FROM ralph_guardrails
    WHERE project = ? AND superseded_by IS NULL
  `;
  const totalStmt = prepareStatement<[string], { count: number }>(db, totalSql);
  const total = totalStmt.get(project)?.count ?? 0;

  const categorySql = `
    SELECT category, COUNT(*) as count FROM ralph_guardrails
    WHERE project = ? AND superseded_by IS NULL
    GROUP BY category
  `;
  const categoryStmt = prepareStatement<[string], { category: string; count: number }>(
    db,
    categorySql,
  );
  const categoryRows = categoryStmt.all(project);

  const severitySql = `
    SELECT severity, COUNT(*) as count FROM ralph_guardrails
    WHERE project = ? AND superseded_by IS NULL
    GROUP BY severity
  `;
  const severityStmt = prepareStatement<[string], { severity: string; count: number }>(
    db,
    severitySql,
  );
  const severityRows = severityStmt.all(project);

  const mostUsedSql = `
    SELECT * FROM ralph_guardrails
    WHERE project = ? AND superseded_by IS NULL
    ORDER BY usage_count DESC LIMIT 5
  `;
  const mostUsedStmt = prepareStatement<[string], RalphGuardrailRow>(db, mostUsedSql);
  const mostUsedRows = mostUsedStmt.all(project);

  const byCategory = {} as Record<GuardrailCategory, number>;
  for (const row of categoryRows) {
    byCategory[row.category as GuardrailCategory] = row.count;
  }

  const bySeverity = {} as Record<GuardrailSeverity, number>;
  for (const row of severityRows) {
    bySeverity[row.severity as GuardrailSeverity] = row.count;
  }

  return {
    total,
    byCategory,
    bySeverity,
    mostUsed: mostUsedRows.map(rowToGuardrail),
  };
}
