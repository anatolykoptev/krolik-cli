/**
 * LLM Factory - Unified LLM creation with caching and provider detection
 *
 * Single entry point for creating LLM instances. Handles:
 * - Provider detection from model name/alias
 * - Backend selection (CLI vs API)
 * - Instance caching (reuse existing instances)
 * - Proper TypeScript types
 *
 * @module @felix/models/llm-factory
 */

import { type BaseLlm, Gemini } from '@google/adk';
import type { ClaudeCliLlm } from './claude-cli-llm.js';
import { ClaudeCliLlm as ClaudeCliLlmImpl } from './claude-cli-llm.js';
import { ClaudeLlm } from './claude-llm.js';
import type { GeminiCliLlm } from './gemini-cli-llm.js';
import { GeminiCliLlm as GeminiCliLlmImpl } from './gemini-cli-llm.js';
import { GroqLlm } from './groq-llm.js';
import { detectProvider, discoverProviders, type ModelProvider } from './model-config.js';
import { getLlmClass, registerProvider } from './provider-registry.js';
import { VibeProxyLlm } from './vibeproxy-llm.js';

// ============================================================================
// PROVIDER REGISTRATION
// ============================================================================

/**
 * Register all built-in providers
 * This runs once at module load time
 */
function registerBuiltInProviders() {
  // API-only providers
  registerProvider('groq', GroqLlm, ['api'], 'Groq fast inference API');
  registerProvider('vibeproxy', VibeProxyLlm, ['api'], 'VibeProxy multi-provider gateway');

  // API providers
  registerProvider('anthropic', ClaudeLlm, ['api'], 'Anthropic Claude API');
  registerProvider('google', Gemini, ['api'], 'Google Gemini API');

  // Note: CLI providers (ClaudeCliLlm, GeminiCliLlm) have different constructors
  // They require workingDirectory param, so we keep switch/case for CLI
}

// Auto-register on module load
registerBuiltInProviders();

// ============================================================================
// TYPES
// ============================================================================

/** Backend type: API (requires keys) or CLI (uses local CLI) */
export type BackendType = 'api' | 'cli';

/** Options for LLM creation */
export interface LlmCreateOptions {
  /** Backend type ("api" or "cli"). Defaults to "cli". */
  backend?: BackendType;
  /** Working directory for CLI backends */
  workingDirectory?: string;
  /** Skip model validation (let CLI validate) */
  skipValidation?: boolean;
}

/** Options for factory configuration */
export interface LlmFactoryConfig {
  /** Default backend type (default: "cli") */
  defaultBackend?: BackendType;
  /** Default working directory for CLI execution */
  workingDirectory?: string;
  /** Maximum cached instances (default: 20) */
  maxCacheSize?: number;
}

/** Result type for creation attempts */
export type LlmCreateResult = { success: true; llm: BaseLlm } | { success: false; error: string };

// ============================================================================
// LLM FACTORY
// ============================================================================

/**
 * Unified LLM Factory
 *
 * Provides a single interface for creating LLM instances across different
 * providers and backends. Handles caching to avoid creating duplicate instances.
 *
 * @example
 * ```typescript
 * const factory = new LlmFactory();
 *
 * // Get CLI-based LLM
 * const cliLlm = factory.create('sonnet', { backend: 'cli' });
 *
 * // Get API-based LLM
 * const apiLlm = factory.create('claude-3-5-sonnet', { backend: 'api' });
 *
 * // Convenience methods
 * const cliLlm2 = factory.createCliLlm('flash');
 * const apiLlm2 = factory.createApiLlm('gemini-2.0-pro');
 * ```
 */
export class LlmFactory {
  private cache: Map<string, BaseLlm> = new Map();
  private config: Required<LlmFactoryConfig>;

  constructor(config: LlmFactoryConfig = {}) {
    this.config = {
      defaultBackend: config.defaultBackend ?? 'cli',
      workingDirectory: config.workingDirectory ?? process.cwd(),
      maxCacheSize: config.maxCacheSize ?? 20,
    };
  }

  // ==========================================================================
  // MAIN CREATION METHODS
  // ==========================================================================

