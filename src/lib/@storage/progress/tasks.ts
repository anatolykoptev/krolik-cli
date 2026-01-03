/**
 * @module lib/@storage/progress/tasks
 * @description CRUD operations for tasks
 */

import { getDatabase, prepareStatement } from '../database';
import type {
  Task,
  TaskCreateOptions,
  TaskPriority,
  TaskRow,
  TaskSource,
  TaskStatus,
  TaskUpdateOptions,
} from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert database row to Task
 */
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    source: row.source as TaskSource,
    externalId: row.external_id ?? undefined,
    project: row.project,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskStatus,
    epic: row.epic ?? undefined,
    priority: row.priority as TaskPriority,
    blockedBy: row.blocked_by ?? undefined,
    labels: JSON.parse(row.labels || '[]') as string[],
    assignedSession: row.assigned_session ?? undefined,
    linkedMemories: JSON.parse(row.linked_memories || '[]') as number[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new task
 */
export function createTask(options: TaskCreateOptions): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO tasks (
      source, external_id, project, title, description,
      status, epic, priority, labels, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const stmt = prepareStatement<
    [
      string,
      string | null,
      string,
      string,
      string | null,
      string,
      string | null,
      string,
      string,
      string,
      string,
    ]
  >(db, sql);

  const result = stmt.run(
    options.source,
    options.externalId ?? null,
    options.project,
    options.title,
    options.description ?? null,
    options.status ?? 'backlog',
    options.epic ?? null,
    options.priority ?? 'medium',
    JSON.stringify(options.labels ?? []),
    now,
    now,
  );

  // Update epic stats if task belongs to an epic
  if (options.epic) {
    updateEpicStats(options.project, options.epic);
  }

  return Number(result.lastInsertRowid);
}

/**
 * Create or update task from external source (upsert)
 */
export function upsertTask(options: TaskCreateOptions): number {
  const db = getDatabase();

  // Check if task exists
  if (options.externalId) {
    const existingSql = `
      SELECT id FROM tasks
      WHERE project = ? AND source = ? AND external_id = ?
    `;
    const existingStmt = prepareStatement<[string, string, string], { id: number }>(
      db,
      existingSql,
    );
    const existing = existingStmt.get(options.project, options.source, options.externalId);

    if (existing) {
      // Update existing
      updateTask(existing.id, {
        title: options.title,
        description: options.description,
        status: options.status,
        epic: options.epic,
        priority: options.priority,
        labels: options.labels,
      });
      return existing.id;
    }
  }

  // Create new
  return createTask(options);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get task by ID
 */
export function getTaskById(id: number): Task | undefined {
  const db = getDatabase();

  const sql = 'SELECT * FROM tasks WHERE id = ?';
  const stmt = prepareStatement<[number], TaskRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToTask(row) : undefined;
}

/**
 * Get task by external ID
 */
export function getTaskByExternalId(
  project: string,
  source: TaskSource,
  externalId: string,
): Task | undefined {
  const db = getDatabase();

  const sql = 'SELECT * FROM tasks WHERE project = ? AND source = ? AND external_id = ?';
  const stmt = prepareStatement<[string, string, string], TaskRow>(db, sql);
  const row = stmt.get(project, source, externalId);

  return row ? rowToTask(row) : undefined;
}

/**
 * Get tasks by project
 */
export function getTasksByProject(project: string, status?: TaskStatus): Task[] {
  const db = getDatabase();

  let sql = 'SELECT * FROM tasks WHERE project = ?';
  const params: (string | undefined)[] = [project];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY priority DESC, created_at DESC';

  const stmt = prepareStatement<string[], TaskRow>(db, sql);
  const rows = stmt.all(...params.filter((p): p is string => p !== undefined));

  return rows.map(rowToTask);
}

/**
 * Get tasks by epic
 */
export function getTasksByEpic(project: string, epic: string): Task[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM tasks
    WHERE project = ? AND epic = ?
    ORDER BY status, priority DESC, created_at DESC
  `;

  const stmt = prepareStatement<[string, string], TaskRow>(db, sql);
  const rows = stmt.all(project, epic);

  return rows.map(rowToTask);
}

/**
 * Get in-progress tasks
 */
export function getInProgressTasks(project: string): Task[] {
  return getTasksByProject(project, 'in_progress');
}

/**
 * Get blocked tasks
 */
export function getBlockedTasks(project: string): Task[] {
  return getTasksByProject(project, 'blocked');
}

/**
 * Get suggested next tasks (backlog, ordered by priority)
 */
export function getSuggestedTasks(project: string, limit = 5): Task[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM tasks
    WHERE project = ? AND status = 'backlog'
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at ASC
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, number], TaskRow>(db, sql);
  const rows = stmt.all(project, limit);

  return rows.map(rowToTask);
}

/**
 * Get recently completed tasks
 */
export function getRecentlyCompletedTasks(project: string, hours = 24): Task[] {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const sql = `
    SELECT * FROM tasks
    WHERE project = ? AND status = 'done' AND completed_at > ?
    ORDER BY completed_at DESC
  `;

  const stmt = prepareStatement<[string, string], TaskRow>(db, sql);
  const rows = stmt.all(project, cutoff);

  return rows.map(rowToTask);
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update a task
 */
export function updateTask(id: number, options: TaskUpdateOptions): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Get current task for epic tracking
  const current = getTaskById(id);
  if (!current) return false;

  const updates: string[] = ['updated_at = ?'];
  const params: (string | null)[] = [now];

  if (options.title !== undefined) {
    updates.push('title = ?');
    params.push(options.title);
  }

  if (options.description !== undefined) {
    updates.push('description = ?');
    params.push(options.description ?? null);
  }

  if (options.status !== undefined) {
    updates.push('status = ?');
    params.push(options.status);

    // Track completion time
    if (options.status === 'done' && current.status !== 'done') {
      updates.push('completed_at = ?');
      params.push(now);
    } else if (options.status !== 'done') {
      updates.push('completed_at = ?');
      params.push(null);
    }
  }

  if (options.epic !== undefined) {
    updates.push('epic = ?');
    params.push(options.epic ?? null);
  }

  if (options.priority !== undefined) {
    updates.push('priority = ?');
    params.push(options.priority);
  }

  if (options.blockedBy !== undefined) {
    updates.push('blocked_by = ?');
    params.push(options.blockedBy ?? null);
  }

  if (options.labels !== undefined) {
    updates.push('labels = ?');
    params.push(JSON.stringify(options.labels));
  }

  if (options.assignedSession !== undefined) {
    updates.push('assigned_session = ?');
    params.push(options.assignedSession ?? null);
  }

  params.push(id.toString());

  const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = prepareStatement(db, sql);
  const result = stmt.run(...params);

  // Update epic stats if epic changed or status changed
  if (options.epic !== undefined || options.status !== undefined) {
    if (current.epic) {
      updateEpicStats(current.project, current.epic);
    }
    if (options.epic && options.epic !== current.epic) {
      updateEpicStats(current.project, options.epic);
    }
  }

  return result.changes > 0;
}

/**
 * Start working on a task
 */
export function startTask(id: number, sessionId?: string): boolean {
  return updateTask(id, {
    status: 'in_progress',
    assignedSession: sessionId,
  });
}

/**
 * Complete a task
 */
export function completeTask(id: number): boolean {
  return updateTask(id, { status: 'done' });
}

/**
 * Block a task
 */
export function blockTask(id: number, reason: string): boolean {
  return updateTask(id, {
    status: 'blocked',
    blockedBy: reason,
  });
}

/**
 * Unblock a task
 */
export function unblockTask(id: number): boolean {
  return updateTask(id, {
    status: 'backlog',
    blockedBy: undefined,
  });
}

/**
 * Link memory to task
 */
export function linkMemoryToTask(taskId: number, memoryId: number): boolean {
  const task = getTaskById(taskId);
  if (!task) return false;

  const linkedMemories = [...task.linkedMemories, memoryId];
  const db = getDatabase();

  const sql = 'UPDATE tasks SET linked_memories = ?, updated_at = ? WHERE id = ?';
  const stmt = prepareStatement<[string, string, number]>(db, sql);
  const result = stmt.run(JSON.stringify(linkedMemories), new Date().toISOString(), taskId);

  return result.changes > 0;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a task
 */
export function deleteTask(id: number): boolean {
  const db = getDatabase();

  // Get task for epic update
  const task = getTaskById(id);

  const sql = 'DELETE FROM tasks WHERE id = ?';
  const stmt = prepareStatement<[number]>(db, sql);
  const result = stmt.run(id);

  // Update epic stats
  if (task?.epic) {
    updateEpicStats(task.project, task.epic);
  }

  return result.changes > 0;
}

// ============================================================================
// EPIC STATS HELPER
// ============================================================================

/**
 * Update epic statistics (called after task changes)
 */
function updateEpicStats(project: string, epicName: string): void {
  const db = getDatabase();

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
  const counts = countStmt.get(project, epicName);

  if (!counts) return;

  const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'planning';

  // Update or create epic
  const upsertSql = `
    INSERT INTO epics (name, project, progress, status, total_tasks, completed_tasks, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project, name) DO UPDATE SET
      progress = excluded.progress,
      status = excluded.status,
      total_tasks = excluded.total_tasks,
      completed_tasks = excluded.completed_tasks,
      completed_at = CASE WHEN excluded.status = 'done' THEN datetime('now') ELSE NULL END
  `;

  const startedAt = progress > 0 ? new Date().toISOString() : null;
  const completedAt = progress === 100 ? new Date().toISOString() : null;

  const upsertStmt = prepareStatement<
    [string, string, number, string, number, number, string | null, string | null]
  >(db, upsertSql);
  upsertStmt.run(
    epicName,
    project,
    progress,
    status,
    counts.total,
    counts.completed,
    startedAt,
    completedAt,
  );
}
