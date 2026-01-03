/**
 * @module lib/@storage/progress/sessions
 * @description AI work session tracking with automatic summaries
 */

import { randomUUID } from 'node:crypto';
import { getDatabase, prepareStatement } from '../database';
import type { Session, SessionCreateOptions, SessionRow, SessionUpdateOptions } from './types';

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert database row to Session
 */
export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    project: row.project,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summary: row.summary ?? undefined,
    tasksWorkedOn: JSON.parse(row.tasks_worked_on || '[]') as number[],
    tasksCompleted: JSON.parse(row.tasks_completed || '[]') as number[],
    commits: JSON.parse(row.commits || '[]') as string[],
    memoriesCreated: JSON.parse(row.memories_created || '[]') as number[],
    filesModified: JSON.parse(row.files_modified || '[]') as string[],
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Start a new AI work session
 */
export function startSession(options: SessionCreateOptions): string {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO sessions (id, project, started_at)
    VALUES (?, ?, ?)
  `;

  const stmt = prepareStatement<[string, string, string]>(db, sql);
  stmt.run(id, options.project, now);

  return id;
}

/**
 * Get or create active session for project
 */
export function getOrCreateActiveSession(project: string): Session {
  const active = getActiveSession(project);
  if (active) {
    return active;
  }

  const id = startSession({ project });
  return getSessionById(id)!;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get session by ID
 */
export function getSessionById(id: string): Session | undefined {
  const db = getDatabase();

  const sql = 'SELECT * FROM sessions WHERE id = ?';
  const stmt = prepareStatement<[string], SessionRow>(db, sql);
  const row = stmt.get(id);

  return row ? rowToSession(row) : undefined;
}

/**
 * Get active session for project (no ended_at)
 */
export function getActiveSession(project: string): Session | undefined {
  const db = getDatabase();

  const sql = `
    SELECT * FROM sessions
    WHERE project = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `;

  const stmt = prepareStatement<[string], SessionRow>(db, sql);
  const row = stmt.get(project);

  return row ? rowToSession(row) : undefined;
}

/**
 * Get recent sessions for a project
 */
export function getRecentSessions(project: string, limit = 10): Session[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM sessions
    WHERE project = ?
    ORDER BY started_at DESC
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, number], SessionRow>(db, sql);
  const rows = stmt.all(project, limit);

  return rows.map(rowToSession);
}

/**
 * Get sessions by date range
 */
export function getSessionsByDateRange(
  project: string,
  startDate: string,
  endDate: string,
): Session[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM sessions
    WHERE project = ? AND started_at >= ? AND started_at <= ?
    ORDER BY started_at DESC
  `;

  const stmt = prepareStatement<[string, string, string], SessionRow>(db, sql);
  const rows = stmt.all(project, startDate, endDate);

  return rows.map(rowToSession);
}

/**
 * Get session statistics for a project
 */
export function getSessionStats(
  project: string,
  days = 7,
): {
  totalSessions: number;
  totalTasksCompleted: number;
  totalCommits: number;
  totalMemories: number;
  averageDurationMinutes: number;
  mostProductiveHour: number;
} {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const sql = `
    SELECT * FROM sessions
    WHERE project = ? AND started_at >= ?
  `;

  const stmt = prepareStatement<[string, string], SessionRow>(db, sql);
  const rows = stmt.all(project, cutoff);
  const sessions = rows.map(rowToSession);

  let totalTasksCompleted = 0;
  let totalCommits = 0;
  let totalMemories = 0;
  let totalDurationMs = 0;
  const hourCounts: Record<number, number> = {};

  for (const session of sessions) {
    totalTasksCompleted += session.tasksCompleted.length;
    totalCommits += session.commits.length;
    totalMemories += session.memoriesCreated.length;

    if (session.endedAt) {
      const start = new Date(session.startedAt).getTime();
      const end = new Date(session.endedAt).getTime();
      totalDurationMs += end - start;
    }

    const hour = new Date(session.startedAt).getHours();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
  }

  // Find most productive hour
  let mostProductiveHour = 10; // Default
  let maxCount = 0;
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostProductiveHour = Number(hour);
    }
  }

  const completedSessions = sessions.filter((s) => s.endedAt).length;
  const averageDurationMinutes =
    completedSessions > 0 ? Math.round(totalDurationMs / completedSessions / 60000) : 0;

  return {
    totalSessions: sessions.length,
    totalTasksCompleted,
    totalCommits,
    totalMemories,
    averageDurationMinutes,
    mostProductiveHour,
  };
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update session
 */
