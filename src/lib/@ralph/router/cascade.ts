/**
 * @module lib/@ralph/router/cascade
 * @description Cascade executor with fallback on failure
 *
 * Fallback logic:
 * - syntax/validation errors → retry same model
 * - capability errors → escalate to next tier
 * - Records outcome for history learning
 */

import { updateRoutingPattern } from './history';
import { getEscalationPath, MODEL_INFO } from './rules';
import type {
  CascadeConfig,
  ErrorCategory,
  ExecutionResult,
  ModelName,
  ModelTier,
  RoutingDecision,
} from './types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CASCADE_CONFIG: CascadeConfig = {
  maxRetries: 3,
  retrySameModel: ['syntax', 'validation'],
  escalateOn: ['capability', 'timeout'],
  escalationPath: {
    cheap: ['flash', 'haiku', 'pro', 'sonnet', 'opus'],
    mid: ['pro', 'sonnet', 'opus'],
    premium: ['opus'],
  },
};

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an error into a category
 */
export function classifyError(error: Error | string): ErrorCategory {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Syntax/parsing errors - retry with same model
  if (
    lowerMessage.includes('syntax error') ||
    lowerMessage.includes('parse error') ||
    lowerMessage.includes('unexpected token') ||
    lowerMessage.includes('invalid json')
  ) {
    return 'syntax';
  }

  // Validation errors - retry with same model (might be transient)
  if (
    lowerMessage.includes('validation failed') ||
    lowerMessage.includes('invalid input') ||
    lowerMessage.includes('missing required')
  ) {
    return 'validation';
  }

  // Capability errors - escalate to more capable model
  if (
    lowerMessage.includes('too complex') ||
    lowerMessage.includes('context too long') ||
    lowerMessage.includes('cannot handle') ||
    lowerMessage.includes('not capable') ||
    lowerMessage.includes('exceeds context') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('overloaded')
  ) {
    return 'capability';
  }

  // Timeout - escalate (simpler model might be faster)
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('deadline exceeded')
  ) {
    return 'timeout';
  }

  return 'unknown';
}

// ============================================================================
// CASCADE EXECUTOR
// ============================================================================

export interface CascadeExecutorOptions {
  decision: RoutingDecision;
  config?: CascadeConfig;
  projectPath: string;
  signatureHash?: string;
  onExecute: (model: ModelName) => Promise<ExecutionResult>;
  onRetry?: (model: ModelName, attempt: number, error: ErrorCategory) => void;
  onEscalate?: (from: ModelName, to: ModelName) => void;
}

/**
 * Execute with cascade fallback
 */
export async function executeWithCascade(
  options: CascadeExecutorOptions,
): Promise<ExecutionResult> {
  const {
    decision,
    config = DEFAULT_CASCADE_CONFIG,
    projectPath,
    signatureHash,
    onExecute,
    onRetry,
    onEscalate,
  } = options;

  let currentModel = decision.selectedModel;
  let retriesRemaining = config.maxRetries;
  const escalationPath = [...decision.escalationPath];
  let escalatedFrom: ModelName | undefined;

  while (true) {
    try {
      const result = await onExecute(currentModel);

      // Record outcome for history learning
      if (signatureHash) {
        updateRoutingPattern(
          signatureHash,
          currentModel,
          result.success,
          result.costUsd,
          projectPath,
        );
      }

      // If successful or no more retries/escalation, return result
      if (result.success) {
        return {
          ...result,
          escalatedFrom,
        };
      }

      // Handle failure
      const errorCategory = result.errorCategory ?? 'unknown';

      // Check if we should retry same model
      if (config.retrySameModel.includes(errorCategory) && retriesRemaining > 0) {
        retriesRemaining--;
        onRetry?.(currentModel, config.maxRetries - retriesRemaining, errorCategory);
        continue;
      }

      // Check if we should escalate
      if (
        (config.escalateOn.includes(errorCategory) || errorCategory === 'unknown') &&
        escalationPath.length > 0 &&
        decision.canEscalate
      ) {
        const nextModel = escalationPath.shift()!;
        onEscalate?.(currentModel, nextModel);
        escalatedFrom = escalatedFrom ?? currentModel;
        currentModel = nextModel;
        retriesRemaining = config.maxRetries; // Reset retries for new model
        continue;
      }

      // No more options - return failure
      return {
        ...result,
        escalatedFrom,
      };
    } catch (error) {
      // Unexpected error during execution
      const errorCategory = classifyError(error as Error);

      // Check if we should retry same model
      if (config.retrySameModel.includes(errorCategory) && retriesRemaining > 0) {
        retriesRemaining--;
        onRetry?.(currentModel, config.maxRetries - retriesRemaining, errorCategory);
        continue;
      }

      // Check if we should escalate
      if (
        config.escalateOn.includes(errorCategory) &&
        escalationPath.length > 0 &&
        decision.canEscalate
      ) {
        const nextModel = escalationPath.shift()!;
        onEscalate?.(currentModel, nextModel);
        escalatedFrom = escalatedFrom ?? currentModel;
        currentModel = nextModel;
        retriesRemaining = config.maxRetries;
        continue;
      }

      // Record failure for history learning
      if (signatureHash) {
        updateRoutingPattern(signatureHash, currentModel, false, 0, projectPath);
      }

      // No more options - rethrow
      return {
        success: false,
        model: currentModel,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        errorCategory,
        errorMessage: (error as Error).message,
        escalatedFrom,
      };
    }
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a model can be escalated
 */
export function canEscalate(model: ModelName): boolean {
  const tier = MODEL_INFO[model].tier;
  return tier !== 'premium';
}

/**
 * Get next tier up
 */
export function getNextTier(tier: ModelTier): ModelTier | null {
  if (tier === 'cheap') return 'mid';
  if (tier === 'mid') return 'premium';
  return null;
}

/**
 * Create a cascade decision from routing decision
 */
export function createCascadeDecision(
  taskId: string,
  model: ModelName,
  source: RoutingDecision['source'],
  score: number,
  noCascade = false,
): RoutingDecision {
  const tier = MODEL_INFO[model].tier;

  return {
    taskId,
    selectedModel: model,
    tier,
    source,
    score,
    canEscalate: !noCascade && tier !== 'premium',
    escalationPath: noCascade ? [] : getEscalationPath(model),
  };
}
