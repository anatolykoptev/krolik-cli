/**
 * @module lib/@felix/router
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
  determineExecutionPlan,
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
// Model Tiers (single source of truth)
export {
  ALL_MODELS,
  canModelEscalate,
  compareTiers,
  DEFAULT_ESCALATION_PROBABILITY,
  DEFAULT_MODELS,
  estimateCost,
  getCheapestModel,
  getCheapestModelInTier,
  getDefaultEscalationProbability,
  getDefaultModel,
  getEscalationPath,
  getModelInfo,
  getModelProvider,
  getModelsForProvider,
  getModelsInTier,
  getModelTier,
  getNextTier as getNextTierUp,
  getPremiumModel,
  getPreviousTier,
  getTierEscalationPaths,
  isTierHigher,
  isTierLower,
  MODEL_INFO,
  scoreToTier,
  TIER_HIERARCHY,
  TIER_THRESHOLDS,
} from './model-tiers';
// Router (main entry point)
export {
  formatRoutingDecision,
  formatRoutingDecisionsXml,
  getRoutingPlanSummary,
  type PRDRoutingPlan,
  type RoutePRDOptions,
  type RouteTaskOptions,
  routePRD,
  routeTask,
  routeTasks,
} from './router';
// Rules (scoring - uses model-tiers internally)
export { calculateTaskScore } from './rules';
// Types
export type {
  AttemptWithRouting,
  CascadeConfig,
  CostEstimate,
  ErrorCategory,
  ExecutionMode,
  ExecutionPlan,
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
