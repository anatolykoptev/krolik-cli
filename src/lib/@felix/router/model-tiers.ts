/**
 * @module lib/@ralph/router/model-tiers
 * @description Single Source of Truth for Model Tier Management
 *
 * Centralizes all model tier logic:
 * - Tier hierarchy and definitions
 * - Model information with pricing (generated from models.config.ts)
 * - Tier-related utility functions
 * - Escalation path generation
 *
 * This module is the canonical source for model tiers.
 * All other modules should import from here.
 *
 * To add new models: edit models.config.ts MODEL_DEFINITIONS array
 */

import {
  getDefaultModelForTier,
  getEnabledModels,
  getModelsByTier as getModelsByTierFromConfig,
  type ModelDefinition,
} from './models.config.js';
import type { ModelInfo, ModelName, ModelProvider, ModelTier } from './types';

// ============================================================================
// TIER HIERARCHY
// ============================================================================

/**
 * Tier hierarchy from lowest to highest capability/cost
 * Used for tier comparison and escalation path generation
 */
export const TIER_HIERARCHY: readonly ModelTier[] = ['free', 'cheap', 'mid', 'premium'] as const;

/**
 * Tier thresholds for score-based tier selection
 */
export const TIER_THRESHOLDS: Readonly<Record<ModelTier, { min: number; max: number }>> = {
  free: { min: 0, max: 20 },
  cheap: { min: 21, max: 40 },
  mid: { min: 41, max: 65 },
  premium: { min: 66, max: 100 },
};

/**
 * Default escalation probability by tier (when no history available)
 */
export const DEFAULT_ESCALATION_PROBABILITY: Readonly<Record<ModelTier, number>> = {
  free: 0.3, // Higher escalation probability for free tier
  cheap: 0.2,
  mid: 0.1,
  premium: 0,
};

// ============================================================================
// MODEL CONFIGURATION (Generated from models.config.ts)
// ============================================================================

/**
 * Convert ModelDefinition to ModelInfo
 */
function definitionToInfo(def: ModelDefinition): ModelInfo {
  return {
    name: def.id as ModelName,
    provider: def.provider as ModelProvider,
    tier: def.tier,
    inputCostPer1M: def.inputCostPer1M,
    outputCostPer1M: def.outputCostPer1M,
  };
}

/**
 * Generate MODEL_INFO from models.config.ts definitions
 * This is computed at module load time
 */
function generateModelInfo(): Record<ModelName, ModelInfo> {
  const models = getEnabledModels();
  const info: Record<string, ModelInfo> = {};
  for (const model of models) {
    info[model.id] = definitionToInfo(model);
  }
  return info as Record<ModelName, ModelInfo>;
}

/**
 * Generate DEFAULT_MODELS from models.config.ts
 * Picks the cheapest model for each tier
 */
function generateDefaultModels(): Record<ModelTier, ModelName> {
  const defaults: Record<string, string> = {};
  for (const tier of TIER_HIERARCHY) {
    const model = getDefaultModelForTier(tier);
    if (model) {
      defaults[tier] = model.id;
    }
  }
  return defaults as Record<ModelTier, ModelName>;
}

/**
 * Complete model information including pricing
 * Generated from models.config.ts MODEL_DEFINITIONS
 *
 * To add models: edit models.config.ts, not this file
 */
export const MODEL_INFO: Readonly<Record<ModelName, ModelInfo>> = generateModelInfo();

/**
 * Default (preferred) model per tier
 * Generated from models.config.ts - picks cheapest model in each tier
 */
export const DEFAULT_MODELS: Readonly<Record<ModelTier, ModelName>> = generateDefaultModels();

/**
 * All available model names (generated from config)
 */
export const ALL_MODELS: readonly ModelName[] = getEnabledModels().map((m) => m.id) as ModelName[];

// ============================================================================
// TIER UTILITIES
// ============================================================================

/**
 * Get the tier for a model
 *
 * @param model - Model name to get tier for
 * @returns The tier of the model
 */
