/**
 * RateLimitPlugin - Rate limiting for API calls
 *
 * Tracks time between model calls and enforces minimum delays.
 * Supports different limits for different error categories.
 */

import type { CallbackContext, LlmRequest, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';
import type { ErrorCategory } from './retry-plugin.js';

export interface RateLimitPluginConfig {
  /** Minimum delay between requests in ms (default: 1000) */
  minDelayMs?: number;
  /** Delay after 429 errors in ms (default: 30000) */
  rateLimitDelayMs?: number;
  /** Optional requests per minute limit */
  maxRequestsPerMinute?: number;
}

interface RequestRecord {
  timestamp: number;
  errorCategory?: ErrorCategory;
}

/**
 * Maximum request history entries to prevent memory leaks
 * Safety: Even with cleanOldRecords, edge cases could cause growth
 * At 100 RPM max, this covers ~10 minutes of history
 */
const MAX_REQUEST_HISTORY = 1000;

export class RateLimitPlugin extends BasePlugin {
  private config: Required<Omit<RateLimitPluginConfig, 'maxRequestsPerMinute'>> & {
    maxRequestsPerMinute: number | null;
  };
  private lastRequestTime = 0;
  private lastErrorCategory: ErrorCategory | null = null;
  private requestHistory: RequestRecord[] = [];

  constructor(config: RateLimitPluginConfig = {}) {
    super('rate-limit');
    this.config = {
      minDelayMs: config.minDelayMs ?? 1000,
      rateLimitDelayMs: config.rateLimitDelayMs ?? 30000,
      maxRequestsPerMinute: config.maxRequestsPerMinute ?? null,
    };
  }

  /**
   * Before model callback - enforce rate limits
   */
  override async beforeModelCallback({
    callbackContext,
    llmRequest: _llmRequest,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
  }): Promise<LlmResponse | undefined> {
    const now = Date.now();

    // Determine required delay based on last error
    let requiredDelay = this.config.minDelayMs;
    if (this.lastErrorCategory === 'rate_limit') {
      requiredDelay = this.config.rateLimitDelayMs;
    }

    // Calculate time since last request
    const timeSinceLastRequest = now - this.lastRequestTime;

    // If we need to wait, sleep for the difference
    if (this.lastRequestTime > 0 && timeSinceLastRequest < requiredDelay) {
      const sleepTime = requiredDelay - timeSinceLastRequest;
      await this.sleep(sleepTime);
    }

    // Check RPM limit if configured
    if (this.config.maxRequestsPerMinute !== null) {
      await this.enforceRpmLimit(now);
    }

    // Update tracking
    this.lastRequestTime = Date.now();
    this.recordRequest(this.lastRequestTime);

    // Clear error category after successful delay
    this.lastErrorCategory = null;

    // Store rate limit state
    callbackContext.eventActions.stateDelta['__rate_limit'] = {
      lastRequestTime: this.lastRequestTime,
      requestsInLastMinute: this.getRequestsInLastMinute(),
    };

    return undefined;
  }

  /**
   * After model callback - track successful responses
   */
  override async afterModelCallback({
    callbackContext: _callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Check for rate limit errors in response
    if (llmResponse.errorCode) {
      const errorMessage = (llmResponse.errorMessage ?? '').toLowerCase();
      if (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('too many requests')
      ) {
        this.lastErrorCategory = 'rate_limit';
        this.updateLastRequestError('rate_limit');
      }
    }

    return undefined;
  }

  /**
   * On model error callback - track errors for adaptive delays
   */
  override async onModelErrorCallback({
    callbackContext: _callbackContext,
    llmRequest: _llmRequest,
    error,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | undefined> {
    const category = this.classifyError(error);
    this.lastErrorCategory = category;
    this.updateLastRequestError(category);

    return undefined;
  }

  /**
   * Classify error into categories
   */
  private classifyError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('too many requests')
    ) {
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

    return 'unknown';
  }

  /**
   * Enforce requests per minute limit
   */
  private async enforceRpmLimit(now: number): Promise<void> {
    if (this.config.maxRequestsPerMinute === null) return;

    // Clean old records
    this.cleanOldRecords(now);

    const requestsInLastMinute = this.requestHistory.length;

    if (requestsInLastMinute >= this.config.maxRequestsPerMinute) {
      // Find oldest request in the window
      const oldestRequest = this.requestHistory[0];
      if (oldestRequest) {
        // Wait until oldest request falls out of the window
        const waitTime = 60000 - (now - oldestRequest.timestamp) + 100; // +100ms buffer
        if (waitTime > 0) {
          await this.sleep(waitTime);
          // Clean again after sleeping
          this.cleanOldRecords(Date.now());
        }
      }
    }
  }

  /**
   * Record a request with safety bounds
   * Safety: Enforces max entries to prevent memory leaks
   */
  private recordRequest(timestamp: number): void {
    // Safety: Enforce max entries limit before adding
    if (this.requestHistory.length >= MAX_REQUEST_HISTORY) {
      // Remove oldest entries (keep half)
      this.requestHistory = this.requestHistory.slice(-MAX_REQUEST_HISTORY / 2);
    }

    this.requestHistory.push({ timestamp });
    // Keep only last minute of records
    this.cleanOldRecords(timestamp);
  }

  /**
   * Update the error category for the last request
   */
  private updateLastRequestError(category: ErrorCategory): void {
    const lastRecord = this.requestHistory[this.requestHistory.length - 1];
    if (lastRecord) {
      lastRecord.errorCategory = category;
    }
  }

  /**
   * Clean records older than 1 minute
   */
  private cleanOldRecords(now: number): void {
    const oneMinuteAgo = now - 60000;
    this.requestHistory = this.requestHistory.filter((r) => r.timestamp > oneMinuteAgo);
  }

  /**
   * Get count of requests in the last minute
   */
  private getRequestsInLastMinute(): number {
    this.cleanOldRecords(Date.now());
    return this.requestHistory.length;
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit stats
   */
  getStats(): {
    lastRequestTime: number;
    requestsInLastMinute: number;
    lastErrorCategory: ErrorCategory | null;
  } {
    return {
      lastRequestTime: this.lastRequestTime,
      requestsInLastMinute: this.getRequestsInLastMinute(),
      lastErrorCategory: this.lastErrorCategory,
    };
  }

  /**
   * Reset rate limit state
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.lastErrorCategory = null;
    this.requestHistory = [];
  }
}

/**
 * Create a rate limit plugin with default configuration
 */
export function createRateLimitPlugin(
  minDelayMs?: number,
  rateLimitDelayMs?: number,
  maxRequestsPerMinute?: number,
): RateLimitPlugin {
  const config: RateLimitPluginConfig = {};
  if (minDelayMs !== undefined) {
    config.minDelayMs = minDelayMs;
  }
  if (rateLimitDelayMs !== undefined) {
    config.rateLimitDelayMs = rateLimitDelayMs;
  }
  if (maxRequestsPerMinute !== undefined) {
    config.maxRequestsPerMinute = maxRequestsPerMinute;
  }
  return new RateLimitPlugin(config);
}
