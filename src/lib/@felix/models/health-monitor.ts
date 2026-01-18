/**
 * Health Monitor - Track provider health and availability
 *
 * Three-level health checks:
 * 1. Process level: CLI executable exists (--version check)
 * 2. Capability level: CLI responds within timeout
 * 3. Runtime level: Track success/failure rates of actual calls
 *
 * @module @ralph/models/health-monitor
 */

import { checkCliAvailability, getCliExecutable, type ModelProvider } from './model-config.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Health state for a provider
 */
export interface ProviderHealth {
  /** Provider identifier */
  provider: ModelProvider;
  /** Whether provider is currently available */
  available: boolean;
  /** Timestamp of last health check */
  lastCheck: Date;
  /** Average latency in milliseconds (if available) */
  latencyMs?: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Error rate (0-1, last 100 calls) */
  errorRate: number;
  /** Total successful calls since start */
  successCount: number;
  /** Total failed calls since start */
  failureCount: number;
  /** Last error message (if any) */
  lastError?: string;
  /** CLI version (if detected) */
  version?: string;
}

/**
 * Configuration for health monitoring
 */
export interface HealthConfig {
  /** How long to cache health checks (ms) */
  cacheTtlMs: number;
  /** Max consecutive failures before marking unhealthy */
  maxConsecutiveFailures: number;
  /** Max error rate before marking unhealthy (0-1) */
  maxErrorRate: number;
  /** Window size for error rate calculation */
  errorRateWindowSize: number;
}

/**
 * Call result for tracking
 */
interface CallResult {
  success: boolean;
  latencyMs: number;
  timestamp: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: HealthConfig = {
  cacheTtlMs: 60_000, // 1 minute
  maxConsecutiveFailures: 3,
  maxErrorRate: 0.5, // 50%
  errorRateWindowSize: 100,
};

// ============================================================================
// HEALTH MONITOR
// ============================================================================

/**
 * Health Monitor - Track provider health state
 *
 * @example
 * ```typescript
 * const monitor = new HealthMonitor();
 *
 * // Check health
 * const health = await monitor.checkHealth('anthropic');
 * console.log(health.available); // true/false
 *
 * // Record successful call
 * monitor.recordSuccess('anthropic', 1234);
 *
 * // Record failed call
 * monitor.recordFailure('anthropic', new Error('Timeout'));
 *
 * // Get cached health (no check)
 * const cached = monitor.getHealth('anthropic');
 *
 * // Quick check
 * if (monitor.isHealthy('anthropic')) {
 *   // proceed
 * }
 *
 * // Get all healthy providers
 * const healthy = monitor.getHealthyProviders();
 * ```
 */
export class HealthMonitor {
  private healthState = new Map<ModelProvider, ProviderHealth>();
  private callHistory = new Map<ModelProvider, CallResult[]>();
  private config: HealthConfig;

