/**
 * @module commands/quality/formatters/text
 * @description CLI text formatter for quality reports
 */

import type {
  QualityIssue,
  QualityOptions,
  QualityReport,
  RecommendationItem,
  SplitSuggestion,
} from '../types';

// ============================================================================
// SECTION FORMATTERS
// ============================================================================

/**
 * Format header section
 */
function formatHeader(report: QualityReport): string[] {
  return [
    '═══════════════════════════════════════════════════════════',
    '  Code Quality Report',
    '═══════════════════════════════════════════════════════════',
    '',
    `Analyzed: ${report.analyzedFiles} files`,
    `Issues: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.infos} info`,
    '',
  ];
}

/**
 * Format category breakdown
 */
function formatCategories(report: QualityReport): string[] {
  const lines: string[] = [];
  const hasCategories = Object.values(report.summary.byCategory).some((v) => v > 0);

  if (hasCategories) {
    lines.push('By Category:');
    for (const [cat, count] of Object.entries(report.summary.byCategory)) {
      if (count > 0) {
        lines.push(`  ${cat}: ${count}`);
      }
    }
    lines.push('');
  }

  return lines;
}

/**
 * Get icon for severity
 */
function getSeverityIcon(severity: QualityIssue['severity']): string {
  const icons = { error: '❌', warning: '⚠️', info: 'ℹ️' };
  return icons[severity];
}

/**
 * Format single issue
 */
function formatIssue(issue: QualityIssue): string[] {
  const lines: string[] = [];
  const icon = getSeverityIcon(issue.severity);
  const loc = issue.line ? `:${issue.line}` : '';

  lines.push(`${icon} [${issue.category}] ${issue.file}${loc}`);
  lines.push(`   ${issue.message}`);
  if (issue.suggestion) {
    lines.push(`   → ${issue.suggestion}`);
  }
  lines.push('');

  return lines;
}

/**
 * Format top issues section
 */
function formatTopIssues(issues: QualityIssue[]): string[] {
  if (issues.length === 0) return [];

  const lines: string[] = ['─── Top Issues ───────────────────────────────────────────', ''];

  for (const issue of issues) {
    lines.push(...formatIssue(issue));
  }

  return lines;
}

/**
 * Format refactoring section
 */
function formatRefactoring(items: QualityReport['needsRefactoring']): string[] {
  if (items.length === 0) return [];

  const lines: string[] = ['─── Needs Refactoring ────────────────────────────────────', ''];

  for (const item of items) {
    lines.push(`📁 ${item.file}`);
    lines.push(`   Issues: ${item.reason}`);
    for (const sug of item.suggestions.slice(0, 2)) {
      lines.push(`   → ${sug}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Get icon for recommendation severity
 */
function getRecSeverityIcon(severity: RecommendationItem['severity']): string {
  const icons = { 'best-practice': '🏆', recommendation: '💡', suggestion: '📝' };
  return icons[severity];
}

/**
 * Format split suggestions for complex functions
 */
function formatSplitSuggestions(report: QualityReport): string[] {
  // Find functions with split suggestions
  const functionsWithSuggestions: Array<{
    file: string;
    name: string;
    complexity: number;
    suggestions: SplitSuggestion[];
  }> = [];

  for (const file of report.files) {
    for (const func of file.functions) {
      if (func.splitSuggestions && func.splitSuggestions.length > 0) {
        functionsWithSuggestions.push({
          file: file.relativePath,
          name: func.name,
          complexity: func.complexity,
          suggestions: func.splitSuggestions,
        });
      }
    }
  }

  if (functionsWithSuggestions.length === 0) return [];

  const lines: string[] = ['─── Complexity Split Points ──────────────────────────────', ''];

  for (const { file, name, complexity, suggestions } of functionsWithSuggestions.slice(0, 5)) {
    lines.push(`🔧 ${file}::${name} (complexity: ${complexity})`);
    for (const sug of suggestions) {
      lines.push(`   → Extract ${sug.suggestedName}() — ${sug.reason}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Format recommendations section
 */
function formatRecommendations(recommendations: RecommendationItem[]): string[] {
  if (recommendations.length === 0) return [];

  const lines: string[] = ['─── Recommendations (Airbnb-style) ───────────────────────', ''];

  for (const rec of recommendations) {
    const icon = getRecSeverityIcon(rec.severity);
    const countStr = rec.count > 1 ? ` (${rec.count} files)` : '';
    lines.push(`${icon} [${rec.category}] ${rec.title}${countStr}`);
    lines.push(`   ${rec.description}`);
    if (rec.snippet) {
      lines.push(`   Example: ${rec.snippet}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Format footer summary
 */
function formatFooter(report: QualityReport): string[] {
  const hasIssues = report.summary.errors + report.summary.warnings > 0;
  const hasRecs = report.recommendations.length > 0;

  const lines: string[] = ['═══════════════════════════════════════════════════════════'];

  if (hasIssues) {
    lines.push(`  ⚠️  ${report.summary.errors + report.summary.warnings} issues found`);
  } else {
    lines.push('  ✅ No major issues found');
  }

  if (hasRecs) {
    lines.push(`  📋 ${report.recommendations.length} recommendations for improvement`);
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines;
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format quality report as CLI text
 */
export function formatText(report: QualityReport, options: QualityOptions): string {
  const lines: string[] = [];

  if (!options.issuesOnly) {
    lines.push(...formatHeader(report));
    lines.push(...formatCategories(report));
  }

  lines.push(...formatTopIssues(report.topIssues));

  if (!options.issuesOnly) {
    lines.push(...formatRefactoring(report.needsRefactoring));
    lines.push(...formatSplitSuggestions(report));
    lines.push(...formatRecommendations(report.recommendations));
    lines.push(...formatFooter(report));
  }

  return lines.join('\n');
}
