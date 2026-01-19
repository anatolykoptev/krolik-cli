/**
 * Fallback Router - Smart LLM provider fallback routing
 *
 * Provides automatic fallback when primary LLM provider/backend fails:
 * 1. Try primary provider + backend
 * 2. Try same provider, alternate backend (cli ↔ api)
 * 3. Try alternate provider, same backend
 * 4. Try alternate provider, alternate backend
 *
 * @module @felix/models/fallback-router
 */

import type { BaseLlm } from '@google/adk';
import { getHealthMonitor, type HealthMonitor } from './health-monitor.js';
import { detectProvider, type ModelProvider, PROVIDERS } from './model-config.js';
import type { BackendType, ModelRegistry } from './registry.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FallbackConfig {
  /** Primary provider and backend */
  primary: { provider: ModelProvider; backend: BackendType };
  /** Fallback options (tried in order) */
  fallbacks: Array<{ provider: ModelProvider; backend: BackendType }>;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
}

interface FallbackAttempt {
  provider: ModelProvider;
  backend: BackendType;
  error?: string;
}

// ============================================================================
// FALLBACK ROUTER
// ============================================================================

/**
 * Fallback router for LLM providers
 *
 * Automatically routes to fallback providers/backends on failure.
 * Respects health status and tries alternatives in smart order.
 *
 * @example
 * ```typescript
 * const registry = getModelRegistry();
 * const router = new FallbackRouter(registry);
 *
 * // Get LLM with automatic fallback
 * const llm = await router.getLlmWithFallback('sonnet');
 *
 * // Custom fallback config
 * const llm2 = await router.getLlmWithFallback('sonnet', {
 *   primary: { provider: 'anthropic', backend: 'cli' },
 *   fallbacks: [
 *     { provider: 'anthropic', backend: 'api' },
 *     { provider: 'google', backend: 'cli' },
 *   ],
 * });
 * ```
 */
export class FallbackRouter {
  private healthMonitor: HealthMonitor;

  constructor(
    private registry: ModelRegistry,
    healthMonitor?: HealthMonitor,
  ) {
    this.healthMonitor = healthMonitor ?? getHealthMonitor();
  }

  /**
   * Get LLM with automatic fallback on failure
   *
   * @param model - Model name or alias (e.g., "sonnet", "flash", "claude-3-5-sonnet")
   * @param config - Optional fallback configuration
   * @returns BaseLlm instance (with fallback if needed)
   * @throws Error if all fallback attempts fail
   */
  async getLlmWithFallback(model: string, config?: Partial<FallbackConfig>): Promise<BaseLlm> {
    const fullConfig = this.buildFallbackConfig(model, config);
    const attempts: FallbackAttempt[] = [];

    // Try primary
    const primaryAttempt = await this.tryGetLlm(
      model,
      fullConfig.primary.provider,
      fullConfig.primary.backend,
    );

    if (primaryAttempt.success) {
      return primaryAttempt.llm;
    }

    attempts.push({
      provider: fullConfig.primary.provider,
      backend: fullConfig.primary.backend,
      error: !primaryAttempt.success ? primaryAttempt.error : 'Unknown error',
    });

    // Try fallbacks
    const maxRetries = fullConfig.maxRetries ?? 2;
    const fallbacksToTry = fullConfig.fallbacks.slice(0, maxRetries);

    for (const fallback of fallbacksToTry) {
      // Skip unhealthy providers (only check for CLI backend)
      if (fallback.backend === 'cli') {
        const isHealthy = await this.healthMonitor.isHealthy(fallback.provider);
        if (!isHealthy) {
          attempts.push({
            provider: fallback.provider,
            backend: fallback.backend,
            error: 'Unhealthy (skipped)',
          });
          continue;
        }
      }

      const attempt = await this.tryGetLlm(model, fallback.provider, fallback.backend);

      if (attempt.success) {
        console.error(
          `[fallback-router] Fallback succeeded: ${fallback.provider}:${fallback.backend}`,
        );
        // Record success for health monitoring
        if (fallback.backend === 'cli') {
          this.healthMonitor.recordSuccess(fallback.provider, 0);
        }
        return attempt.llm;
      }

      const errorMsg = !attempt.success ? attempt.error : 'Unknown error';

      attempts.push({
        provider: fallback.provider,
        backend: fallback.backend,
        error: errorMsg,
      });

      // Record failure for health monitoring (CLI only)
      if (fallback.backend === 'cli') {
        this.healthMonitor.recordFailure(fallback.provider, errorMsg);
      }
    }

    // All attempts failed
    const errorDetails = attempts
      .map((a) => `  - ${a.provider}:${a.backend}: ${a.error}`)
      .join('\n');

    throw new Error(`All fallback attempts failed for model "${model}":\n${errorDetails}`);
  }