export function getModelTier(model: ModelName): ModelTier {
  return MODEL_INFO[model].tier;
}

/**
 * Get model info for a model
 *
 * @param model - Model name to get info for
 * @returns Complete model information
 */
export function getModelInfo(model: ModelName): ModelInfo {
  return MODEL_INFO[model];
}

/**
 * Get the default model for a tier
 *
 * @param tier - Tier to get default model for
 * @returns The default model for the tier
 */
export function getDefaultModel(tier: ModelTier): ModelName {
  return DEFAULT_MODELS[tier];
}

/**
 * Get all models in a specific tier
 *
 * @param tier - Tier to get models for
 * @returns Array of model names in the tier
 */
export function getModelsInTier(tier: ModelTier): ModelName[] {
  return getModelsByTierFromConfig(tier).map((m) => m.id as ModelName);
}

/**
 * Get the next tier up from the given tier
 *
 * @param tier - Current tier
 * @returns Next higher tier, or null if already at premium
 */
export function getNextTier(tier: ModelTier): ModelTier | null {
  const currentIndex = TIER_HIERARCHY.indexOf(tier);
  if (currentIndex < 0 || currentIndex >= TIER_HIERARCHY.length - 1) {
    return null;
  }
  return TIER_HIERARCHY[currentIndex + 1] ?? null;
}

/**
 * Get the previous tier down from the given tier
 *
 * @param tier - Current tier
 * @returns Previous lower tier, or null if already at cheap
 */
export function getPreviousTier(tier: ModelTier): ModelTier | null {
  const currentIndex = TIER_HIERARCHY.indexOf(tier);
  if (currentIndex <= 0) {
    return null;
  }
  return TIER_HIERARCHY[currentIndex - 1] ?? null;
}

/**
 * Check if a model can be escalated (not at premium tier)
 *
 * @param model - Model name to check
 * @returns True if the model can be escalated
 */
export function canModelEscalate(model: ModelName): boolean {
  return getModelTier(model) !== 'premium';
}

/**
 * Compare two tiers
 *
 * @param a - First tier
 * @param b - Second tier
 * @returns Negative if a < b, 0 if equal, positive if a > b
 */
export function compareTiers(a: ModelTier, b: ModelTier): number {
  return TIER_HIERARCHY.indexOf(a) - TIER_HIERARCHY.indexOf(b);
}

/**
 * Check if tier a is higher than tier b
 *
 * @param a - First tier
 * @param b - Second tier
 * @returns True if a is higher than b
 */
export function isTierHigher(a: ModelTier, b: ModelTier): boolean {
  return compareTiers(a, b) > 0;
}

/**
 * Check if tier a is lower than tier b
 *
 * @param a - First tier
 * @param b - Second tier
 * @returns True if a is lower than b
 */
export function isTierLower(a: ModelTier, b: ModelTier): boolean {
  return compareTiers(a, b) < 0;
}

// ============================================================================
// ESCALATION PATH
// ============================================================================

/**
 * Get escalation path from a model
 * Returns models in order of increasing capability/cost
 *
 * @param fromModel - Starting model
 * @returns Array of models to escalate to, in order
 */
export function getEscalationPath(fromModel: ModelName): ModelName[] {
  const currentTier = getModelTier(fromModel);
  const currentTierIndex = TIER_HIERARCHY.indexOf(currentTier);

  // Premium tier's default model has nowhere to escalate
  if (currentTier === 'premium' && fromModel === DEFAULT_MODELS.premium) {
    return [];
  }

  const path: ModelName[] = [];

  // Add remaining models in current tier (excluding current)
  for (const model of getModelsInTier(currentTier)) {
    if (model !== fromModel) {
      path.push(model);
    }
  }

  // Add models from higher tiers
  for (let i = currentTierIndex + 1; i < TIER_HIERARCHY.length; i++) {
    const tier = TIER_HIERARCHY[i];
    if (tier) {
      path.push(...getModelsInTier(tier));
    }
  }

  return path;
}

