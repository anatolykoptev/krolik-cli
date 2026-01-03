/**
 * @module lib/@storage/progress/epics
 * @description CRUD operations for epics (task groups)
 */

import { getDatabase, prepareStatement } from '../database';
import type { Epic, EpicCreateOptions, EpicRow, EpicStatus, EpicUpdateOptions } from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert database row to Epic
 */
export function rowToEpic(row: EpicRow): Epic {
  return {
    id: row.id,
    name: row.name,
    project: row.project,
    description: row.description ?? undefined,
    progress: row.progress,
    status: row.status as EpicStatus,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new epic
 */
export function createEpic(options: EpicCreateOptions): number {
  const db = getDatabase();

  const sql = `
    INSERT INTO epics (name, project, description, status)
    VALUES (?, ?, ?, ?)
  `;

  const stmt = prepareStatement<[string, string, string | null, string]>(db, sql);

  const result = stmt.run(
    options.name,
    options.project,
    options.description ?? null,
    options.status ?? 'planning',
  );

  return Number(result.lastInsertRowid);
}

/**
 * Get or create epic by name
 */
export function getOrCreateEpic(project: string, name: string): Epic {
  const existing = getEpicByName(project, name);
  if (existing) {
    return existing;
  }

  const id = createEpic({ project, name });
  return getEpicById(id)!;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get epic by ID
 */
export function getEpicById(id: number): Epic | undefined {
  const db = getDatabase();

  const sql = 'SELECT * FROM epics WHERE id = ?';
  const stmt = prepareStatement<[number], EpicRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToEpic(row) : undefined;
}

/**
 * Get epic by name
 */
export function getEpicByName(project: string, name: string): Epic | undefined {
  const db = getDatabase();

  const sql = 'SELECT * FROM epics WHERE project = ? AND name = ?';
  const stmt = prepareStatement<[string, string], EpicRow>(db, sql);
  const row = stmt.get(project, name);

  return row ? rowToEpic(row) : undefined;
}

/**
 * Get all epics for a project
 */
export function getEpicsByProject(project: string, status?: EpicStatus): Epic[] {
  const db = getDatabase();

  let sql = 'SELECT * FROM epics WHERE project = ?';
  const params: string[] = [project];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY status, progress DESC';

  const stmt = prepareStatement<string[], EpicRow>(db, sql);
  const rows = stmt.all(...params);

  return rows.map(rowToEpic);
}

/**
 * Get active epics (in_progress)
 */
export function getActiveEpics(project: string): Epic[] {
  return getEpicsByProject(project, 'in_progress');
}

/**
 * Get epics summary for AI context
 */
export function getEpicsSummary(project: string): {
  total: number;
  active: number;
  completed: number;
  averageProgress: number;
  epics: Array<{ name: string; progress: number; status: EpicStatus }>;
} {
  const epics = getEpicsByProject(project);

  const active = epics.filter((e) => e.status === 'in_progress').length;
  const completed = epics.filter((e) => e.status === 'done').length;
  const totalProgress = epics.reduce((sum, e) => sum + e.progress, 0);
  const averageProgress = epics.length > 0 ? Math.round(totalProgress / epics.length) : 0;

  return {
    total: epics.length,
    active,
    completed,
    averageProgress,
    epics: epics.map((e) => ({
      name: e.name,
      progress: e.progress,
      status: e.status,
    })),
  };
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update an epic
 */
export function updateEpic(id: number, options: EpicUpdateOptions): boolean {
  const db = getDatabase();

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (options.name !== undefined) {
    updates.push('name = ?');
    params.push(options.name);
  }

  if (options.description !== undefined) {
    updates.push('description = ?');
    params.push(options.description ?? null);
  }

  if (options.status !== undefined) {
    updates.push('status = ?');
    params.push(options.status);

    // Track completion time
    if (options.status === 'done') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }
  }

  if (updates.length === 0) {
    return false;
  }

  params.push(id);

  const sql = `UPDATE epics SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = prepareStatement(db, sql);
  const result = stmt.run(...params);

  return result.changes > 0;
}

/**
 * Start an epic (set status to in_progress)
 */
export function startEpic(id: number): boolean {
  const db = getDatabase();

  const sql = `
    UPDATE epics
    SET status = 'in_progress', started_at = ?
    WHERE id = ? AND status = 'planning'
  `;

  const stmt = prepareStatement<[string, number]>(db, sql);
  const result = stmt.run(new Date().toISOString(), id);

  return result.changes > 0;
}

/**
 * Complete an epic
 */
export function completeEpic(id: number): boolean {
  return updateEpic(id, { status: 'done' });
}

/**
 * Put epic on hold
 */
export function holdEpic(id: number): boolean {
  return updateEpic(id, { status: 'on_hold' });
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete an epic (tasks remain, just unlinked)
 */
export function deleteEpic(id: number): boolean {
  const db = getDatabase();

  // First, unlink all tasks from this epic
  const epic = getEpicById(id);
  if (epic) {
    const unlinkSql = 'UPDATE tasks SET epic = NULL WHERE project = ? AND epic = ?';
    prepareStatement<[string, string]>(db, unlinkSql).run(epic.project, epic.name);
  }

  // Delete the epic
  const sql = 'DELETE FROM epics WHERE id = ?';
  const stmt = prepareStatement<[number]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Recalculate all epic stats for a project
 */
export function recalculateAllEpicStats(project: string): void {
  const db = getDatabase();

  const epicsSql = 'SELECT name FROM epics WHERE project = ?';
  const epicsStmt = prepareStatement<[string], { name: string }>(db, epicsSql);
  const epicNames = epicsStmt.all(project);

  for (const { name } of epicNames) {
    // Count tasks in epic
    const countSql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
      FROM tasks
      WHERE project = ? AND epic = ?
    `;
    const countStmt = prepareStatement<[string, string], { total: number; completed: number }>(
      db,
      countSql,
    );
    const counts = countStmt.get(project, name);

    if (!counts) continue;

    const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
    const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'planning';

    const updateSql = `
      UPDATE epics
      SET progress = ?, status = ?, total_tasks = ?, completed_tasks = ?,
          completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE completed_at END
      WHERE project = ? AND name = ?
    `;

    prepareStatement<[number, string, number, number, string, string, string]>(db, updateSql).run(
      progress,
      status,
      counts.total,
      counts.completed,
      status,
      project,
      name,
    );
  }
}
