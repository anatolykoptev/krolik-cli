/**
 * @module commands/refactor/output/text
 * @description Human-readable text output formatter
 */

import type {
  RefactorAnalysis,
  MigrationPlan,
  StructureAnalysis,
} from '../core';

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format refactor analysis as human-readable text
 */
export function formatRefactorText(analysis: RefactorAnalysis): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    REFACTOR ANALYSIS');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📁 Path: ${analysis.path}`);
  lines.push(`🕐 Time: ${analysis.timestamp}`);
  lines.push('');

  // Duplicates section
  formatDuplicatesSection(lines, analysis);

  // Type duplicates section
  if (analysis.typeDuplicates && analysis.typeDuplicates.length > 0) {
    formatTypeDuplicatesSection(lines, analysis);
  }

  // Structure section
  formatStructureSection(lines, analysis);

  // Migration section
  formatMigrationSection(lines, analysis);

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ============================================================================
// SECTIONS
// ============================================================================

function formatDuplicatesSection(lines: string[], analysis: RefactorAnalysis): void {
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    DUPLICATE FUNCTIONS');
  lines.push('───────────────────────────────────────────────────────────────');

  if (analysis.duplicates.length === 0) {
    lines.push('');
    lines.push('  ✅ No duplicate functions found');
  } else {
    for (const dup of analysis.duplicates) {
      lines.push('');
      const icon =
        dup.recommendation === 'merge'
          ? '🔴'
          : dup.recommendation === 'rename'
            ? '🟡'
            : '🟢';
      lines.push(
        `  ${icon} ${dup.name} (${(dup.similarity * 100).toFixed(0)}% similar)`,
      );
      lines.push(`     Recommendation: ${dup.recommendation.toUpperCase()}`);
      for (const loc of dup.locations) {
        const exp = loc.exported ? ' [exported]' : '';
        lines.push(`     - ${loc.file}:${loc.line}${exp}`);
      }
    }
  }

  lines.push('');
}

function formatTypeDuplicatesSection(lines: string[], analysis: RefactorAnalysis): void {
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    DUPLICATE TYPES/INTERFACES');
  lines.push('───────────────────────────────────────────────────────────────');

  if (!analysis.typeDuplicates || analysis.typeDuplicates.length === 0) {
    lines.push('');
    lines.push('  ✅ No duplicate types found');
  } else {
    for (const dup of analysis.typeDuplicates) {
      lines.push('');
      const icon =
        dup.recommendation === 'merge'
          ? '🔴'
          : dup.recommendation === 'rename'
            ? '🟡'
            : '🟢';
      const kindLabel = dup.kind === 'interface' ? '[interface]' : dup.kind === 'type' ? '[type]' : '[mixed]';
      lines.push(
        `  ${icon} ${dup.name} ${kindLabel} (${(dup.similarity * 100).toFixed(0)}% similar)`,
      );
      lines.push(`     Recommendation: ${dup.recommendation.toUpperCase()}`);
      if (dup.commonFields && dup.commonFields.length > 0) {
        lines.push(`     Common fields: ${dup.commonFields.join(', ')}`);
      }
      if (dup.difference) {
        lines.push(`     Differences: ${dup.difference}`);
      }
      for (const loc of dup.locations) {
        const exp = loc.exported ? ' [exported]' : '';
        lines.push(`     - ${loc.file}:${loc.line} (${loc.name})${exp}`);
      }
    }
  }

  lines.push('');
}

function formatStructureSection(lines: string[], analysis: RefactorAnalysis): void {
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    STRUCTURE ANALYSIS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(visualizeStructure(analysis.structure));

  if (analysis.structure.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    for (const issue of analysis.structure.issues) {
      const icon =
        issue.severity === 'error'
          ? '❌'
          : issue.severity === 'warning'
            ? '⚠️ '
            : 'ℹ️ ';
      lines.push(`  ${icon} [${issue.type}] ${issue.message}`);
      if (issue.fix) {
        lines.push(`      Fix: ${issue.fix}`);
      }
    }
  }

  lines.push('');
}

function formatMigrationSection(lines: string[], analysis: RefactorAnalysis): void {
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    MIGRATION PLAN');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');

  if (analysis.migration.actions.length === 0) {
    lines.push('  ✅ No migrations needed');
  } else {
    lines.push(
      `  📦 Files affected: ${analysis.migration.filesAffected}`,
    );
    lines.push(
      `  🔗 Imports to update: ${analysis.migration.importsToUpdate}`,
    );
    lines.push('');
    lines.push('  Risk summary:');
    lines.push(`    🟢 Safe: ${analysis.migration.riskSummary.safe}`);
    lines.push(`    🟡 Medium: ${analysis.migration.riskSummary.medium}`);
    lines.push(`    🔴 Risky: ${analysis.migration.riskSummary.risky}`);
    lines.push('');
    lines.push('  Actions:');

    for (const action of analysis.migration.actions) {
      const riskIcon =
        action.risk === 'safe' ? '🟢' : action.risk === 'medium' ? '🟡' : '🔴';
      const arrow = action.target ? ` → ${action.target}` : '';
      lines.push(`    ${riskIcon} [${action.type}] ${action.source}${arrow}`);
    }
  }

  lines.push('');
}

// ============================================================================
// STRUCTURE VISUALIZATION
// ============================================================================

/**
 * Visualize structure analysis as ASCII tree
 */
export function visualizeStructure(structure: StructureAnalysis): string {
  const lines: string[] = [];

  lines.push(`  Score: ${structure.score}/100`);
  lines.push('');

  if (structure.namespacedFolders.length > 0) {
    lines.push('  📁 Namespaced folders:');
    for (const folder of structure.namespacedFolders) {
      lines.push(`     ├── ${folder}`);
    }
  }

  if (structure.flatFiles.length > 0) {
    lines.push('  📄 Flat files (should be grouped):');
    for (const file of structure.flatFiles.slice(0, 5)) {
      lines.push(`     ├── ${file}`);
    }
    if (structure.flatFiles.length > 5) {
      lines.push(`     └── ... and ${structure.flatFiles.length - 5} more`);
    }
  }

  if (structure.doubleNested.length > 0) {
    lines.push('  ⚠️  Double-nested (should be flattened):');
    for (const nested of structure.doubleNested) {
      lines.push(`     ├── ${nested}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// MIGRATION PREVIEW
// ============================================================================

/**
 * Format migration plan preview
 */
export function formatMigrationPreview(plan: MigrationPlan): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('📋 MIGRATION PREVIEW');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  if (plan.actions.length === 0) {
    lines.push('  No actions to perform.');
    return lines.join('\n');
  }

  lines.push(`  Total actions: ${plan.actions.length}`);
  lines.push(`  Files affected: ${plan.filesAffected}`);
  lines.push('');

  const byType = new Map<string, typeof plan.actions>();
  for (const action of plan.actions) {
    const existing = byType.get(action.type) ?? [];
    existing.push(action);
    byType.set(action.type, existing);
  }

  for (const [type, actions] of byType) {
    lines.push(`  📁 ${type.toUpperCase()} (${actions.length})`);
    for (const action of actions) {
      const riskIcon =
        action.risk === 'safe' ? '🟢' : action.risk === 'medium' ? '🟡' : '🔴';
      if (action.target) {
        lines.push(`     ${riskIcon} ${action.source} → ${action.target}`);
      } else {
        lines.push(`     ${riskIcon} ${action.source}`);
      }
    }
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  Run with --apply to execute these changes');
  lines.push('');

  return lines.join('\n');
}
