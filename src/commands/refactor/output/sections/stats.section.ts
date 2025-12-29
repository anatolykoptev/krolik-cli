/**
 * @module commands/refactor/output/sections/stats.section
 * @description Stats summary section for registry-based architecture
 *
 * Shows aggregated statistics from all analyzers.
 */

import type { DuplicatesAnalysis } from '../../analyzers/modules/duplicates.analyzer';
import type { RecommendationsAnalysis } from '../../analyzers/modules/recommendations.analyzer';
import type { ArchHealth, FileSizeAnalysis } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Stats summary section
 *
 * Renders aggregated statistics at the top of the output.
 * Order: 1 (first section)
 */
export const statsSection: Section = {
  metadata: {
    id: 'stats',
    name: 'Summary Statistics',
    description: 'Shows aggregated statistics from all analyzers',
    order: 1, // First section
    requires: [],
    showWhen: 'always',
  },

  shouldRender(): boolean {
    return true; // Always render stats
  },

  render(lines: string[], ctx: SectionContext): void {
    // Gather data from all analyzers
    const archResult = ctx.results.get('architecture');
    const duplicatesResult = ctx.results.get('duplicates');
    const fileSizeResult = ctx.results.get('file-size');
    const recommendationsResult = ctx.results.get('recommendations');
    const migrationResult = ctx.results.get('migration');

    const archHealth = archResult?.data as ArchHealth | undefined;
    const duplicates = duplicatesResult?.data as DuplicatesAnalysis | undefined;
    const fileSize = fileSizeResult?.data as FileSizeAnalysis | undefined;
    const recommendations = recommendationsResult?.data as RecommendationsAnalysis | undefined;
    const migration = migrationResult?.data as { actions: unknown[] } | undefined;

    lines.push('  <!-- STATS - Summary of analysis results -->');
    lines.push('  <stats');

    // Architecture score
    if (archHealth) {
      lines.push(`    architecture-score="${archHealth.score}"`);
      lines.push(`    violations="${archHealth.violations.length}"`);
    }

    // Duplicates
    if (duplicates) {
      lines.push(`    duplicates="${duplicates.totalCount}"`);
      lines.push(`    function-duplicates="${duplicates.functions.length}"`);
      lines.push(`    type-duplicates="${duplicates.types.length}"`);
    }

    // File size
    if (fileSize) {
      lines.push(`    oversized-files="${fileSize.issues.length}"`);
      lines.push(`    critical-files="${fileSize.summary.critical}"`);
    }

    // Recommendations
    if (recommendations) {
      lines.push(`    recommendations="${recommendations.recommendations.length}"`);
      lines.push(`    auto-fixable="${recommendations.autoFixableCount}"`);
    }

    // Migration
    if (migration) {
      lines.push(`    migration-actions="${migration.actions.length}"`);
    }

    // Analyzer status summary
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const result of ctx.results.values()) {
      switch (result.status) {
        case 'success':
          successCount++;
          break;
        case 'skipped':
          skippedCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    }

    lines.push(`    analyzers-success="${successCount}"`);
    lines.push(`    analyzers-skipped="${skippedCount}"`);
    lines.push(`    analyzers-error="${errorCount}"`);

    lines.push('  />');
    lines.push('');
  },
};