export function updateSession(id: string, options: SessionUpdateOptions): boolean {
  const db = getDatabase();

  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (options.summary !== undefined) {
    updates.push('summary = ?');
    params.push(options.summary ?? null);
  }

  if (options.tasksWorkedOn !== undefined) {
    updates.push('tasks_worked_on = ?');
    params.push(JSON.stringify(options.tasksWorkedOn));
  }

  if (options.tasksCompleted !== undefined) {
    updates.push('tasks_completed = ?');
    params.push(JSON.stringify(options.tasksCompleted));
  }

  if (options.commits !== undefined) {
    updates.push('commits = ?');
    params.push(JSON.stringify(options.commits));
  }

  if (options.memoriesCreated !== undefined) {
    updates.push('memories_created = ?');
    params.push(JSON.stringify(options.memoriesCreated));
  }

  if (options.filesModified !== undefined) {
    updates.push('files_modified = ?');
    params.push(JSON.stringify(options.filesModified));
  }

  if (updates.length === 0) {
    return false;
  }

  params.push(id);

  const sql = `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = prepareStatement(db, sql);
  const result = stmt.run(...params);

  return result.changes > 0;
}

/**
 * Add task to session's worked-on list
 */
export function addTaskToSession(sessionId: string, taskId: number): boolean {
  const session = getSessionById(sessionId);
  if (!session) return false;

  if (!session.tasksWorkedOn.includes(taskId)) {
    return updateSession(sessionId, {
      tasksWorkedOn: [...session.tasksWorkedOn, taskId],
    });
  }

  return true;
}

/**
 * Mark task as completed in session
 */
export function completeTaskInSession(sessionId: string, taskId: number): boolean {
  const session = getSessionById(sessionId);
  if (!session) return false;

  const updates: SessionUpdateOptions = {};

  if (!session.tasksWorkedOn.includes(taskId)) {
    updates.tasksWorkedOn = [...session.tasksWorkedOn, taskId];
  }

  if (!session.tasksCompleted.includes(taskId)) {
    updates.tasksCompleted = [...session.tasksCompleted, taskId];
  }

  return Object.keys(updates).length > 0 ? updateSession(sessionId, updates) : true;
}

/**
 * Add commit to session
 */
export function addCommitToSession(sessionId: string, commitHash: string): boolean {
  const session = getSessionById(sessionId);
  if (!session) return false;

  if (!session.commits.includes(commitHash)) {
    return updateSession(sessionId, {
      commits: [...session.commits, commitHash],
    });
  }

  return true;
}

/**
 * Add memory to session
 */
export function addMemoryToSession(sessionId: string, memoryId: number): boolean {
  const session = getSessionById(sessionId);
  if (!session) return false;

  if (!session.memoriesCreated.includes(memoryId)) {
    return updateSession(sessionId, {
      memoriesCreated: [...session.memoriesCreated, memoryId],
    });
  }

  return true;
}

/**
 * Add file to session's modified list
 */
export function addFileToSession(sessionId: string, filePath: string): boolean {
  const session = getSessionById(sessionId);
  if (!session) return false;

  if (!session.filesModified.includes(filePath)) {
    return updateSession(sessionId, {
      filesModified: [...session.filesModified, filePath],
    });
  }

  return true;
}

/**
 * End a session with automatic summary generation
 */
export function endSession(id: string, summary?: string | undefined): boolean {
  const db = getDatabase();
  const session = getSessionById(id);

  if (!session) return false;

  // Auto-generate summary if not provided
  const finalSummary = summary ?? generateSessionSummary(session);
  const now = new Date().toISOString();

  const sql = `
    UPDATE sessions
    SET ended_at = ?, summary = ?
    WHERE id = ?
  `;

  const stmt = prepareStatement<[string, string, string]>(db, sql);
  const result = stmt.run(now, finalSummary, id);

  return result.changes > 0;
}

// ============================================================================
// AUTO-SUMMARY
// ============================================================================

/**
 * Generate automatic summary from session data
 */
function generateSessionSummary(session: Session): string {
  const parts: string[] = [];

  const tasksWorked = session.tasksWorkedOn.length;
  const tasksCompleted = session.tasksCompleted.length;
  const commits = session.commits.length;
  const files = session.filesModified.length;
  const memories = session.memoriesCreated.length;

  if (tasksCompleted > 0) {
    parts.push(`Completed ${tasksCompleted} task${tasksCompleted > 1 ? 's' : ''}`);
  } else if (tasksWorked > 0) {
    parts.push(`Worked on ${tasksWorked} task${tasksWorked > 1 ? 's' : ''}`);
  }

  if (commits > 0) {
    parts.push(`${commits} commit${commits > 1 ? 's' : ''}`);
  }

  if (files > 0) {
    parts.push(`modified ${files} file${files > 1 ? 's' : ''}`);
  }

  if (memories > 0) {
    parts.push(`saved ${memories} memor${memories > 1 ? 'ies' : 'y'}`);
  }

  if (parts.length === 0) {
    return 'Session with no tracked activity';
  }

  // Calculate duration
  if (session.endedAt) {
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.endedAt).getTime();
    const durationMins = Math.round((end - start) / 60000);

    if (durationMins > 0) {
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      parts.push(`(${durationStr})`);
    }
  }

  return parts.join(', ');
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a session
 */
export function deleteSession(id: string): boolean {
  const db = getDatabase();

  const sql = 'DELETE FROM sessions WHERE id = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Clean up old sessions (older than N days)
 */
export function cleanupOldSessions(project: string, maxAgeDays = 90): number {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  const sql = `
    DELETE FROM sessions
    WHERE project = ? AND started_at < ? AND ended_at IS NOT NULL
  `;

  const stmt = prepareStatement<[string, string]>(db, sql);
  const result = stmt.run(project, cutoff);

  return result.changes;
}
