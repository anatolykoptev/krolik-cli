/**
 * @module commands/agent/orchestrator/types
 * @description Types for agent orchestration
 */

import type { AgentCategory, AgentDefinition } from '../types';

/**
 * Task types the orchestrator can detect
 */
export type TaskType =
  | 'code-review'
  | 'security-audit'
  | 'performance-optimization'
  | 'architecture-design'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'refactoring'
  | 'feature-implementation'
  | 'multi-domain'
  | 'unknown';

/**
 * Execution strategy for agents
 */
export type ExecutionStrategy = 'sequential' | 'parallel' | 'mixed';

/**
 * Agent recommendation with priority
 */
export interface AgentRecommendation {
  agent: AgentDefinition;
  priority: number; // 1 = highest
  reason: string;
  parallel: boolean; // Can run in parallel with others
}

/**
 * Execution phase (agents in same phase can run in parallel)
 */
export interface ExecutionPhase {
  name: string;
  agents: AgentRecommendation[];
  parallel: boolean;
}

/**
 * Execution plan for agents
 */
export interface ExecutionPlan {
  /** Phases of execution (each phase can have parallel agents) */
  phases: ExecutionPhase[];
  /** Total estimated agents */
  totalAgents: number;
  /** Execution strategy used */
  strategy: ExecutionStrategy;
}

/**
 * Task analysis result from orchestrator
 */
export interface TaskAnalysis {
  /** Original task description */
  task: string;
  /** Detected task type */
  taskType: TaskType;
  /** Confidence level (0-1) */
  confidence: number;
  /** Detected categories */
  categories: AgentCategory[];
  /** Recommended agents */
  agents: AgentRecommendation[];
  /** Execution strategy */
  strategy: ExecutionStrategy;
  /** Keywords that triggered detection */
  keywords: string[];
}

/**
 * Orchestration options
 */
export interface OrchestrateOptions {
  /** Maximum agents to run */
  maxAgents?: number | undefined;
  /** Categories to include/exclude */
  includeCategories?: AgentCategory[] | undefined;
  excludeCategories?: AgentCategory[] | undefined;
  /** Prefer parallel execution */
  preferParallel?: boolean | undefined;
  /** Include project context */
  includeContext?: boolean | undefined;
  /** Target file for analysis */
  file?: string | undefined;
  /** Feature/domain to focus on */
  feature?: string | undefined;
  /** Dry run - don't execute, just plan */
  dryRun?: boolean | undefined;
  /** Output format */
  format?: 'text' | 'xml' | 'json' | undefined;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  analysis: TaskAnalysis;
  plan: ExecutionPlan;
  context?: import('../types').AgentContext | undefined;
  durationMs: number;
}

/**
 * Detected task type with score (internal)
 */
export interface DetectedType {
  type: TaskType;
  score: number;
  keywords: string[];
}

/**
 * Task keyword configuration
 */
export interface TaskKeywordConfig {
  keywords: string[];
  categories: AgentCategory[];
}
