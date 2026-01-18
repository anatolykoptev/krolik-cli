/**
 * CostPlugin - Track token usage and costs
 *
 * Monitors LLM usage, calculates costs, and enforces budget limits.
 */

import type { CallbackContext, InvocationContext, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';
import type { TokenUsage } from '../types';
import { type CostTracking, getPricing } from '../utils/cost-calculator';

// Re-export types for backwards compatibility
export type { TokenUsage, CostTracking };

export interface CostPluginConfig {
  maxCostUsd?: number;
  maxTokens?: number;
  onUpdate?: (tracking: CostTracking) => void;
  onBudgetExceeded?: (tracking: CostTracking) => void;
}

export class CostPlugin extends BasePlugin {
  private config: CostPluginConfig;
  private totalTokens: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private totalCostUsd = 0;
  private trackingHistory: CostTracking[] = [];

  constructor(config: CostPluginConfig = {}) {
    super('cost');
    this.config = config;
  }

  /**
   * Track costs after each model response
   */
  override async afterModelCallback({
    callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Skip partial responses
    if (llmResponse.partial) {
      return undefined;
    }

    // Extract usage metadata
    const usage = llmResponse.usageMetadata;
    if (!usage) {
      return undefined;
    }

    // Get model from LlmAgent if available
    const agent = callbackContext.invocationContext.agent;
    const modelProp = 'model' in agent ? (agent as { model?: unknown }).model : undefined;
    const model = typeof modelProp === 'string' ? modelProp : 'unknown';
    const inputTokens = usage.promptTokenCount ?? 0;
    const outputTokens = usage.candidatesTokenCount ?? 0;

    // Calculate cost
    const pricing = getPricing(model);
    const costUsd =
      (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

    // Update totals
    this.totalTokens.inputTokens += inputTokens;
    this.totalTokens.outputTokens += outputTokens;
    this.totalTokens.totalTokens += inputTokens + outputTokens;
    this.totalCostUsd += costUsd;

    // Create tracking record
    const tracking: CostTracking = {
      tokens: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      costUsd,
      model,
      timestamp: Date.now(),
    };

    this.trackingHistory.push(tracking);

    // Store in session state
    callbackContext.eventActions.stateDelta['__cost'] = {
      current: tracking,
      total: {
        tokens: this.totalTokens,
        costUsd: this.totalCostUsd,
      },
    };

    // Notify callback
    this.config.onUpdate?.(tracking);

    // Check budget limits
    if (this.config.maxCostUsd && this.totalCostUsd > this.config.maxCostUsd) {
      this.config.onBudgetExceeded?.({
        tokens: this.totalTokens,
        costUsd: this.totalCostUsd,
        model,
        timestamp: Date.now(),
      });

      return {
        ...llmResponse,
        errorCode: 'BUDGET_EXCEEDED',
        errorMessage: `Budget limit exceeded: $${this.totalCostUsd.toFixed(4)} > $${this.config.maxCostUsd}`,
      };
    }

    if (this.config.maxTokens && this.totalTokens.totalTokens > this.config.maxTokens) {
      return {
        ...llmResponse,
        errorCode: 'TOKEN_LIMIT_EXCEEDED',
        errorMessage: `Token limit exceeded: ${this.totalTokens.totalTokens} > ${this.config.maxTokens}`,
      };
    }

    return undefined;
  }

  /**
   * Log final costs after run completes
   */
  override async afterRunCallback({
    invocationContext: _invocationContext,
  }: {
    invocationContext: InvocationContext;
  }): Promise<void> {
    // Could log to console or external service
  }

  /**
   * Get total usage statistics
   */
  getTotalUsage(): { tokens: TokenUsage; costUsd: number } {
    return {
      tokens: { ...this.totalTokens },
      costUsd: this.totalCostUsd,
    };
  }

  /**
   * Get tracking history
   */
  getHistory(): CostTracking[] {
    return [...this.trackingHistory];
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.totalTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    this.totalCostUsd = 0;
    this.trackingHistory = [];
  }

  /**
   * Format cost as string
   */
  formatCost(): string {
    return `$${this.totalCostUsd.toFixed(4)} (${this.totalTokens.totalTokens.toLocaleString()} tokens)`;
  }
}

/**
 * Create a cost plugin with default configuration
 */
export function createCostPlugin(maxCostUsd?: number): CostPlugin {
  const config: CostPluginConfig = {};
  if (maxCostUsd !== undefined) {
    config.maxCostUsd = maxCostUsd;
  }
  return new CostPlugin(config);
}
