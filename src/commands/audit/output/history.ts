/**
 * @module commands/audit/output/history
 * @description Audit history tracking for trend analysis
 *
 * Stores audit results in .krolik/audit-history.json to enable
 * trend comparison between audits (improving, stable, declining).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '@/lib/@core/fs';
import type { PriorityLevel } from '../../fix/reporter/types';
import type { HealthGrade } from './health-score';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single audit history entry
 */
export interface AuditHistoryEntry {
  /** ISO timestamp of the audit */
  timestamp: string;
  /** Git commit hash if available */
  commit?: string;
  /** Git branch name */
  branch?: string;
  /** Health score (0-100) */
  score: number;
  /** Letter grade */
  grade: HealthGrade;
  /** Issue counts by priority */
  issues: Record<PriorityLevel, number>;
  /** Total issue count */
  totalIssues: number;
}

/**
 * Complete audit history file structure
 */
export interface AuditHistory {
  /** Schema version for migrations */
  version: '1.0';
  /** Array of audit entries (newest first) */
  entries: AuditHistoryEntry[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HISTORY_FILE = '.krolik/audit-history.json';
const MAX_ENTRIES = 50; // Keep last 50 audits

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Load audit history from file
 */
export function loadAuditHistory(projectRoot: string): AuditHistory {
  const historyPath = path.join(projectRoot, HISTORY_FILE);

  try {
    if (fs.existsSync(historyPath)) {
      const content = fs.readFileSync(historyPath, 'utf-8');
      const history = JSON.parse(content) as AuditHistory;

      // Validate structure
      if (history.version === '1.0' && Array.isArray(history.entries)) {
        return history;
      }
    }
  } catch {
    // Return empty history on error
  }

  return { version: '1.0', entries: [] };
}

/**
 * Save audit entry to history
 */
export function saveAuditEntry(projectRoot: string, entry: AuditHistoryEntry): void {
  const historyPath = path.join(projectRoot, HISTORY_FILE);
  const history = loadAuditHistory(projectRoot);

  // Add new entry at the beginning
  history.entries.unshift(entry);

  // Trim to max entries
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(0, MAX_ENTRIES);
  }

  // Ensure .krolik directory exists
  ensureDir(path.dirname(historyPath));

  // Write history
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Get the previous audit entry (for trend comparison)
 */
export function getPreviousAudit(projectRoot: string): AuditHistoryEntry | undefined {
  const history = loadAuditHistory(projectRoot);
  // Return the most recent entry (first in array)
  return history.entries[0];
}

/**
 * Get audit history summary
 */
export function getHistorySummary(
  projectRoot: string,
  limit = 5,
): Array<{ date: string; score: number; grade: HealthGrade; issues: number }> {
  const history = loadAuditHistory(projectRoot);

  return history.entries.slice(0, limit).map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString(),
    score: entry.score,
    grade: entry.grade,
    issues: entry.totalIssues,
  }));
}

/**
 * Calculate score delta from previous audit
 */
export function calculateScoreDelta(
  currentScore: number,
  projectRoot: string,
): { delta: number; previous?: number } {
  const previous = getPreviousAudit(projectRoot);

  if (!previous) {
    return { delta: 0 };
  }

  return {
    delta: currentScore - previous.score,
    previous: previous.score,
  };
}
