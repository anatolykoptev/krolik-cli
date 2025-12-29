/**
 * @module commands/refactor/analyzers/modules/reusable.analyzer
 * @description Reusable Modules Analyzer for the registry-based architecture
 *
 * Discovers and analyzes reusable modules across the codebase.
 * Identifies modules that can be shared, promoted to libraries, or consolidated.
 *
 * Analysis includes:
 * - Module categorization (ui-component, hook, utility, etc.)
 * - Reusability scoring (core, high, medium, low, none)
 * - Export/import counts
 * - Top reusable modules ranking
 *
 * @example
 * ```typescript
 * import { reusableAnalyzer } from './modules/reusable.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(reusableAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const reusableResult = results.get('reusable');
 * ```
 */

import type { ReusableModulesInfo } from '../../core';
import { analyzeReusableModules } from '../metrics/reusable';
import type { Analyzer } from '../registry';

// ============================================================================
// REUSABLE MODULES ANALYZER
// ============================================================================

/**
 * Analyzer for discovering and scoring reusable modules.
 *
 * This analyzer scans the codebase for modules that could be
 * reused across the project or promoted to shared libraries.
 *
 * Features:
 * - Runs independently (no dependencies)
 * - Async analysis for performance
 * - Categorizes by module type
 * - Scores by reusability level
 * - Can be skipped if not needed
 */
export const reusableAnalyzer: Analyzer<ReusableModulesInfo> = {
  metadata: {
    id: 'reusable',
    name: 'Reusable Modules Analysis',
    description: 'Discovers and scores reusable modules across the codebase',
    defaultEnabled: true,
    cliFlag: '--include-reusable',
    // No dependencies - can run independently
  },

  /**
   * Determines if the analyzer should run.
   *
   * Can be skipped if user doesn't need reusability analysis.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeReusable !== false;
  },

  /**
   * Performs reusable modules analysis.
   *
   * Scans the project for modules with high reusability potential
   * and categorizes them by type and score.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    try {
      const reusableModules = await analyzeReusableModules(ctx.projectRoot, ctx.targetPath);

      return {
        status: 'success',
        data: reusableModules,
      };
    } catch (error) {
      // Log the error but don't fail completely
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`Reusable modules analysis failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
