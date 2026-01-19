/**
 * State Manager - Orchestrator state management
 *
 * @module @felix/orchestrator/state-manager
 */

import type { CostPlugin } from '../plugins/cost-plugin.js';
import type { RalphLoopState, TaskExecutionResult } from '../types.js';
import type { OrchestratorResult } from './types.js';

/**
 * Create initial orchestrator state
 */
export function createInitialState(): RalphLoopState {
  return {
    status: 'idle',
    completedTasks: [],
    failedTasks: [],
    skippedTasks: [],
    totalTokensUsed: 0,
    totalCostUsd: 0,
  };
}

/**
 * Determine final status based on state and abort signal
 */
export function determineFinalStatus(
  state: RalphLoopState,
  abortController: AbortController | null,
): RalphLoopState['status'] {
  if (abortController?.signal.aborted) {
    return 'cancelled';
  }
  return state.failedTasks.length > 0 ? 'failed' : 'completed';
}

/**
 * Create orchestrator result object
 */
export function createResult(
  success: boolean,
  state: RalphLoopState,
  taskResults: TaskExecutionResult[],
  costPlugin: CostPlugin,
  startTime: number,
): OrchestratorResult {
  return {
    success,
    state,
    taskResults,
    totalCost: costPlugin.getTotalUsage().costUsd,
    totalTokens: costPlugin.getTotalUsage().tokens.totalTokens,
    duration: Date.now() - startTime,
  };
}

/**
 * Update state after task completion
 */
export function updateStateAfterTask(state: RalphLoopState, result: TaskExecutionResult): void {
  if (result.success) {
    state.completedTasks.push(result.taskId);
  } else {
    state.failedTasks.push(result.taskId);
  }
  state.totalTokensUsed += result.tokensUsed;
  state.totalCostUsd += result.costUsd;
}

/**
 * Check if task should be skipped (dependencies not met)
 */
export function shouldSkipTask(
  taskId: string,
  dependencies: string[],
  state: RalphLoopState,
): { skip: boolean; reason?: string } {
  // Already processed
  if (state.completedTasks.includes(taskId) || state.failedTasks.includes(taskId)) {
    return { skip: true, reason: 'already_processed' };
  }

  // Check unmet dependencies
  const unmetDeps = dependencies.filter((dep) => !state.completedTasks.includes(dep));
  if (unmetDeps.length > 0) {
    return { skip: true, reason: `unmet_deps:${unmetDeps.join(',')}` };
  }

  return { skip: false };
}
