/**
 * @module commands/refactor/analyzers/modules/domains.analyzer
 * @description Domains Classification Analyzer for the registry-based architecture
 *
 * Classifies code into logical domains based on directory structure
 * and file contents. Helps identify domain boundaries and suggests improvements.
 *
 * Analysis includes:
 * - Domain detection (core, integrations, ui, utils, etc.)
 * - Coherence scoring per domain
 * - File placement suggestions
 * - Domain boundary violations
 *
 * @example
 * ```typescript
 * import { domainsAnalyzer } from './modules/domains.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(domainsAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const domainsResult = results.get('domains');
 * ```
 */

import type { DomainInfo } from '../../core';
import { classifyDomains } from '../architecture/domains';
import type { Analyzer } from '../registry';

// ============================================================================
// DOMAINS ANALYZER
// ============================================================================

/**
 * Analyzer for domain classification.
 *
 * This analyzer examines the directory structure and file contents
 * to classify code into logical domains, detecting boundaries
 * and suggesting improvements.
 *
 * Features:
 * - Depends on architecture analyzer for graph data
 * - Classifies directories by domain type
 * - Measures domain coherence
 * - Suggests file movements for better organization
 */
export const domainsAnalyzer: Analyzer<DomainInfo[]> = {
  metadata: {
    id: 'domains',
    name: 'Domain Classification',
    description: 'Classifies code into logical domains and detects boundaries',
    defaultEnabled: true,
    dependsOn: ['architecture'],
  },

  /**
   * Determines if the analyzer should run.
   *
   * Domain classification helps with codebase organization.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeDomains !== false;
  },

  /**
   * Performs domain classification.
   *
   * Analyzes the target path to identify and classify domains.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    try {
      const domains = classifyDomains(ctx.targetPath);

      return {
        status: 'success',
        data: domains,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`Domain classification failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
