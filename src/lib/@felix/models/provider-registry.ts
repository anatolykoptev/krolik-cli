/**
 * Provider Registry - Dynamic LLM registration system
 *
 * Eliminates switch/case hell in llm-factory.ts
 * Allows adding new providers without modifying factory code
 *
 * @module @ralph/models/provider-registry
 */

import type { BaseLlm, Gemini } from '@google/adk';
import type { ModelProvider } from './model-config.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * LLM constructor signature
 * All LLM classes must follow this pattern:
 * - constructor({ model: string })
 * - extends BaseLlm
 */
export type LlmConstructor = new (params: { model: string }) => BaseLlm;

/**
 * Provider metadata for registry
 */
export interface ProviderMetadata {
  /** LLM class constructor */
  llmClass: LlmConstructor;
  /** Supported backends ('api', 'cli', or both) */
  backends: ('api' | 'cli')[];
  /** Description */
  description?: string;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Provider Registry - maps providers to LLM classes
 *
 * Usage:
 * ```typescript
 * // Register a provider
 * providerRegistry.register('vibeproxy', {
 *   llmClass: VibeProxyLlm,
 *   backends: ['api'],
 *   description: 'VibeProxy multi-provider gateway'
 * });
 *
 * // Get LLM class for a provider
 * const LlmClass = providerRegistry.get('vibeproxy', 'api');
 * const llm = new LlmClass!({ model: 'vibe-opus' });
 * ```
 */
export class ProviderRegistry {
  private providers = new Map<ModelProvider, ProviderMetadata>();

  /**
   * Register a provider
   *
   * @param provider - Provider name
   * @param metadata - Provider metadata with LLM class
   */
  register(provider: ModelProvider, metadata: ProviderMetadata): void {
    if (this.providers.has(provider)) {
      console.warn(`[provider-registry] Provider "${provider}" already registered, overwriting`);
    }
    this.providers.set(provider, metadata);
  }

  /**
   * Get LLM class for a provider and backend
   *
   * @param provider - Provider name
   * @param backend - Backend type ('api' or 'cli')
   * @returns LLM constructor or undefined if not found
   */
  get(provider: ModelProvider, backend: 'api' | 'cli'): LlmConstructor | undefined {
    const metadata = this.providers.get(provider);
    if (!metadata) {
      return undefined;
    }

    // Check if provider supports this backend
    if (!metadata.backends.includes(backend)) {
      return undefined;
    }

    return metadata.llmClass;
  }

  /**
   * Check if provider is registered
   *
   * @param provider - Provider name
   * @returns True if provider is registered
   */
  has(provider: ModelProvider): boolean {
    return this.providers.has(provider);
  }

  /**
   * Check if provider supports backend
   *
   * @param provider - Provider name
   * @param backend - Backend type
   * @returns True if provider supports backend
   */
  supportsBackend(provider: ModelProvider, backend: 'api' | 'cli'): boolean {
    const metadata = this.providers.get(provider);
    return metadata?.backends.includes(backend) ?? false;
  }

  /**
   * Get all registered providers
   *
   * @returns Array of provider names
   */
  getAll(): ModelProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get metadata for a provider
   *
   * @param provider - Provider name
   * @returns Provider metadata or undefined
   */
  getMetadata(provider: ModelProvider): ProviderMetadata | undefined {
    return this.providers.get(provider);
  }

  /**
   * Clear all registered providers (for testing)
   */
  clear(): void {
    this.providers.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistry();

// ============================================================================
// AUTO-REGISTRATION
// ============================================================================

/**
 * Auto-register all known providers
 * This runs at module load time
 */
function registerBuiltInProviders() {
  // Import LLM classes
  // NOTE: Can't use dynamic imports in top-level, must be sync
  // Registered in llm-factory.ts instead when classes are imported
  // Alternatively, we can do lazy registration on first use
  // But for now, keep it simple and register in llm-factory
}

// Run auto-registration
registerBuiltInProviders();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Register a provider (convenience function)
 *
 * @param provider - Provider name
 * @param llmClass - LLM class constructor
 * @param backends - Supported backends
 * @param description - Optional description
 */
export function registerProvider(
  provider: ModelProvider,
  llmClass: LlmConstructor,
  backends: ('api' | 'cli')[],
  description?: string,
): void {
  providerRegistry.register(provider, {
    llmClass,
    backends,
    description,
  });
}

/**
 * Get LLM class for provider and backend (convenience function)
 *
 * @param provider - Provider name
 * @param backend - Backend type
 * @returns LLM constructor or undefined
 */
export function getLlmClass(
  provider: ModelProvider,
  backend: 'api' | 'cli',
): LlmConstructor | undefined {
  return providerRegistry.get(provider, backend);
}
