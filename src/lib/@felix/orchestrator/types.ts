/**
 * FelixOrchestrator Types
 *
 * Type definitions for the orchestrator module.
 *
 * @module @ralph/orchestrator/types
 */

import type { BasePlugin } from '@google/adk';
import type {
  CircuitBreakerPluginConfig,
  CircuitState,
} from '../plugins/circuit-breaker-plugin.js';
import type { CostTracking } from '../plugins/cost-plugin.js';
import type { QualityGateMode } from '../plugins/quality-gate-plugin.js';
import type { RateLimitPluginConfig } from '../plugins/rate-limit-plugin.js';
import type { ValidationStep } from '../plugins/validation-plugin.js';
import type { RalphLoopEvent, RalphLoopState, TaskExecutionResult } from '../types.js';

/**
 * Orchestrator configuration
 */
export interface FelixOrchestratorConfig {
  /** Project root directory */
  projectRoot: string;
  /** PRD file path (relative or absolute) */
  prdPath?: string;
  /** Model to use: claude (opus|sonnet|haiku) or gemini (flash|pro) */
  model?: string;
  /** Backend to use: cli (Claude Code/Gemini CLI) or api (requires API keys) */
  backend?: 'cli' | 'api';
  /** Maximum retry attempts per task */
  maxAttempts?: number;
  /** Maximum cost in USD (budget limit) */
  maxCostUsd?: number;
  /** Validation steps to run */
  validationSteps?: ValidationStep[];
  /** Continue to next task on failure */
  continueOnFailure?: boolean;
  /** Event handler for progress updates */
  onEvent?: (event: RalphLoopEvent) => void;
  /** Cost update callback */
  onCostUpdate?: (tracking: CostTracking) => void;
  /** Custom plugins to add */
  plugins?: BasePlugin[];
  /** Enable context injection (schema, routes, memories) */
  enableContext?: boolean;
  /** Enable git auto-commit on success */
  enableGitAutoCommit?: boolean;
  /** Quality gate mode (pre-commit, release, full) */
  qualityGateMode?: QualityGateMode;
  /** Enable memory auto-save */
  enableMemory?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Rate limit configuration (optional) */
  rateLimit?: RateLimitPluginConfig;
  /** Circuit breaker configuration (optional) - stops on consecutive failures */
  circuitBreaker?: CircuitBreakerPluginConfig;
  /** Callback when circuit breaker state changes */
  onCircuitBreakerTrip?: (state: CircuitState, failures: number) => void;
  /** Enable parallel execution of independent tasks (default: false for safety) */
  enableParallelExecution?: boolean;
  /** Maximum number of tasks to run in parallel (default: 3) */
  maxParallelTasks?: number;
  /** Enable checkpoint-based crash recovery (default: true) */
  enableCheckpoints?: boolean;
  /**
   * @deprecated Router now decides execution mode automatically based on task analysis.
   * This option is kept for backwards compatibility but is ignored.
   * The Router analyzes PRD complexity and chooses single/multi-agent mode.
   */
  useMultiAgentMode?: boolean;
}

/**
 * Config keys that are optional with callbacks/plugins
 */
type OptionalConfigKeys =
  | 'rateLimit'
  | 'circuitBreaker'
  | 'onCircuitBreakerTrip'
  | 'qualityGateMode';

/**
 * Config keys that have non-optional defaults
 */
type DefaultedConfigKeys =
  | 'enableParallelExecution'
  | 'maxParallelTasks'
  | 'enableCheckpoints'
  | 'useMultiAgentMode';

/**
 * Resolved config with defaults applied
 */
export type ResolvedConfig = Required<
  Omit<FelixOrchestratorConfig, OptionalConfigKeys | DefaultedConfigKeys>
> &
  Pick<FelixOrchestratorConfig, OptionalConfigKeys> & {
    [K in DefaultedConfigKeys]: NonNullable<FelixOrchestratorConfig[K]>;
  };

/**
 * Session result after run
 */
export interface OrchestratorResult {
  success: boolean;
  state: RalphLoopState;
  taskResults: TaskExecutionResult[];
  totalCost: number;
  totalTokens: number;
  duration: number;
}

/**
 * Validation state from ADK event
 */
export interface ValidationState {
  passed: boolean;
  failedSteps?: string[];
  totalDuration?: number;
}

/**
 * Cost state from ADK event
 */
export interface CostState {
  current: CostTracking;
  total: { tokens: { totalTokens: number }; costUsd: number };
}

/**
 * Retry state from ADK event
 */
export interface RetryState {
  attempt: number;
  maxAttempts?: number;
}
