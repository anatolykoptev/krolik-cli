/**
 * RetryPlugin - Smart retry with exponential backoff
 *
 * Handles model errors with configurable retry strategy.
 * Injects failure context for better subsequent attempts.
 */

import type { CallbackContext, InvocationContext, LlmRequest, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';

export type ErrorCategory =
  | 'rate_limit'
  | 'timeout'
  | 'validation'
  | 'authentication'
  | 'server_error'
  | 'unknown';

export interface RetryPluginConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableCategories?: ErrorCategory[];
}

interface AttemptState {
  count: number;
  lastError?: string;
  category?: ErrorCategory;
  createdAt: number;
}

/**
 * Maximum number of entries in attempts map to prevent memory leaks
 * Safety: Even with afterRunCallback cleanup, edge cases could cause unbounded growth
 */
const MAX_ATTEMPT_ENTRIES = 1000;

/**
 * Maximum age of entries in ms (1 hour) for stale entry cleanup
 */
const MAX_ENTRY_AGE_MS = 60 * 60 * 1000;

export class RetryPlugin extends BasePlugin {
  private config: Required<RetryPluginConfig>;
  private attempts: Map<string, AttemptState> = new Map();

  constructor(config: RetryPluginConfig) {
    super('retry');
    this.config = {
      retryableCategories: ['rate_limit', 'timeout', 'server_error', 'validation'],
      ...config,
    };
  }

  /**
   * Handle model errors with retry logic
   */
  override async onModelErrorCallback({
    callbackContext,
    llmRequest,
    error,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | undefined> {
    const invocationId = callbackContext.invocationContext.invocationId;
    const state = this.getAttemptState(invocationId);
    state.count++;

    const category = this.classifyError(error);
    state.category = category;
    state.lastError = error.message;

    // Check if we should retry
    if (state.count >= this.config.maxAttempts) {
      // Max retries reached, let error propagate
      return undefined;
    }

    if (!this.config.retryableCategories.includes(category)) {
      // Non-retryable error
      return undefined;
    }

    // Calculate delay with exponential backoff + jitter
    const delay = this.calculateDelay(state.count);
    await this.sleep(delay);

    // Inject retry context into the request
    this.injectRetryContext(llmRequest, state, error);

    // Store retry info in state
    callbackContext.eventActions.stateDelta['__retry'] = {
      attempt: state.count,
      maxAttempts: this.config.maxAttempts,
      lastError: error.message,
      category,
      delayMs: delay,
    };

    // Return undefined to trigger retry
    return undefined;
  }

  /**
   * After run callback - cleanup attempt state to prevent memory leaks
   */
  override async afterRunCallback({
    invocationContext,
  }: {
    invocationContext: InvocationContext;
  }): Promise<void> {
    const invocationId = invocationContext.invocationId;
    this.attempts.delete(invocationId);
  }

  /**
   * After model callback - check for validation failures from ValidationPlugin
   */
  override async afterModelCallback({
    callbackContext,
    llmResponse: _llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Check if validation failed (set by ValidationPlugin)
    const validation = callbackContext.eventActions.stateDelta['__validation'] as
      | {
          passed: boolean;
          failedSteps: string[];
        }
      | undefined;

    if (validation && !validation.passed) {
      const invocationId = callbackContext.invocationContext.invocationId;
      const state = this.getAttemptState(invocationId);

      // Track validation failures as retry attempts
      if (state.count < this.config.maxAttempts) {
        state.count++;
        state.category = 'validation';
        state.lastError = `Validation failed: ${validation.failedSteps.join(', ')}`;

        callbackContext.eventActions.stateDelta['__retry'] = {
          attempt: state.count,
          maxAttempts: this.config.maxAttempts,
          reason: 'validation_failure',
          failedSteps: validation.failedSteps,
        };
      }
    }

    return undefined;
  }

  /**
   * Classify error into categories
   */
  private classifyError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('api key')
    ) {
      return 'authentication';
    }
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return 'server_error';
    }
    if (
      message.includes('validation') ||
      message.includes('typecheck') ||
      message.includes('lint')
    ) {
      return 'validation';
    }

    return 'unknown';
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.config.baseDelayMs * 2 ** (attempt - 1);

    // Add jitter (0-25% of delay)
    const jitter = exponentialDelay * Math.random() * 0.25;

    // Cap at maxDelay
    return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
  }

  /**
   * Inject retry context into the request
   */
  private injectRetryContext(llmRequest: LlmRequest, state: AttemptState, error: Error): void {
    const retryMessage = `
⚠️ RETRY ATTEMPT ${state.count}/${this.config.maxAttempts}

Previous attempt failed with: ${error.message}

Please try a different approach. Consider:
- Breaking down the task into smaller steps
- Checking for syntax errors before making changes
- Validating file paths exist before modifying
- Testing changes incrementally
`.trim();

    llmRequest.contents.push({
      role: 'user',
      parts: [{ text: retryMessage }],
    });
  }

  /**
   * Get or create attempt state for an invocation
   * Includes safety cleanup to prevent memory leaks (even if afterRunCallback fails)
   */
  private getAttemptState(invocationId: string): AttemptState {
    // Safety: Clean up stale entries periodically
    if (this.attempts.size > MAX_ATTEMPT_ENTRIES / 2) {
      this.cleanupStaleEntries();
    }

    let state = this.attempts.get(invocationId);
    if (!state) {
      // Safety: Enforce max entries limit
      if (this.attempts.size >= MAX_ATTEMPT_ENTRIES) {
        this.cleanupStaleEntries();
        // If still over limit after cleanup, remove oldest
        if (this.attempts.size >= MAX_ATTEMPT_ENTRIES) {
          const oldestKey = this.attempts.keys().next().value;
          if (oldestKey) {
            this.attempts.delete(oldestKey);
          }
        }
      }
      state = { count: 0, createdAt: Date.now() };
      this.attempts.set(invocationId, state);
    }
    return state;
  }

  /**
   * Remove entries older than MAX_ENTRY_AGE_MS
   * Safety: Prevents unbounded memory growth from abandoned invocations
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    for (const [id, state] of this.attempts) {
      if (now - state.createdAt > MAX_ENTRY_AGE_MS) {
        this.attempts.delete(id);
      }
    }
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset attempts for an invocation (call on success)
   */
  resetAttempts(invocationId: string): void {
    this.attempts.delete(invocationId);
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(invocationId: string): number {
    return this.attempts.get(invocationId)?.count ?? 0;
  }
}

/**
 * Create a retry plugin with common configuration
 */
export function createRetryPlugin(
  maxAttempts = 3,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
): RetryPlugin {
  return new RetryPlugin({ maxAttempts, baseDelayMs, maxDelayMs });
}
