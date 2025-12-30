/**
 * @module commands/fix/reporter/summary
 * @description Report summary calculation
 */

import { aggregateEffort } from './effort';
import type { EffortLevel, EnrichedIssue, PriorityLevel, ReportSummary } from './types';

/**
 * Calculate report summary from enriched issues
 */
export function calculateSummary(enrichedIssues: EnrichedIssue[]): ReportSummary {
  const autoFixableIssues = enrichedIssues.filter((i) => i.autoFixable).length;
  const efforts = enrichedIssues.map((i) => i.effort);
  const totalEffort = aggregateEffort(efforts);

  // Count by priority
  const byPriority: Record<PriorityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const issue of enrichedIssues) {
    byPriority[issue.priority]++;
  }

  // Count by category
  const byCategory: Record<string, number> = {};
  for (const issue of enrichedIssues) {
    const cat = issue.issue.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  // Count by effort
  const byEffort: Record<EffortLevel, number> = {
    trivial: 0,
    small: 0,
    medium: 0,
    large: 0,
    complex: 0,
  };
  for (const issue of enrichedIssues) {
    byEffort[issue.effort.level]++;
  }

  return {
    totalIssues: enrichedIssues.length,
    autoFixableIssues,
    manualIssues: enrichedIssues.length - autoFixableIssues,
    totalEffortMinutes: totalEffort.minutes,
    totalEffortLabel: totalEffort.timeLabel,
    byPriority,
    byCategory,
    byEffort,
  };
}