/**
 * Get dynamic escalation paths for each tier
 * Generated from models.config.ts - includes all models from current tier and higher
 *
 * @returns Record mapping each tier to its escalation path
 */
export function getTierEscalationPaths(): Record<ModelTier, ModelName[]> {
  const paths: Record<string, ModelName[]> = {};

  for (let i = 0; i < TIER_HIERARCHY.length; i++) {
    const tier = TIER_HIERARCHY[i]!;
    const path: ModelName[] = [];

    // Premium tier only has the default model in escalation path
    if (tier === 'premium') {
      paths[tier] = [DEFAULT_MODELS.premium];
      continue;
    }

    // Include models from this tier and all higher tiers
    for (let j = i; j < TIER_HIERARCHY.length; j++) {
      const tierModels = getModelsInTier(TIER_HIERARCHY[j]!);
      // For premium tier, only include the default model
      if (TIER_HIERARCHY[j] === 'premium') {
        path.push(DEFAULT_MODELS.premium);
      } else {
        path.push(...tierModels);
      }
    }

    paths[tier] = path;
  }

  return paths as Record<ModelTier, ModelName[]>;
}

// ============================================================================
// SCORE TO TIER CONVERSION
// ============================================================================

/**
 * Convert a score (0-100) to a tier
 *
 * @param score - Score value between 0 and 100
 * @returns The appropriate tier for the score
 */
export function scoreToTier(score: number): ModelTier {
  if (score <= TIER_THRESHOLDS.free.max) return 'free';
  if (score <= TIER_THRESHOLDS.cheap.max) return 'cheap';
  if (score <= TIER_THRESHOLDS.mid.max) return 'mid';
  return 'premium';
}

/**
 * Get the default escalation probability for a tier
 *
 * @param tier - Tier to get probability for
 * @returns Default escalation probability (0-1)
 */
export function getDefaultEscalationProbability(tier: ModelTier): number {
  return DEFAULT_ESCALATION_PROBABILITY[tier];
}

// ============================================================================
// COST UTILITIES
// ============================================================================

/**
 * Estimate cost for a model given token counts
 *
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Estimated cost in USD
 */
export function estimateCost(model: ModelName, inputTokens: number, outputTokens: number): number {
  const info = MODEL_INFO[model];
  const inputCost = (inputTokens / 1_000_000) * info.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * info.outputCostPer1M;
  return inputCost + outputCost;
}

/**
 * Get the cheapest model in a tier
 *
 * @param tier - Tier to find cheapest model in
 * @returns The cheapest model in the tier
 */
export function getCheapestModelInTier(tier: ModelTier): ModelName {
  const models = getModelsInTier(tier);
  let cheapest = models[0]!;
  let lowestCost = MODEL_INFO[cheapest].inputCostPer1M + MODEL_INFO[cheapest].outputCostPer1M;

  for (const model of models.slice(1)) {
    const cost = MODEL_INFO[model].inputCostPer1M + MODEL_INFO[model].outputCostPer1M;
    if (cost < lowestCost) {
      lowestCost = cost;
      cheapest = model;
    }
  }

  return cheapest;
}

/**
 * Get the overall cheapest model
 *
 * @returns The cheapest model overall
 */
export function getCheapestModel(): ModelName {
  return getCheapestModelInTier('cheap');
}

/**
 * Get the most expensive (premium) model
 *
 * @returns The most expensive model
 */
export function getPremiumModel(): ModelName {
  return DEFAULT_MODELS.premium;
}

// ============================================================================
// PROVIDER UTILITIES
// ============================================================================

/**
 * Get all models for a provider
 *
 * @param provider - Provider to get models for
 * @returns Array of model names for the provider
 */
export function getModelsForProvider(provider: ModelProvider): ModelName[] {
  return Object.values(MODEL_INFO)
    .filter((m) => m.provider === provider)
    .map((m) => m.name);
}

/**
 * Get the provider for a model
 *
 * @param model - Model name
 * @returns Provider of the model
 */
export function getModelProvider(model: ModelName): ModelProvider {
  return MODEL_INFO[model].provider;
}
