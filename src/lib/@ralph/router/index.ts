/**
 * @module lib/@ralph/router
 * @description Model Router for adaptive model selection
 *
 * Features:
 * - Rule-based initial model selection from task attributes
 * - History-based adjustments from past attempts
 * - Cascade fallback on failure (cheap → mid → premium)
 * - Cost estimation before execution
 */

// Cascade (fallback execution)
export {
  type CascadeExecutorOptions,
  canEscalate,
  classifyError,
  createCascadeDecision,
  DEFAULT_CASCADE_CONFIG,
  executeWithCascade,
  getNextTier,
} from './cascade';
// Cost estimation
export {
  estimateTaskCost,
  estimateTotalCost,
  formatCostEstimate,
  formatCostEstimateXml,
} from './cost-estimator';

// History (learning from past attempts)
export {
  analyzeHistory,
  createTaskSignature,
  getBestModelFromHistory,
  getRoutingPatterns,
  getRoutingStats,
  updateRoutingPattern,
} from './history';
// Router (main entry point)
export {
  formatRoutingDecision,
  formatRoutingDecisionsXml,
  getRoutingPlanSummary,
  type RouteTaskOptions,
  routeTask,
  routeTasks,
} from './router';
// Rules (scoring and model configuration)
export {
  calculateTaskScore,
  compareTiers,
  DEFAULT_MODELS,
  estimateCost,
  getEscalationPath,
  getModelsInTier,
  MODEL_INFO,
  scoreToTier,
} from './rules';
// Types
export type {
  AttemptWithRouting,
  CascadeConfig,
  CostEstimate,
  ErrorCategory,
  ExecutionResult,
  HistoryAdjustment,
  ModelInfo,
  ModelName,
  ModelPreference,
  ModelProvider,
  ModelTier,
  RoutingDecision,
  RoutingPattern,
  RoutingPatternRow,
  ScoringResult,
  TaskAttributes,
  TaskComplexity,
  TaskCostEstimate,
  TaskSignature,
} from './types';
