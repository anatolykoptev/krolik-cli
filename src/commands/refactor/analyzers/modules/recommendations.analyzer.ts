/**
 * @module commands/refactor/analyzers/modules/recommendations.analyzer
 * @description Recommendations analyzer for registry-based architecture
 *
 * Generates prioritized recommendations from architecture, domains, and duplicates data.
 * Depends on: architecture, domains, duplicates analyzers.
 */

import type { RefactorAnalysis } from '../../core/types';
import type { ArchHealth, DomainInfo, Recommendation } from '../../core/types-ai';
import { generateRecommendations } from '../metrics/recommendations';
import type { Analyzer, AnalyzerContext, AnalyzerResult } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recommendations analysis result
 */
export interface RecommendationsAnalysis {
  /** All recommendations */
  recommendations: Recommendation[];
  /** Count by category */
  byCategory: {
    architecture: number;
    duplication: number;
    structure: number;
    naming: number;
    documentation: number;
  };
  /** Auto-fixable count */
  autoFixableCount: number;
  /** Total expected improvement */
  totalExpectedImprovement: number;
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Recommendations analyzer
 *
 * Generates prioritized recommendations based on:
 * - Architecture violations
 * - Duplicate functions
 * - Structure issues
 * - Domain coherence
 */
export const recommendationsAnalyzer: Analyzer<RecommendationsAnalysis> = {
  metadata: {
    id: 'recommendations',
    name: 'Recommendations Generator',
    description: 'Generates prioritized recommendations from analysis data',
    defaultEnabled: true,
    dependsOn: ['architecture', 'domains', 'duplicates'],
  },

  shouldRun(ctx: AnalyzerContext): boolean {
    return ctx.options.includeRecommendations !== false;
  },

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult<RecommendationsAnalysis>> {
    // Get required data from context options (set by runner after first pass)
    const archHealth = ctx.options.archHealth as ArchHealth | undefined;
    const domains = ctx.options.domains as DomainInfo[] | undefined;
    const baseAnalysis = ctx.baseAnalysis as RefactorAnalysis;

    if (!archHealth) {
      return {
        status: 'skipped',
        error: 'No architecture data available',
      };
    }

    if (!domains) {
      return {
        status: 'skipped',
        error: 'No domains data available',
      };
    }

    // Generate recommendations
    const recommendations = generateRecommendations(baseAnalysis, archHealth, domains);

    // Calculate stats
    const byCategory = {
      architecture: 0,
      duplication: 0,
      structure: 0,
      naming: 0,
      documentation: 0,
    };

    let autoFixableCount = 0;
    let totalExpectedImprovement = 0;

    for (const rec of recommendations) {
      byCategory[rec.category]++;
      if (rec.autoFixable) autoFixableCount++;
      totalExpectedImprovement += rec.expectedImprovement;
    }

    return {
      status: 'success',
      data: {
        recommendations,
        byCategory,
        autoFixableCount,
        totalExpectedImprovement,
      },
    };
  },
};
