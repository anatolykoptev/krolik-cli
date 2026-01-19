/**
 * @module lib/@felix/router/types
 * @description Types for Model Router system
 */

// ============================================================================
// MODEL TIERS AND MODELS
// ============================================================================

export type ModelTier = 'free' | 'cheap' | 'mid' | 'premium';

/**
 * Known model names - extend this union when adding new models
 * For full flexibility, use `string` but lose autocomplete
 * IMPORTANT: Keep in sync with MODEL_DEFINITIONS in models.config.ts
 */
export type ModelName =
  // Free tier (VibeProxy - Antigravity)
  | 'vibe-opus'
  | 'vibe-sonnet'
  | 'vibe-sonnet-fast'
  | 'gemini-3-pro'
  // Free tier (Groq)
  | 'llama-70b'
  | 'llama-8b'
  | 'mixtral'
  | 'deepseek-r1'
  // Cheap tier
  | 'haiku'
  | 'flash'
  | 'gpt-4o-mini'
  // Mid tier
  | 'sonnet'
  | 'pro'
  | 'gpt-4o'
  // Premium tier
  | 'opus'
  | 'o1'
  | 'thinking';

/**
 * Known providers - extend when adding new integrations
 * IMPORTANT: Keep in sync with ProviderType in models.config.ts
 */
export type ModelProvider =
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openai'
  | 'mistral'
  | 'ollama'
  | 'vibeproxy';

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
// EXECUTION MODE
// ============================================================================

export type ExecutionMode = 'single' | 'multi';

export interface ExecutionPlan {
  /** Single agent or multi-agent mode */
  mode: ExecutionMode;
  /** Whether subtasks can run in parallel */
  parallelizable: boolean;
  /** Suggested number of agents for multi-mode */
  suggestedAgentCount: number;
  /** Reason for this execution mode */
  reason: string;
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
  /** Force execution mode */
  forceMode?: ExecutionMode;
}

export interface RoutingDecision {
  taskId: string;
  selectedModel: ModelName;
  tier: ModelTier;
  source: 'rule' | 'history' | 'preference' | 'escalation';
  score: number;
  canEscalate: boolean;
  escalationPath: ModelName[];
  /** Execution plan decided by router */
  execution: ExecutionPlan;
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
