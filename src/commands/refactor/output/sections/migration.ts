/**
 * @module commands/refactor/output/sections/migration
 * @description Migration plan section formatter
 */

import { escapeXml } from '../../../../lib/format';
import type { EnhancedMigrationAction, EnhancedRefactorAnalysis } from '../../core';
import { deduplicateAffectedFiles, deduplicateMigrationActions, sortByOrder } from '../helpers';

/**
 * Format a single migration action
 */
export function formatMigrationAction(lines: string[], action: EnhancedMigrationAction): void {
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
    // Deduplicate affected files
    const deduplicated = deduplicateAffectedFiles(action.affectedDetails);

    lines.push(`        <affected-files count="${deduplicated.length}" deduplicated="true">`);
    for (const detail of deduplicated.slice(0, 5)) {
      lines.push(`          <file path="${detail.file}" import-count="${detail.importCount}" />`);
    }
    if (deduplicated.length > 5) {
      lines.push(`          <!-- +${deduplicated.length - 5} more files -->`);
    }
    lines.push('        </affected-files>');
  }

  lines.push('      </action>');
}

/**
 * Format migration section
 */
export function formatMigration(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { enhancedMigration } = analysis;

  lines.push(
    `  <migration files-affected="${enhancedMigration.filesAffected}" imports-to-update="${enhancedMigration.importsToUpdate}">`,
  );

  // Risk summary
  lines.push('    <risk-summary>');
  lines.push(`      <safe count="${enhancedMigration.riskSummary.safe}" />`);
  lines.push(`      <medium count="${enhancedMigration.riskSummary.medium}" />`);
  lines.push(`      <risky count="${enhancedMigration.riskSummary.risky}" />`);
  lines.push('    </risk-summary>');

  // Execution order
  lines.push('    <execution-order>');
  for (const step of enhancedMigration.executionOrder) {
    lines.push(
      `      <step number="${step.step}" action-id="${step.actionId}" can-parallelize="${step.canParallelize}" />`,
    );
  }
  lines.push('    </execution-order>');

  // Rollback points
  if (enhancedMigration.rollbackPoints.length > 0) {
    lines.push(
      `    <rollback-points>${enhancedMigration.rollbackPoints.join(', ')}</rollback-points>`,
    );
  }

  // Actions - deduplicated and sorted by order
  const deduplicated = deduplicateMigrationActions(enhancedMigration.actions);
  const sorted = sortByOrder(deduplicated);

  lines.push(`    <actions deduplicated="true" sorted-by="order">`);
  for (const action of sorted) {
    formatMigrationAction(lines, action);
  }
  lines.push('    </actions>');

  lines.push('  </migration>');
  lines.push('');
}
