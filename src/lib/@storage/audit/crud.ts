/**
 * @module lib/@storage/audit/crud
 * @description CRUD operations for audit history
 */

import { getDatabase, prepareStatement } from '../database';
import type { AuditHistoryEntry, AuditHistoryRow, AuditTrend, ProjectAuditSummary } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ENTRIES_PER_PROJECT = 100;

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert database row to AuditHistoryEntry
 */
function rowToEntry(row: AuditHistoryRow): AuditHistoryEntry {
  return {
    id: row.id,
    project: row.project,
    timestamp: row.timestamp,
    timestamp_epoch: row.timestamp_epoch,
    commit_hash: row.commit_hash ?? undefined,
    branch: row.branch ?? undefined,
    score: row.score,
    grade: row.grade as AuditHistoryEntry['grade'],
    total_issues: row.total_issues,
    critical_issues: row.critical_issues,
    high_issues: row.high_issues,
    medium_issues: row.medium_issues,
    low_issues: row.low_issues,
    files_analyzed: row.files_analyzed ?? undefined,
    duration_ms: row.duration_ms ?? undefined,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Save a new audit entry
 */
export function saveAuditEntry(entry: Omit<AuditHistoryEntry, 'id'>): number {
  const db = getDatabase();

  const sql = `
    INSERT INTO audit_history (
      project, timestamp, timestamp_epoch, commit_hash, branch,
      score, grade, total_issues, critical_issues, high_issues,
      medium_issues, low_issues, files_analyzed, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const stmt = prepareStatement<
    [
      string,
      string,
      number,
      string | null,
      string | null,
      number,
      string,
      number,
      number,
      number,
      number,
      number,
      number | null,
      number | null,
    ]
  >(db, sql);

  const result = stmt.run(
    entry.project,
    entry.timestamp,
    entry.timestamp_epoch,
    entry.commit_hash ?? null,
    entry.branch ?? null,
    entry.score,
    entry.grade,
    entry.total_issues,
    entry.critical_issues,
    entry.high_issues,
    entry.medium_issues,
    entry.low_issues,
    entry.files_analyzed ?? null,
    entry.duration_ms ?? null,
  );

  // Cleanup old entries
  cleanupOldEntries(entry.project);

  return Number(result.lastInsertRowid);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get the most recent audit entry for a project
 */
export function getLatestAudit(project: string): AuditHistoryEntry | undefined {
  const db = getDatabase();

  const sql = `
    SELECT * FROM audit_history
    WHERE project = ?
    ORDER BY timestamp_epoch DESC
    LIMIT 1
  `;

  const stmt = prepareStatement<[string], AuditHistoryRow>(db, sql);
  const row = stmt.get(project);

  return row ? rowToEntry(row) : undefined;
}

/**
 * Get the previous audit (second most recent)
 */
export function getPreviousAudit(project: string): AuditHistoryEntry | undefined {
  const db = getDatabase();

  const sql = `
    SELECT * FROM audit_history
    WHERE project = ?
    ORDER BY timestamp_epoch DESC
    LIMIT 1 OFFSET 1
  `;

  const stmt = prepareStatement<[string], AuditHistoryRow>(db, sql);
  const row = stmt.get(project);

  return row ? rowToEntry(row) : undefined;
}

/**
 * Get audit history for a project
 */
export function getAuditHistory(project: string, limit = 10): AuditHistoryEntry[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM audit_history
    WHERE project = ?
    ORDER BY timestamp_epoch DESC
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, number], AuditHistoryRow>(db, sql);
  const rows = stmt.all(project, limit);

  return rows.map(rowToEntry);
}

/**
 * Get all audits across all projects
 */
export function getAllAudits(limit = 50): AuditHistoryEntry[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM audit_history
    ORDER BY timestamp_epoch DESC
    LIMIT ?
  `;

  const stmt = prepareStatement<[number], AuditHistoryRow>(db, sql);
  const rows = stmt.all(limit);

  return rows.map(rowToEntry);
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Calculate trend for a project
 */
export function calculateTrend(project: string): AuditTrend {
  const db = getDatabase();

  // Get last 2 audits
  const sql = `
    SELECT score FROM audit_history
    WHERE project = ?
    ORDER BY timestamp_epoch DESC
    LIMIT 2
  `;

  const stmt = prepareStatement<[string], { score: number }>(db, sql);
  const rows = stmt.all(project);

  // Count total audits
  const countSql = 'SELECT COUNT(*) as count FROM audit_history WHERE project = ?';
  const countStmt = prepareStatement<[string], { count: number }>(db, countSql);
  const countRow = countStmt.get(project);
  const historyCount = countRow?.count ?? 0;

  const firstRow = rows[0];
  if (rows.length === 0 || !firstRow) {
    return {
      current: 0,
      delta: 0,
      direction: 'stable',
      historyCount: 0,
    };
  }

  const current = firstRow.score;
  const secondRow = rows[1];
  const previous = rows.length > 1 && secondRow ? secondRow.score : undefined;
  const delta = previous !== undefined ? current - previous : 0;

  let direction: AuditTrend['direction'] = 'stable';
  if (delta >= 5) direction = 'improving';
  else if (delta <= -5) direction = 'declining';

  return {
    current,
    previous,
    delta,
    direction,
    historyCount,
  };
}

/**
 * Get project summary
 */
export function getProjectSummary(project: string): ProjectAuditSummary | undefined {
  const db = getDatabase();

  const sql = `
    SELECT
      project,
      COUNT(*) as total_audits,
      AVG(score) as avg_score,
      MAX(score) as best_score,
      MIN(score) as worst_score,
      MAX(timestamp) as last_audit
    FROM audit_history
    WHERE project = ?
    GROUP BY project
  `;

  type SummaryRow = {
    project: string;
    total_audits: number;
    avg_score: number;
    best_score: number;
    worst_score: number;
    last_audit: string;
  };

  const stmt = prepareStatement<[string], SummaryRow>(db, sql);
  const row = stmt.get(project);

  if (!row) return undefined;

  const latest = getLatestAudit(project);

  return {
    project: row.project,
    latestScore: latest?.score ?? 0,
    latestGrade: latest?.grade ?? 'F',
    totalAudits: row.total_audits,
    averageScore: Math.round(row.avg_score),
    bestScore: row.best_score,
    worstScore: row.worst_score,
    lastAudit: row.last_audit,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove old entries to keep history manageable
 */
function cleanupOldEntries(project: string): void {
  const db = getDatabase();

  // Delete entries beyond the limit
  const sql = `
    DELETE FROM audit_history
    WHERE project = ? AND id NOT IN (
      SELECT id FROM audit_history
      WHERE project = ?
      ORDER BY timestamp_epoch DESC
      LIMIT ?
    )
  `;

  const stmt = prepareStatement<[string, string, number]>(db, sql);
  stmt.run(project, project, MAX_ENTRIES_PER_PROJECT);
}

/**
 * Clear all history for a project
 */
export function clearProjectHistory(project: string): number {
  const db = getDatabase();

  const sql = 'DELETE FROM audit_history WHERE project = ?';
  const stmt = prepareStatement<[string]>(db, sql);
  const result = stmt.run(project);

  return result.changes;
}

/**
 * Get total audit count
 */
export function getTotalAuditCount(): number {
  const db = getDatabase();

  const sql = 'SELECT COUNT(*) as count FROM audit_history';
  const stmt = prepareStatement<[], { count: number }>(db, sql);
  const row = stmt.get();

  return row?.count ?? 0;
}
