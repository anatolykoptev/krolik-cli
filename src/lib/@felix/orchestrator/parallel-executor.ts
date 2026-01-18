/**
 * Parallel Executor Module
 *
 * Handles parallel task execution by grouping tasks by dependency level.
 *
 * @module @ralph/orchestrator/parallel-executor
 */

import type { PRDTask } from '../schemas/prd.schema.js';
import type { RalphLoopState, TaskExecutionResult } from '../types.js';
import { groupTasksByLevel } from './task-levels.js';

// Re-export for backward compatibility
export { groupTasksByLevel };

/**
 * Task executor function type
 */
export type TaskExecutor = (task: PRDTask) => Promise<TaskExecutionResult>;

/**
 * Parallel execution configuration
 */
export interface ParallelExecutionConfig {
  maxParallelTasks: number;
  continueOnFailure: boolean;
  isAborted: () => boolean;
  isRunning: () => boolean;
}

/**
 * Filter tasks that are ready to run
 */
export function filterRunnableTasks(
  tasks: PRDTask[],
  state: RalphLoopState,
): { runnableTasks: PRDTask[]; skippedTasks: string[] } {
  const runnableTasks: PRDTask[] = [];
  const skippedTasks: string[] = [];

  for (const task of tasks) {
    // Skip already completed/failed tasks
    if (state.completedTasks.includes(task.id) || state.failedTasks.includes(task.id)) {
      continue;
    }

    // Check if dependencies are met
    const unmetDeps = task.dependencies.filter((dep) => !state.completedTasks.includes(dep));
    if (unmetDeps.length > 0) {
      skippedTasks.push(task.id);
      continue;
    }

    runnableTasks.push(task);
  }

  return { runnableTasks, skippedTasks };
}

/**
 * Execute multiple tasks in parallel with concurrency limit.
 * Uses Promise.all with chunking to respect maxParallelTasks.
 */
export async function executeTasksInParallel(
  tasks: PRDTask[],
  executor: TaskExecutor,
  config: ParallelExecutionConfig,
): Promise<TaskExecutionResult[]> {
  const { maxParallelTasks, continueOnFailure, isAborted, isRunning } = config;
  const results: TaskExecutionResult[] = [];

  // Process in chunks of maxParallelTasks
  for (let i = 0; i < tasks.length; i += maxParallelTasks) {
    // Check abort before each chunk
    if (isAborted()) break;
    if (!isRunning()) break;

    const chunk = tasks.slice(i, i + maxParallelTasks);

    // Execute chunk in parallel
    const chunkResults = await Promise.all(chunk.map((task) => executor(task)));

    results.push(...chunkResults);

    // If not continuing on failure, check if any failed
    if (!continueOnFailure) {
      const hasFailure = chunkResults.some((r) => !r.success);
      if (hasFailure) break;
    }
  }

  return results;
}

/**
 * Process task results and update state
 */
export function processTaskResults(
  results: TaskExecutionResult[],
  state: RalphLoopState,
  continueOnFailure: boolean,
): { shouldBreak: boolean } {
  let shouldBreak = false;

  for (const result of results) {
    if (result.success) {
      state.completedTasks.push(result.taskId);
    } else {
      state.failedTasks.push(result.taskId);
      if (!continueOnFailure) {
        shouldBreak = true;
      }
    }

    // Update totals
    state.totalTokensUsed += result.tokensUsed;
    state.totalCostUsd += result.costUsd;
  }

  return { shouldBreak };
}
