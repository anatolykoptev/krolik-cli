/**
 * @module lib/@reporter/formatter/xml-patterns
 * @description XML pattern and cluster formatters for AI Report
 */

import { escapeXml } from '../../@core/xml/escape';
import { formatGitContextXml } from '../../@krolik/enrichment';
import type { IssueCluster, IssuePattern } from '../types';
import { formatSuggestionXml } from './shared';

// ============================================================================
// ISSUE PATTERN FORMATTER
// ============================================================================

/**
 * Format issue patterns as XML for smart audit output
 */
export function formatIssuePatterns(patterns: IssuePattern[]): string[] {
  if (patterns.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- ISSUE-GROUPS - Pattern-based issue grouping for batch operations -->');

  for (const pattern of patterns) {
    lines.push(
      `  <issue-group category="${pattern.category}" pattern="${pattern.pattern}" count="${pattern.issues.length}">`,
    );

    lines.push(`    <batch-fix available="${pattern.batchFix.available}">`);
    if (pattern.batchFix.available && pattern.batchFix.command) {
      lines.push(`      <command>${escapeXml(pattern.batchFix.command)}</command>`);
    }
    lines.push(`      <files-affected>${pattern.batchFix.filesAffected}</files-affected>`);
    lines.push(`      <auto-fixable>${pattern.batchFix.autoFixable}</auto-fixable>`);
    lines.push(`      <manual-required>${pattern.batchFix.manualRequired}</manual-required>`);
    lines.push('    </batch-fix>');

    if (pattern.byFile.length > 0) {
      lines.push('    <by-file>');
      for (const file of pattern.byFile.slice(0, 10)) {
        lines.push(
          `      <file path="${escapeXml(file.path)}" count="${file.count}" auto="${file.auto}"/>`,
        );
      }
      if (pattern.byFile.length > 10) {
        lines.push(`      <!-- ... and ${pattern.byFile.length - 10} more files -->`);
      }
      lines.push('    </by-file>');
    }

    const issuesWithSuggestions = pattern.issues.filter((i) => i.suggestion).slice(0, 3);
    if (issuesWithSuggestions.length > 0) {
      lines.push('    <sample-issues>');
      for (const enriched of issuesWithSuggestions) {
        const loc = enriched.issue.line ? `:${enriched.issue.line}` : '';
        lines.push(`      <issue file="${escapeXml(enriched.issue.file)}${loc}">`);
        lines.push(`        <description>${escapeXml(enriched.issue.message)}</description>`);
        if (enriched.suggestion) {
          lines.push(...formatSuggestionXml(enriched.suggestion, 8));
        }
        lines.push('      </issue>');
      }
      lines.push('    </sample-issues>');
    }

    lines.push('  </issue-group>');
  }

  return lines;
}

// ============================================================================
// ISSUE CLUSTER FORMATTER
// ============================================================================

/**
 * Format issue clusters as XML for smart audit output
 */
export function formatIssueClusters(clusters: IssueCluster[]): string[] {
  if (clusters.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push(
    '  <!-- ISSUE-CLUSTERS - File-level grouping for related issues (3+ same category) -->',
  );

  for (const cluster of clusters) {
    lines.push(
      `  <issue-cluster file="${escapeXml(cluster.file)}" category="${escapeXml(cluster.category)}" count="${cluster.count}">`,
    );
    lines.push(`    <root-cause>${escapeXml(cluster.rootCause)}</root-cause>`);
    lines.push(`    <fix-together>${cluster.fixTogether}</fix-together>`);
    lines.push(`    <locations>${cluster.locations.join(', ')}</locations>`);
    lines.push(
      `    <suggested-approach>${escapeXml(cluster.suggestedApproach)}</suggested-approach>`,
    );

    const firstIssueWithImpact = cluster.issues.find((i) => i.impact);
    if (firstIssueWithImpact?.impact) {
      const imp = firstIssueWithImpact.impact;
      lines.push(`    <impact dependents="${imp.dependents}" risk="${imp.riskLevel}">`);
      if (imp.dependentFiles && imp.dependentFiles.length > 0) {
        lines.push('      <top-dependents>');
        for (const file of imp.dependentFiles.slice(0, 3)) {
          lines.push(`        <file>${escapeXml(file)}</file>`);
        }
        lines.push('      </top-dependents>');
      }
      if (imp.riskReason) {
        lines.push(`      <risk-reason>${escapeXml(imp.riskReason)}</risk-reason>`);
      }
      lines.push('    </impact>');
    }

    if (cluster.issues.length > 0) {
      const sampleIssues = cluster.issues.slice(0, 3);
      lines.push('    <sample-issues>');
      for (const enriched of sampleIssues) {
        lines.push(`      <issue line="${enriched.issue.line ?? 0}">`);
        lines.push(`        <description>${escapeXml(enriched.issue.message)}</description>`);
        if (enriched.gitContext) {
          lines.push(...formatGitContextXml(enriched.gitContext, 8));
        }
        if (enriched.suggestion) {
          lines.push(...formatSuggestionXml(enriched.suggestion, 8));
        }
        lines.push('      </issue>');
      }
      if (cluster.issues.length > 3) {
        lines.push(`      <!-- ... and ${cluster.issues.length - 3} more issues -->`);
      }
      lines.push('    </sample-issues>');
    }

    lines.push('  </issue-cluster>');
  }

  return lines;
}
