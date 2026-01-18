/**
 * @module lib/@reporter/formatter/xml
 * @description XML formatter for AI Report
 *
 * This module orchestrates XML formatting, delegating to:
 * - xml-sections.ts: Section formatters (summary, quick wins, action plan, etc.)
 * - xml-patterns.ts: Pattern and cluster formatters
 */

import { formatProgressiveOutput, type OutputLevel } from '../../../commands/audit/output';
import type { AIReport } from '../types';
import { formatIssueClusters, formatIssuePatterns } from './xml-patterns';
import {
  formatXmlActionPlan,
  formatXmlBackwardsCompat,
  formatXmlCodeStyle,
  formatXmlDuplicates,
  formatXmlQuickWins,
  formatXmlRanking,
  formatXmlReadability,
  formatXmlRecommendations,
  formatXmlSummary,
} from './xml-sections';

// ============================================================================
// PROGRESSIVE XML FORMATTER
// ============================================================================

/**
 * Format AI Report as progressive XML with token budgets
 */
export function formatAsProgressiveXml(report: AIReport, level: OutputLevel = 'default'): string {
  return formatProgressiveOutput(report, level);
}

// ============================================================================
// MAIN XML FORMATTER
// ============================================================================

/**
 * Format AI Report as XML (AI-friendly format)
 *
 * This function orchestrates multiple section formatters.
 * Each section is handled by a dedicated helper function.
 */
export function formatAsXml(report: AIReport): string {
  const lines: string[] = [];

  lines.push('<ai-report>');
  lines.push(`  <meta version="${report.meta.version}" generated="${report.meta.generatedAt}" />`);
  lines.push('');

  // Delegate to section formatters
  lines.push(...formatXmlSummary(report.summary));
  lines.push(...formatXmlQuickWins(report.quickWins));
  lines.push(...formatXmlActionPlan(report.actionPlan));
  lines.push(...formatXmlRanking(report.ranking));
  lines.push(...formatXmlBackwardsCompat(report.backwardsCompatFiles));
  lines.push(...formatXmlRecommendations(report.recommendations));
  lines.push(...formatXmlDuplicates(report.duplicates));
  lines.push(...formatIssuePatterns(report.issuePatterns ?? []));
  lines.push(...formatIssueClusters(report.issueClusters ?? []));
  lines.push(...formatXmlReadability(report.readability));
  lines.push(...formatXmlCodeStyle(report.codeStyleRecommendations));

  lines.push('</ai-report>');

  return lines.join('\n');
}

// Re-export pattern formatters for backwards compatibility
export { formatIssueClusters, formatIssuePatterns } from './xml-patterns';
