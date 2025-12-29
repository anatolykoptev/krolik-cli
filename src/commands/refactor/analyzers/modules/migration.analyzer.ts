/**
 * @module commands/refactor/analyzers/modules/migration.analyzer
 * @description Migration analyzer for registry-based architecture
 *
 * Creates enhanced migration plan with ordering and dependencies.
 * Depends on: architecture analyzer.
 */

import type {
  ArchHealth,
  EnhancedMigrationAction,
  EnhancedMigrationPlan,
  MigrationPlan,
  RefactorAnalysis,
} from '../../core';
import type { Analyzer, AnalyzerContext, AnalyzerResult } from '../registry';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create enhanced migration plan with ordering and dependencies
 */
function createEnhancedMigrationPlan(
  basePlan: MigrationPlan,
  _archHealth: ArchHealth,
): EnhancedMigrationPlan {
  const enhancedActions: EnhancedMigrationAction[] = [];
  const executionOrder: EnhancedMigrationPlan['executionOrder'] = [];
  const rollbackPoints: string[] = [];

  let order = 1;

  // First: create-barrel actions (safe, can be rolled back)
  for (const action of basePlan.actions.filter((a) => a.type === 'create-barrel')) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: [],
      reason: 'Create barrel export for clean imports',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: true });
    rollbackPoints.push(`after-${id}`);
    order++;
  }

  // Second: move actions (need import updates)
  const moveActions = basePlan.actions.filter((a) => a.type === 'move');
  for (const action of moveActions) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: [],
      reason: action.target
        ? `Move to correct namespace (${action.target})`
        : 'Reorganize file location',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: false });
    order++;
  }

  // Third: merge actions (depend on moves)
  const mergeActions = basePlan.actions.filter((a) => a.type === 'merge');
  const moveIds = enhancedActions.filter((a) => a.type === 'move').map((a) => a.id);
  for (const action of mergeActions) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: moveIds.length > 0 ? [moveIds[moveIds.length - 1]!] : [],
      reason: 'Consolidate duplicate functions',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: false });
    rollbackPoints.push(`after-${id}`);
    order++;
  }

  // Fourth: delete actions (last, depend on merges)
  for (const action of basePlan.actions.filter((a) => a.type === 'delete')) {
    const id = `act-${order}`;
    const mergeIds = enhancedActions.filter((a) => a.type === 'merge').map((a) => a.id);
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: mergeIds,
      reason: 'Remove duplicate after consolidation',
      affectedDetails: [],
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: true });
    order++;
  }

  return {
    ...basePlan,
    actions: enhancedActions,
    executionOrder,
    rollbackPoints,
  };
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Migration analyzer
 *
 * Creates enhanced migration plan with:
 * - Action ordering
 * - Prerequisites
 * - Rollback points
 * - Affected file details
 */
export const migrationAnalyzer: Analyzer<EnhancedMigrationPlan> = {
  metadata: {
    id: 'migration',
    name: 'Enhanced Migration',
    description: 'Creates enhanced migration plan with ordering and dependencies',
    defaultEnabled: true,
    dependsOn: ['architecture'],
  },

  shouldRun(ctx: AnalyzerContext): boolean {
    return ctx.options.includeMigration !== false;
  },

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult<EnhancedMigrationPlan>> {
    const baseAnalysis = ctx.baseAnalysis as RefactorAnalysis;
    const archHealth = ctx.options.archHealth as ArchHealth | undefined;

    if (!baseAnalysis.migration || baseAnalysis.migration.actions.length === 0) {
      return {
        status: 'success',
        data: {
          filesAffected: 0,
          importsToUpdate: 0,
          actions: [],
          riskSummary: { safe: 0, medium: 0, risky: 0 },
          executionOrder: [],
          rollbackPoints: [],
        },
      };
    }

    if (!archHealth) {
      // Return basic plan without enhancements
      const basicPlan: EnhancedMigrationPlan = {
        ...baseAnalysis.migration,
        actions: baseAnalysis.migration.actions.map((a, i) => ({
          ...a,
          id: `act-${i + 1}`,
          order: i + 1,
          prerequisite: [],
          reason: 'Migration action',
          affectedDetails: a.affectedImports.map((f) => ({ file: f, importCount: 1 })),
        })),
        executionOrder: baseAnalysis.migration.actions.map((_, i) => ({
          step: i + 1,
          actionId: `act-${i + 1}`,
          canParallelize: false,
        })),
        rollbackPoints: [],
      };
      return { status: 'success', data: basicPlan };
    }

    // Create enhanced plan
    const enhancedPlan = createEnhancedMigrationPlan(baseAnalysis.migration, archHealth);

    return {
      status: 'success',
      data: enhancedPlan,
    };
  },
};
