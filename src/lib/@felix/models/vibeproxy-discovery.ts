/**
 * VibeProxy Model Discovery
 *
 * Dynamically fetches available models from VibeProxy /v1/models endpoint.
 * Caches results with TTL to avoid repeated API calls.
 *
 * @module @felix/models/vibeproxy-discovery
 */

// ============================================================================
// TYPES
// ============================================================================

export interface VibeProxyModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface VibeProxyModelsResponse {
  data: VibeProxyModel[];
  object: string;
}

interface CachedModels {
  models: VibeProxyModel[];
  fetchedAt: number;
  expiresAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8318';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 3000; // 3 seconds

/**
 * Owner categories for model grouping
 */
export const MODEL_OWNERS = {
  ANTIGRAVITY: 'antigravity',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  GITHUB_COPILOT: 'github-copilot',
} as const;

// ============================================================================
// DISCOVERY SERVICE
// ============================================================================

/**
 * VibeProxy Model Discovery Service
 *
 * Fetches and caches available models from VibeProxy.
 * Falls back to static list if VibeProxy is unavailable.
 */
class VibeProxyDiscovery {
  private baseUrl: string;
  private cacheTtlMs: number;
  private cache: CachedModels | null = null;
  private fetchPromise: Promise<VibeProxyModel[]> | null = null;
  private aliasMapCache: Map<string, string> | null = null;
  private aliasMapPromise: Promise<Map<string, string>> | null = null;