  constructor(config: Partial<HealthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // PUBLIC API - HEALTH CHECKS
  // ==========================================================================

  /**
   * Run health check for provider
   * Performs process-level and capability-level checks
   */
  async checkHealth(provider: ModelProvider): Promise<ProviderHealth> {
    const existing = this.healthState.get(provider);
    const now = new Date();

    // Use cached health if still valid
    if (existing && this.isCacheValid(existing)) {
      return existing;
    }

    // Process-level check: CLI exists and responds
    const executable = getCliExecutable(provider);
    if (!executable) {
      return this.createUnhealthyState(provider, 'No CLI executable configured');
    }

    const cliCheck = await checkCliAvailability(executable);

    // Create or update health state
    const health: ProviderHealth = {
      provider,
      available: cliCheck.available,
      lastCheck: now,
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
      errorRate: this.calculateErrorRate(provider),
      successCount: existing?.successCount ?? 0,
      failureCount: existing?.failureCount ?? 0,
    };

    // Add version if available
    if (cliCheck.version) {
      health.version = cliCheck.version;
    }

    if (!cliCheck.available) {
      health.consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
      health.lastError = cliCheck.error ?? 'CLI not available';
      health.failureCount = (existing?.failureCount ?? 0) + 1;
    } else {
      health.consecutiveFailures = 0;
    }

    // Calculate average latency from history
    const avgLatency = this.calculateAverageLatency(provider);
    if (typeof avgLatency === 'number') {
      health.latencyMs = avgLatency;
    }

    // Apply health criteria
    health.available = this.evaluateHealth(health);

    this.healthState.set(provider, health);
    return health;
  }

  /**
   * Get cached health state (no check)
   */
  getHealth(provider: ModelProvider): ProviderHealth | undefined {
    return this.healthState.get(provider);
  }

  /**
   * Quick health check (uses cache, falls back to check)
   */
  async isHealthy(provider: ModelProvider): Promise<boolean> {
    const cached = this.healthState.get(provider);

    // If cache is valid, use it
    if (cached && this.isCacheValid(cached)) {
      return cached.available;
    }

    // Otherwise run fresh check
    const health = await this.checkHealth(provider);
    return health.available;
  }

  /**
   * Get list of healthy providers
   */
  async getHealthyProviders(): Promise<ModelProvider[]> {
    const providers: ModelProvider[] = ['anthropic', 'google'];
    const results = await Promise.all(
      providers.map(async (provider) => ({
        provider,
        healthy: await this.isHealthy(provider),
      })),
    );

    return results.filter((r) => r.healthy).map((r) => r.provider);
  }

  // ==========================================================================
  // PUBLIC API - CALL TRACKING
  // ==========================================================================

  /**
   * Record successful call
   */
  recordSuccess(provider: ModelProvider, latencyMs: number): void {
    this.recordCall(provider, {
      success: true,
      latencyMs,
      timestamp: new Date(),
    });

    // Update health state if exists
    const health = this.healthState.get(provider);
    if (health) {
      health.consecutiveFailures = 0;
      health.successCount++;
      health.errorRate = this.calculateErrorRate(provider);
      const avgLatency = this.calculateAverageLatency(provider);
      if (typeof avgLatency === 'number') {
        health.latencyMs = avgLatency;
      }
      health.available = this.evaluateHealth(health);
    }
  }

  /**
   * Record failed call
   */
  recordFailure(provider: ModelProvider, error: Error | string): void {
    this.recordCall(provider, {
      success: false,
      latencyMs: 0,
      timestamp: new Date(),
    });

    // Update health state if exists
    const health = this.healthState.get(provider);
    if (health) {
      health.consecutiveFailures++;
      health.failureCount++;
      health.errorRate = this.calculateErrorRate(provider);
      health.lastError = typeof error === 'string' ? error : error.message;
      health.available = this.evaluateHealth(health);
    } else {
      // Create unhealthy state
      const unhealthy = this.createUnhealthyState(
        provider,
        typeof error === 'string' ? error : error.message,
      );
      this.healthState.set(provider, unhealthy);
    }
  }

  /**
   * Reset health state for provider
   */
  reset(provider: ModelProvider): void {
    this.healthState.delete(provider);
    this.callHistory.delete(provider);
  }

  /**
   * Reset all health states
   */
  resetAll(): void {
    this.healthState.clear();
    this.callHistory.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS - EVALUATION
  // ==========================================================================

  /**
   * Evaluate overall health based on criteria
   */
  private evaluateHealth(health: ProviderHealth): boolean {
    // Consecutive failures exceed threshold
    if (health.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return false;
    }

    // Error rate exceeds threshold
    if (health.errorRate > this.config.maxErrorRate) {
      return false;
    }

    // Otherwise healthy if no recent failures
    return true;
  }

  /**
   * Check if cached health is still valid
   */
  private isCacheValid(health: ProviderHealth): boolean {
    const age = Date.now() - health.lastCheck.getTime();
    return age < this.config.cacheTtlMs;
  }

  /**
   * Create unhealthy state
   */
  private createUnhealthyState(provider: ModelProvider, error: string): ProviderHealth {
    return {
      provider,
      available: false,
      lastCheck: new Date(),
      consecutiveFailures: 1,
      errorRate: 1.0,
      successCount: 0,
      failureCount: 1,
      lastError: error,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - CALL HISTORY
  // ==========================================================================

  /**
   * Record call result
   */
  private recordCall(provider: ModelProvider, result: CallResult): void {
    let history = this.callHistory.get(provider);
    if (!history) {
      history = [];
      this.callHistory.set(provider, history);
    }

    history.push(result);

    // Keep only recent window
    if (history.length > this.config.errorRateWindowSize) {
      history.shift();
    }
  }

  /**
   * Calculate error rate from recent calls
   */
  private calculateErrorRate(provider: ModelProvider): number {
    const history = this.callHistory.get(provider);
    if (!history || history.length === 0) {
      return 0;
    }

    const failures = history.filter((r) => !r.success).length;
    return failures / history.length;
  }

  /**
   * Calculate average latency from recent successful calls
   */
  private calculateAverageLatency(provider: ModelProvider): number | undefined {
    const history = this.callHistory.get(provider);
    if (!history || history.length === 0) {
      return undefined;
    }

    const successfulCalls = history.filter((r) => r.success);
    if (successfulCalls.length === 0) {
      return undefined;
    }

    const total = successfulCalls.reduce((sum, r) => sum + r.latencyMs, 0);
    return Math.round(total / successfulCalls.length);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalMonitor: HealthMonitor | null = null;

/**
 * Get global health monitor instance
 */
export function getHealthMonitor(): HealthMonitor {
  if (!globalMonitor) {
    globalMonitor = new HealthMonitor();
  }
  return globalMonitor;
}

/**
 * Reset global health monitor
 */
export function resetHealthMonitor(): void {
  globalMonitor = null;
}
