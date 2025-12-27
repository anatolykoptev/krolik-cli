/**
 * @module commands/fix/parallel-executor
 * @description Parallel execution strategy for fix operations
 *
 * Design Goals:
 * 1. Parallel execution across independent files
 * 2. Sequential execution within a single file (preserve line number ordering)
 * 3. Configurable concurrency limit to avoid overwhelming fs
 * 4. Error handling with partial success reporting
 * 5. Progress reporting for parallel operations
 */

import { applyFix, createBackup } from './applier';
import type { FixPlan } from './plan';
import type { FixOptions, FixResult } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of processing a single file
 */
export interface FileFixResult {
  file: string;
  results: FixResult[];
  success: boolean;
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Aggregated results from parallel execution
 */
export interface ParallelExecutionResult {
  /** Results grouped by file */
  fileResults: FileFixResult[];
  /** Total successful fixes */
  successCount: number;
  /** Total failed fixes */
  failureCount: number;
  /** Files that were fully successful */
  successfulFiles: string[];
  /** Files with at least one failure */
  failedFiles: string[];
  /** Total execution time in milliseconds */
  totalDuration: number;
  /** Whether all fixes were successful */
  allSuccessful: boolean;
}

/**
 * Progress callback for reporting execution status
 */
export interface ProgressCallback {
  /** Called when a file starts processing */
  onFileStart?: (file: string, index: number, total: number) => void;
  /** Called when a file finishes processing */
  onFileComplete?: (file: string, result: FileFixResult, index: number, total: number) => void;
  /** Called when a fix is applied */
  onFixApplied?: (file: string, result: FixResult) => void;
}

/**
 * Options for parallel execution
 */
export interface ParallelExecutionOptions {
  /** Maximum concurrent file operations (default: 4) */
  concurrency?: number;
  /** Create backup before fixing (default: false) */
  backup?: boolean;
  /** Dry run mode (default: false) */
  dryRun?: boolean;
  /** Progress callbacks */
  progress?: ProgressCallback;
  /** Stop on first error in a file (default: true) */
  stopOnError?: boolean;
  /** Abort all execution on any error (default: false) */
  failFast?: boolean;
}

// ============================================================================
// CONCURRENCY CONTROL (p-limit pattern)
// ============================================================================

/**
 * Simple concurrency limiter (p-limit pattern)
 * Limits the number of concurrent promises
 */
function createConcurrencyLimiter(concurrency: number) {
  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    if (activeCount < concurrency && queue.length > 0) {
      activeCount++;
      const fn = queue.shift();
      fn?.();
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          next();
        }
      };

      queue.push(task);
      next();
    });
  };

  return {
    run,
    /** Current number of active tasks */
    get activeCount() {
      return activeCount;
    },
    /** Number of tasks waiting in queue */
    get pendingCount() {
      return queue.length;
    },
  };
}

export type ConcurrencyLimiter = ReturnType<typeof createConcurrencyLimiter>;

// ============================================================================
// FILE PROCESSOR
// ============================================================================

/**
 * Process fixes for a single file
 * Fixes are applied sequentially within the file (in reverse line order)
 */
