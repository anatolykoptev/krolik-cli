/**
 * @module lib/@storage/felix/sessions
 * @description CRUD operations for Krolik Felix sessions
 *
 * All Felix data is stored at project level: {project}/.krolik/memory/krolik.db
 */

import { randomUUID } from 'node:crypto';
import { prepareStatement } from '../database';
import { getFelixDatabase } from './database';
import type {
  FelixSession,
  FelixSessionCreate,
  FelixSessionRow,
  FelixSessionStatus,
} from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

function rowToSession(row: FelixSessionRow): FelixSession {
  return {
    id: row.id,
    project: row.project,
    prdPath: row.prd_path,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    status: row.status as FelixSessionStatus,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    failedTasks: row.failed_tasks,
    skippedTasks: row.skipped_tasks,
    totalTokens: row.total_tokens,
    totalCostUsd: row.total_cost_usd,
    currentTaskId: row.current_task_id ?? undefined,
    config: JSON.parse(row.config || '{}') as Record<string, unknown>,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new Felix session
 * Stores in project-level database: {projectPath}/.krolik/memory/krolik.db
 */
export function createSession(options: FelixSessionCreate): string {
  const db = getFelixDatabase(options.projectPath);
  const id = randomUUID();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO felix_sessions (
      id, project, prd_path, started_at, status, total_tasks, config
    ) VALUES (?, ?, ?, ?, 'running', ?, ?)
  `;

  const stmt = prepareStatement<[string, string, string, string, number, string]>(db, sql);
  stmt.run(
    id,
    options.project,
    options.prdPath,
    now,
    options.totalTasks,
    JSON.stringify(options.config ?? {}),
  );

  return id;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get session by ID
 */
export function getSessionById(id: string, projectPath?: string): FelixSession | undefined {
  const db = getFelixDatabase(projectPath);

  const sql = 'SELECT * FROM felix_sessions WHERE id = ?';
  const stmt = prepareStatement<[string], FelixSessionRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToSession(row) : undefined;
}

/**
 * Get active session for a project
 */
export function getActiveSession(project: string, projectPath?: string): FelixSession | undefined {
  const db = getFelixDatabase(projectPath);

  const sql = `
    SELECT * FROM felix_sessions
    WHERE project = ? AND status IN ('running', 'paused')
    ORDER BY started_at DESC LIMIT 1
  `;
  const stmt = prepareStatement<[string], FelixSessionRow>(db, sql);
  const row = stmt.get(project);

  return row ? rowToSession(row) : undefined;
}

/**
 * Get sessions for a project
 */
export function getSessionsByProject(
  project: string,
  options?: { status?: FelixSessionStatus; limit?: number; projectPath?: string },
): FelixSession[] {
  const db = getFelixDatabase(options?.projectPath);

  let sql = 'SELECT * FROM felix_sessions WHERE project = ?';
  const params: (string | number)[] = [project];

  if (options?.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY started_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const stmt = prepareStatement<(string | number)[], FelixSessionRow>(db, sql);
  const rows = stmt.all(...params);

  return rows.map(rowToSession);
}

/**
 * Get latest session for a project
 */
export function getLatestSession(project: string, projectPath?: string): FelixSession | undefined {
  const options: { limit: number; projectPath?: string } = { limit: 1 };
  if (projectPath) {
    options.projectPath = projectPath;
  }
  const sessions = getSessionsByProject(project, options);
  return sessions[0];
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update session status
 */
export function updateSessionStatus(
  id: string,
  status: FelixSessionStatus,
  projectPath?: string,
): boolean {
  const db = getFelixDatabase(projectPath);
  const now = new Date().toISOString();

  let sql = 'UPDATE felix_sessions SET status = ?';
  const params: (string | null)[] = [status];

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    sql += ', ended_at = ?';
    params.push(now);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  const stmt = prepareStatement(db, sql);
  const result = stmt.run(...params);

  return result.changes > 0;
}

/**
 * Update current task
 */
export function updateCurrentTask(
  id: string,
  taskId: string | null,
  projectPath?: string,
): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = 'UPDATE felix_sessions SET current_task_id = ? WHERE id = ?';
  const stmt = prepareStatement<[string | null, string]>(db, sql);
  const result = stmt.run(taskId, id);

  return result.changes > 0;
}

/**
 * Increment completed tasks count
 */
export function incrementCompletedTasks(id: string, projectPath?: string): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = 'UPDATE felix_sessions SET completed_tasks = completed_tasks + 1 WHERE id = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Increment failed tasks count
 */
export function incrementFailedTasks(id: string, projectPath?: string): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = 'UPDATE felix_sessions SET failed_tasks = failed_tasks + 1 WHERE id = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Increment skipped tasks count
 */
export function incrementSkippedTasks(id: string, projectPath?: string): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = 'UPDATE felix_sessions SET skipped_tasks = skipped_tasks + 1 WHERE id = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Add tokens and cost to session
 */
export function addTokensAndCost(
  id: string,
  tokens: number,
  costUsd: number,
  projectPath?: string,
): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = `
    UPDATE felix_sessions
    SET total_tokens = total_tokens + ?, total_cost_usd = total_cost_usd + ?
    WHERE id = ?
  `;
  const stmt = prepareStatement<[number, number, string]>(db, sql);
  const result = stmt.run(tokens, costUsd, id);

  return result.changes > 0;
}

/**
 * Pause session
 */
export function pauseSession(id: string, projectPath?: string): boolean {
  return updateSessionStatus(id, 'paused', projectPath);
}

/**
 * Resume session
 */
export function resumeSession(id: string, projectPath?: string): boolean {
  return updateSessionStatus(id, 'running', projectPath);
}

/**
 * Complete session
 */
export function completeSession(id: string, projectPath?: string): boolean {
  return updateSessionStatus(id, 'completed', projectPath);
}

/**
 * Fail session
 */
export function failSession(id: string, projectPath?: string): boolean {
  return updateSessionStatus(id, 'failed', projectPath);
}

/**
 * Cancel session
 */
export function cancelSession(id: string, projectPath?: string): boolean {
  return updateSessionStatus(id, 'cancelled', projectPath);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a session
 */
export function deleteSession(id: string, projectPath?: string): boolean {
  const db = getFelixDatabase(projectPath);

  const sql = 'DELETE FROM felix_sessions WHERE id = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get session statistics for a project
 */
export function getSessionStats(
  project: string,
  projectPath?: string,
): {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  averageTasksPerSession: number;
} {
  const db = getFelixDatabase(projectPath);

  const sql = `
    SELECT
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sessions,
      SUM(total_tokens) as total_tokens,
      SUM(total_cost_usd) as total_cost,
      AVG(completed_tasks + failed_tasks + skipped_tasks) as avg_tasks
    FROM felix_sessions
    WHERE project = ?
  `;

  const stmt = prepareStatement<
    [string],
    {
      total_sessions: number;
      completed_sessions: number;
      failed_sessions: number;
      total_tokens: number;
      total_cost: number;
      avg_tasks: number;
    }
  >(db, sql);

  const row = stmt.get(project);

  return {
    totalSessions: row?.total_sessions ?? 0,
    completedSessions: row?.completed_sessions ?? 0,
    failedSessions: row?.failed_sessions ?? 0,
    totalTokensUsed: row?.total_tokens ?? 0,
    totalCostUsd: row?.total_cost ?? 0,
    averageTasksPerSession: row?.avg_tasks ?? 0,
  };
}
