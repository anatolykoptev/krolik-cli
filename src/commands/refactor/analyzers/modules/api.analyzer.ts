/**
 * @module commands/refactor/analyzers/modules/api.analyzer
 * @description API Routes Analyzer for the registry-based architecture
 *
 * Analyzes tRPC API routes in the codebase to provide insights on
 * procedures, protection status, and API structure.
 *
 * Analysis includes:
 * - tRPC router discovery
 * - Procedure type detection (query/mutation)
 * - Protected route identification
 * - Statistics aggregation
 *
 * @example
 * ```typescript
 * import { apiAnalyzer } from './modules/api.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(apiAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const apiResult = results.get('api');
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeRoutes, type RoutesOutput } from '../../../routes';
import type { Analyzer, AnalyzerResult } from '../registry';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common tRPC router directory locations to check
 */
const ROUTER_CANDIDATES = [
  'packages/api/src/routers', // Monorepo
  'src/server/routers', // Next.js
  'src/routers', // Simple
  'server/routers', // Alternative
  'src/trpc/routers', // tRPC specific
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find tRPC routers directory in the project
 *
 * @param projectRoot - The project root path
 * @returns The routers directory path or null if not found
 */
function findRoutersDir(projectRoot: string): string | null {
  for (const candidate of ROUTER_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

// ============================================================================
// API ANALYZER
// ============================================================================

/**
 * Analyzer for tRPC API routes.
 *
 * This analyzer discovers tRPC routers and analyzes their procedures,
 * providing insights on API structure and protection status.
 *
 * Features:
 * - Only runs in deep mode (not quick mode)
 * - Automatically discovers routers directory
 * - Graceful skip when no routers found
 * - Aggregates procedure statistics
 */
export const apiAnalyzer: Analyzer<RoutesOutput> = {
  metadata: {
    id: 'api',
    name: 'API Routes Analysis',
    description: 'Analyzes tRPC API routes, procedures, and protection status',
    defaultEnabled: true,
    cliFlag: '--include-api',
    // No dependencies - independent analyzer
  },

  /**
   * Determines if the analyzer should run.
   *
   * Only runs in deep mode (not quick mode) and when not explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true if the analyzer should run
   */
  shouldRun(ctx) {
    // Skip in quick mode
    if (ctx.options.quick === true) {
      return false;
    }

    // Skip if explicitly disabled
    if (ctx.options.includeApi === false) {
      return false;
    }

    return true;
  },

  /**
   * Analyzes tRPC API routes.
   *
   * Discovers the routers directory and analyzes all procedures,
   * returning statistics and detailed information.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx): Promise<AnalyzerResult<RoutesOutput>> {
    try {
      // Find routers directory
      const routersDir = findRoutersDir(ctx.projectRoot);

      if (!routersDir) {
        return {
          status: 'skipped',
          error: `No tRPC routers directory found. Checked: ${ROUTER_CANDIDATES.join(', ')}`,
        };
      }

      // Analyze routes
      const routesData = analyzeRoutes(routersDir);

      // Handle empty results
      if (routesData.routers.length === 0) {
        return {
          status: 'skipped',
          error: 'Routers directory found but no routers detected',
        };
      }

      return {
        status: 'success',
        data: routesData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`API routes analysis failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
