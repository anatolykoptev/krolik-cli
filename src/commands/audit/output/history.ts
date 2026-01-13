/**
 * @module commands/audit/output/history
 * @description Audit history tracking for trend analysis
 *
 * Uses SQLite database in ~/.krolik/memory/memories.db for persistence.
 * Tracks audit results over time for trend comparison.
 */

import {
  type AuditHistoryEntry,
  type AuditTrend,
  calculateTrend as dbCalculateTrend,
  getAuditHistory as dbGetHistory,
  getLatestAudit as dbGetLatest,
  getPreviousAudit as dbGetPrevious,
  saveAuditEntry as dbSaveEntry,
} from '@/lib/@storage';
import type { PriorityLevel } from '../../../lib/@reporter/types';
import type { HealthGrade } from './health-score';

// ============================================================================
// RE-EXPORT TYPES
// ============================================================================

export type { AuditHistoryEntry, AuditTrend };

// ============================================================================
// SIMPLIFIED API (for audit command)
// ============================================================================

/**
 * Input for saving audit entry (simplified for command use)
 */
export interface SaveAuditInput {
  /** Project root path */
  projectRoot: string;
  /** Health score (0-100) */
  score: number;
  /** Letter grade */
  grade: HealthGrade;
  /** Issues by priority */
  issues: Record<PriorityLevel, number>;
  /** Total issue count */
  totalIssues: number;
  /** Git branch (optional) */
  branch?: string;
  /** Git commit hash (optional) */
  commit?: string;
  /** Files analyzed (optional) */
  filesAnalyzed?: number;
  /** Duration in ms (optional) */
  durationMs?: number;
}

/**
 * Save audit entry to history (simplified API)
 */
export function saveAuditEntry(input: SaveAuditInput): void {
  const now = new Date();

  dbSaveEntry({
    project: normalizeProjectPath(input.projectRoot),
    timestamp: now.toISOString(),
    timestamp_epoch: now.getTime(),
    commit_hash: input.commit,
    branch: input.branch,
    score: input.score,
    grade: input.grade,
    total_issues: input.totalIssues,
    critical_issues: input.issues.critical ?? 0,
    high_issues: input.issues.high ?? 0,
    medium_issues: input.issues.medium ?? 0,
    low_issues: input.issues.low ?? 0,
    files_analyzed: input.filesAnalyzed,
    duration_ms: input.durationMs,
  });
}

/**
 * Get the previous audit entry (for trend comparison)
 */
export function getPreviousAudit(projectRoot: string): AuditHistoryEntry | undefined {
  return dbGetPrevious(normalizeProjectPath(projectRoot));
}

/**
 * Get audit history summary (for display)
 */
export function getHistorySummary(
  projectRoot: string,
  limit = 5,
): Array<{ date: string; score: number; grade: HealthGrade; issues: number }> {
  const entries = dbGetHistory(normalizeProjectPath(projectRoot), limit);

  return entries.map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString(),
    score: entry.score,
    grade: entry.grade,
    issues: entry.total_issues,
  }));
}

/**
 * Calculate score delta from previous audit
 */
export function calculateScoreDelta(
  currentScore: number,
  projectRoot: string,
): { delta: number; previous?: number } {
  const previous = dbGetLatest(normalizeProjectPath(projectRoot));

  if (!previous) {
    return { delta: 0 };
  }

  return {
    delta: currentScore - previous.score,
    previous: previous.score,
  };
}

/**
 * Get full trend analysis
 */
export function getTrend(projectRoot: string): AuditTrend {
  return dbCalculateTrend(normalizeProjectPath(projectRoot));
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize project path for consistent storage
 * Removes trailing slashes, resolves ~, etc.
 */
function normalizeProjectPath(projectRoot: string): string {
  // Remove trailing slashes
  const normalized = projectRoot.replace(/\/+$/, '');

  // Extract just the project name for brevity
  const parts = normalized.split('/');
  const projectName = parts[parts.length - 1] ?? normalized;

  // If it's a typical project path, use just the project name
  // Otherwise keep the full path for uniqueness
  if (normalized.includes('/CascadeProjects/') || normalized.includes('/Projects/')) {
    return projectName;
  }

  return normalized;
}
