/**
 * @module commands/refactor/output/sections/recommendations
 * @description Recommendations section formatter with priority sorting and output limits
 */

import { escapeXml } from '../../../../lib/format';
import type { EnhancedRefactorAnalysis, Recommendation } from '../../core';
import { deduplicateRecommendations, sortByPriority } from '../helpers';
import { applyLimit, type SectionLimits } from '../limits';

// ============================================================================
// DEFAULTS
// ============================================================================

/** Default limit for affected files when no limits provided */
const DEFAULT_AFFECTED_FILES_LIMIT = 3;

/** Default limit for recommendations when no limits provided */
const DEFAULT_RECOMMENDATIONS_LIMIT = 10;

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format a single recommendation with optional limits for affected files.
 *
 * @param lines - Output lines array to append to
 * @param rec - Recommendation to format
 * @param affectedFilesLimit - Max affected files to show (default: 3)
 */
export function formatRecommendation(
  lines: string[],
  rec: Recommendation,
  affectedFilesLimit: number = DEFAULT_AFFECTED_FILES_LIMIT,
): void {
  lines.push(
    `    <recommendation id="${rec.id}" priority="${rec.priority}" category="${rec.category}">`,
  );
  lines.push(`      <title>${escapeXml(rec.title)}</title>`);
  lines.push(`      <description>${escapeXml(rec.description)}</description>`);
  lines.push(`      <effort level="${rec.effort}" />`);
  lines.push(`      <expected-improvement score-delta="+${rec.expectedImprovement}" />`);
  lines.push(`      <auto-fixable>${rec.autoFixable}</auto-fixable>`);

  if (rec.affectedFiles.length > 0) {
    const { items: files, overflow } = applyLimit(rec.affectedFiles, affectedFilesLimit);

    lines.push(`      <affected-files count="${rec.affectedFiles.length}">`);
    for (const file of files) {
      lines.push(`        <file>${file}</file>`);
    }
    if (overflow > 0) {
      lines.push(`        <!-- +${overflow} more files -->`);
    }
    lines.push('      </affected-files>');
  }

  lines.push('    </recommendation>');
}

/**
 * Format recommendations section with optional output limits.
 *
 * Deduplicates recommendations, sorts by priority, and applies limits
 * to control output size for different token budgets.
 *
 * @param lines - Output lines array to append to
 * @param analysis - Enhanced refactor analysis containing recommendations
 * @param limits - Optional section limits for controlling output size
 */
export function formatRecommendations(
  lines: string[],
  analysis: EnhancedRefactorAnalysis,
  limits?: SectionLimits,
): void {
  const { recommendations } = analysis;

  if (recommendations.length === 0) {
    lines.push('  <recommendations count="0" />');
    lines.push('');
    return;
  }

  // Deduplicate and sort by priority
  const deduplicated = deduplicateRecommendations(recommendations);
  const sorted = sortByPriority(deduplicated);

  // Apply limits (use defaults if not provided)
  const recommendationsLimit = limits?.recommendations ?? DEFAULT_RECOMMENDATIONS_LIMIT;
  const affectedFilesLimit = limits?.affectedFiles ?? DEFAULT_AFFECTED_FILES_LIMIT;

  const { items: limitedRecs, overflow } = applyLimit(sorted, recommendationsLimit);

  lines.push(
    `  <recommendations count="${sorted.length}" deduplicated="true" sorted-by="priority">`,
  );

  for (const rec of limitedRecs) {
    formatRecommendation(lines, rec, affectedFilesLimit);
  }

  if (overflow > 0) {
    lines.push(`    <!-- +${overflow} more recommendations -->`);
  }

  lines.push('  </recommendations>');
  lines.push('');
}
