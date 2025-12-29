/**
 * @module commands/refactor/analyzers/modules/architecture.analyzer
 * @description Architecture Health Analyzer for the registry-based architecture
 *
 * Analyzes architectural health including layer violations, circular dependencies,
 * and dependency graph construction.
 *
 * Analysis includes:
 * - Layer violation detection (Clean Architecture layers)
 * - Circular dependency detection
 * - Dependency graph construction
 * - Layer compliance scoring
 * - Architecture health score
 *
 * @example
 * ```typescript
 * import { architectureAnalyzer } from './modules/architecture.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(architectureAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const archResult = results.get('architecture');
 * ```
 */

import type { ArchHealth } from '../../core';
import { analyzeArchHealth } from '../architecture/architecture';
import type { Analyzer } from '../registry';

// ============================================================================
// ARCHITECTURE ANALYZER
// ============================================================================

/**
 * Analyzer for architecture health assessment.
 *
 * This analyzer examines the codebase for architectural violations
 * including layer breaches and circular dependencies. It produces
 * a dependency graph that other analyzers can use.
 *
 * Features:
 * - Depends on project-context for context awareness
 * - Produces dependency graph for ranking analyzer
 * - Detects Clean Architecture layer violations
 * - Identifies circular dependencies
 * - Calculates architecture health score
 */
export const architectureAnalyzer: Analyzer<ArchHealth> = {
  metadata: {
    id: 'architecture',
    name: 'Architecture Health Analysis',
    description: 'Analyzes layer violations, circular dependencies, and architectural health',
    defaultEnabled: true,
    dependsOn: ['project-context'],
  },

  /**
   * Determines if the analyzer should run.
   *
   * Architecture analysis is fundamental for many other analyses.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeArchitecture !== false;
  },

  /**
   * Performs architecture health analysis.
   *
   * Analyzes the target path for architectural violations
   * and builds the dependency graph.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    try {
      const archHealth = analyzeArchHealth(ctx.targetPath, ctx.projectRoot);

      return {
        status: 'success',
        data: archHealth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`Architecture analysis failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
