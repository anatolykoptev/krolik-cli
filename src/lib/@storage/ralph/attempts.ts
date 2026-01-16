/**
 * @module lib/@storage/ralph/attempts
 * @description CRUD operations for Ralph Loop attempts
 *
 * All Ralph data is stored at project level: {project}/.krolik/memory/krolik.db
 */

import { prepareStatement } from '../database';
import { getRalphDatabase } from './database';
import type {
  RalphAttempt,
  RalphAttemptComplete,
  RalphAttemptCreate,
  RalphAttemptRow,
} from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

function rowToAttempt(row: RalphAttemptRow): RalphAttempt {
  return {
    id: row.id,
    taskId: row.task_id,
    prdTaskId: row.prd_task_id,
    attemptNumber: row.attempt_number,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    success: row.success === 1,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: row.cost_usd,
    model: row.model ?? undefined,
    errorMessage: row.error_message ?? undefined,
    errorStack: row.error_stack ?? undefined,
    filesModified: JSON.parse(row.files_modified || '[]') as string[],
    commandsExecuted: JSON.parse(row.commands_executed || '[]') as string[],
    commitSha: row.commit_sha ?? undefined,
    validationPassed: row.validation_passed === 1,
    validationOutput: row.validation_output ?? undefined,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new attempt (start of execution)
 */
export function createAttempt(options: RalphAttemptCreate & { projectPath?: string }): number {
  const db = getRalphDatabase(options.projectPath);
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO ralph_attempts (
      task_id, prd_task_id, attempt_number, started_at, model
    ) VALUES (?, ?, ?, ?, ?)
  `;

  const stmt = prepareStatement<[number, string, number, string, string | null]>(db, sql);
  const result = stmt.run(
    options.taskId,
    options.prdTaskId,
    options.attemptNumber,
    now,
    options.model ?? null,
  );

  return Number(result.lastInsertRowid);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get attempt by ID
 */
export function getAttemptById(id: number): RalphAttempt | undefined {
  const db = getRalphDatabase();

  const sql = 'SELECT * FROM ralph_attempts WHERE id = ?';
  const stmt = prepareStatement<[number], RalphAttemptRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToAttempt(row) : undefined;
}

/**
 * Get attempts for a task
 */
export function getAttemptsByTaskId(taskId: number): RalphAttempt[] {
  const db = getRalphDatabase();

  const sql = 'SELECT * FROM ralph_attempts WHERE task_id = ? ORDER BY attempt_number ASC';
  const stmt = prepareStatement<[number], RalphAttemptRow>(db, sql);
  const rows = stmt.all(taskId);

  return rows.map(rowToAttempt);
}

/**
 * Get attempts for a PRD task
 */
export function getAttemptsByPrdTaskId(prdTaskId: string): RalphAttempt[] {
  const db = getRalphDatabase();

  const sql = 'SELECT * FROM ralph_attempts WHERE prd_task_id = ? ORDER BY attempt_number ASC';
  const stmt = prepareStatement<[string], RalphAttemptRow>(db, sql);
  const rows = stmt.all(prdTaskId);

  return rows.map(rowToAttempt);
}

/**
 * Get latest attempt for a task
 */
export function getLatestAttempt(taskId: number): RalphAttempt | undefined {
  const db = getRalphDatabase();

  const sql = `
    SELECT * FROM ralph_attempts 
    WHERE task_id = ? 
    ORDER BY attempt_number DESC 
    LIMIT 1
  `;
  const stmt = prepareStatement<[number], RalphAttemptRow>(db, sql);
  const row = stmt.get(taskId);

  return row ? rowToAttempt(row) : undefined;
}

/**
 * Get attempt count for a task
 */
export function getAttemptCount(taskId: number): number {
  const db = getRalphDatabase();

  const sql = 'SELECT COUNT(*) as count FROM ralph_attempts WHERE task_id = ?';
  const stmt = prepareStatement<[number], { count: number }>(db, sql);
  const row = stmt.get(taskId);

  return row?.count ?? 0;
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Complete an attempt (end of execution)
 */
export function completeAttempt(
  id: number,
  result: RalphAttemptComplete & { projectPath?: string },
): boolean {
  const db = getRalphDatabase(result.projectPath);
  const now = new Date().toISOString();

  const sql = `
    UPDATE ralph_attempts SET
      ended_at = ?,
      success = ?,
      input_tokens = ?,
      output_tokens = ?,
      cost_usd = ?,
      error_message = ?,
      error_stack = ?,
      files_modified = ?,
      commands_executed = ?,
      commit_sha = ?,
      validation_passed = ?,
      validation_output = ?
    WHERE id = ?
  `;

  const stmt = prepareStatement<
    [
      string,
      number,
      number,
      number,
      number,
      string | null,
      string | null,
      string,
      string,
      string | null,
      number,
      string | null,
      number,
    ]
  >(db, sql);

  const updateResult = stmt.run(
    now,
    result.success ? 1 : 0,
    result.inputTokens ?? 0,
    result.outputTokens ?? 0,
    result.costUsd ?? 0,
    result.errorMessage ?? null,
    result.errorStack ?? null,
    JSON.stringify(result.filesModified ?? []),
    JSON.stringify(result.commandsExecuted ?? []),
    result.commitSha ?? null,
    result.validationPassed ? 1 : 0,
    result.validationOutput ?? null,
    id,
  );

  return updateResult.changes > 0;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get attempt statistics for a project
 *
 * Note: Uses project-level database, so all attempts are for this project
 */
export function getAttemptStats(
  _project: string,
  projectPath?: string,
): {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalTokens: number;
  totalCost: number;
  averageAttempts: number;
} {
  const db = getRalphDatabase(projectPath);

  // Count all attempts in project-level database
  const sql = `
    SELECT
      COUNT(*) as total_attempts,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_attempts,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_attempts,
      SUM(input_tokens + output_tokens) as total_tokens,
      SUM(cost_usd) as total_cost
    FROM ralph_attempts
  `;

  const stmt = prepareStatement<
    [],
    {
      total_attempts: number;
      successful_attempts: number;
      failed_attempts: number;
      total_tokens: number;
      total_cost: number;
    }
  >(db, sql);

  const row = stmt.get();

  // Calculate average attempts per PRD task
  const avgSql = `
    SELECT AVG(attempt_count) as avg_attempts FROM (
      SELECT COUNT(*) as attempt_count
      FROM ralph_attempts
      GROUP BY prd_task_id
    )
  `;
  const avgStmt = prepareStatement<[], { avg_attempts: number | null }>(db, avgSql);
  const avgRow = avgStmt.get();

  return {
    totalAttempts: row?.total_attempts ?? 0,
    successfulAttempts: row?.successful_attempts ?? 0,
    failedAttempts: row?.failed_attempts ?? 0,
    totalTokens: row?.total_tokens ?? 0,
    totalCost: row?.total_cost ?? 0,
    averageAttempts: avgRow?.avg_attempts ?? 0,
  };
}
