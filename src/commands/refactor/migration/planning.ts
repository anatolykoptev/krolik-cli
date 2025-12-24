/**
 * @module commands/refactor/migration/planning
 * @description Migration plan creation from analysis results
 *
 * Creates migration plans from duplicate detection and structure analysis.
 */

import * as path from 'node:path';
import { normalizeToRelative } from '../../../lib';
import type { DuplicateInfo, MigrationAction, MigrationPlan, StructureAnalysis } from '../core';

// ============================================================================
// MIGRATION PLANNING
// ============================================================================

/**
 * Create migration plan from analysis results
 */
export function createMigrationPlan(
  duplicates: DuplicateInfo[],
  structure: StructureAnalysis,
  libPath: string,
): MigrationPlan {
  const actions: MigrationAction[] = [];

  // Plan actions for duplicates
  planDuplicateActions(duplicates, libPath, actions);

  // Plan actions for structure issues
  planStructureActions(structure, libPath, actions);

  // Plan actions for suggested groupings
  planGroupingActions(structure, libPath, actions);

  const riskSummary = calculateRiskSummary(actions);

  return {
    actions,
    filesAffected: new Set(actions.map((a) => a.source)).size,
    importsToUpdate: 0,
    riskSummary,
  };
}

// ============================================================================
// PLANNING HELPERS
// ============================================================================

/**
 * Plan actions for duplicate functions
 */
function planDuplicateActions(
  duplicates: DuplicateInfo[],
  libPath: string,
  actions: MigrationAction[],
): void {
  for (const dup of duplicates) {
    if (dup.recommendation === 'merge' && dup.locations.length >= 2) {
      const [keep, ...remove] = dup.locations;
      if (!keep) continue;

      for (const loc of remove) {
        // Normalize paths to be relative to lib
        const sourceRel = normalizeToRelative(loc.file, libPath);
        const targetRel = normalizeToRelative(keep.file, libPath);

        actions.push({
          type: 'merge',
          source: sourceRel,
          target: targetRel,
          affectedImports: [],
          risk: 'medium',
        });
      }
    }
  }
}

/**
 * Plan actions for structure issues
 */
function planStructureActions(
  structure: StructureAnalysis,
  libPath: string,
  actions: MigrationAction[],
): void {
  for (const issue of structure.issues) {
    switch (issue.type) {
      case 'double-nesting':
        for (const nested of issue.files) {
          const relativePath = normalizeToRelative(nested, libPath);
          const parts = relativePath.split('/');
          if (parts.length === 2 && parts[0] === '@utils') {
            actions.push({
              type: 'move',
              source: relativePath,
              target: parts[1] ?? relativePath,
              affectedImports: [],
              risk: 'medium',
            });
          }
        }
        break;

      case 'missing-barrel':
        for (const dir of issue.files) {
          actions.push({
            type: 'create-barrel',
            source: normalizeToRelative(dir, libPath),
            affectedImports: [],
            risk: 'safe',
          });
        }
        break;

      case 'duplicate-module':
        // Handle in separate pass
        break;
    }
  }
}

/**
 * Plan actions for suggested file groupings
 */
function planGroupingActions(
  structure: StructureAnalysis,
  libPath: string,
  actions: MigrationAction[],
): void {
  for (const { file, suggestedNamespace } of structure.ungroupedFiles) {
    const relativePath = normalizeToRelative(file, libPath);
    actions.push({
      type: 'move',
      source: relativePath,
      target: `${suggestedNamespace}/${path.basename(relativePath)}`,
      affectedImports: [],
      risk: 'medium',
    });
  }
}

/**
 * Calculate risk summary from actions
 */
function calculateRiskSummary(actions: MigrationAction[]): MigrationPlan['riskSummary'] {
  return {
    safe: actions.filter((a) => a.risk === 'safe').length,
    medium: actions.filter((a) => a.risk === 'medium').length,
    risky: actions.filter((a) => a.risk === 'risky').length,
  };
}

// ============================================================================
// PLAN UTILITIES
// ============================================================================

/**
 * Filter plan to only include safe actions
 */
export function filterSafeActions(plan: MigrationPlan): MigrationPlan {
  const safeActions = plan.actions.filter((a) => a.risk === 'safe');
  return {
    ...plan,
    actions: safeActions,
    filesAffected: new Set(safeActions.map((a) => a.source)).size,
    riskSummary: calculateRiskSummary(safeActions),
  };
}

/**
 * Sort actions by risk (safe first)
 */
export function sortByRisk(plan: MigrationPlan): MigrationPlan {
  const riskOrder = { safe: 0, medium: 1, risky: 2 };
  const sorted = [...plan.actions].sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
  return { ...plan, actions: sorted };
}
