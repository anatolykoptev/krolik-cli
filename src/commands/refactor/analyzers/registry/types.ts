/**
 * @module commands/refactor/analyzers/registry/types
 * @description Type definitions for the AnalyzerRegistry system
 *
 * Provides a unified interface for registering and running analyzers
 * with dependency management, metadata, and result handling.
 */

// NOTE: Import directly from types.ts to avoid circular dependency
// (core/index.ts re-exports types-ai.ts which imports i18n.analyzer.ts which imports registry)
import type { RefactorAnalysis } from '../../core/types';

// ============================================================================
// STATUS & RESULT TYPES
// ============================================================================

/**
 * Status of an analyzer execution.
 *
 * - `success`: Analyzer completed successfully with data
 * - `skipped`: Analyzer was skipped (e.g., dependencies not met, not applicable)
 * - `error`: Analyzer encountered an error during execution
 */
export type AnalyzerStatus = 'success' | 'skipped' | 'error';

/**
 * Result of an analyzer execution.
 *
 * Generic container for analyzer output with status tracking,
 * optional error information, and performance metrics.
 *
 * @template T - The type of data returned by the analyzer
 */
export interface AnalyzerResult<T> {
  /** Execution status */
  status: AnalyzerStatus;

  /** Result data (present when status is 'success') */
  data?: T;

  /** Error message (present when status is 'error' or 'skipped') */
  error?: string;

  /** Execution duration in milliseconds */
  durationMs?: number;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Context provided to analyzers during execution.
 *
 * Contains all necessary information for an analyzer to perform
 * its analysis, including paths, base analysis data, and options.
 */
export interface AnalyzerContext {
  /** Absolute path to the project root */
  projectRoot: string;

  /** Absolute path to the target directory being analyzed */
  targetPath: string;

  /** Base analysis result from the core refactor analysis */
  baseAnalysis: RefactorAnalysis;

  /** Additional options passed to the analyzer (analyzer-specific) */
  options: Record<string, unknown>;

  /** Optional logger for warnings and debug info */
  logger?: {
    warn?: (msg: string) => void;
  };
}

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Metadata describing an analyzer.
 *
 * Used by the registry to manage analyzer lifecycle,
 * resolve dependencies, and expose configuration options.
 */
export interface AnalyzerMetadata {
  /** Unique identifier for the analyzer (e.g., 'file-size', 'namespace') */
  id: string;

  /** Human-readable name (e.g., 'File Size Analyzer') */
  name: string;

  /** Brief description of what the analyzer does */
  description: string;

  /**
   * IDs of analyzers this one depends on.
   * The registry ensures dependencies run first.
   */
  dependsOn?: string[];

  /**
   * Whether the analyzer is enabled by default.
   * @default true
   */
  defaultEnabled?: boolean;

  /**
   * CLI flag name to enable/disable this analyzer.
   * Example: 'file-size' would map to --file-size / --no-file-size
   */
  cliFlag?: string;
}

// ============================================================================
// ANALYZER INTERFACE
// ============================================================================

/**
 * Interface for analyzers that can be registered with the AnalyzerRegistry.
 *
 * Analyzers perform specific analysis tasks on the codebase and return
 * typed results. They can declare dependencies on other analyzers.
 *
 * @template T - The type of data returned by the analyzer
 *
 * @example
 * ```typescript
 * const fileSizeAnalyzer: Analyzer<FileSizeAnalysis> = {
 *   metadata: {
 *     id: 'file-size',
 *     name: 'File Size Analyzer',
 *     description: 'Detects files exceeding size thresholds',
 *     defaultEnabled: true,
 *     cliFlag: 'file-size',
 *   },
 *   shouldRun: (ctx) => ctx.options.analyzeFileSize !== false,
 *   analyze: async (ctx) => {
 *     // ... analysis logic
 *     return { status: 'success', data: result };
 *   },
 * };
 * ```
 */
export interface Analyzer<T> {
  /** Analyzer metadata for registration and configuration */
  metadata: AnalyzerMetadata;

  /**
   * Determines whether this analyzer should run given the current context.
   *
   * @param ctx - The analyzer context
   * @returns true if the analyzer should run, false to skip
   */
  shouldRun(ctx: AnalyzerContext): boolean;

  /**
   * Performs the analysis and returns the result.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  analyze(ctx: AnalyzerContext): Promise<AnalyzerResult<T>>;
}
