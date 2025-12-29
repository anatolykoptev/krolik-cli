/**
 * @module commands/refactor/output/sections/migration.section
 * @description Migration section for registry-based architecture
 *
 * Shows enhanced migration plan with ordering and dependencies.
 */

import { escapeXml } from '../../../../lib/@format';
import type { EnhancedMigrationAction, EnhancedMigrationPlan } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a migration action as XML
 */
function formatMigrationAction(
  lines: string[],
  action: EnhancedMigrationAction,
  affectedFilesLimit: number,
): void {
  lines.push(
    `      <action id="${action.id}" type="${action.type}" risk="${action.risk}" order="${action.order}">`,
  );
  lines.push(`        <source>${escapeXml(action.source)}</source>`);

  if (action.target) {
    lines.push(`        <target>${escapeXml(action.target)}</target>`);
  }

  lines.push(`        <reason>${escapeXml(action.reason)}</reason>`);

  if (action.prerequisite.length > 0) {
    lines.push(`        <prerequisite>${action.prerequisite.join(', ')}</prerequisite>`);
  }

  if (action.affectedDetails.length > 0) {
    const limited = action.affectedDetails.slice(0, affectedFilesLimit);
    const overflow = action.affectedDetails.length - limited.length;

    lines.push(`        <affected-files count="${action.affectedDetails.length}">`);
    for (const detail of limited) {
      lines.push(
        `          <file path="${escapeXml(detail.file)}" import-count="${detail.importCount}" />`,
      );
    }
    if (overflow > 0) {
      lines.push(`          <!-- +${overflow} more files -->`);
    }
    lines.push('        </affected-files>');
  }

  lines.push('      </action>');
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Migration section
 *
 * Renders enhanced migration plan with:
 * - Risk summary
 * - Execution order
 * - Rollback points
 * - Actions with prerequisites
 *
 * Order: 70 (after recommendations)
 */
export const migrationSection: Section = {
  metadata: {
    id: 'migration',
    name: 'Migration Plan',
    description: 'Shows enhanced migration plan with ordering',
    order: 70, // After recommendations
    requires: ['migration'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('migration');
    return result?.status === 'success' && result.data != null;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('migration');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <migration status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </migration>');
      lines.push('');
      return;
    }

    const data = result?.data as EnhancedMigrationPlan | undefined;

    // Handle no data
    if (!data || data.actions.length === 0) {
      lines.push('  <migration files-affected="0" actions="0" status="none" />');
      lines.push('');
      return;
    }

    // Get limits
    const maxActions = ctx.limits.migrationActions ?? Infinity;
    const affectedFilesLimit = ctx.limits.affectedFiles ?? 5;
    const collapseRollback = ctx.limits.collapseRollbackPoints ?? false;

    lines.push('  <!-- MIGRATION - Enhanced migration plan with ordering -->');
    lines.push(
      `  <migration files-affected="${data.filesAffected}" imports-to-update="${data.importsToUpdate}">`,
    );

    // Risk summary
    lines.push('    <risk-summary>');
    lines.push(`      <safe count="${data.riskSummary.safe}" />`);
    lines.push(`      <medium count="${data.riskSummary.medium}" />`);
    lines.push(`      <risky count="${data.riskSummary.risky}" />`);
    lines.push('    </risk-summary>');

    // Execution order
    lines.push('    <execution-order>');
    for (const step of data.executionOrder) {
      lines.push(
        `      <step number="${step.step}" action-id="${step.actionId}" can-parallelize="${step.canParallelize}" />`,
      );
    }
    lines.push('    </execution-order>');

    // Rollback points
    if (data.rollbackPoints.length > 0) {
      if (collapseRollback) {
        lines.push(`    <rollback-points count="${data.rollbackPoints.length}" />`);
      } else {
        lines.push(`    <rollback-points>${data.rollbackPoints.join(', ')}</rollback-points>`);
      }
    }

    // Actions
    const sorted = [...data.actions].sort((a, b) => a.order - b.order);
    const limited = sorted.slice(0, maxActions);
    const overflow = sorted.length - limited.length;

    lines.push('    <actions>');
    for (const action of limited) {
      formatMigrationAction(lines, action, affectedFilesLimit);
    }
    if (overflow > 0) {
      lines.push(`      <!-- +${overflow} more actions -->`);
    }
    lines.push('    </actions>');

    lines.push('  </migration>');
    lines.push('');
  },
};
