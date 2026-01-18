/**
 * @module lib/@ralph/router/types
 * @description Types for Model Router system
 */

// ============================================================================
// MODEL TIERS AND MODELS
// ============================================================================

export type ModelTier = 'cheap' | 'mid' | 'premium';

export type ModelName = 'haiku' | 'flash' | 'sonnet' | 'pro' | 'opus';

export type ModelProvider = 'anthropic' | 'google';

export interface ModelInfo {
  name: ModelName;
  provider: ModelProvider;
  tier: ModelTier;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

// ============================================================================
// TASK SCORING
// ============================================================================

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';

export interface TaskAttributes {
  id: string;
  complexity?: TaskComplexity | undefined;
  filesAffected?: string[] | undefined;
  acceptanceCriteria?: string[] | undefined;
  tags?: string[] | undefined;
}

export interface ScoringResult {
  score: number;
  tier: ModelTier;
  breakdown: {
    base: number;
    filesBoost: number;
    criteriaBoost: number;
    tagsBoost: number;
  };
  suggestedModel: ModelName;
}

// ============================================================================
// ROUTING DECISIONS
// ============================================================================

export interface ModelPreference {
  /** Force specific model */
  model?: ModelName;
  /** Minimum tier (can escalate but not go lower) */
  minTier?: ModelTier;
  /** Disable cascade fallback */
  noCascade?: boolean;
}

export interface RoutingDecision {
  taskId: string;
  selectedModel: ModelName;
  tier: ModelTier;
  source: 'rule' | 'history' | 'preference' | 'escalation';
  score: number;
  canEscalate: boolean;
  escalationPath: ModelName[];
}

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

export interface TaskSignature {
  hash: string;
  complexity: TaskComplexity;
  tags: string[];
  filesRange: 'few' | 'some' | 'many'; // 1-2, 3-5, 6+
}

export interface RoutingPattern {
  signatureHash: string;
  model: ModelName;
  successCount: number;
  failCount: number;
  avgCost: number;
  lastUpdated: string;
}

export interface HistoryAdjustment {
  originalTier: ModelTier;
  adjustedTier: ModelTier;
  reason: string;
  confidence: number; // 0-1, based on sample size
}

// ============================================================================
// CASCADE EXECUTION
// ============================================================================

export type ErrorCategory = 'syntax' | 'validation' | 'capability' | 'timeout' | 'unknown';

export interface ExecutionResult {
  success: boolean;
  model: ModelName;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errorCategory?: ErrorCategory | undefined;
  errorMessage?: string | undefined;
  escalatedFrom?: ModelName | undefined;
}

export interface CascadeConfig {
  maxRetries: number;
  retrySameModel: ErrorCategory[];
  escalateOn: ErrorCategory[];
  escalationPath: Record<ModelTier, ModelName[]>;
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

export interface CostEstimate {
  optimistic: number;
  expected: number;
  pessimistic: number;
  breakdown: TaskCostEstimate[];
}

export interface TaskCostEstimate {
  taskId: string;
  estimatedModel: ModelName;
  estimatedTokens: number;
  optimisticCost: number;
  expectedCost: number;
  pessimisticCost: number;
  escalationProbability: number;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface RoutingPatternRow {
  id: number;
  signature_hash: string;
  model: string;
  success_count: number;
  fail_count: number;
  avg_cost: number;
  last_updated: string;
}

export interface AttemptWithRouting {
  id: number;
  prdTaskId: string;
  model: ModelName;
  success: boolean;
  signatureHash?: string;
  escalatedFrom?: ModelName;
  costUsd: number;
}
