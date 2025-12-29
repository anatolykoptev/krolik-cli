/**
 * @module commands/refactor/analyzers/modules/duplicates.analyzer
 * @description Duplicates Analyzer for the registry-based architecture
 *
 * Detects duplicate functions and types across the codebase using AST analysis.
 * This analyzer helps identify code that can be consolidated.
 *
 * Detection includes:
 * - Duplicate functions (same name, similar body)
 * - Duplicate types/interfaces (same structure)
 * - Similarity scoring for near-duplicates
 * - Recommendations (merge, rename, keep-both)
 *
 * @example
 * ```typescript
 * import { duplicatesAnalyzer } from './modules/duplicates.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(duplicatesAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const duplicatesResult = results.get('duplicates');
 * ```
 */

import type { DuplicateInfo, TypeDuplicateInfo } from '../../core';
import type { Analyzer } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Duplicates analysis result
 */
export interface DuplicatesAnalysis {
  /** Duplicate functions found */
  functions: DuplicateInfo[];
  /** Duplicate types/interfaces found */
  types: TypeDuplicateInfo[];
  /** Total count of duplicates */
  totalCount: number;
}

// ============================================================================
// DUPLICATES ANALYZER
// ============================================================================

/**
 * Analyzer for detecting duplicate functions and types.
 *
 * This analyzer uses the base analysis data which already contains
 * duplicate detection results. It extracts and organizes this data
 * for output formatting.
 *
 * Features:
 * - Uses pre-computed duplicates from base analysis
 * - No external dependencies
 * - Combines function and type duplicates
 * - Provides consolidated summary
 */
export const duplicatesAnalyzer: Analyzer<DuplicatesAnalysis> = {
  metadata: {
    id: 'duplicates',
    name: 'Duplicates Detection',
    description: 'Detects duplicate functions and types across the codebase',
    defaultEnabled: true,
    // No dependencies - uses baseAnalysis data
  },

  /**
   * Determines if the analyzer should run.
   *
   * Duplicates analysis is always useful unless explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeDuplicates !== false;
  },

  /**
   * Extracts duplicates data from base analysis.
   *
   * The heavy lifting is done during base analysis,
   * this analyzer organizes and returns the results.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    const { baseAnalysis } = ctx;

    const functions = baseAnalysis.duplicates || [];
    const types = baseAnalysis.typeDuplicates || [];
    const totalCount = functions.length + types.length;

    // ALWAYS return success, even if no duplicates found
    return {
      status: 'success',
      data: {
        functions,
        types,
        totalCount,
      },
    };
  },
};