async function processFile(
  plan: FixPlan,
  options: ParallelExecutionOptions,
): Promise<FileFixResult> {
  const startTime = Date.now();
  const results: FixResult[] = [];
  let hasError = false;

  // Sort fixes by line number descending (apply from bottom to top)
  const sortedFixes = [...plan.fixes].sort((a, b) => {
    const lineA = a.operation.line || 0;
    const lineB = b.operation.line || 0;
    return lineB - lineA;
  });

  // Create single backup for the file if requested
  if (options.backup && !options.dryRun) {
    try {
      createBackup(plan.file);
    } catch {
      // Backup failure is not critical, continue with fixes
    }
  }

  // Apply fixes sequentially within the file
  for (const { issue, operation } of sortedFixes) {
    const result = applyFix(operation, issue, {
      backup: false, // Already handled above
      dryRun: options.dryRun ?? false,
    });

    results.push(result);
    options.progress?.onFixApplied?.(plan.file, result);

    if (!result.success) {
      hasError = true;
      if (options.stopOnError !== false) {
        // Default: stop on first error in file
        break;
      }
    }
  }

  return {
    file: plan.file,
    results,
    success: !hasError,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// PARALLEL EXECUTOR
// ============================================================================

/**
 * Execute fix plans in parallel across files
 *
 * @example
 * ```typescript
 * const result = await executeParallel(plans, {
 *   concurrency: 4,
 *   backup: true,
 *   progress: {
 *     onFileStart: (file, i, total) => console.log(`[${i+1}/${total}] Starting ${file}`),
 *     onFileComplete: (file, result) => console.log(`Completed ${file}: ${result.success ? 'OK' : 'FAILED'}`),
 *   },
 * });
 * ```
 */
export async function executeParallel(
  plans: FixPlan[],
  options: ParallelExecutionOptions = {},
): Promise<ParallelExecutionResult> {
  const startTime = Date.now();
  const concurrency = options.concurrency ?? 4;
  const limiter = createConcurrencyLimiter(concurrency);

  // Track abort state for failFast
  let aborted = false;
  const fileResults: FileFixResult[] = [];

  // Create tasks for each file
  const tasks = plans.map((plan, index) => async (): Promise<FileFixResult | null> => {
    // Check if we should abort
    if (aborted) {
      return null;
    }

    // Report start
    options.progress?.onFileStart?.(plan.file, index, plans.length);

    // Process file
    const result = await processFile(plan, options);

    // Report completion
    options.progress?.onFileComplete?.(plan.file, result, index, plans.length);

    // Check failFast
    if (options.failFast && !result.success) {
      aborted = true;
    }

    return result;
  });

  // Execute with concurrency limit
  const results = await Promise.all(tasks.map((task) => limiter.run(task)));

  // Filter out null results (aborted tasks)
  for (const result of results) {
    if (result !== null) {
      fileResults.push(result);
    }
  }

  // Aggregate results
  return aggregateResults(fileResults, Date.now() - startTime);
}

/**
 * Aggregate file results into overall execution result
 */
function aggregateResults(
  fileResults: FileFixResult[],
  totalDuration: number,
): ParallelExecutionResult {
  let successCount = 0;
  let failureCount = 0;
  const successfulFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const fileResult of fileResults) {
    const fileSuccesses = fileResult.results.filter((r) => r.success).length;
    const fileFailures = fileResult.results.filter((r) => !r.success).length;

    successCount += fileSuccesses;
    failureCount += fileFailures;

    if (fileResult.success) {
      successfulFiles.push(fileResult.file);
    } else {
      failedFiles.push(fileResult.file);
    }
  }

  return {
    fileResults,
    successCount,
    failureCount,
    successfulFiles,
    failedFiles,
    totalDuration,
    allSuccessful: failureCount === 0,
  };
}

// ============================================================================
// INTEGRATION HELPER
// ============================================================================

/**
 * Convert FixPlan[] to parallel-friendly format and execute
 * This is the main entry point for integration with runFix()
 */
export async function applyFixesParallel(
  plans: FixPlan[],
  options: FixOptions,
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  },
): Promise<FixResult[]> {
  const parallelOptions: ParallelExecutionOptions = {
    concurrency: 4, // Sensible default for fs operations
    backup: options.backup ?? false,
    dryRun: options.dryRun ?? false,
    stopOnError: true,
    failFast: false,
    progress: {
      onFileStart: (file, index, total) => {
        logger.debug(`[${index + 1}/${total}] Processing ${file}`);
      },
      onFileComplete: (file, result) => {
        if (result.success) {
          logger.debug(`Completed ${file} (${result.results.length} fixes, ${result.duration}ms)`);
        } else {
          const failures = result.results.filter((r) => !r.success);
          logger.error(`Failed ${file}: ${failures.length} errors`);
        }
      },
    },
  };

  const executionResult = await executeParallel(plans, parallelOptions);

  // Log summary
  logger.info(
    `Parallel execution: ${executionResult.successCount} succeeded, ${executionResult.failureCount} failed (${executionResult.totalDuration}ms)`,
  );

  if (executionResult.failedFiles.length > 0) {
    logger.warn(`Files with failures: ${executionResult.failedFiles.join(', ')}`);
  }

  // Flatten results for compatibility with existing code
  return executionResult.fileResults.flatMap((fr) => fr.results);
}

// ============================================================================
// BATCH UTILITIES
// ============================================================================

/**
 * Group plans by directory for locality-aware execution
 * Files in the same directory may benefit from being processed together
 */
export function groupByDirectory(plans: FixPlan[]): Map<string, FixPlan[]> {
  const groups = new Map<string, FixPlan[]>();

  for (const plan of plans) {
    const dir = plan.file.substring(0, plan.file.lastIndexOf('/'));
    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    groups.get(dir)!.push(plan);
  }

  return groups;
}

/**
 * Estimate execution time based on fix counts
 * Useful for progress reporting
 */
export function estimateExecutionTime(plans: FixPlan[]): {
  totalFixes: number;
  estimatedMs: number;
} {
  const totalFixes = plans.reduce((sum, p) => sum + p.fixes.length, 0);
  // Rough estimate: 10ms per fix operation
  const estimatedMs = totalFixes * 10;

  return { totalFixes, estimatedMs };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { createConcurrencyLimiter };
