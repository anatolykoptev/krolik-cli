/**
 * @module commands/refactor/output/sections/recommendations.section
 * @description Recommendations section for registry-based architecture
 *
 * Shows prioritized recommendations from the recommendations analyzer.
 */

import { escapeXml } from '../../../../lib/@format';
import type { RecommendationsAnalysis } from '../../analyzers/modules/recommendations.analyzer';
import type { Recommendation } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a single recommendation as XML
 */
function formatRecommendation(
  lines: string[],
  rec: Recommendation,
  affectedFilesLimit: number,
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
    const limitedFiles = rec.affectedFiles.slice(0, affectedFilesLimit);
    const overflow = rec.affectedFiles.length - limitedFiles.length;

    lines.push(`      <affected-files count="${rec.affectedFiles.length}">`);
    for (const file of limitedFiles) {
      lines.push(`        <file>${escapeXml(file)}</file>`);
    }
    if (overflow > 0) {
      lines.push(`        <!-- +${overflow} more files -->`);
    }
    lines.push('      </affected-files>');
  }

  lines.push('    </recommendation>');
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Recommendations section
 *
 * Renders prioritized recommendations for codebase improvements.
 * Order: 60 (after domains)
 */
export const recommendationsSection: Section = {
  metadata: {
    id: 'recommendations',
    name: 'Recommendations',
    description: 'Shows prioritized recommendations for improvements',
    order: 60, // After domains
    requires: ['recommendations'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('recommendations');
    return result?.status === 'success' && result.data != null;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('recommendations');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <recommendations status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </recommendations>');
      lines.push('');
      return;
    }

    const data = result?.data as RecommendationsAnalysis | undefined;

    // Handle no data
    if (!data || data.recommendations.length === 0) {
      lines.push('  <recommendations count="0" status="none" />');
      lines.push('');
      return;
    }

    // Get limits
    const recommendationsLimit = ctx.limits.recommendations ?? 10;
    const affectedFilesLimit = ctx.limits.affectedFiles ?? 3;

    // Sort by priority and limit
    const sorted = [...data.recommendations].sort((a, b) => a.priority - b.priority);
    const limited = sorted.slice(0, recommendationsLimit);
    const overflow = sorted.length - limited.length;

    lines.push('  <!-- RECOMMENDATIONS - Prioritized improvements -->');
    lines.push(
      `  <recommendations count="${data.recommendations.length}" auto-fixable="${data.autoFixableCount}" total-improvement="+${data.totalExpectedImprovement}">`,
    );

    for (const rec of limited) {
      formatRecommendation(lines, rec, affectedFilesLimit);
    }

    if (overflow > 0) {
      lines.push(`    <!-- +${overflow} more recommendations -->`);
    }

    lines.push('  </recommendations>');
    lines.push('');
  },
};
