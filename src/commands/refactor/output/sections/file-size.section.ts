/**
 * @module commands/refactor/output/sections/file-size.section
 * @description File size analysis section for the registry-based architecture
 *
 * Shows oversized files that should be split for maintainability.
 * Groups issues by severity (critical, error, warning) with appropriate limits.
 */

import { escapeXml } from '../../../../lib/@format';
import type { FileSizeAnalysis, FileSizeIssue } from '../../core';
import { sortBySeverity } from '../helpers';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a single file size issue as XML
 */
function formatFileSizeIssue(lines: string[], issue: FileSizeIssue, indent: string): void {
  lines.push(
    `${indent}<file path="${issue.file}" lines="${issue.lines}" split-into="${issue.suggestedSplitCount}">`,
  );
  lines.push(`${indent}  <suggestion>${escapeXml(issue.suggestion)}</suggestion>`);
  lines.push(`${indent}</file>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * File size analysis section
 *
 * Renders information about oversized files that should be split.
 * Groups issues by severity and applies appropriate limits per group:
 * - critical: all shown
 * - error: first 10
 * - warning: first 5
 */
export const fileSizeSection: Section = {
  metadata: {
    id: 'file-size',
    name: 'File Size Analysis',
    description: 'Shows oversized files that should be split',
    order: 90, // Near the end
    requires: ['file-size'], // Requires file-size analyzer
    showWhen: 'always', // Always show, even if no issues (shows "healthy" status)
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('file-size');
    // Show if analyzer ran (success or error)
    // Skip only if analyzer was skipped
    return result?.status !== 'skipped';
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('file-size');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <file-size-analysis status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </file-size-analysis>');
      lines.push('');
      return;
    }

    const data = result?.data as FileSizeAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <file-size-analysis status="no-data" />');
      lines.push('');
      return;
    }

    // Handle no issues - show healthy status
    if (data.issues.length === 0) {
      lines.push('  <!-- File size analysis: all files within limits -->');
      lines.push(
        `  <file-size-analysis total-files="${data.totalFiles}" issues="0" status="healthy" />`,
      );
      lines.push('');
      return;
    }

    // Normal rendering with issues
    const { issues, thresholds, summary, totalFiles } = data;

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
  },
};
