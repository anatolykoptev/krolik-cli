/**
 * @module commands/refactor/output/sections/stats
 * @description Stats summary section formatter
 */

import type { EnhancedRefactorAnalysis } from '../../core';

/**
 * Format stats summary section
 *
 * @param lines - Output lines array
 * @param analysis - Enhanced refactor analysis
 * @param executionTimeMs - Optional execution time in milliseconds
 */
export function formatStats(
  lines: string[],
  analysis: EnhancedRefactorAnalysis,
  executionTimeMs?: number,
): void {
  const { structure, duplicates, archHealth, recommendations, fileSizeAnalysis } = analysis;

  lines.push('  <stats');
  lines.push(`    structure_score="${structure.score}"`);
  lines.push(`    architecture_score="${archHealth.score}"`);
  lines.push(`    duplicates_count="${duplicates.length}"`);
  lines.push(`    issues_count="${structure.issues.length}"`);
  lines.push(`    violations_count="${archHealth.violations.length}"`);
  lines.push(`    recommendations_count="${recommendations.length}"`);
  lines.push(`    migration_actions="${analysis.enhancedMigration.actions.length}"`);
  if (fileSizeAnalysis) {
    lines.push(`    oversized_files="${fileSizeAnalysis.issues.length}"`);
    lines.push(`    critical_files="${fileSizeAnalysis.summary.critical}"`);
  }
  if (executionTimeMs !== undefined) {
    lines.push(`    execution_time_ms="${executionTimeMs}"`);
  }
  lines.push('  />');
  lines.push('');
}
