/**
 * Task Splitter Plugin - Splits large tasks into smaller atomic units
 *
 * This plugin post-processes generated tasks and splits any task that
 * affects more than MAX_FILES_PER_TASK files into individual file-based tasks.
 *
 * @module commands/prd/generators/task-splitter
 */

import { PRD_LIMITS } from '../constants';
import type { GeneratedTask, TaskComplexity } from '../types';

/**
 * Options for task splitting
 */
export interface TaskSplitterOptions {
  /** Maximum files per task before splitting (default: from PRD_LIMITS) */
  maxFilesPerTask?: number;
  /** Whether to preserve original task if splitting fails */
  preserveOnError?: boolean;
}

/**
 * Result of task splitting operation
 */
export interface TaskSplitResult {
  /** Original task count */
  originalCount: number;
  /** Final task count after splitting */
  finalCount: number;
  /** Number of tasks that were split */
  splitCount: number;
  /** Tasks after splitting */
  tasks: GeneratedTask[];
}

/**
 * Split large tasks that affect too many files into smaller atomic tasks.
 *
 * Rules:
 * 1. Tasks with <= maxFilesPerTask files are kept as-is
 * 2. Tasks with > maxFilesPerTask files are split into one task per file
 * 3. Split tasks inherit properties from parent task
 * 4. Dependencies are updated to point to split task IDs
 * 5. Split tasks have sequential dependencies (file-1 -> file-2 -> file-3)
 */
export function splitLargeTasks(
  tasks: GeneratedTask[],
  options: TaskSplitterOptions = {},
): TaskSplitResult {
  const maxFiles = options.maxFilesPerTask ?? PRD_LIMITS.maxFilesPerTask;
  const preserveOnError = options.preserveOnError ?? true;

  const result: GeneratedTask[] = [];
  let splitCount = 0;

  // Map of original task IDs to their split task IDs (for dependency remapping)
  const taskIdMap = new Map<string, string[]>();

  for (const task of tasks) {
    const filesCount = task.filesAffected.length;

    if (filesCount <= maxFiles) {
      // Task is small enough, keep as-is
      result.push(task);
      taskIdMap.set(task.id, [task.id]);
      continue;
    }

    try {
      // Split task into multiple file-based tasks
      const splitTasks = splitTaskByFiles(task);
      result.push(...splitTasks);
      taskIdMap.set(
        task.id,
        splitTasks.map((t) => t.id),
      );
      splitCount++;
    } catch {
      // If splitting fails, keep original task
      if (preserveOnError) {
        result.push(task);
        taskIdMap.set(task.id, [task.id]);
      }
    }
  }

  // Remap dependencies to point to split task IDs
  const remappedTasks = remapDependencies(result, taskIdMap);

  return {
    originalCount: tasks.length,
    finalCount: remappedTasks.length,
    splitCount,
    tasks: remappedTasks,
  };
}

/**
 * Split a single task into multiple file-based tasks
 */
function splitTaskByFiles(task: GeneratedTask): GeneratedTask[] {
  const files = task.filesAffected;
  const splitTasks: GeneratedTask[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const fileName = extractFileName(file);
    const isLast = i === files.length - 1;

    const splitTask: GeneratedTask = {
      id: `${task.id}-${i + 1}`,
      title: `${task.title} (${fileName})`,
      description: buildSplitDescription(task.description, file, i + 1, files.length),
      acceptanceCriteria: adaptAcceptanceCriteria(task.acceptanceCriteria, file),
      filesAffected: [file],
      complexity: reduceComplexity(task.complexity),
      priority: task.priority,
      // First split task depends on parent's dependencies, subsequent depend on previous split
      dependencies: i === 0 ? [...task.dependencies] : [`${task.id}-${i}`],
      tags: [...task.tags, 'auto-split'],
    };

    // If this is the last split task, add verification step
    if (isLast && files.length > 2) {
      splitTask.acceptanceCriteria.push(
        `Verify all ${files.length} files work together after changes`,
      );
    }

    splitTasks.push(splitTask);
  }

  return splitTasks;
}

/**
 * Extract file name from path
 */
function extractFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}

/**
 * Build description for split task
 */
function buildSplitDescription(
  originalDesc: string,
  file: string,
  index: number,
  total: number,
): string {
  return `[Part ${index}/${total}] ${originalDesc}\n\nFocus on file: ${file}`;
}

/**
 * Adapt acceptance criteria for single file
 */
function adaptAcceptanceCriteria(criteria: string[], file: string): string[] {
  return criteria.map((c) => {
    // If criterion mentions "all files" or similar, make it specific
    if (c.toLowerCase().includes('all files') || c.toLowerCase().includes('each file')) {
      return c.replace(/all files|each file/gi, file);
    }
    return c;
  });
}

/**
 * Reduce complexity when splitting task
 * Epic -> Complex -> Moderate -> Simple -> Trivial
 */
function reduceComplexity(complexity: TaskComplexity): TaskComplexity {
  const complexityOrder: TaskComplexity[] = ['trivial', 'simple', 'moderate', 'complex', 'epic'];
  const currentIndex = complexityOrder.indexOf(complexity);

  // Reduce by 1-2 levels depending on original complexity
  if (currentIndex >= 3) {
    // complex/epic -> moderate
    return 'moderate';
  }
  if (currentIndex >= 2) {
    // moderate -> simple
    return 'simple';
  }
  // simple/trivial -> trivial
  return 'trivial';
}

/**
 * Remap task dependencies after splitting
 *
 * If task A depends on task B, and B was split into B-1, B-2, B-3,
 * then A should depend on B-3 (the last split task).
 */
function remapDependencies(tasks: GeneratedTask[], idMap: Map<string, string[]>): GeneratedTask[] {
  return tasks.map((task) => {
    const newDeps: string[] = [];

    for (const dep of task.dependencies) {
      const mappedIds = idMap.get(dep);
      if (mappedIds && mappedIds.length > 0) {
        // Depend on the last split task (all others must complete first)
        newDeps.push(mappedIds[mappedIds.length - 1]!);
      } else {
        // Keep original dependency if not in map
        newDeps.push(dep);
      }
    }

    return {
      ...task,
      dependencies: [...new Set(newDeps)], // Remove duplicates
    };
  });
}

/**
 * Check if tasks should be split (utility function)
 */
export function shouldSplitTasks(tasks: GeneratedTask[], maxFiles?: number): boolean {
  const threshold = maxFiles ?? PRD_LIMITS.maxFilesPerTask;
  return tasks.some((t) => t.filesAffected.length > threshold);
}

/**
 * Get statistics about potential splits
 */
export function getTaskSplitStats(
  tasks: GeneratedTask[],
  maxFiles?: number,
): {
  tasksNeedingSplit: number;
  totalFilesInLargeTasks: number;
  estimatedFinalTaskCount: number;
} {
  const threshold = maxFiles ?? PRD_LIMITS.maxFilesPerTask;

  let tasksNeedingSplit = 0;
  let totalFilesInLargeTasks = 0;
  let estimatedFinalTaskCount = 0;

  for (const task of tasks) {
    if (task.filesAffected.length > threshold) {
      tasksNeedingSplit++;
      totalFilesInLargeTasks += task.filesAffected.length;
      estimatedFinalTaskCount += task.filesAffected.length;
    } else {
      estimatedFinalTaskCount++;
    }
  }

  return {
    tasksNeedingSplit,
    totalFilesInLargeTasks,
    estimatedFinalTaskCount,
  };
}
