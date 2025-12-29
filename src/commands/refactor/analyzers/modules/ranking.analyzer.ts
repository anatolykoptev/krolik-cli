/**
 * @module commands/refactor/analyzers/modules/ranking.analyzer
 * @description Ranking Analyzer for the registry-based architecture
 *
 * Performs PageRank-based dependency analysis to identify hotspots,
 * calculate coupling metrics, and generate safe refactoring order.
 *
 * Analysis includes:
 * - PageRank scores for module centrality
 * - Dependency hotspots detection
 * - Coupling metrics (afferent, efferent, instability)
 * - Safe refactoring order with phases
 * - Cycle detection
 *
 * @example
 * ```typescript
 * import { rankingAnalyzer } from './modules/ranking.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(rankingAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const rankingResult = results.get('ranking');
 * ```
 */

import { analyzeRanking, type RankingAnalysis } from '../ranking/index';
import type { Analyzer, AnalyzerResult } from '../registry';

// ============================================================================
// RANKING ANALYZER
// ============================================================================

/**
 * Analyzer for PageRank-based dependency analysis.
 *
 * This analyzer uses the dependency graph from the architecture analyzer
 * to compute centrality scores, identify hotspots, and generate
 * a safe refactoring order.
 *
 * Features:
 * - Depends on architecture analyzer for dependency graph
 * - Computes PageRank scores for all modules
 * - Identifies top N hotspots by centrality
 * - Calculates coupling metrics (Ca, Ce, Instability)
 * - Generates topologically-sorted refactoring phases
 */
export const rankingAnalyzer: Analyzer<RankingAnalysis> = {
  metadata: {
    id: 'ranking',
    name: 'PageRank-based Ranking',
    description: 'Computes centrality scores, hotspots, and safe refactoring order',
    defaultEnabled: true,
    cliFlag: '--include-ranking',
    dependsOn: ['architecture'],
  },

  /**
   * Determines if the analyzer should run.
   *
   * Ranking requires a dependency graph with at least some nodes.
   *
   * @param ctx - The analyzer context
   * @returns true if ranking should run
   */
  shouldRun(ctx) {
    return ctx.options.includeRanking !== false;
  },

  /**
   * Performs ranking analysis.
   *
   * Note: This analyzer needs access to architecture results.
   * In the current design, it receives them via a custom mechanism
   * since analyzers can't directly access other analyzer results.
   *
   * For now, we re-run the architecture analysis to get the graph.
   * TODO: Consider passing results through context or a results store.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx): Promise<AnalyzerResult<RankingAnalysis>> {
    try {
      // Get the dependency graph from options (set by the runner)
      const dependencyGraph = ctx.options.dependencyGraph as Record<string, string[]> | undefined;

      if (!dependencyGraph || Object.keys(dependencyGraph).length === 0) {
        return {
          status: 'skipped',
          error: 'No dependency graph available - architecture analysis may have failed',
        };
      }

      const rankingAnalysis = analyzeRanking(dependencyGraph);

      return {
        status: 'success',
        data: rankingAnalysis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`Ranking analysis failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
