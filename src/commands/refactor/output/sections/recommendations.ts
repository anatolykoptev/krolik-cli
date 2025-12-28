/**
 * @module commands/refactor/output/sections/recommendations
 * @description Recommendations section formatter with priority sorting
 */

import { escapeXml } from '../../../../lib/@formatters';
import type { EnhancedRefactorAnalysis, Recommendation } from '../../core';
import { deduplicateRecommendations, sortByPriority } from '../helpers';

/**
 * Format a single recommendation
 */
export function formatRecommendation(lines: string[], rec: Recommendation): void {
  lines.push(
    `    <recommendation id="${rec.id}" priority="${rec.priority}" category="${rec.category}">`,
  );
  lines.push(`      <title>${escapeXml(rec.title)}</title>`);
  lines.push(`      <description>${escapeXml(rec.description)}</description>`);
  lines.push(`      <effort level="${rec.effort}" />`);
  lines.push(`      <expected-improvement score-delta="+${rec.expectedImprovement}" />`);
  lines.push(`      <auto-fixable>${rec.autoFixable}</auto-fixable>`);

  if (rec.affectedFiles.length > 0) {
    lines.push(`      <affected-files count="${rec.affectedFiles.length}">`);
    for (const file of rec.affectedFiles.slice(0, 3)) {
      lines.push(`        <file>${file}</file>`);
    }
    if (rec.affectedFiles.length > 3) {
      lines.push(`        <!-- +${rec.affectedFiles.length - 3} more files -->`);
    }
    lines.push('      </affected-files>');
  }

  lines.push('    </recommendation>');
}

/**
 * Format recommendations section
 */
export function formatRecommendations(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { recommendations } = analysis;

  if (recommendations.length === 0) {
    lines.push('  <recommendations count="0" />');
    lines.push('');
    return;
  }

  // Deduplicate and sort by priority
  const deduplicated = deduplicateRecommendations(recommendations);
  const sorted = sortByPriority(deduplicated);

  lines.push(
    `  <recommendations count="${sorted.length}" deduplicated="true" sorted-by="priority">`,
  );

  for (const rec of sorted.slice(0, 10)) {
    formatRecommendation(lines, rec);
  }

  if (sorted.length > 10) {
    lines.push(`    <!-- +${sorted.length - 10} more recommendations -->`);
  }

  lines.push('  </recommendations>');
  lines.push('');
}
