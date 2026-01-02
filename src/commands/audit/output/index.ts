/**
 * @module commands/audit/output
 * @description Progressive disclosure output for audit reports
 *
 * Provides 3-level output system:
 * - Level 1 (summary): Executive summary only (~50 tokens)
 * - Level 2 (default): Executive summary + top issues (~500 tokens)
 * - Level 3 (full): Complete report
 *
 * @example
 * ```typescript
 * import {
 *   formatProgressiveOutput,
 *   calculateHealthScore,
 *   type OutputLevel,
 * } from '@/commands/audit/output';
 *
 * // Default output (~500 tokens)
 * const output = formatProgressiveOutput(report, 'default');
 *
 * // Summary only (~50 tokens)
 * const summary = formatProgressiveOutput(report, 'summary');
 *
 * // Full report
 * const full = formatProgressiveOutput(report, 'full');
 * ```
 */

// ============================================================================
// Health Score
// ============================================================================

export type {
  HealthGrade,
  HealthScore,
  HealthTrend,
} from './health-score';

export {
  calculateHealthScore,
  determineGrade,
  determineTrend,
  formatHealthScoreAttr,
} from './health-score';

// ============================================================================
// Executive Summary
// ============================================================================

export type {
  ExecutiveSummary,
  FocusFile,
  QuickWinSuggestion,
} from './executive-summary';

export {
  buildExecutiveSummaryElement,
  formatExecutiveSummary,
  generateExecutiveSummary,
} from './executive-summary';

// ============================================================================
// Progressive Output
// ============================================================================

export type {
  OutputLevel,
  OutputLevelConfig,
} from './progressive';

export {
  formatProgressiveOutput,
  getOutputTokenCount,
  OUTPUT_LEVELS,
  validateTokenBudget,
} from './progressive';

// ============================================================================
// Audit History (Trend Tracking)
// ============================================================================

export type {
  AuditHistory,
  AuditHistoryEntry,
} from './history';

export {
  calculateScoreDelta,
  getHistorySummary,
  getPreviousAudit,
  loadAuditHistory,
  saveAuditEntry,
} from './history';
