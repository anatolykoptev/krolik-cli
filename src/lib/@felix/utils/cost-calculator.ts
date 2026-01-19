import type { TokenUsage } from '../types.js';

/**
 * Cost Calculator - Unified cost calculation for Krolik Felix
 *
 * Consolidates pricing and cost calculation from cost-plugin and executor.
 *
 * @module @felix/utils/cost-calculator
 */

// ============================================================================
// Model Pricing (per 1M tokens, Jan 2025)
// ============================================================================

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude 4 models
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  // Claude 3.5 models
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4.0 }, // Legacy alias
  // Claude 3 models
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  // Gemini models
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
};

// Default pricing for unknown models (Claude Sonnet rates)
const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

// ============================================================================
// Model ID Mapping
// ============================================================================

export type ModelAlias = 'opus' | 'sonnet' | 'haiku';
export type ModelId = keyof typeof MODEL_PRICING | string;

/**
 * Get full model ID from short alias
 */
export function getModelId(alias: ModelAlias): string {
  switch (alias) {
    case 'opus':
      return 'claude-opus-4-20250514';
    case 'haiku':
      return 'claude-haiku-3-5-20241022';
    default:
      return 'claude-sonnet-4-20250514';
  }
}

// ============================================================================
// Pricing Functions
// ============================================================================

/**
 * Get pricing for a model (with prefix matching for variants)
 */
export function getPricing(model: string): { input: number; output: number } {
  // Try exact match
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Try prefix match for model variants
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const prefix = key.split('-').slice(0, 2).join('-');
    if (model.startsWith(prefix)) {
      return pricing;
    }
  }

  return DEFAULT_PRICING;
}

/**
 * Calculate cost from model and token counts
 *
 * @param model - Model name or alias
 * @param inputTokens - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: string | ModelAlias,
  inputTokens: number,
  outputTokens: number,
): number {
  // Resolve alias to full model ID if needed
  const modelId = ['opus', 'sonnet', 'haiku'].includes(model)
    ? getModelId(model as ModelAlias)
    : model;

  const pricing = getPricing(modelId);

  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

// ============================================================================
// Token Usage Types
// ============================================================================

export interface CostTracking {
  tokens: TokenUsage;
  costUsd: number;
  model: string;
  timestamp: number;
}
