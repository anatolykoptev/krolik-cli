/**
 * @module commands/audit/output/executive-summary
 * @description Executive summary generation for audit reports (~50 tokens)
 *
 * Provides at-a-glance view of:
 * - Health score (A-F grade)
 * - Critical issue count
 * - Best quick-win action
 * - Hottest file to focus on
 *
 * Uses @format/xml for type-safe XML building and automatic escaping.
 */

import { buildElement, type XmlElement } from '../../../lib/@format';
import { normalizePath } from '../../../lib/@reporter/grouping';
import type { AIReport } from '../../../lib/@reporter/types';
import { calculateHealthScore, type HealthScore } from './health-score';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Quick win suggestion for immediate action
 */
export interface QuickWinSuggestion {
  /** Command to run */
  command: string;
  /** Expected result description */
  result: string;
}

/**
 * Focus file recommendation
 */
export interface FocusFile {
  /** Relative file path */
  file: string;
  /** Reason for focus (e.g., "hottest: 4 critical, 50 deps") */
  reason: string;
}

/**
 * Complete executive summary data
 */
export interface ExecutiveSummary {
  health: HealthScore;
  criticalCount: number;
  quickWin: QuickWinSuggestion | null;
  focus: FocusFile | null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate executive summary from audit report
 *
 * @param report - The AI report with issues and analysis
 * @param previousScore - Optional previous score for trend
 * @returns Complete executive summary data
 */
export function generateExecutiveSummary(
  report: AIReport,
  previousScore?: number,
): ExecutiveSummary {
  const health = calculateHealthScore(report, previousScore);
  const criticalCount = report.summary.byPriority.critical ?? 0;
  const quickWin = findBestQuickWin(report);
  const focus = findFocusFile(report);

  return { health, criticalCount, quickWin, focus };
}

/**
 * Build executive summary as XmlElement structure
 * Can be composed with other elements before rendering
 */
export function buildExecutiveSummaryElement(report: AIReport, previousScore?: number): XmlElement {
  const summary = generateExecutiveSummary(report, previousScore);

  // Build health score attributes
  const healthAttrs: Record<string, string | number> = {
    score: summary.health.grade,
    trend: summary.health.trend,
  };

  // Add numeric score for more precision
  healthAttrs.numeric = summary.health.score;

  // Add delta if comparing with previous
  if (previousScore !== undefined) {
    const delta = summary.health.score - previousScore;
    healthAttrs.delta = delta >= 0 ? `+${delta}` : `${delta}`;
    healthAttrs['vs-previous'] = previousScore;
  }

  const children: XmlElement[] = [
    // Health score (always present)
    { tag: 'health', attrs: healthAttrs },
    // Critical count (always present)
    { tag: 'critical', attrs: { count: summary.criticalCount } },
  ];

  // Quick win (optional)
  if (summary.quickWin) {
    children.push({
      tag: 'quick-win',
      attrs: { command: summary.quickWin.command, result: summary.quickWin.result },
    });
  }

  // Focus file (optional)
  if (summary.focus) {
    children.push({
      tag: 'focus',
      attrs: { file: summary.focus.file, reason: summary.focus.reason },
    });
  }

  return {
    tag: 'executive-summary',
    content: children,
  };
}

/**
 * Format executive summary as XML string (~50 tokens)
 *
 * @example
 * <executive-summary>
 *   <health score="C" trend="improving"/>
 *   <critical count="3"/>
 *   <quick-win command="krolik fix --safe" result="7 issues in 2 min"/>
 *   <focus file="slots.ts" reason="hottest: 4 critical, 50 deps"/>
 * </executive-summary>
 */
export function formatExecutiveSummary(report: AIReport, previousScore?: number): string {
  const element = buildExecutiveSummaryElement(report, previousScore);
  return buildElement(element);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find the best quick-win action based on report data
 */
function findBestQuickWin(report: AIReport): QuickWinSuggestion | null {
  const autoFixable = report.summary.autoFixableIssues;

  if (autoFixable === 0) {
    return null;
  }

  // Calculate approximate time savings
  const quickWinCount = report.quickWins ? report.quickWins.length : 0;
  const estimatedMinutes = Math.max(2, Math.ceil(quickWinCount / 5));

  if (quickWinCount > 0) {
    return {
      command: 'krolik fix --safe',
      result: `${quickWinCount} issues in ${estimatedMinutes} min`,
    };
  }

  return {
    command: 'krolik fix --dry-run',
    result: `${autoFixable} auto-fixable issues`,
  };
}

/**
 * Find the hottest file to focus on
 */
function findFocusFile(report: AIReport): FocusFile | null {
  const hottest = report.hotspots?.[0];
  if (!hottest) {
    return null;
  }

  const normalizedPath = normalizePath(hottest.file);
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;

  // Build reason based on available data
  const parts: string[] = [];

  if (hottest.priority === 'critical' || hottest.priority === 'high') {
    parts.push(`${hottest.issueCount} ${hottest.priority}`);
  } else {
    parts.push(`${hottest.issueCount} issues`);
  }

  // Check ranking data for dependency info
  if (report.ranking?.hotspots.length) {
    const rankingMatch = report.ranking.hotspots.find(
      (h) => h.path.includes(fileName) || normalizedPath.includes(h.path),
    );
    if (rankingMatch && rankingMatch.coupling.afferent > 0) {
      parts.push(`${rankingMatch.coupling.afferent} deps`);
    }
  }

  return {
    file: fileName,
    reason: `hottest: ${parts.join(', ')}`,
  };
}
