/**
 * @module lib/@felix/router/cost-estimator
 * @description Pre-execution cost estimation
 *
 * Provides three estimates:
 * - Optimistic: all cheap, no retries
 * - Expected: based on history escalation rates
 * - Pessimistic: all escalate to opus
 */

import { createTaskSignature, getRoutingPatterns } from './history';
import {
  estimateCost,
  getCheapestModel,
  getDefaultEscalationProbability,
  getModelTier,
  getPremiumModel,
} from './model-tiers';
import { calculateTaskScore } from './rules';
import type { CostEstimate, TaskAttributes, TaskCostEstimate } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Average tokens per task (based on typical PRD task execution)
const DEFAULT_INPUT_TOKENS = 4000;
const DEFAULT_OUTPUT_TOKENS = 2000;

// Token multipliers by complexity
const COMPLEXITY_TOKEN_MULTIPLIERS: Record<string, number> = {
  trivial: 0.5,
  simple: 0.75,
  moderate: 1.0,
  complex: 1.5,
  epic: 2.5,
};

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Estimate tokens for a task based on complexity
 */
function estimateTokens(task: TaskAttributes): { input: number; output: number } {
  const complexity = task.complexity ?? 'moderate';
  const multiplier = COMPLEXITY_TOKEN_MULTIPLIERS[complexity] ?? 1.0;

  // Add multiplier for files affected
  const filesMultiplier = 1 + (task.filesAffected?.length ?? 0) * 0.1;

  return {
    input: Math.round(DEFAULT_INPUT_TOKENS * multiplier * filesMultiplier),
    output: Math.round(DEFAULT_OUTPUT_TOKENS * multiplier * filesMultiplier),
  };
}

/**
 * Estimate cost for a single task
 */
export function estimateTaskCost(task: TaskAttributes, projectPath?: string): TaskCostEstimate {
  const { tier, suggestedModel } = calculateTaskScore(task);
  const tokens = estimateTokens(task);

  // Check history for escalation probability
  let escalationProbability = 0;

  if (projectPath) {
    const signature = createTaskSignature(task);
    const patterns = getRoutingPatterns(signature.hash, projectPath);

    if (patterns.length > 0) {
      // Calculate escalation probability from history
      let totalAttempts = 0;
      let escalatedAttempts = 0;

      for (const pattern of patterns) {
        const patternTier = getModelTier(pattern.model);
        if (patternTier !== tier) {
          // This was an escalation
          escalatedAttempts += pattern.successCount + pattern.failCount;
        }
        totalAttempts += pattern.successCount + pattern.failCount;
      }

      if (totalAttempts > 0) {
        escalationProbability = escalatedAttempts / totalAttempts;
      }
    } else {
      // No history - use default escalation probability based on tier
      escalationProbability = getDefaultEscalationProbability(tier);
    }
  } else {
    // No project path - use default escalation probability
    escalationProbability = getDefaultEscalationProbability(tier);
  }

  // Calculate costs for different scenarios
  const cheapestModel = getCheapestModel();
  const expectedModel = suggestedModel;
  const premiumModel = getPremiumModel();

  const optimisticCost = estimateCost(cheapestModel, tokens.input, tokens.output);
  const baseCost = estimateCost(expectedModel, tokens.input, tokens.output);
  const premiumCost = estimateCost(premiumModel, tokens.input, tokens.output);

  // Expected cost includes potential escalation
  const expectedCost = baseCost * (1 - escalationProbability) + premiumCost * escalationProbability;

  return {
    taskId: task.id,
    estimatedModel: expectedModel,
    estimatedTokens: tokens.input + tokens.output,
    optimisticCost,
    expectedCost,
    pessimisticCost: premiumCost,
    escalationProbability,
  };
}

/**
 * Estimate total cost for a list of tasks
 */
export function estimateTotalCost(tasks: TaskAttributes[], projectPath?: string): CostEstimate {
  const breakdown: TaskCostEstimate[] = [];

  let optimistic = 0;
  let expected = 0;
  let pessimistic = 0;

  for (const task of tasks) {
    const taskEstimate = estimateTaskCost(task, projectPath);
    breakdown.push(taskEstimate);

    optimistic += taskEstimate.optimisticCost;
    expected += taskEstimate.expectedCost;
    pessimistic += taskEstimate.pessimisticCost;
  }

  return {
    optimistic,
    expected,
    pessimistic,
    breakdown,
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const lines: string[] = [];

  lines.push('Cost Estimate:');
  lines.push(`  Optimistic: $${estimate.optimistic.toFixed(4)}`);
  lines.push(`  Expected:   $${estimate.expected.toFixed(4)}`);
  lines.push(`  Pessimistic: $${estimate.pessimistic.toFixed(4)}`);
  lines.push('');
  lines.push('Task Breakdown:');

  for (const task of estimate.breakdown) {
    const escProb = (task.escalationProbability * 100).toFixed(0);
    lines.push(
      `  ${task.taskId}: ${task.estimatedModel} (~${task.estimatedTokens} tokens, ` +
        `$${task.expectedCost.toFixed(4)}, ${escProb}% escalation risk)`,
    );
  }

  return lines.join('\n');
}

/**
 * Format cost estimate as XML for AI consumption
 */
export function formatCostEstimateXml(estimate: CostEstimate): string {
  const lines: string[] = [];

  lines.push('<cost-estimate>');
  lines.push(`  <optimistic>$${estimate.optimistic.toFixed(4)}</optimistic>`);
  lines.push(`  <expected>$${estimate.expected.toFixed(4)}</expected>`);
  lines.push(`  <pessimistic>$${estimate.pessimistic.toFixed(4)}</pessimistic>`);
  lines.push('  <tasks>');

  for (const task of estimate.breakdown) {
    lines.push(`    <task id="${task.taskId}">`);
    lines.push(`      <model>${task.estimatedModel}</model>`);
    lines.push(`      <tokens>${task.estimatedTokens}</tokens>`);
    lines.push(`      <cost>$${task.expectedCost.toFixed(4)}</cost>`);
    lines.push(
      `      <escalation-risk>${(task.escalationProbability * 100).toFixed(0)}%</escalation-risk>`,
    );
    lines.push('    </task>');
  }

  lines.push('  </tasks>');
  lines.push('</cost-estimate>');

  return lines.join('\n');
}