  /**
   * Build default fallback config for a model
   *
   * Fallback priority:
   * 1. Primary provider + backend
   * 2. Same provider, alternate backend (cli → api or api → cli)
   * 3. Alternate provider with same backend
   * 4. Alternate provider with alternate backend
   */
  getDefaultFallbackConfig(model: string): FallbackConfig {
    const provider = detectProvider(model);
    if (!provider) {
      throw new Error(`Cannot detect provider for model: ${model}`);
    }

    const defaultBackend = this.registry.getDefaultBackend();
    const alternateBackend: BackendType = defaultBackend === 'cli' ? 'api' : 'cli';

    // Get alternate provider (first available provider that's not the current one)
    const alternateProvider = PROVIDERS.find((p) => p.name !== provider)?.name;

    const fallbacks: Array<{ provider: ModelProvider; backend: BackendType }> = [];

    // 1. Same provider, alternate backend
    fallbacks.push({ provider, backend: alternateBackend });

    // 2. Alternate provider, same backend (if available)
    if (alternateProvider) {
      fallbacks.push({ provider: alternateProvider, backend: defaultBackend });

      // 3. Alternate provider, alternate backend
      fallbacks.push({ provider: alternateProvider, backend: alternateBackend });
    }

    return {
      primary: { provider, backend: defaultBackend },
      fallbacks,
      maxRetries: 2,
    };
  }

  /**
   * Reset health monitor (clears failure counts)
   */
  resetHealth(): void {
    this.healthMonitor.resetAll();
  }

  /**
   * Try to get an LLM instance
   * Returns success status and LLM or error
   */
  private async tryGetLlm(
    model: string,
    provider: ModelProvider,
    backend: BackendType,
  ): Promise<{ success: true; llm: BaseLlm } | { success: false; error: string }> {
    try {
      // Check if provider is available for CLI backend
      if (backend === 'cli') {
        const isAvailable = await this.registry.isCliAvailable(model);
        if (!isAvailable) {
          return {
            success: false,
            error: `CLI not available for ${provider}`,
          };
        }
      }

      const llm = this.registry.getLlm(model, backend);

      // Verify LLM is actually usable (basic check)
      if (!llm) {
        return {
          success: false,
          error: 'Registry returned null',
        };
      }

      return { success: true, llm };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build full fallback config from partial config and model
   */
  private buildFallbackConfig(model: string, partial?: Partial<FallbackConfig>): FallbackConfig {
    if (partial?.primary && partial?.fallbacks) {
      return {
        primary: partial.primary,
        fallbacks: partial.fallbacks,
        maxRetries: partial.maxRetries !== undefined ? partial.maxRetries : 2,
      };
    }

    const defaultConfig = this.getDefaultFallbackConfig(model);

    return {
      primary: partial?.primary ?? defaultConfig.primary,
      fallbacks: partial?.fallbacks ?? defaultConfig.fallbacks,
      maxRetries:
        partial?.maxRetries !== undefined ? partial.maxRetries : (defaultConfig.maxRetries ?? 2),
    };
  }
}
