/**
 * @module lib/@storage/ralph/types
 * @description Types for Ralph Loop storage
 */

import type { MemoryType } from '../memory/types';

/**
 * Guardrail severity level
 */
export type GuardrailSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'error'
  | 'warning'
  | 'info';

// ============================================================================
// RALPH ATTEMPT TYPES
// ============================================================================

export interface FelixAttemptRow {
  id: number;
  task_id: number;
  prd_task_id: string;
  attempt_number: number;
  started_at: string;
  ended_at: string | null;
  success: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string | null;
  error_message: string | null;
  error_stack: string | null;
  files_modified: string;
  commands_executed: string;
  commit_sha: string | null;
  validation_passed: number;
  validation_output: string | null;
}

export interface FelixAttempt {
  id: number;
  taskId: number;
  prdTaskId: string;
  attemptNumber: number;
  startedAt: string;
  endedAt?: string | undefined;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model?: string | undefined;
  errorMessage?: string | undefined;
  errorStack?: string | undefined;
  filesModified: string[];
  commandsExecuted: string[];
  commitSha?: string | undefined;
  validationPassed: boolean;
  validationOutput?: string | undefined;
}

export interface FelixAttemptCreate {
  taskId: number;
  prdTaskId: string;
  attemptNumber: number;
  model?: string;
  /** Signature hash for history-based routing */
  signatureHash?: string;
  /** Model escalated from (if this is a retry with different model) */
  escalatedFrom?: string;
}

export interface FelixAttemptComplete {
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  errorMessage?: string;
  errorStack?: string;
  filesModified?: string[];
  commandsExecuted?: string[];
  commitSha?: string;
  validationPassed?: boolean;
  validationOutput?: string;
}

// ============================================================================
// RALPH GUARDRAIL TYPES
// ============================================================================

export type GuardrailCategory =
  | 'code-quality'
  | 'testing'
  | 'security'
  | 'dependencies'
  | 'performance'
  | 'architecture'
  | 'api'
  | 'database'
  | 'typescript'
  | 'react'
  | 'other';

export interface FelixGuardrailRow {
  id: number;
  project: string;
  type: string;
  category: string;
  severity: string;
  title: string;
  problem: string;
  solution: string;
  example: string | null;
  tags: string;
  related_tasks: string;
  usage_count: number;
  last_used_at: string | null;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface FelixGuardrail {
  id: number;
  project: string;
  type: MemoryType;
  category: GuardrailCategory;
  severity: GuardrailSeverity;
  title: string;
  problem: string;
  solution: string;
  example?: string | undefined;
  tags: string[];
  relatedTasks: string[];
  usageCount: number;
  lastUsedAt?: string | undefined;
  supersededBy?: number | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface FelixGuardrailCreate {
  project: string;
  type?: MemoryType;
  category: GuardrailCategory;
  severity: GuardrailSeverity;
  title: string;
  problem: string;
  solution: string;
  example?: string;
  tags?: string[];
  relatedTasks?: string[];
}

// ============================================================================
// RALPH SESSION TYPES
// ============================================================================

export type RalphSessionStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface RalphSessionRow {
  id: string;
  project: string;
  prd_path: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  skipped_tasks: number;
  total_tokens: number;
  total_cost_usd: number;
  current_task_id: string | null;
  config: string;
}

export interface RalphSession {
  id: string;
  project: string;
  prdPath: string;
  startedAt: string;
  endedAt?: string | undefined;
  status: RalphSessionStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  totalTokens: number;
  totalCostUsd: number;
  currentTaskId?: string | undefined;
  config: Record<string, unknown>;
}

export interface RalphSessionCreate {
  /** Project name (for display/identification) */
  project: string;
  /** Full path to project root (for database location) */
  projectPath: string;
  prdPath: string;
  totalTasks: number;
  config?: Record<string, unknown>;
}

/**
 * Alias for RalphSessionCreate (for backward compatibility)
 */
export type CreateSessionConfig = RalphSessionCreate;
