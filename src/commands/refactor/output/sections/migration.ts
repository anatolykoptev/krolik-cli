/**
 * @module commands/refactor/output/sections/migration
 * @description Migration plan section formatter with output limit support
 *
 * Supports configurable limits for:
 * - Number of migration actions displayed
 * - Affected files per action
 * - Rollback point display mode (full list vs collapsed count)
 */

import { escapeXml } from '../../../../lib/format';
import type { EnhancedMigrationAction, EnhancedRefactorAnalysis } from '../../core';
import { deduplicateAffectedFiles, deduplicateMigrationActions, sortByOrder } from '../helpers';
import { applyLimit, type SectionLimits } from '../limits';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for formatting migration output
 */
export interface MigrationFormatOptions {
  /** Maximum number of actions to display (default: unlimited) */
  maxActions: number;
  /** Maximum affected files per action (default: 5) */
  affectedFiles: number;
  /** Collapse rollback points to count only (default: false) */
  collapseRollbackPoints: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get default format options (unlimited output)
 */
function getDefaultOptions(): MigrationFormatOptions {
  return {
    maxActions: Infinity,
    affectedFiles: 5,
    collapseRollbackPoints: false,
  };
}

/**
 * Convert SectionLimits to MigrationFormatOptions
 */
function limitsToOptions(limits: SectionLimits): MigrationFormatOptions {
  return {
    maxActions: limits.migrationActions,
    affectedFiles: limits.affectedFiles,
    collapseRollbackPoints: limits.collapseRollbackPoints,
  };
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format a single migration action
 *
 * @param lines - Output lines array to append to
 * @param action - Migration action to format
 * @param affectedFilesLimit - Maximum affected files to display (default: 5)
 */
export function formatMigrationAction(
  lines: string[],
  action: EnhancedMigrationAction,
  affectedFilesLimit = 5,
): void {
  lines.push(
    `      <action id="${action.id}" type="${action.type}" risk="${action.risk}" order="${action.order}">`,
  );
  lines.push(`        <source>${action.source}</source>`);
  if (action.target) {
    lines.push(`        <target>${action.target}</target>`);
  }
  lines.push(`        <reason>${escapeXml(action.reason)}</reason>`);

  if (action.prerequisite.length > 0) {
    lines.push(`        <prerequisite>${action.prerequisite.join(', ')}</prerequisite>`);
  }

  if (action.affectedDetails.length > 0) {
    // Deduplicate affected files and apply limit
    const deduplicated = deduplicateAffectedFiles(action.affectedDetails);
    const { items: limitedFiles, overflow } = applyLimit(deduplicated, affectedFilesLimit);

    lines.push(`        <affected-files count="${deduplicated.length}" deduplicated="true">`);
    for (const detail of limitedFiles) {
      lines.push(`          <file path="${detail.file}" import-count="${detail.importCount}" />`);
    }
    if (overflow > 0) {
      lines.push(`          <!-- +${overflow} more files -->`);
    }
    lines.push('        </affected-files>');
  }

  lines.push('      </action>');
}

/**
 * Format migration section with optional output limits
 *
 * @param lines - Output lines array to append to
 * @param analysis - Enhanced refactor analysis containing migration data
 * @param limits - Optional section limits for controlling output size
 *
 * @example
 * ```typescript
 * // Without limits (full output)
 * formatMigration(lines, analysis);
 *
 * // With limits (controlled output)
 * formatMigration(lines, analysis, getLimits('standard'));
 * ```
 */
export function formatMigration(
  lines: string[],
  analysis: EnhancedRefactorAnalysis,
  limits?: SectionLimits,
): void {
  const { enhancedMigration } = analysis;
  const options = limits ? limitsToOptions(limits) : getDefaultOptions();

  lines.push(
    `  <migration files-affected="${enhancedMigration.filesAffected}" imports-to-update="${enhancedMigration.importsToUpdate}">`,
  );

  // Risk summary (always included - small footprint)
  lines.push('    <risk-summary>');
  lines.push(`      <safe count="${enhancedMigration.riskSummary.safe}" />`);
  lines.push(`      <medium count="${enhancedMigration.riskSummary.medium}" />`);
  lines.push(`      <risky count="${enhancedMigration.riskSummary.risky}" />`);
  lines.push('    </risk-summary>');

  // Execution order (always included - provides critical ordering info)
  lines.push('    <execution-order>');
  for (const step of enhancedMigration.executionOrder) {
    lines.push(
      `      <step number="${step.step}" action-id="${step.actionId}" can-parallelize="${step.canParallelize}" />`,
    );
  }
  lines.push('    </execution-order>');

  // Rollback points - optionally collapsed to count only
  if (enhancedMigration.rollbackPoints.length > 0) {
    if (options.collapseRollbackPoints) {
      lines.push(`    <rollback-points count="${enhancedMigration.rollbackPoints.length}" />`);
    } else {
      lines.push(
        `    <rollback-points>${enhancedMigration.rollbackPoints.join(', ')}</rollback-points>`,
      );
    }
  }

  // Actions - deduplicated, sorted, and limited
  const deduplicated = deduplicateMigrationActions(enhancedMigration.actions);
  const sorted = sortByOrder(deduplicated);
  const { items: limitedActions, overflow: actionsOverflow } = applyLimit(
    sorted,
    options.maxActions,
  );

  lines.push(`    <actions deduplicated="true" sorted-by="order">`);
  for (const action of limitedActions) {
    formatMigrationAction(lines, action, options.affectedFiles);
  }
  if (actionsOverflow > 0) {
    lines.push(`      <!-- +${actionsOverflow} more actions -->`);
  }
  lines.push('    </actions>');

  lines.push('  </migration>');
  lines.push('');
}
