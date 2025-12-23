/**
 * @module commands/quality/formatters/ai
 * @description AI-optimized formatter with concrete fixes and file context
 *
 * This formatter provides AI assistants with:
 * - Concrete before/after code fixes
 * - File purpose and dependencies
 * - Priority ordering for what to fix first
 * - Effort estimates for each fix
 */

import type { QualityReport } from '../types';
import { transformToAIFormat, formatAIReport } from '../ai-format';
import { escapeXml } from '@/lib';

/**
 * Format quality report as AI-optimized XML
 *
 * Enhanced format with:
 * - Concrete fixes (before/after code)
 * - File context (purpose, exports, imports)
 * - Effort estimates (trivial, small, medium, large)
 * - Priority list (what to fix first)
 */
export function formatAI(report: QualityReport, fileContents?: Map<string, string>): string {
  // If no file contents provided, create empty map
  const contents = fileContents ?? new Map<string, string>();

  // Transform to AI-optimized format
  const aiReport = transformToAIFormat(report, contents);

  // Format as structured XML
  return formatAIReport(aiReport);
}

/**
 * Legacy simple format (kept for backward compatibility)
 */
export function formatAISimple(report: QualityReport): string {
  const lines: string[] = ['<quality-report>'];

  // Summary
  lines.push(`  <summary files="${report.analyzedFiles}" errors="${report.summary.errors}" warnings="${report.summary.warnings}">`);
  for (const [cat, count] of Object.entries(report.summary.byCategory)) {
    if (count > 0) {
      lines.push(`    <category name="${cat}">${count}</category>`);
    }
  }
  lines.push('  </summary>');

  // Issues grouped by category
  const byCategory = new Map<string, typeof report.topIssues>();
  for (const issue of report.topIssues) {
    const categoryIssues = byCategory.get(issue.category) ?? [];
    categoryIssues.push(issue);
    byCategory.set(issue.category, categoryIssues);
  }

  for (const [category, issues] of byCategory) {
    lines.push(`  <issues category="${category}">`);
    for (const issue of issues) {
      const loc = issue.line ? ` line="${issue.line}"` : '';
      lines.push(`    <issue severity="${issue.severity}" file="${issue.file}"${loc}>`);
      lines.push(`      <message>${escapeXml(issue.message)}</message>`);
      if (issue.suggestion) {
        lines.push(`      <suggestion>${escapeXml(issue.suggestion)}</suggestion>`);
      }
      lines.push('    </issue>');
    }
    lines.push('  </issues>');
  }

  // Refactoring needed
  if (report.needsRefactoring.length > 0) {
    lines.push('  <refactoring-needed>');
    for (const item of report.needsRefactoring) {
      lines.push(`    <file path="${item.file}">`);
      for (const sug of item.suggestions) {
        lines.push(`      <action>${escapeXml(sug)}</action>`);
      }
      lines.push('    </file>');
    }
    lines.push('  </refactoring-needed>');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('  <recommendations>');
    for (const rec of report.recommendations) {
      lines.push(`    <recommendation id="${rec.id}" severity="${rec.severity}" count="${rec.count}">`);
      lines.push(`      <title>${escapeXml(rec.title)}</title>`);
      lines.push(`      <description>${escapeXml(rec.description)}</description>`);
      lines.push('    </recommendation>');
    }
    lines.push('  </recommendations>');
  }

  lines.push('</quality-report>');
  return lines.join('\n');
}

// escapeXml imported from lib/formatters
