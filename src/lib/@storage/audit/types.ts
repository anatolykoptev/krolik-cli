/**
 * @module lib/@storage/audit/types
 * @description Types for audit history storage
 */

import type { HealthGrade } from '@/commands/audit/output/health-score';
import type { PriorityLevel } from '@/commands/fix/reporter/types';

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Audit history entry stored in SQLite
 */
export interface AuditHistoryEntry {
  /** Auto-increment ID */
  id?: number | undefined;
  /** Project path (normalized) */
  project: string;
  /** ISO timestamp of the audit */
  timestamp: string;
  /** Unix epoch (for sorting) */
  timestamp_epoch: number;
  /** Git commit hash if available */
  commit_hash?: string | undefined;
  /** Git branch name */
  branch?: string | undefined;
  /** Health score (0-100) */
  score: number;
  /** Letter grade (A-F) */
  grade: HealthGrade;
  /** Total issue count */
  total_issues: number;
  /** Critical issues */
  critical_issues: number;
  /** High priority issues */
  high_issues: number;
  /** Medium priority issues */
  medium_issues: number;
  /** Low priority issues */
  low_issues: number;
  /** Files analyzed */
  files_analyzed?: number | undefined;
  /** Duration in ms */
  duration_ms?: number | undefined;
}

/**
 * SQLite row for audit history
 */
export interface AuditHistoryRow {
  id: number;
  project: string;
  timestamp: string;
  timestamp_epoch: number;
  commit_hash: string | null;
  branch: string | null;
  score: number;
  grade: string;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  files_analyzed: number | null;
  duration_ms: number | null;
}

/**
 * Trend analysis result
 */
export interface AuditTrend {
  /** Current score */
  current: number;
  /** Previous score */
  previous?: number | undefined;
  /** Score delta */
  delta: number;
  /** Trend direction */
  direction: 'improving' | 'stable' | 'declining';
  /** Number of audits in history */
  historyCount: number;
}

/**
 * Summary for a specific project
 */
export interface ProjectAuditSummary {
  /** Project path */
  project: string;
  /** Latest score */
  latestScore: number;
  /** Latest grade */
  latestGrade: HealthGrade;
  /** Total audits */
  totalAudits: number;
  /** Average score */
  averageScore: number;
  /** Best score ever */
  bestScore: number;
  /** Worst score ever */
  worstScore: number;
  /** Last audit date */
  lastAudit: string;
}

// ============================================================================
// LEGACY TYPES (for migration)
// ============================================================================

/**
 * Legacy JSON-based audit history entry
 */
export interface LegacyAuditHistoryEntry {
  timestamp: string;
  commit?: string;
  branch?: string;
  score: number;
  grade: HealthGrade;
  issues: Record<PriorityLevel, number>;
  totalIssues: number;
}

/**
 * Legacy JSON-based audit history file
 */
export interface LegacyAuditHistory {
  version: '1.0';
  entries: LegacyAuditHistoryEntry[];
}
