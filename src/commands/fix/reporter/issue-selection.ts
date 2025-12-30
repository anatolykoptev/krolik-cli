/**
 * @module commands/fix/reporter/issue-selection
 * @description Proportional issue selection for audit reports
 */

import type { QualityIssue } from '../core';

/** Threshold for excluding i18n from main audit */
export const I18N_THRESHOLD = 100;

/**
 * Result of issue selection with i18n handling
 */
export interface IssueSelectionResult {
  issues: QualityIssue[];
  /** Number of i18n issues excluded (0 if included) */
  excludedI18nCount: number;
}

/**
 * Select issues with smart i18n handling
 *
 * If i18n issues >= 100, they are excluded from the selection
 * and only a count is returned for display in the report.
 */
export function selectIssuesWithI18nHandling(
  allIssues: QualityIssue[],
  maxIssues: number,
): IssueSelectionResult {
  const i18nIssues = allIssues.filter((i) => i.category === 'i18n');
  const otherIssues = allIssues.filter((i) => i.category !== 'i18n');

  if (i18nIssues.length < I18N_THRESHOLD) {
    return {
      issues: selectProportionalIssues(allIssues, maxIssues),
      excludedI18nCount: 0,
    };
  }

  return {
    issues: selectProportionalIssues(otherIssues, maxIssues),
    excludedI18nCount: i18nIssues.length,
  };
}

/**
 * Select issues proportionally from all categories
 * Ensures each category is represented based on its share of total issues
 */
export function selectProportionalIssues(
  allIssues: QualityIssue[],
  maxIssues: number,
): QualityIssue[] {
  if (allIssues.length <= maxIssues) {
    return allIssues;
  }

  // Group issues by category
  const byCategory = new Map<string, QualityIssue[]>();
  for (const issue of allIssues) {
    const cat = issue.category;
    const existing = byCategory.get(cat) ?? [];
    existing.push(issue);
    byCategory.set(cat, existing);
  }

  const selected: QualityIssue[] = [];
  const categories = [...byCategory.keys()];

  // First pass: allocate proportionally (at least 1 per category)
  for (const cat of categories) {
    const catIssues = byCategory.get(cat) ?? [];
    const proportion = catIssues.length / allIssues.length;
    const allocated = Math.max(1, Math.floor(proportion * maxIssues));

    // Take allocated issues (prioritize by severity)
    const sorted = [...catIssues].sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
    selected.push(...sorted.slice(0, allocated));
  }

  // Fill remaining slots
  if (selected.length < maxIssues) {
    const selectedSet = new Set(selected);
    const remaining = allIssues.filter((i) => !selectedSet.has(i));
    remaining.sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
    selected.push(...remaining.slice(0, maxIssues - selected.length));
  }

  return selected.slice(0, maxIssues);
}
