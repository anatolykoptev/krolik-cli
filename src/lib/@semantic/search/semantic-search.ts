/**
 * @module lib/@semantic/search/semantic-search
 * @description Reusable semantic search class
 */

import {
  cosineSimilarity,
  generateEmbedding,
  isEmbeddingsAvailable,
  isEmbeddingsLoading,
  preloadEmbeddingPool,
} from '@/lib/@storage/memory/embeddings';
import {
  DEFAULT_INIT_TIMEOUT,
  DEFAULT_THRESHOLDS,
  type ScoringThresholds,
  type SearchOptions,
  type SearchResult,
  type SearchStatus,
  type SemanticSearchConfig,
} from './types';

/**
 * Reusable semantic search class
 *
 * Provides semantic similarity search across any collection of items.
 * Uses Xenova embeddings with automatic caching and graceful fallback.
 *
 * @example
 * ```typescript
 * interface Agent {
 *   name: string;
 *   description: string;
 * }
 *
 * const search = new SemanticSearch<Agent>({
 *   getId: (agent) => agent.name,
 *   getText: (agent) => agent.description,
 * });
 *
 * const results = await search.search('optimize performance', agents);
 * for (const { item, similarity, points } of results) {
 *   console.log(`${item.name}: ${similarity.toFixed(3)} (${points} pts)`);
 * }
 * ```
 */
export class SemanticSearch<T> {
  private config: SemanticSearchConfig<T>;
  private thresholds: ScoringThresholds;
  private initTimeout: number;
  private embeddingCache: Map<string, Float32Array>;
  private initAttempted: boolean;

  constructor(config: SemanticSearchConfig<T>) {
    this.config = config;
    this.thresholds = config.thresholds ?? DEFAULT_THRESHOLDS;
    this.initTimeout = config.initTimeout ?? DEFAULT_INIT_TIMEOUT;
    this.embeddingCache = new Map();
    this.initAttempted = false;
  }

  /**
   * Search for items semantically similar to query
   *
   * @param query - Search query text
   * @param items - Collection of items to search
   * @param options - Search options
   * @returns Array of results sorted by similarity (highest first)
   */
  async search(query: string, items: T[], options: SearchOptions = {}): Promise<SearchResult<T>[]> {
    const { maxResults = 10, minSimilarity = 0 } = options;

    // Try to get query embedding
    const queryEmbedding = await this.getQueryEmbedding(query);
    if (!queryEmbedding) {
      // Graceful fallback: return empty results
      return [];
    }

    // Score all items
    const results: SearchResult<T>[] = [];

    for (const item of items) {
      const similarity = await this.calculateSimilarity(queryEmbedding, item);
      if (similarity >= minSimilarity) {
        results.push({
          item,
          similarity,
          points: this.calculatePoints(similarity),
        });
      }
    }

    // Sort by similarity (highest first) and limit
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
  }

  /**
   * Get embedding for a single item (cached)
   *
   * @param item - Item to embed
   * @returns Embedding vector or null if unavailable
   */
  async getItemEmbedding(item: T): Promise<Float32Array | null> {
    const id = this.config.getId(item);

    // Check cache
    const cached = this.embeddingCache.get(id);
    if (cached) {
      return cached;
    }

    // Initialize if needed
    const available = await this.tryInit();
    if (!available) {
      return null;
    }

    // Generate and cache
    try {
      const text = this.config.getText(item);
      const result = await generateEmbedding(text);
      this.embeddingCache.set(id, result.embedding);
      return result.embedding;
    } catch {
      return null;
    }
  }

  /**
   * Pre-cache embeddings for a collection of items
   *
   * Call this to warm up the cache before searching.
   *
   * @param items - Items to pre-cache
   * @returns Number of successfully cached items
   */
  async preCacheItems(items: T[]): Promise<number> {
    let cached = 0;
    for (const item of items) {
      const embedding = await this.getItemEmbedding(item);
      if (embedding) {
        cached++;
      }
    }
    return cached;
  }

  /**
   * Get status of semantic search
   */
  getStatus(): SearchStatus {
    return {
      available: isEmbeddingsAvailable(),
      loading: isEmbeddingsLoading(),
      cachedItems: this.embeddingCache.size,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Calculate points based on similarity thresholds
   */
  private calculatePoints(similarity: number): number {
    if (similarity > this.thresholds.high) {
      return this.thresholds.highPoints;
    }
    if (similarity > this.thresholds.medium) {
      return this.thresholds.mediumPoints;
    }
    if (similarity > this.thresholds.low) {
      return this.thresholds.lowPoints;
    }
    return 0;
  }

  /**
   * Calculate similarity between query and item
   */
  private async calculateSimilarity(queryEmbedding: Float32Array, item: T): Promise<number> {
    const itemEmbedding = await this.getItemEmbedding(item);
    if (!itemEmbedding) {
      return 0;
    }
    return cosineSimilarity(queryEmbedding, itemEmbedding);
  }

  /**
   * Get embedding for search query
   */
  private async getQueryEmbedding(query: string): Promise<Float32Array | null> {
    const available = await this.tryInit();
    if (!available) {
      return null;
    }

    try {
      const result = await generateEmbedding(query);
      return result.embedding;
    } catch {
      return null;
    }
  }

  /**
   * Try to initialize embeddings with timeout
   */
  private async tryInit(): Promise<boolean> {
    if (this.initAttempted) {
      return isEmbeddingsAvailable();
    }
    this.initAttempted = true;

    // Already ready
    if (isEmbeddingsAvailable()) {
      return true;
    }

    // Start loading if not already
    if (!isEmbeddingsLoading()) {
      preloadEmbeddingPool();
    }

    // Wait with timeout
    const startTime = Date.now();
    while (Date.now() - startTime < this.initTimeout) {
      if (isEmbeddingsAvailable()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return isEmbeddingsAvailable();
  }
}