  /**
   * Create or get cached LLM instance
   *
   * @param modelOrAlias - Model name or alias (e.g., "sonnet", "opus", "flash", "gemini-2.0-flash")
   * @param options - Creation options
   * @returns BaseLlm instance
   * @throws Error if provider cannot be detected
   */
  create(modelOrAlias: string, options: LlmCreateOptions = {}): BaseLlm {
    const backend = options.backend ?? this.config.defaultBackend;
    const workingDirectory = options.workingDirectory ?? this.config.workingDirectory;
    const cacheKey = this.buildCacheKey(modelOrAlias, backend, workingDirectory);

    // Return cached instance if available
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Detect provider
    const provider = detectProvider(modelOrAlias);
    if (!provider) {
      throw new Error(
        `Cannot detect provider for model: ${modelOrAlias}. ` +
          `Use a known alias (sonnet, opus, haiku, flash, pro) or full model name (claude-*, gemini-*).`,
      );
    }

    // Create instance
    const llm = this.createInstance(provider, modelOrAlias, backend, {
      workingDirectory,
      ...(options.skipValidation !== undefined && { skipValidation: options.skipValidation }),
    });

    // Cache and return
    this.cacheInstance(cacheKey, llm);
    return llm;
  }

  /**
   * Try to create LLM instance, returning Result type instead of throwing
   *
   * @param modelOrAlias - Model name or alias
   * @param options - Creation options
   * @returns Result with LLM or error message
   */
  tryCreate(modelOrAlias: string, options: LlmCreateOptions = {}): LlmCreateResult {
    try {
      const llm = this.create(modelOrAlias, options);
      return { success: true, llm };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create CLI-based LLM (convenience method)
   */
  createCliLlm(modelOrAlias: string, workingDirectory?: string): BaseLlm {
    return this.create(modelOrAlias, {
      backend: 'cli',
      workingDirectory: workingDirectory ?? this.config.workingDirectory,
    });
  }

  /**
   * Create API-based LLM (convenience method)
   */
  createApiLlm(modelOrAlias: string): BaseLlm {
    return this.create(modelOrAlias, { backend: 'api' });
  }

  /**
   * Create LLM for a specific provider (bypasses auto-detection)
   *
   * This is used when you want to force a specific provider regardless of model name.
   * For example, to use VibeProxy for model "sonnet" instead of Anthropic.
   *
   * @param model - Model name (passed to the provider as-is)
   * @param provider - Provider to use (vibeproxy, anthropic, google, etc.)
   * @param backend - Backend type (api or cli)
   * @param workingDirectory - Working directory for CLI backends
   */
  createForProvider(
    model: string,
    provider: ModelProvider,
    backend: BackendType,
    workingDirectory: string,
  ): BaseLlm {
    const cacheKey = this.buildCacheKey(`${provider}:${model}`, backend, workingDirectory);

    // Return cached instance if available
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Create instance for specific provider
    const llm = this.createInstance(provider, model, backend, { workingDirectory });

    // Cache and return
    this.cacheInstance(cacheKey, llm);
    return llm;
  }

  // ==========================================================================
  // CONFIGURATION METHODS
  // ==========================================================================

  /**
   * Set default backend type
   */
  setDefaultBackend(backend: BackendType): void {
    this.config.defaultBackend = backend;
  }

  /**
   * Get current default backend
   */
  getDefaultBackend(): BackendType {
    return this.config.defaultBackend;
  }

  /**
   * Set default working directory
   */
  setWorkingDirectory(dir: string): void {
    this.config.workingDirectory = dir;
  }

  /**
   * Get current working directory
   */
  getWorkingDirectory(): string {
    return this.config.workingDirectory;
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Clear all cached instances
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get number of cached instances
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Check if model/backend combination is cached
   */
  isCached(modelOrAlias: string, backend?: BackendType): boolean {
    const effectiveBackend = backend ?? this.config.defaultBackend;
    const cacheKey = this.buildCacheKey(
      modelOrAlias,
      effectiveBackend,
      this.config.workingDirectory,
    );
    return this.cache.has(cacheKey);
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if a model/alias is supported (provider can be detected)
   */
  isSupported(modelOrAlias: string): boolean {
    return detectProvider(modelOrAlias) !== null;
  }

  /**
   * Get provider for a model/alias
   */
  getProvider(modelOrAlias: string): ModelProvider | null {
    return detectProvider(modelOrAlias);
  }

  /**
   * Check if CLI backend is available for a model
   *
   * Tries to create a CLI LLM instance and checks if it's available.
   * Moved from ModelRegistry to consolidate all LLM logic in Factory.
   */
  async isCliAvailable(modelOrAlias: string): Promise<boolean> {
    try {
      const llm = this.createCliLlm(modelOrAlias, this.config.workingDirectory);
      if ('isAvailable' in llm && typeof llm.isAvailable === 'function') {
        return await (llm as ClaudeCliLlm | GeminiCliLlm).isAvailable();
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Discover available CLI providers and their versions
   *
   * Delegates to model-config's discoverProviders().
   * Moved from ModelRegistry to consolidate all provider discovery in Factory.
   */
  async discoverAvailable(): Promise<Map<ModelProvider, { available: boolean; version?: string }>> {
    return discoverProviders();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Build cache key for instance lookup
   */
  private buildCacheKey(model: string, backend: BackendType, workingDirectory: string): string {
    return `${model}:${backend}:${workingDirectory}`;
  }

  /**
   * Cache instance with LRU eviction
   */
  private cacheInstance(key: string, llm: BaseLlm): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, llm);
  }

  /**
   * Create LLM instance based on provider and backend
   */
  private createInstance(
    provider: ModelProvider,
    model: string,
    backend: BackendType,
    options: { workingDirectory: string; skipValidation?: boolean },
  ): BaseLlm {
    if (backend === 'cli') {
      return this.createCliInstance(provider, model, options);
    }
    return this.createApiInstance(provider, model);
  }

  /**
   * Create CLI-based LLM instance
   */
  private createCliInstance(
    provider: ModelProvider,
    model: string,
    options: { workingDirectory: string; skipValidation?: boolean },
  ): BaseLlm {
    switch (provider) {
      case 'anthropic':
        return new ClaudeCliLlmImpl({
          model,
          workingDirectory: options.workingDirectory,
          skipValidation: options.skipValidation ?? true,
        });
      case 'google':
        return new GeminiCliLlmImpl({
          model,
          workingDirectory: options.workingDirectory,
          skipValidation: options.skipValidation ?? true,
        });
      case 'groq':
        // Groq has no CLI, fall back to API
        return new GroqLlm({ model });
      case 'vibeproxy':
        // VibeProxy has no CLI, fall back to API
        return new VibeProxyLlm({ model });
      default:
        throw new Error(`CLI backend not supported for provider: ${provider}`);
    }
  }

  /**
   * Create API-based LLM instance
   * Uses Provider Registry for dynamic instantiation
   */
  private createApiInstance(provider: ModelProvider, model: string): BaseLlm {
    // Try registry first
    const LlmClass = getLlmClass(provider, 'api');
    if (LlmClass) {
      return new LlmClass({ model });
    }

    // Fallback to switch/case for backwards compatibility
    // This should never be reached if registry is properly configured
    switch (provider) {
      case 'anthropic':
        return new ClaudeLlm({ model });
      case 'google':
        return new Gemini({ model });
      case 'groq':
        return new GroqLlm({ model });
      case 'vibeproxy':
        return new VibeProxyLlm({ model });
      default:
        throw new Error(`API backend not supported for provider: ${provider}`);
    }
  }
}

// ============================================================================
// SINGLETON & CONVENIENCE FUNCTIONS
// ============================================================================

let factoryInstance: LlmFactory | null = null;

/**
 * Get global LLM factory instance
 */
export function getLlmFactory(config?: LlmFactoryConfig): LlmFactory {
  if (!factoryInstance) {
    factoryInstance = new LlmFactory(config);
  }
  return factoryInstance;
}

/**
 * Reset global factory instance (useful for testing)
 */
export function resetLlmFactory(): void {
  factoryInstance = null;
}

/**
 * Create LLM using global factory (convenience function)
 *
 * @param modelOrAlias - Model name or alias
 * @param options - Creation options
 * @returns BaseLlm instance
 */
export function createLlm(modelOrAlias: string, options?: LlmCreateOptions): BaseLlm {
  return getLlmFactory().create(modelOrAlias, options);
}

/**
 * Create CLI LLM using global factory (convenience function)
 */
export function createCliLlm(modelOrAlias: string, workingDirectory?: string): BaseLlm {
  return getLlmFactory().createCliLlm(modelOrAlias, workingDirectory);
}

/**
 * Create API LLM using global factory (convenience function)
 */
export function createApiLlm(modelOrAlias: string): BaseLlm {
  return getLlmFactory().createApiLlm(modelOrAlias);
}