  constructor(baseUrl?: string, cacheTtlMs?: number) {
    this.baseUrl = baseUrl ?? process.env.VIBEPROXY_BASE_URL ?? DEFAULT_BASE_URL;
    this.cacheTtlMs = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Preload models and alias map into cache.
   * Call this at application startup for best performance.
   */
  async preload(): Promise<void> {
    await this.getModels();
    await this.buildAliasMap();
  }

  /**
   * Check if cache is warmed up (models and aliases loaded)
   */
  isCacheWarmed(): boolean {
    return this.cache !== null && this.aliasMapCache !== null;
  }

  /**
   * Resolve alias synchronously using cached data.
   * Returns undefined if cache is not warmed.
   * Use resolveAlias() for async resolution with auto-fetch.
   */
  resolveAliasSync(aliasOrId: string): string | undefined {
    if (!this.aliasMapCache) {
      return undefined;
    }
    return this.aliasMapCache.get(aliasOrId.toLowerCase()) ?? this.aliasMapCache.get(aliasOrId);
  }

  /**
   * Get available models (cached or fresh)
   */
  async getModels(): Promise<VibeProxyModel[]> {
    // Return cached if valid
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.models;
    }

    // Deduplicate concurrent fetches
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchModels();

    try {
      const models = await this.fetchPromise;
      return models;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Get models by owner (e.g., 'antigravity', 'anthropic')
   */
  async getModelsByOwner(owner: string): Promise<VibeProxyModel[]> {
    const models = await this.getModels();
    return models.filter((m) => m.owned_by === owner);
  }

  /**
   * Get Antigravity models (free via Google account)
   */
  async getAntigravityModels(): Promise<VibeProxyModel[]> {
    return this.getModelsByOwner(MODEL_OWNERS.ANTIGRAVITY);
  }

  /**
   * Check if model ID exists
   */
  async hasModel(modelId: string): Promise<boolean> {
    const models = await this.getModels();
    return models.some((m) => m.id === modelId);
  }

  /**
   * Find model by ID or partial match
   */
  async findModel(query: string): Promise<VibeProxyModel | undefined> {
    const models = await this.getModels();
    const lower = query.toLowerCase();

    // Exact match first
    const exact = models.find((m) => m.id.toLowerCase() === lower);
    if (exact) return exact;

    // Partial match
    return models.find((m) => m.id.toLowerCase().includes(lower));
  }

  /**
   * Build alias map from discovered models
   * Maps common aliases to full VibeProxy model IDs
   * Prioritizes thinking models for generic aliases like 'sonnet', 'opus'
   * Results are cached for sync access via resolveAliasSync()
   */
  async buildAliasMap(): Promise<Map<string, string>> {
    // Return cached if valid
    if (this.aliasMapCache && this.cache && Date.now() < this.cache.expiresAt) {
      return this.aliasMapCache;
    }

    // Deduplicate concurrent builds
    if (this.aliasMapPromise) {
      return this.aliasMapPromise;
    }

    this.aliasMapPromise = this.buildAliasMapInternal();

    try {
      const aliasMap = await this.aliasMapPromise;
      this.aliasMapCache = aliasMap;
      return aliasMap;
    } finally {
      this.aliasMapPromise = null;
    }
  }

  private async buildAliasMapInternal(): Promise<Map<string, string>> {
    const models = await this.getModels();
    const aliasMap = new Map<string, string>();

    // First pass: collect all aliases with their models
    const aliasToModels = new Map<string, VibeProxyModel[]>();

    for (const model of models) {
      // Add the model ID itself
      aliasMap.set(model.id, model.id);

      // Generate aliases based on model patterns
      const aliases = this.generateAliases(model);
      for (const alias of aliases) {
        if (!aliasToModels.has(alias)) {
          aliasToModels.set(alias, []);
        }
        aliasToModels.get(alias)!.push(model);
      }
    }

    // Second pass: resolve conflicts with priority rules
    for (const [alias, candidateModels] of aliasToModels) {
      if (candidateModels.length === 1) {
        const firstModel = candidateModels[0];
        if (firstModel) {
          aliasMap.set(alias, firstModel.id);
        }
      } else {
        // Priority: thinking > non-thinking, newer > older
        const sorted = candidateModels.sort((a, b) => {
          // Prefer thinking models for generic aliases
          const aThinking = a.id.includes('thinking') ? 1 : 0;
          const bThinking = b.id.includes('thinking') ? 1 : 0;
          if (aThinking !== bThinking) {
            return bThinking - aThinking; // thinking first
          }
          // Prefer newer models
          return b.created - a.created;
        });
        const bestModel = sorted[0];
        if (bestModel) {
          aliasMap.set(alias, bestModel.id);
        }
      }
    }

    return aliasMap;
  }

  /**
   * Resolve alias to full model ID
   */
  async resolveAlias(aliasOrId: string): Promise<string | undefined> {
    const aliasMap = await this.buildAliasMap();
    return aliasMap.get(aliasOrId.toLowerCase()) ?? aliasMap.get(aliasOrId);
  }

  /**
   * Check if VibeProxy is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache (for testing or forced refresh)
   */
  clearCache(): void {
    this.cache = null;
    this.aliasMapCache = null;
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { cached: boolean; expiresIn?: number } {
    if (!this.cache) {
      return { cached: false };
    }

    const expiresIn = this.cache.expiresAt - Date.now();
    if (expiresIn > 0) {
      return { cached: true, expiresIn };
    }
    return { cached: false };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async fetchModels(): Promise<VibeProxyModel[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[vibeproxy-discovery] Failed to fetch models: ${response.status}`);
        return this.getStaticFallback();
      }

      const data = (await response.json()) as VibeProxyModelsResponse;
      const models = data.data ?? [];

      // Cache the results
      this.cache = {
        models,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + this.cacheTtlMs,
      };

      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[vibeproxy-discovery] Error fetching models: ${message}`);
      return this.getStaticFallback();
    }
  }

  /**
   * Generate aliases for a model
   * Only generates aliases for Antigravity models (via VibeProxy)
   */
  private generateAliases(model: VibeProxyModel): string[] {
    const aliases: string[] = [];
    const id = model.id.toLowerCase();

    // Only generate aliases for Antigravity models
    // Other providers (anthropic, google) have their own direct APIs
    if (model.owned_by !== MODEL_OWNERS.ANTIGRAVITY) {
      return aliases;
    }

    // gemini-claude-sonnet-4-5-thinking → sonnet, claude-sonnet, vibe-sonnet
    if (id.includes('claude-sonnet') || id.includes('sonnet')) {
      aliases.push('sonnet', 'claude-sonnet', 'vibe-sonnet', 'antigravity-sonnet');
      if (id.includes('thinking')) {
        aliases.push('sonnet-thinking');
      }
      if (!id.includes('thinking')) {
        aliases.push('sonnet-fast', 'vibe-sonnet-fast');
      }
    }

    // gemini-claude-opus-4-5-thinking → opus, claude-opus, vibe-opus
    if (id.includes('claude-opus') || id.includes('opus')) {
      aliases.push('opus', 'claude-opus', 'vibe-opus', 'antigravity-opus');
      if (id.includes('thinking')) {
        aliases.push('opus-thinking');
      }
    }

    // gemini-3-pro-* → gemini-3-pro, g3-pro
    if (id.includes('gemini-3-pro')) {
      aliases.push('gemini-3-pro', 'g3-pro');
    }

    // gemini-2.5-flash → flash, gemini-flash
    if (id.includes('gemini-2') && id.includes('flash')) {
      aliases.push('flash', 'gemini-flash', 'gemini-2-flash');
    }

    // gemini-2.5-pro → pro, gemini-pro
    if (id.includes('gemini-2') && id.includes('pro') && !id.includes('preview')) {
      aliases.push('pro', 'gemini-pro', 'gemini-2-pro');
    }

    return aliases;
  }

  /**
   * Static fallback when VibeProxy is unavailable
   */
  private getStaticFallback(): VibeProxyModel[] {
    return [
      {
        id: 'gemini-claude-opus-4-5-thinking',
        object: 'model',
        created: Date.now(),
        owned_by: MODEL_OWNERS.ANTIGRAVITY,
      },
      {
        id: 'gemini-claude-sonnet-4-5-thinking',
        object: 'model',
        created: Date.now(),
        owned_by: MODEL_OWNERS.ANTIGRAVITY,
      },
      {
        id: 'gemini-claude-sonnet-4-5',
        object: 'model',
        created: Date.now(),
        owned_by: MODEL_OWNERS.ANTIGRAVITY,
      },
      {
        id: 'gemini-3-pro-image-preview',
        object: 'model',
        created: Date.now(),
        owned_by: MODEL_OWNERS.ANTIGRAVITY,
      },
    ];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let discoveryInstance: VibeProxyDiscovery | null = null;

/**
 * Get the singleton VibeProxy discovery instance
 */
export function getVibeProxyDiscovery(): VibeProxyDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new VibeProxyDiscovery();
  }
  return discoveryInstance;
}

/**
 * Reset the discovery instance (for testing)
 */
export function resetVibeProxyDiscovery(): void {
  discoveryInstance = null;
}

/**
 * Create a custom discovery instance
 */
export function createVibeProxyDiscovery(
  baseUrl?: string,
  cacheTtlMs?: number,
): VibeProxyDiscovery {
  return new VibeProxyDiscovery(baseUrl, cacheTtlMs);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Resolve a model alias to full VibeProxy model ID
 *
 * @example
 * resolveVibeProxyAlias('sonnet') → 'gemini-claude-sonnet-4-5-thinking'
 * resolveVibeProxyAlias('opus') → 'gemini-claude-opus-4-5-thinking'
 */
export async function resolveVibeProxyAlias(aliasOrId: string): Promise<string | undefined> {
  const discovery = getVibeProxyDiscovery();
  return discovery.resolveAlias(aliasOrId);
}

/**
 * Get all available VibeProxy models
 */
export async function getVibeProxyModels(): Promise<VibeProxyModel[]> {
  const discovery = getVibeProxyDiscovery();
  return discovery.getModels();
}

/**
 * Check if VibeProxy is available
 */
export async function isVibeProxyAvailable(): Promise<boolean> {
  const discovery = getVibeProxyDiscovery();
  return discovery.isAvailable();
}

/**
 * Preload VibeProxy models and alias cache.
 * Call this at application startup for best performance.
 * After preload, resolveVibeProxyAliasSync() can be used.
 */
export async function preloadVibeProxyModels(): Promise<void> {
  const discovery = getVibeProxyDiscovery();
  return discovery.preload();
}

/**
 * Resolve alias synchronously using cached data.
 * Returns undefined if cache is not warmed (call preloadVibeProxyModels first).
 * For async resolution with auto-fetch, use resolveVibeProxyAlias().
 */
export function resolveVibeProxyAliasSync(aliasOrId: string): string | undefined {
  const discovery = getVibeProxyDiscovery();
  return discovery.resolveAliasSync(aliasOrId);
}

/**
 * Check if VibeProxy discovery cache is warmed
 */
export function isVibeProxyCacheWarmed(): boolean {
  const discovery = getVibeProxyDiscovery();
  return discovery.isCacheWarmed();
}

export { VibeProxyDiscovery };
