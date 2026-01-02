/**
 * @module commands/audit/output/progressive
 * @description Progressive disclosure output for audit reports
 *
 * 3-level output with token budgets:
 * - Level 1 (summary): Executive summary only (~50 tokens)
 * - Level 2 (default): Executive summary + top issues (~500 tokens)
 * - Level 3 (full): Complete report (all issues)
 *
 * Uses @format/xml for type-safe XML building and optimization.
 * Uses @tokens for token counting and budget fitting.
 */

import { buildElement, optimizeXml, type XmlElement } from '../../../lib/@format';
import { countTokens, fitToBudget } from '../../../lib/@tokens';
import { normalizePath } from '../../fix/reporter/grouping';
import type { AIReport, EnrichedIssue, IssueGroup, PriorityLevel } from '../../fix/reporter/types';
import { buildExecutiveSummaryElement } from './executive-summary';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Output level determines how much detail is shown
 */
export type OutputLevel = 'summary' | 'default' | 'full';

/**
 * Level configuration with token budgets
 */
export interface OutputLevelConfig {
  level: 1 | 2 | 3;
  tokenBudget: number;
  sections: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Output level configurations
 */
export const OUTPUT_LEVELS: Record<OutputLevel, OutputLevelConfig> = {
  summary: {
    level: 1,
    tokenBudget: 50,
    sections: ['executive-summary'],
  },
  default: {
    level: 2,
    tokenBudget: 500,
    sections: ['executive-summary', 'top-issues'],
  },
  full: {
    level: 3,
    tokenBudget: 5000,
    sections: ['executive-summary', 'top-issues', 'full-report'],
  },
};

/**
 * Maximum issues to show in top-issues section
 */
const MAX_TOP_ISSUES = 10;

/**
 * Maximum issues per group in top-issues
 */
const MAX_ISSUES_PER_GROUP = 3;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Format audit report with progressive disclosure
 *
 * @param report - The AI report to format
 * @param level - Output level (summary, default, full)
 * @param previousScore - Optional previous score for trend
 * @returns Formatted XML string within token budget
 *
 * @example
 * const output = formatProgressiveOutput(report, 'default');
 * console.log(output); // ~500 tokens
 */
export function formatProgressiveOutput(
  report: AIReport,
  level: OutputLevel = 'default',
  previousScore?: number,
): string {
  const config = OUTPUT_LEVELS[level];

  // Build audit element with children based on level
  const children: XmlElement[] = [buildExecutiveSummaryElement(report, previousScore)];

  // Level 2+: Include top issues
  if (config.level >= 2) {
    children.push(buildTopIssuesElement(report));
  }

  // Level 3: Include full report reference
  if (config.level >= 3) {
    children.push(buildFullReportElement(report));
  }

  const auditElement: XmlElement = {
    tag: 'audit',
    content: children,
  };

  // Build and optimize XML
  let output = buildElement(auditElement);

  // Apply optimization for token reduction
  if (level !== 'summary') {
    const optimizationLevel = level === 'full' ? 'compact' : 'semantic';
    output = optimizeXml(output, { level: optimizationLevel }).output;
  }

  // For non-full levels, ensure we stay within budget
  if (level !== 'full') {
    return trimToTokenBudget(output, config.tokenBudget);
  }

  return output;
}

/**
 * Get current token count for an output
 */
export function getOutputTokenCount(output: string): number {
  return countTokens(output);
}

// ============================================================================
// ELEMENT BUILDERS
// ============================================================================

/**
 * Build top-issues element with issue groups
 */
function buildTopIssuesElement(report: AIReport): XmlElement {
  const sortedGroups = [...report.groups].sort(
    (a, b) => priorityOrder(a.priority) - priorityOrder(b.priority),
  );

  const groupElements: XmlElement[] = [];
  let issueCount = 0;

  for (const group of sortedGroups) {
    if (issueCount >= MAX_TOP_ISSUES) break;

    const groupIssues = Math.min(
      group.issues.length,
      MAX_ISSUES_PER_GROUP,
      MAX_TOP_ISSUES - issueCount,
    );

    groupElements.push(buildIssueGroupElement(group, groupIssues));
    issueCount += groupIssues;
  }

  return {
    tag: 'top-issues',
    attrs: { count: groupElements.length },
    content: groupElements,
  };
}

/**
 * Build a single issue group element
 */
function buildIssueGroupElement(group: IssueGroup, maxIssues: number): XmlElement {
  const hasBatch = group.autoFixableCount > 0;

  const issueElements: XmlElement[] = group.issues
    .slice(0, maxIssues)
    .map((enriched) => buildIssueElement(enriched));

  // Add "more" indicator if there are remaining issues
  if (group.count > maxIssues) {
    issueElements.push({
      tag: 'more',
      attrs: { count: group.count - maxIssues },
    });
  }

  return {
    tag: 'issue-group',
    attrs: {
      category: group.category,
      priority: group.priority,
      count: group.count,
      ...(hasBatch && { batch: true }),
    },
    content: issueElements,
  };
}

/**
 * Build a single issue element
 */
function buildIssueElement(enriched: EnrichedIssue): XmlElement {
  const { issue, effort } = enriched;
  const path = normalizePath(issue.file);
  const loc = issue.line ? `:${issue.line}` : '';

  return {
    tag: 'issue',
    attrs: {
      file: `${path}${loc}`,
      effort: effort.timeLabel,
    },
    content: issue.message,
  };
}

/**
 * Build full report reference element
 */
function buildFullReportElement(report: AIReport): XmlElement {
  return {
    tag: 'full-report',
    attrs: { file: '.krolik/AUDIT.xml' },
    content: [
      { tag: 'total-issues', content: String(report.summary.totalIssues) },
      { tag: 'auto-fixable', content: String(report.summary.autoFixableIssues) },
      { tag: 'hint', content: 'Full details available in .krolik/AUDIT.xml' },
    ],
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get sort order for priority (lower = higher priority)
 */
function priorityOrder(priority: PriorityLevel): number {
  const order: Record<PriorityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority];
}

/**
 * Trim output to fit within token budget
 * Uses fitToBudget for optimal trimming
 */
function trimToTokenBudget(output: string, maxTokens: number): string {
  const currentTokens = countTokens(output);

  if (currentTokens <= maxTokens) {
    return output;
  }

  // Split into lines and fit to budget
  const lines = output.split('\n');
  const result = fitToBudget(lines, (subset) => subset.join('\n'), maxTokens);

  // Ensure we have proper XML closing
  let trimmedOutput = result.output;

  if (!trimmedOutput.includes('</audit>')) {
    trimmedOutput += '\n</audit>';
  }

  return trimmedOutput;
}

/**
 * Validate output is within token budget
 */
export function validateTokenBudget(output: string, level: OutputLevel): boolean {
  const config = OUTPUT_LEVELS[level];
  const tokens = countTokens(output);
  return tokens <= config.tokenBudget;
}
