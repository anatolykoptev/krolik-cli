/**
 * Sequential Task Runner - Execute tasks one by one
 *
 * @module @felix/orchestrator/sequential-runner
 */

import { getTaskExecutionOrder, type PRD, type PRDTask } from '../schemas/prd.schema.js';
import type { FelixLoopState, TaskExecutionResult } from '../types.js';
import { createComponentLogger } from '../utils/logger.js';
import { shouldSkipTask, updateStateAfterTask } from './state-manager.js';

const logger = createComponentLogger('sequential-runner');

export interface SequentialRunnerConfig {
  continueOnFailure: boolean;
  isAborted: () => boolean;
  isRunning: () => boolean;
}

export type TaskExecutor = (
  task: PRDTask,
  prdConfig?: PRD['config'],
) => Promise<TaskExecutionResult>;

/**
 * Run tasks sequentially in dependency order
 */
export async function runSequential(
  prd: PRD,
  state: FelixLoopState,
  executeTask: TaskExecutor,
  config: SequentialRunnerConfig,
): Promise<TaskExecutionResult[]> {
  const results: TaskExecutionResult[] = [];
  const orderedTasks = getTaskExecutionOrder(prd.tasks);

  logger.debug(`Starting with ${orderedTasks.length} tasks, state.status=${state.status}`);

  for (const task of orderedTasks) {
    logger.debug(
      `Task ${task.id}: isAborted=${config.isAborted()}, isRunning=${config.isRunning()}`,
    );
    // Check abort/pause conditions
    if (config.isAborted()) {
      logger.debug(`Aborted, breaking`);
      break;
    }
    if (!config.isRunning()) {
      logger.debug(`Not running (status=${state.status}), breaking`);
      break;
    }

    // Check if task should be skipped
    const { skip, reason } = shouldSkipTask(task.id, task.dependencies, state);
    if (skip) {
      if (reason?.startsWith('unmet_deps')) {
        state.skippedTasks.push(task.id);
      }
      continue;
    }

    // Set current task
    state.currentTaskId = task.id;

    // Execute task
    logger.debug(`Executing task ${task.id}...`);
    try {
      const result = await executeTask(task, prd.config);
      logger.debug(`Task ${task.id} result: success=${result.success}`);
      results.push(result);

      // Update state
      updateStateAfterTask(state, result);

      // Check if we should stop on failure
      if (!result.success && !config.continueOnFailure) {
        logger.debug(`Task failed, stopping`);
        break;
      }
    } catch (error) {
      logger.error(
        `Task ${task.id} threw error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  logger.debug(`Completed with ${results.length} results`);
  return results;
}
