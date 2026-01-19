/**
 * Model Registry - Multi-provider LLM registry for Ralph
 *
 * High-level registry that wraps LlmFactory with additional features:
 * - Provider discovery (check CLI availability)
 * - Health checking
 * - Backward-compatible API
 *
 * For direct LLM creation, prefer using LlmFactory directly.
 *
 * @module @felix/models/registry
 */

import type { BaseLlm } from '@google/adk';
import type { ClaudeCliLlm } from './claude-cli-llm.js';
import type { GeminiCliLlm } from './gemini-cli-llm.js';
import {
  type BackendType,
  LlmFactory,
  type LlmFactoryConfig,
  resetLlmFactory,
} from './llm-factory.js';
import { discoverProviders, type ModelProvider } from './model-config.js';

// Re-export types
export type { BackendType } from './llm-factory.js';
export type { ModelProvider } from './model-config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RegistryConfig extends LlmFactoryConfig {
  /** Default backend type (default: "cli") */
  defaultBackend?: BackendType;
  /** Working directory for CLI execution */
  workingDirectory?: string;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

/**
 * Model Registry - High-level LLM management
 *
 * Wraps LlmFactory with additional features like provider discovery
 * and health checking. Maintains backward compatibility with existing API.
 */
export class ModelRegistry {
  private factory: LlmFactory;
  private config: Required<Omit<RegistryConfig, 'maxCacheSize'>> & { maxCacheSize: number };

  constructor(config: RegistryConfig = {}) {
    this.config = {
      defaultBackend: config.defaultBackend ?? 'cli',
      workingDirectory: config.workingDirectory ?? process.cwd(),
      maxCacheSize: config.maxCacheSize ?? 20,
    };
    this.factory = new LlmFactory(this.config);
  }

  // ==========================================================================
  // LLM CREATION (delegated to factory)
  // ==========================================================================

  /**
   * Get or create an LLM instance for the given model
   *
   * @param modelOrAlias - Model name or alias (e.g., "sonnet", "opus", "flash", "gemini-2.0-flash")
   * @param backend - Backend type ("api" or "cli"). If not specified, uses default.
   */
  getLlm(modelOrAlias: string, backend?: BackendType): BaseLlm {
    return this.factory.create(modelOrAlias, {
      backend: backend ?? this.config.defaultBackend,
      workingDirectory: this.config.workingDirectory,
    });
  }

  /**
   * Get CLI-based LLM (shorthand)
   */
  getCliLlm(modelOrAlias: string): BaseLlm {
    return this.factory.createCliLlm(modelOrAlias, this.config.workingDirectory);
  }

  /**
   * Get API-based LLM (shorthand)
   */
  getApiLlm(modelOrAlias: string): BaseLlm {
    return this.factory.createApiLlm(modelOrAlias);
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Set default backend type
   */
  setDefaultBackend(backend: BackendType): void {
    this.config.defaultBackend = backend;
    this.factory.setDefaultBackend(backend);
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
    this.factory.setWorkingDirectory(dir);
  }

  // ==========================================================================
  // VALIDATION & DISCOVERY
  // ==========================================================================

  /**
   * Check if a model is supported (provider can be detected)
   */
  isSupported(modelOrAlias: string): boolean {
    return this.factory.isSupported(modelOrAlias);
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

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Clear cached instances
   */
  clearCache(): void {
    this.factory.clearCache();
  }

  /**
   * Get underlying factory (for advanced use)
   */
  getFactory(): LlmFactory {
    return this.factory;
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
  resetLlmFactory();
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
