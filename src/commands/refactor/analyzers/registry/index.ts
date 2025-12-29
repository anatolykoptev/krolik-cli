/**
 * @module commands/refactor/analyzers/registry
 * @description Analyzer Registry for refactor command
 *
 * Provides a centralized registration point for all analyzers:
 * - Auto-discovery of analyzers
 * - Dependency-aware execution order
 * - Status tracking (success/skipped/error)
 * - Performance measurement
 *
 * @example
 * ```ts
 * import { analyzerRegistry, type Analyzer } from './registry';
 *
 * // Register an analyzer
 * analyzerRegistry.register(myAnalyzer);
 *
 * // Run all analyzers
 * const results = await analyzerRegistry.runAll(ctx);
 *
 * // Check result
 * const fileSizeResult = results.get('file-size');
 * if (fileSizeResult?.status === 'success') {
 *   console.log(fileSizeResult.data);
 * }
 * ```
 */

// Registry
export { AnalyzerRegistry, analyzerRegistry } from './registry';
// Types
export type {
  Analyzer,
  AnalyzerContext,
  AnalyzerMetadata,
  AnalyzerResult,
  AnalyzerStatus,
} from './types';
