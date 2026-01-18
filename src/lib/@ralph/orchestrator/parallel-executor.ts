/**
 * Parallel Executor Module
 *
 * Handles parallel task execution by grouping tasks by dependency level.
 *
 * @module @ralph/orchestrator/parallel-executor
 */

import type { PRDTask } from '../schemas/prd.schema.js';
import type { RalphLoopState, TaskExecutionResult } from '../types.js';

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
 * Group tasks by dependency level for parallel execution.
 * Tasks at level 0 have no dependencies, level 1 depends only on level 0, etc.
 */
export function groupTasksByLevel(tasks: PRDTask[]): PRDTask[][] {
  const levels: PRDTask[][] = [];
  const completed = new Set<string>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const remaining = new Set(tasks.map((t) => t.id));

  while (remaining.size > 0) {
    // Find tasks whose dependencies are all completed
    const level = tasks.filter(
      (t) =>
        remaining.has(t.id) && t.dependencies.every((d) => completed.has(d) || !taskMap.has(d)),
    );

    if (level.length === 0) {
      // No progress possible - remaining tasks have unmet deps (shouldn't happen with valid PRD)
      break;
    }

    levels.push(level);
    for (const t of level) {
      completed.add(t.id);
      remaining.delete(t.id);
    }
  }

  return levels;
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
