/**
 * @module commands/refactor/analyzers/modules/file-size.analyzer
 * @description File Size Analyzer for the registry-based architecture
 *
 * Detects oversized files that should be split for maintainability.
 * This analyzer runs independently without dependencies on other analyzers.
 *
 * Thresholds:
 * - Warning: 300+ lines (consider splitting)
 * - Error: 500+ lines (should split)
 * - Critical: 800+ lines (must split immediately)
 *
 * Large files indicate:
 * - Single Responsibility Principle violations
 * - Poor modularity
 * - Maintenance difficulties
 * - Hard to test and review
 *
 * @example
 * ```typescript
 * import { fileSizeAnalyzer } from './modules/file-size.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(fileSizeAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const fileSizeResult = results.get('file-size');
 * ```
 */

import * as path from 'node:path';

import type { FileSizeAnalysis } from '../../core';
import { analyzeFileSizes } from '../metrics/file-size';
import type { Analyzer } from '../registry';

// ============================================================================
// FILE SIZE ANALYZER
// ============================================================================

/**
 * Analyzer for detecting oversized files that should be split.
 *
 * This analyzer scans all TypeScript files in the source directories
 * and reports files exceeding size thresholds. It helps maintain
 * code quality by identifying files that have grown too large.
 *
 * Features:
 * - Runs independently (no dependencies)
 * - Scans all src directories (not just targetPath)
 * - Returns success even if no issues found
 * - Can be disabled via options.includeFileSize
 */
export const fileSizeAnalyzer: Analyzer<FileSizeAnalysis> = {
  metadata: {
    id: 'file-size',
    name: 'File Size Analysis',
    description: 'Detects oversized files that should be split for maintainability',
    defaultEnabled: true,
    cliFlag: '--include-file-size',
    // No dependencies - can run independently
  },

  /**
   * Determines if the analyzer should run.
   *
   * Checks if the analyzer is explicitly disabled via options.
   * By default, the analyzer runs unless explicitly set to false.
   *
   * @param ctx - The analyzer context
   * @returns true if the analyzer should run
   */
  shouldRun(ctx) {
    // Check if explicitly disabled via options
    return ctx.options.includeFileSize !== false;
  },

  /**
   * Performs file size analysis on the source directories.
   *
   * Uses srcRoot (parent of targetPath) to scan all src directories,
   * not just the specific targetPath. This ensures comprehensive
   * coverage of the entire source tree.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    // Use srcRoot (parent of targetPath) to scan all src directories
    const srcRoot = path.dirname(ctx.targetPath);
    const analysis = analyzeFileSizes(srcRoot, ctx.projectRoot);

    // ALWAYS return success, even if no issues found
    // The section formatter will decide how to render
    return {
      status: 'success',
      data: analysis,
    };
  },
};
