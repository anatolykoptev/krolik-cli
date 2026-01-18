/**
 * Task Level Analysis Module
 *
 * Consolidated logic for grouping tasks by dependency levels
 * and analyzing parallelization opportunities.
 *
 * @module @ralph/orchestrator/task-levels
 */

import type { PRDTask } from '../schemas/prd.schema.js';

/**
 * Level grouping result
 */
export interface TaskLevel {
  levelIndex: number;
  tasks: PRDTask[];
  /** All tasks in this level are independent (no cross-dependencies) */
  isParallelizable: boolean;
}

/**
 * Group tasks by dependency level for parallel execution.
 * Tasks at level 0 have no dependencies, level 1 depends only on level 0, etc.
 *
 * Uses topological sorting to group tasks into levels where:
 * - All tasks in a level have their dependencies satisfied by previous levels
 * - Tasks within the same level can potentially run in parallel
 *
 * @param tasks - Array of PRD tasks to group
 * @returns Array of task arrays, one per level (level 0, level 1, etc.)
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
 * Analyze task levels for parallelization opportunities.
 *
 * Groups tasks by dependency level and determines if tasks within
 * each level can run in parallel (no cross-dependencies within level).
 *
 * @param tasks - Array of PRD tasks to analyze
 * @returns Array of TaskLevel objects with parallelization info
 */
export function analyzeTaskLevels(tasks: PRDTask[]): TaskLevel[] {
  const levelGroups = groupTasksByLevel(tasks);

  return levelGroups.map((levelTasks, levelIndex) => {
    // Check if all tasks in this level can run in parallel
    // They can if none depend on each other (only on previous levels)
    const taskIds = new Set(levelTasks.map((t) => t.id));
    const isParallelizable = levelTasks.every((task) =>
      task.dependencies.every((dep) => !taskIds.has(dep)),
    );

    return {
      levelIndex,
      tasks: levelTasks,
      isParallelizable,
    };
  });
}

/**
 * Get tasks in dependency order (topological sort).
 * Flattens level groups into a single ordered array.
 *
 * @param tasks - Array of PRD tasks
 * @returns Tasks ordered by dependencies (ready-to-run first)
 */
export function getTaskDependencyOrder(tasks: PRDTask[]): PRDTask[] {
  const levels = groupTasksByLevel(tasks);
  return levels.flat();
}

/**
 * Check if a task can run given the set of completed tasks.
 * A task can run if all its dependencies are in the completed set.
 *
 * @param task - Task to check
 * @param completedTaskIds - Set of completed task IDs
 * @param allTaskIds - Optional set of all valid task IDs (for filtering external deps)
 * @returns true if all dependencies are satisfied
 */
export function canTaskRun(
  task: PRDTask,
  completedTaskIds: Set<string>,
  allTaskIds?: Set<string>,
): boolean {
  return task.dependencies.every((depId) => {
    // If we have a list of all task IDs, skip deps that reference external/missing tasks
    if (allTaskIds && !allTaskIds.has(depId)) {
      return true;
    }
    return completedTaskIds.has(depId);
  });
}

/**
 * Get all tasks that are ready to run given completed tasks.
 *
 * @param tasks - All tasks to consider
 * @param completedTaskIds - Set of completed task IDs
 * @param excludeTaskIds - Optional set of task IDs to exclude (e.g., failed, in-progress)
 * @returns Array of tasks ready to execute
 */
export function getReadyTasks(
  tasks: PRDTask[],
  completedTaskIds: Set<string>,
  excludeTaskIds?: Set<string>,
): PRDTask[] {
  const allTaskIds = new Set(tasks.map((t) => t.id));

  return tasks.filter((task) => {
    // Skip if already completed or excluded
    if (completedTaskIds.has(task.id)) return false;
    if (excludeTaskIds?.has(task.id)) return false;

    // Check if dependencies are met
    return canTaskRun(task, completedTaskIds, allTaskIds);
  });
}
