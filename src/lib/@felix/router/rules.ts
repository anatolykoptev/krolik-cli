/**
 * @module lib/@ralph/router/rules
 * @description Rule-based model selection from task attributes
 */

import {
  compareTiers,
  DEFAULT_MODELS,
  estimateCost,
  getEscalationPath,
  getModelsInTier,
  MODEL_INFO,
  scoreToTier,
} from './model-tiers';
import type { ScoringResult, TaskAttributes, TaskComplexity } from './types';

// Re-export from model-tiers for backwards compatibility
export {
  compareTiers,
  DEFAULT_MODELS,
  estimateCost,
  getEscalationPath,
  getModelsInTier,
  MODEL_INFO,
  scoreToTier,
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
