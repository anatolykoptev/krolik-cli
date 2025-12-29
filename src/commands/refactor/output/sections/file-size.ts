/**
 * @module commands/refactor/output/sections/file-size
 * @description File size analysis section formatter
 */

import { escapeXml } from '../../../../lib/@format';
import type { EnhancedRefactorAnalysis, FileSizeIssue } from '../../core';
import { sortBySeverity } from '../helpers';

/**
 * Format a single file size issue
 */
export function formatFileSizeIssue(lines: string[], issue: FileSizeIssue, indent: string): void {
  lines.push(
    `${indent}<file path="${issue.file}" lines="${issue.lines}" split-into="${issue.suggestedSplitCount}">`,
  );
  lines.push(`${indent}  <suggestion>${escapeXml(issue.suggestion)}</suggestion>`);
  lines.push(`${indent}</file>`);
}

/**
 * Format file size analysis section
 */
export function formatFileSizeAnalysis(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { fileSizeAnalysis } = analysis;

  if (!fileSizeAnalysis || fileSizeAnalysis.issues.length === 0) {
    lines.push('  <file-size-analysis />');
    lines.push('');
    return;
  }

  const { issues, thresholds, summary, totalFiles } = fileSizeAnalysis;

  // Sort all issues by severity
  const sortedIssues = sortBySeverity(issues);

  lines.push('  <!-- OVERSIZED FILES - files that are too large and should be split -->');
  lines.push(
    `  <file-size-analysis total-files="${totalFiles}" issues="${issues.length}" critical="${summary.critical}" error="${summary.error}" warning="${summary.warning}" sorted-by="severity">`,
  );

  lines.push('    <thresholds>');
  lines.push(`      <warning lines="${thresholds.warning}" />`);
  lines.push(`      <error lines="${thresholds.error}" />`);
  lines.push(`      <critical lines="${thresholds.critical}" />`);
  lines.push('    </thresholds>');

  // Group by severity (already sorted)
  const critical = sortedIssues.filter((i) => i.severity === 'critical');
  const error = sortedIssues.filter((i) => i.severity === 'error');
  const warning = sortedIssues.filter((i) => i.severity === 'warning');

  if (critical.length > 0) {
    lines.push('    <!-- CRITICAL: Must split immediately -->');
    lines.push(`    <critical count="${critical.length}">`);
    for (const issue of critical) {
      formatFileSizeIssue(lines, issue, '      ');
    }
    lines.push('    </critical>');
  }

  if (error.length > 0) {
    lines.push('    <!-- ERROR: Should split for maintainability -->');
    lines.push(`    <error count="${error.length}">`);
    for (const issue of error.slice(0, 10)) {
      formatFileSizeIssue(lines, issue, '      ');
    }
    if (error.length > 10) {
      lines.push(`      <!-- +${error.length - 10} more error-level files -->`);
    }
    lines.push('    </error>');
  }

  if (warning.length > 0) {
    lines.push('    <!-- WARNING: Consider splitting if multiple responsibilities -->');
    lines.push(`    <warning count="${warning.length}">`);
    for (const issue of warning.slice(0, 5)) {
      formatFileSizeIssue(lines, issue, '      ');
    }
    if (warning.length > 5) {
      lines.push(`      <!-- +${warning.length - 5} more warning-level files -->`);
    }
    lines.push('    </warning>');
  }

  lines.push('  </file-size-analysis>');
  lines.push('');
}
