/**
 * Model Registry - Multi-provider LLM registry for Ralph
 *
 * Pass-through approach: any model name is accepted, CLI validates.
 * Provider is detected from model name pattern.
 *
 * @module @ralph/models/registry
 */

import { type BaseLlm, Gemini } from '@google/adk';
import { ClaudeCliLlm } from './claude-cli-llm.js';
import { ClaudeLlm } from './claude-llm.js';
import { GeminiCliLlm } from './gemini-cli-llm.js';
import { detectProvider, discoverProviders, type ModelProvider } from './model-config.js';

// Re-export types from model-config
export type { ModelProvider } from './model-config.js';

// ============================================================================
// TYPES
// ============================================================================

/** Backend type: API (requires keys) or CLI (uses local CLI) */
export type BackendType = 'api' | 'cli';

export interface RegistryConfig {
  /** Default backend type (default: "cli") */
  defaultBackend?: BackendType;
  /** Working directory for CLI execution */
  workingDirectory?: string;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export class ModelRegistry {
  private instances: Map<string, BaseLlm> = new Map();
  private config: Required<RegistryConfig>;

  constructor(config: RegistryConfig = {}) {
    this.config = {
      defaultBackend: config.defaultBackend ?? 'cli',
      workingDirectory: config.workingDirectory ?? process.cwd(),
    };
  }

  /**
   * Get or create an LLM instance for the given model
   *
   * Pass-through: any model name accepted, CLI validates
   *
   * @param modelOrAlias - Model name or alias (e.g., "sonnet", "opus", "flash", "gemini-2.0-flash")
   * @param backend - Backend type ("api" or "cli"). If not specified, uses default.
   */
  getLlm(modelOrAlias: string, backend?: BackendType): BaseLlm {
    const effectiveBackend = backend ?? this.config.defaultBackend;
    const cacheKey = `${modelOrAlias}:${effectiveBackend}:${this.config.workingDirectory}`;

    // Return cached instance if exists
    const cached = this.instances.get(cacheKey);
    if (cached) return cached;

    // Detect provider from model name
    const provider = detectProvider(modelOrAlias);

    if (!provider) {
      throw new Error(
        `Cannot detect provider for model: ${modelOrAlias}. ` +
          `Use a known alias (sonnet, opus, haiku, flash, pro) or full model name (claude-*, gemini-*).`,
      );
    }

    return this.createAndCache(cacheKey, provider, modelOrAlias, effectiveBackend);
  }

  /**
   * Get CLI-based LLM (shorthand)
   */
  getCliLlm(modelOrAlias: string): BaseLlm {
    return this.getLlm(modelOrAlias, 'cli');
  }

  /**
   * Get API-based LLM (shorthand)
   */
  getApiLlm(modelOrAlias: string): BaseLlm {
    return this.getLlm(modelOrAlias, 'api');
  }

  /**
   * Set default backend type
   */
  setDefaultBackend(backend: BackendType): void {
    this.config.defaultBackend = backend;
  }

  /**
   * Get current default backend type
   */
  getDefaultBackend(): BackendType {
    return this.config.defaultBackend;
  }

  /**
   * Set working directory for CLI backends
   */
  setWorkingDirectory(dir: string): void {
    this.config.workingDirectory = dir;
  }

  /**
   * Check if a model is supported (provider can be detected)
   */
  isSupported(modelOrAlias: string): boolean {
    return detectProvider(modelOrAlias) !== null;
  }

  /**
   * Check if CLI backend is available for a model
   */
  async isCliAvailable(modelOrAlias: string): Promise<boolean> {
    try {
      const llm = this.getCliLlm(modelOrAlias);
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
   */
  async discoverAvailable(): Promise<Map<ModelProvider, { available: boolean; version?: string }>> {
    return discoverProviders();
  }

  /**
   * Clear cached instances
   */
  clearCache(): void {
    this.instances.clear();
  }

  /**
   * Create and cache LLM instance
   */
  private createAndCache(
    key: string,
    provider: ModelProvider,
    model: string,
    backend: BackendType,
  ): BaseLlm {
    let llm: BaseLlm;

    if (backend === 'cli') {
      llm = this.createCliLlm(provider, model);
    } else {
      llm = this.createApiLlm(provider, model);
    }

    this.instances.set(key, llm);
    return llm;
  }

  /**
   * Create CLI-based LLM (pass-through model name)
   */
  private createCliLlm(provider: ModelProvider, model: string): BaseLlm {
    switch (provider) {
      case 'anthropic':
        return new ClaudeCliLlm({
          model, // pass-through
          workingDirectory: this.config.workingDirectory,
          skipValidation: true, // CLI validates
        });
      case 'google':
        return new GeminiCliLlm({
          model, // pass-through
          workingDirectory: this.config.workingDirectory,
          skipValidation: true, // CLI validates
        });
      default:
        throw new Error(`CLI backend not supported for provider: ${provider}`);
    }
  }

  /**
   * Create API-based LLM (pass-through model name)
   */
  private createApiLlm(provider: ModelProvider, model: string): BaseLlm {
    switch (provider) {
      case 'anthropic':
        return new ClaudeLlm({ model });
      case 'google':
        return new Gemini({ model });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

// ============================================================================
// SINGLETON & HELPERS
// ============================================================================

let registry: ModelRegistry | null = null;

/**
 * Get the global model registry
 */
export function getModelRegistry(config?: RegistryConfig): ModelRegistry {
  if (!registry) {
    registry = new ModelRegistry(config);
  }
  return registry;
}

/**
 * Reset the global model registry (useful for testing)
 */
export function resetModelRegistry(): void {
  registry = null;
}

/**
 * Shorthand to get an LLM instance (pass-through)
 */
export function getLlm(modelOrAlias: string, backend?: BackendType): BaseLlm {
  return getModelRegistry().getLlm(modelOrAlias, backend);
}

/**
 * Shorthand to get a CLI-based LLM
 */
export function getCliLlm(modelOrAlias: string): BaseLlm {
  return getModelRegistry().getCliLlm(modelOrAlias);
}

/**
 * Shorthand to get an API-based LLM
 */
export function getApiLlm(modelOrAlias: string): BaseLlm {
  return getModelRegistry().getApiLlm(modelOrAlias);
}
