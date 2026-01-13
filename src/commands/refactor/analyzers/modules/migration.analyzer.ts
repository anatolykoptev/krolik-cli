/**
 * @module commands/refactor/analyzers/modules/migration.analyzer
 * @description Migration analyzer for registry-based architecture
 *
 * Creates enhanced migration plan with ordering and dependencies.
 * Depends on: architecture analyzer.
 */

import type { RefactorAnalysis } from '../../core/types';
import type { ArchHealth, EnhancedMigrationPlan } from '../../core/types-ai';
import { createEnhancedMigrationPlan } from '../enhanced';
import type { Analyzer, AnalyzerContext, AnalyzerResult } from '../registry';

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
