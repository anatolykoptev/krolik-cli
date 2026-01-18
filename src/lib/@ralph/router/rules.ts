/**
 * @module lib/@ralph/router/rules
 * @description Rule-based model selection from task attributes
 */

import type {
  ModelInfo,
  ModelName,
  ModelTier,
  ScoringResult,
  TaskAttributes,
  TaskComplexity,
} from './types';

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

export const MODEL_INFO: Record<ModelName, ModelInfo> = {
  haiku: {
    name: 'haiku',
    provider: 'anthropic',
    tier: 'cheap',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
  },
  flash: {
    name: 'flash',
    provider: 'google',
    tier: 'cheap',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
  },
  sonnet: {
    name: 'sonnet',
    provider: 'anthropic',
    tier: 'mid',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  pro: {
    name: 'pro',
    provider: 'google',
    tier: 'mid',
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
  },
  opus: {
    name: 'opus',
    provider: 'anthropic',
    tier: 'premium',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
};

// Default model per tier (prefer cheaper within tier)
export const DEFAULT_MODELS: Record<ModelTier, ModelName> = {
  cheap: 'flash', // Flash is cheaper than Haiku
  mid: 'pro', // Pro is cheaper than Sonnet
  premium: 'opus',
};

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const COMPLEXITY_SCORES: Record<TaskComplexity, number> = {
  trivial: 10,
  simple: 25,
  moderate: 50,
  complex: 75,
  epic: 95,
};

const TAG_BOOSTS: Record<string, number> = {
  // High complexity indicators
  architecture: 20,
  security: 15,
  performance: 10,
  refactor: 10,
  migration: 15,
  database: 10,
  api: 5,

  // Low complexity indicators
  lint: -15,
  typo: -25,
  formatting: -20,
  docs: -10,
  comment: -15,
  rename: -10,
  cleanup: -5,
};

const TIER_THRESHOLDS = {
  cheap: { min: 0, max: 35 },
  mid: { min: 36, max: 65 },
  premium: { min: 66, max: 100 },
};

// ============================================================================
// RULE ENGINE
// ============================================================================

/**
 * Calculate task score based on attributes
 */
export function calculateTaskScore(task: TaskAttributes): ScoringResult {
  // Base score from complexity
  const complexity = task.complexity ?? 'moderate';
  const base = COMPLEXITY_SCORES[complexity];

  // Files boost: +5 per file over 2
  const filesCount = task.filesAffected?.length ?? 0;
  const filesBoost = Math.max(0, (filesCount - 2) * 5);

  // Criteria boost: +3 per criterion over 2
  const criteriaCount = task.acceptanceCriteria?.length ?? 0;
  const criteriaBoost = Math.max(0, (criteriaCount - 2) * 3);

  // Tags boost: sum of matching tag weights
  const tagsBoost = (task.tags ?? []).reduce((sum, tag) => {
    const normalizedTag = tag.toLowerCase();
    return sum + (TAG_BOOSTS[normalizedTag] ?? 0);
  }, 0);

  // Total score clamped to 0-100
  const rawScore = base + filesBoost + criteriaBoost + tagsBoost;
  const score = Math.max(0, Math.min(100, rawScore));

  // Determine tier
  const tier = scoreToTier(score);

  return {
    score,
    tier,
    breakdown: {
      base,
      filesBoost,
      criteriaBoost,
      tagsBoost,
    },
    suggestedModel: DEFAULT_MODELS[tier],
  };
}

/**
 * Convert score to tier
 */
export function scoreToTier(score: number): ModelTier {
  if (score <= TIER_THRESHOLDS.cheap.max) return 'cheap';
  if (score <= TIER_THRESHOLDS.mid.max) return 'mid';
  return 'premium';
}

/**
 * Get all models in a tier
 */
export function getModelsInTier(tier: ModelTier): ModelName[] {
  return Object.values(MODEL_INFO)
    .filter((m) => m.tier === tier)
    .map((m) => m.name);
}

/**
 * Get escalation path from a model
 * Returns models in order of increasing capability/cost
 */
export function getEscalationPath(fromModel: ModelName): ModelName[] {
  const tiers: ModelTier[] = ['cheap', 'mid', 'premium'];
  const currentTier = MODEL_INFO[fromModel].tier;
  const currentTierIndex = tiers.indexOf(currentTier);

  const path: ModelName[] = [];

  // Add remaining models in current tier (excluding current)
  for (const model of getModelsInTier(currentTier)) {
    if (model !== fromModel) {
      path.push(model);
    }
  }

  // Add models from higher tiers
  for (let i = currentTierIndex + 1; i < tiers.length; i++) {
    const tier = tiers[i];
    if (tier) {
      path.push(...getModelsInTier(tier));
    }
  }

  return path;
}

/**
 * Compare tiers (returns -1, 0, or 1)
 */
export function compareTiers(a: ModelTier, b: ModelTier): number {
  const order: ModelTier[] = ['cheap', 'mid', 'premium'];
  return order.indexOf(a) - order.indexOf(b);
}

/**
 * Estimate cost for a model given token counts
 */
export function estimateCost(model: ModelName, inputTokens: number, outputTokens: number): number {
  const info = MODEL_INFO[model];
  const inputCost = (inputTokens / 1_000_000) * info.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * info.outputCostPer1M;
  return inputCost + outputCost;
}
