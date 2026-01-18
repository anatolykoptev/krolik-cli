/**
 * CircuitBreakerPlugin - Stop execution on consecutive failures
 *
 * Implements the circuit breaker pattern to prevent cascading failures:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Circuit tripped, all requests fail immediately
 * - HALF_OPEN: Testing if service recovered, one request allowed
 */

import type { CallbackContext, LlmRequest, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerPluginConfig {
  /** Number of consecutive failures before tripping (default: 3) */
  failureThreshold?: number;
  /** Time in ms before moving from OPEN to HALF_OPEN (default: 60000) */
  resetTimeoutMs?: number;
  /** Callback when circuit state changes */
  onTrip?: (state: CircuitState, failures: number) => void;
}

interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerPlugin extends BasePlugin {
  private config: Required<CircuitBreakerPluginConfig>;
  private circuitState: CircuitBreakerState;

  constructor(config: CircuitBreakerPluginConfig = {}) {
    super('circuit-breaker');
    this.config = {
      failureThreshold: 3,
      resetTimeoutMs: 60000,
      onTrip: () => {},
      ...config,
    };

    this.circuitState = {
      state: 'closed',
      consecutiveFailures: 0,
      lastFailureTime: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };
  }

  /**
   * Before model call - check circuit state
   * If OPEN, check if reset timeout has elapsed to move to HALF_OPEN
   * If OPEN and timeout not elapsed, return error response
   */
  override async beforeModelCallback({
    callbackContext,
    llmRequest: _llmRequest,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
  }): Promise<LlmResponse | undefined> {
    const now = Date.now();

    // Check if we should transition from OPEN to HALF_OPEN
    if (this.circuitState.state === 'open') {
      const timeSinceFailure = now - this.circuitState.lastFailureTime;

      if (timeSinceFailure >= this.config.resetTimeoutMs) {
        // Move to HALF_OPEN state to test recovery
        this.transitionState('half_open');
        callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
          state: this.circuitState.state,
          consecutiveFailures: this.circuitState.consecutiveFailures,
          message: 'Circuit moved to HALF_OPEN, testing recovery',
        };
        // Allow this request through to test
        return undefined;
      }

      // Circuit still OPEN, reject request
      callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
        state: this.circuitState.state,
        consecutiveFailures: this.circuitState.consecutiveFailures,
        message: `Circuit OPEN: ${this.circuitState.consecutiveFailures} consecutive failures. Waiting ${Math.ceil((this.config.resetTimeoutMs - timeSinceFailure) / 1000)}s before retry.`,
        blocked: true,
      };

      // Return an error response to stop execution
      return {
        content: {
          role: 'model',
          parts: [
            {
              text: `Circuit breaker OPEN: Execution stopped after ${this.circuitState.consecutiveFailures} consecutive failures. Wait ${Math.ceil((this.config.resetTimeoutMs - timeSinceFailure) / 1000)} seconds before retrying.`,
            },
          ],
        },
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        errorMessage: `Circuit breaker tripped after ${this.circuitState.consecutiveFailures} consecutive failures`,
      };
    }

    return undefined;
  }

  /**
   * After successful model call - reset failures or close circuit
   */
  override async afterModelCallback({
    callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Skip partial responses (streaming)
    if (llmResponse.partial) {
      return undefined;
    }

    // Check if response has errors - treat as failure
    if (llmResponse.errorCode) {
      return this.handleFailure(callbackContext, llmResponse.errorMessage ?? 'Model error');
    }

    // Check for validation failures from ValidationPlugin
    const validation = callbackContext.eventActions.stateDelta['__validation'] as
      | { passed: boolean }
      | undefined;

    if (validation && !validation.passed) {
      return this.handleFailure(callbackContext, 'Validation failed');
    }

    // Success - reset or close circuit
    this.handleSuccess(callbackContext);

    return undefined;
  }

  /**
   * Handle model errors
   */
  override async onModelErrorCallback({
    callbackContext,
    llmRequest: _llmRequest,
    error,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | undefined> {
    return this.handleFailure(callbackContext, error.message);
  }

  /**
   * Handle a successful call
   */
  private handleSuccess(callbackContext: CallbackContext): void {
    this.circuitState.totalSuccesses++;

    if (this.circuitState.state === 'half_open') {
      // Success in HALF_OPEN means service recovered
      this.circuitState.consecutiveFailures = 0;
      this.transitionState('closed');
      callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
        state: this.circuitState.state,
        consecutiveFailures: 0,
        message: 'Circuit CLOSED: Service recovered',
        recovered: true,
      };
    } else if (this.circuitState.state === 'closed') {
      // Reset consecutive failures on success
      this.circuitState.consecutiveFailures = 0;
      callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
        state: this.circuitState.state,
        consecutiveFailures: 0,
      };
    }
  }

  /**
   * Handle a failed call
   */
  private handleFailure(
    callbackContext: CallbackContext,
    errorMessage: string,
  ): LlmResponse | undefined {
    this.circuitState.consecutiveFailures++;
    this.circuitState.totalFailures++;
    this.circuitState.lastFailureTime = Date.now();

    if (this.circuitState.state === 'half_open') {
      // Failure in HALF_OPEN means service still failing
      this.transitionState('open');
      callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
        state: this.circuitState.state,
        consecutiveFailures: this.circuitState.consecutiveFailures,
        message: `Circuit OPEN: Service still failing - ${errorMessage}`,
        tripped: true,
      };

      return {
        content: {
          role: 'model',
          parts: [
            {
              text: `Circuit breaker OPEN: Test request failed. Waiting ${this.config.resetTimeoutMs / 1000} seconds before next attempt.`,
            },
          ],
        },
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        errorMessage: `Circuit breaker tripped: ${errorMessage}`,
      };
    }

    // Check if we should trip the circuit
    if (
      this.circuitState.state === 'closed' &&
      this.circuitState.consecutiveFailures >= this.config.failureThreshold
    ) {
      this.transitionState('open');
      callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
        state: this.circuitState.state,
        consecutiveFailures: this.circuitState.consecutiveFailures,
        message: `Circuit OPEN: Threshold reached (${this.circuitState.consecutiveFailures}/${this.config.failureThreshold} failures)`,
        tripped: true,
      };

      return {
        content: {
          role: 'model',
          parts: [
            {
              text: `Circuit breaker OPEN: ${this.circuitState.consecutiveFailures} consecutive failures reached the threshold of ${this.config.failureThreshold}. Stopping execution.`,
            },
          ],
        },
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        errorMessage: `Circuit breaker tripped after ${this.circuitState.consecutiveFailures} consecutive failures`,
      };
    }

    // Record failure but don't trip yet
    callbackContext.eventActions.stateDelta['__circuit_breaker'] = {
      state: this.circuitState.state,
      consecutiveFailures: this.circuitState.consecutiveFailures,
      failureThreshold: this.config.failureThreshold,
      message: `Failure ${this.circuitState.consecutiveFailures}/${this.config.failureThreshold}: ${errorMessage}`,
    };

    return undefined;
  }

  /**
   * Transition to a new state
   */
  private transitionState(newState: CircuitState): void {
    const oldState = this.circuitState.state;
    this.circuitState.state = newState;

    // Notify via callback
    this.config.onTrip(newState, this.circuitState.consecutiveFailures);

    // Log state transition for debugging
    if (oldState !== newState) {
      // State changed - callback already notified
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.circuitState.state;
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.circuitState.consecutiveFailures;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState;
    consecutiveFailures: number;
    totalFailures: number;
    totalSuccesses: number;
  } {
    return {
      state: this.circuitState.state,
      consecutiveFailures: this.circuitState.consecutiveFailures,
      totalFailures: this.circuitState.totalFailures,
      totalSuccesses: this.circuitState.totalSuccesses,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    const wasOpen = this.circuitState.state !== 'closed';
    this.circuitState = {
      state: 'closed',
      consecutiveFailures: 0,
      lastFailureTime: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };
    if (wasOpen) {
      this.config.onTrip('closed', 0);
    }
  }

  /**
   * Manually trip the circuit (for testing or emergency stops)
   */
  trip(): void {
    this.circuitState.state = 'open';
    this.circuitState.lastFailureTime = Date.now();
    this.config.onTrip('open', this.circuitState.consecutiveFailures);
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowingRequests(): boolean {
    if (this.circuitState.state === 'closed') return true;
    if (this.circuitState.state === 'half_open') return true;
    if (this.circuitState.state === 'open') {
      const timeSinceFailure = Date.now() - this.circuitState.lastFailureTime;
      return timeSinceFailure >= this.config.resetTimeoutMs;
    }
    return false;
  }
}

/**
 * Create a circuit breaker plugin with common configuration
 */
export function createCircuitBreakerPlugin(
  failureThreshold = 3,
  resetTimeoutMs = 60000,
  onTrip?: (state: CircuitState, failures: number) => void,
): CircuitBreakerPlugin {
  const config: CircuitBreakerPluginConfig = { failureThreshold, resetTimeoutMs };
  if (onTrip) {
    config.onTrip = onTrip;
  }
  return new CircuitBreakerPlugin(config);
}
