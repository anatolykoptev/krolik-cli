/**
 * Types for multi-agent orchestration
 *
 * @module @ralph/agents/types
 */

import type { BaseLlm, BaseTool } from '@google/adk';
import type { PRDTask } from '../schemas/prd.schema.js';

/**
 * Configuration for creating agent hierarchy
 */
export interface AgentFactoryConfig {
  /** LLM instance for agents */
  llm: BaseLlm;
  /** Project root for context injection */
  projectRoot: string;
  /** Tools available to worker agents */
  tools: BaseTool[];
  /** Enable parallel execution for independent tasks */
  enableParallel?: boolean;
  /** Maximum parallel tasks (default: 3) */
  maxParallelTasks?: number;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Result from a task execution stored in session state
 */
export interface TaskResult {
  /** Task completed successfully */
  success: boolean;
  /** Task ID */
  taskId: string;
  /** Files changed during task */
  filesChanged: string[];
  /** Summary of what was done */
  summary: string;
  /** Error message if failed */
  error?: string;
  /** Tokens used */
  tokensUsed: number;
  /** Cost in USD */
  costUsd: number;
  /** Timestamp */
  completedAt: string;
}

/**
 * Orchestrator result stored in session state
 */
export interface OrchestratorResult {
  /** Overall success */
  success: boolean;
  /** Completed task IDs */
  completedTasks: string[];
  /** Failed task IDs */
  failedTasks: string[];
  /** Skipped task IDs */
  skippedTasks: string[];
  /** Total tokens used */
  totalTokensUsed: number;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Duration in ms */
  durationMs: number;
}

/**
 * State keys used in multi-agent session
 */
export const STATE_KEYS = {
  // Per-task results
  taskResult: (taskId: string) => `task:${taskId}:result` as const,
  taskFiles: (taskId: string) => `task:${taskId}:files` as const,
  taskError: (taskId: string) => `task:${taskId}:error` as const,

  // Level aggregates
  levelCompleted: (level: number) => `level:${level}:completed` as const,
  levelFailed: (level: number) => `level:${level}:failed` as const,

  // Accumulated context
  accumulatedChanges: 'context:accumulated_changes' as const,
  warnings: 'context:warnings' as const,
  learnedPatterns: 'context:learned_patterns' as const,

  // PRD metadata
  prdVersion: 'prd:version' as const,
  prdTotalTasks: 'prd:total_tasks' as const,
  prdCurrentPhase: 'prd:current_phase' as const,

  // Orchestrator output
  orchestratorResult: 'orchestrator:result' as const,
} as const;

/**
 * PRD execution phases
 */
export type PrdPhase = 'planning' | 'execution' | 'validation' | 'completed' | 'failed';

/**
 * Level grouping result
 */
export interface TaskLevel {
  levelIndex: number;
  tasks: PRDTask[];
  /** All tasks in this level are independent (no cross-dependencies) */
  isParallelizable: boolean;
}
