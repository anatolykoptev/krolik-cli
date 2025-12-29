/**
 * @module commands/refactor/analyzers/registry/registry
 * @description AnalyzerRegistry for managing and orchestrating analyzers
 *
 * Provides a registry pattern for analyzers with:
 * - Dependency-aware topological sorting
 * - Automatic execution ordering
 * - Error handling with proper status tracking
 * - Performance measurement
 */

import type { Analyzer, AnalyzerContext, AnalyzerResult } from './types';

// ============================================================================
// ANALYZER REGISTRY
// ============================================================================

/**
 * Registry for managing and executing analyzers.
 *
 * Features:
 * - Register/unregister analyzers
 * - Topologically sort by dependencies
 * - Execute all analyzers in correct order
 * - Track execution results and timing
 *
 * @example
 * ```typescript
 * import { analyzerRegistry } from './registry';
 *
 * // Register analyzers
 * analyzerRegistry.register(fileSizeAnalyzer);
 * analyzerRegistry.register(namespaceAnalyzer);
 *
 * // Run all analyzers
 * const results = await analyzerRegistry.runAll(context);
 * ```
 */
export class AnalyzerRegistry {
  private analyzers = new Map<string, Analyzer<unknown>>();

  /**
   * Register a single analyzer.
   *
   * @param analyzer - The analyzer to register
   * @throws Error if analyzer with same ID already exists
   */
  register<T>(analyzer: Analyzer<T>): void {
    const id = analyzer.metadata.id;
    if (this.analyzers.has(id)) {
      throw new Error(`Analyzer with id "${id}" is already registered`);
    }
    this.analyzers.set(id, analyzer as Analyzer<unknown>);
  }

  /**
   * Register multiple analyzers at once.
   *
   * @param analyzers - Array of analyzers to register
   */
  registerAll(analyzers: Analyzer<unknown>[]): void {
    for (const analyzer of analyzers) {
      this.register(analyzer);
    }
  }

  /**
   * Get an analyzer by its ID.
   *
   * @param id - The analyzer ID
   * @returns The analyzer or undefined if not found
   */
  get<T>(id: string): Analyzer<T> | undefined {
    return this.analyzers.get(id) as Analyzer<T> | undefined;
  }

  /**
   * Check if an analyzer with the given ID exists.
   *
   * @param id - The analyzer ID
   * @returns true if the analyzer exists
   */
  has(id: string): boolean {
    return this.analyzers.has(id);
  }

  /**
   * Get all registered analyzers.
   *
   * @returns Array of all registered analyzers
   */
  all(): Analyzer<unknown>[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Get all registered analyzer IDs.
   *
   * @returns Array of analyzer IDs
   */
  ids(): string[] {
    return Array.from(this.analyzers.keys());
  }

  /**
   * Clear all registered analyzers.
   * Useful for testing.
   */
  clear(): void {
    this.analyzers.clear();
  }

  /**
   * Get the number of registered analyzers.
   */
  get size(): number {
    return this.analyzers.size;
  }

  /**
   * Run all registered analyzers in dependency order.
   *
   * - Topologically sorts analyzers by dependencies
   * - Checks shouldRun() before executing
   * - Skips analyzers whose dependencies failed
   * - Tracks duration and errors for each analyzer
   *
   * @param ctx - The analyzer context
   * @returns Map of analyzer ID to result
   */
  async runAll(ctx: AnalyzerContext): Promise<Map<string, AnalyzerResult<unknown>>> {
    const results = new Map<string, AnalyzerResult<unknown>>();
    const sortedAnalyzers = this.topologicalSort();

    for (const analyzer of sortedAnalyzers) {
      const id = analyzer.metadata.id;
      const startTime = performance.now();

      // Check if dependencies failed
      const failedDeps = this.getFailedDependencies(analyzer, results);
      if (failedDeps.length > 0) {
        results.set(id, {
          status: 'skipped',
          error: `Skipped due to failed dependencies: ${failedDeps.join(', ')}`,
          durationMs: 0,
        });
        continue;
      }

      // Check if analyzer should run
      if (!analyzer.shouldRun(ctx)) {
        const durationMs = performance.now() - startTime;
        results.set(id, {
          status: 'skipped',
          error: 'Analyzer returned false from shouldRun()',
          durationMs,
        });
        continue;
      }

      // Execute the analyzer
      try {
        const result = await analyzer.analyze(ctx);
        const durationMs = performance.now() - startTime;
        results.set(id, {
          ...result,
          durationMs,
        });
      } catch (err) {
        const durationMs = performance.now() - startTime;
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Unknown error occurred';

        // NEVER silently fail - always record the error
        results.set(id, {
          status: 'error',
          error: errorMessage,
          durationMs,
        });
      }
    }

    return results;
  }

  /**
   * Get dependencies that failed for an analyzer.
   *
   * @param analyzer - The analyzer to check
   * @param results - Current results map
   * @returns Array of failed dependency IDs
   */
  private getFailedDependencies(
    analyzer: Analyzer<unknown>,
    results: Map<string, AnalyzerResult<unknown>>,
  ): string[] {
    const deps = analyzer.metadata.dependsOn ?? [];
    const failed: string[] = [];

    for (const depId of deps) {
      const depResult = results.get(depId);
      if (depResult && depResult.status === 'error') {
        failed.push(depId);
      }
    }

    return failed;
  }

  /**
   * Topologically sort analyzers by dependencies.
   *
   * Uses Kahn's algorithm for topological sorting.
   * Handles cycles gracefully by warning and breaking them.
   *
   * @returns Analyzers sorted in dependency order
   */
  private topologicalSort(): Analyzer<unknown>[] {
    const sorted: Analyzer<unknown>[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string, path: string[] = []): void => {
      if (visited.has(id)) {
        return;
      }

      if (visiting.has(id)) {
        // Cycle detected - warn and break it
        const cycleStart = path.indexOf(id);
        const cycle = [...path.slice(cycleStart), id].join(' -> ');
        console.warn(`[AnalyzerRegistry] Circular dependency detected: ${cycle}. Breaking cycle.`);
        return;
      }

      const analyzer = this.analyzers.get(id);
      if (!analyzer) {
        console.warn(`[AnalyzerRegistry] Unknown analyzer dependency: ${id}`);
        return;
      }

      visiting.add(id);

      // Visit dependencies first
      const deps = analyzer.metadata.dependsOn ?? [];
      for (const depId of deps) {
        visit(depId, [...path, id]);
      }

      visiting.delete(id);
      visited.add(id);
      sorted.push(analyzer);
    };

    // Visit all analyzers
    for (const id of this.analyzers.keys()) {
      visit(id);
    }

    return sorted;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Default analyzer registry instance.
 *
 * Use this for the main application. For testing,
 * create a new instance or use registry.clear().
 */
export const analyzerRegistry = new AnalyzerRegistry();
