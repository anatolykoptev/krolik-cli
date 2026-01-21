/**
 * @module commands/agent/selection/embeddings
 * @description Embedding cache for semantic agent matching
 *
 * Provides cached embeddings for agent descriptions and task queries.
 * Uses the shared embedding infrastructure from @storage/memory.
 *
 * Features:
 * - In-memory cache for agent embeddings (persist across calls)
 * - Lazy generation (only when embeddings available)
 * - Graceful fallback (returns null if embeddings unavailable)
 */

import { logger } from '@/lib/@core/logger';
import {
  generateEmbedding,
  isEmbeddingsAvailable,
  isEmbeddingsLoading,
  preloadEmbeddingPool,
} from '@/lib/@storage/memory/embeddings';
import { cosineSimilarity } from '@/lib/@storage/semantic-search';

// ============================================================================
// CACHE
// ============================================================================

/**
 * Maximum number of agent embeddings to cache.
 * Prevents unbounded memory growth in long-running processes.
 * 200 agents × ~1.5KB per embedding = ~300KB max memory.
 */
const MAX_CACHE_SIZE = 200;

/**
 * In-memory cache for agent embeddings
 * Key: agent name, Value: embedding vector
 * Uses LRU-like eviction when cache exceeds MAX_CACHE_SIZE
 */
const agentEmbeddingCache = new Map<string, Float32Array>();

/**
 * Add to cache with size limit (evict oldest entries if full)
 */
function cacheEmbedding(name: string, embedding: Float32Array): void {
  // Evict oldest entries if cache is full
  if (agentEmbeddingCache.size >= MAX_CACHE_SIZE) {
    // Map maintains insertion order, so first key is oldest
    const oldestKey = agentEmbeddingCache.keys().next().value;
    if (oldestKey) {
      agentEmbeddingCache.delete(oldestKey);
    }
  }
  agentEmbeddingCache.set(name, embedding);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/** Whether we've already tried to initialize embeddings */
let initAttempted = false;

/**
 * Maximum time to wait for embeddings to load (ms)
 *
 * Production optimization: Use very short timeout for instant response.
 * If embeddings not ready, gracefully degrade to keyword-only scoring.
 *
 * Timeout strategy:
 * - 0ms if not already loading (don't block at all)
 * - 50ms if already loading (quick check if nearly ready)
 *
 * Note: MCP server preloads embeddings at startup, so most MCP calls
 * will have embeddings ready. CLI cold starts use keyword-only.
 */
const INIT_TIMEOUT_MS = 50;

/**
 * Try to initialize embeddings with timeout
 * Returns true if embeddings become available within timeout
 *
 * Optimization: Only wait if embeddings are already loading (nearly ready).
 * Don't block on cold start — use keyword-only matching instead.
 */
async function tryInitEmbeddings(): Promise<boolean> {
  if (initAttempted) {
    return isEmbeddingsAvailable();
  }
  initAttempted = true;

  // If already ready, we're done
  if (isEmbeddingsAvailable()) {
    return true;
  }

  // If already loading, wait briefly (might be nearly ready)
  if (isEmbeddingsLoading()) {
    const startTime = Date.now();
    while (Date.now() - startTime < INIT_TIMEOUT_MS) {
      if (isEmbeddingsAvailable()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } else {
    // Not loading — start in background but don't wait
    // Next call will benefit from preloading
    preloadEmbeddingPool();
  }

  return isEmbeddingsAvailable();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get embedding for an agent (from pre-computed or generate on-demand)
 *
 * Priority:
 * 1. In-memory cache (fastest)
 * 2. Pre-computed embedding from capabilities index (no network)
 * 3. Generate on-demand (slowest, requires model)
 *
 * @param name - Agent name (cache key)
 * @param description - Agent description to embed
 * @param preComputed - Pre-computed embedding from capabilities index
 * @returns Embedding vector or null if unavailable
 */
export async function getAgentEmbedding(
  name: string,
  description: string,
  preComputed?: number[],
): Promise<Float32Array | null> {
  // Check in-memory cache first (fastest path)
  const cached = agentEmbeddingCache.get(name);
  if (cached) {
    return cached;
  }

  // Use pre-computed embedding if available (no model call needed)
  if (preComputed && preComputed.length > 0) {
    const embedding = new Float32Array(preComputed);
    cacheEmbedding(name, embedding);
    return embedding;
  }

  // Fallback to on-demand generation if embeddings available
  if (!isEmbeddingsAvailable()) {
    return null;
  }

  try {
    const result = await generateEmbedding(description);
    cacheEmbedding(name, result.embedding);
    return result.embedding;
  } catch (error) {
    // Log at debug level for troubleshooting, but don't fail
    logger.debug(`Embedding generation failed for agent "${name}": ${error}`);
    return null;
  }
}

/**
 * Get embedding for a task description
 *
 * This is the entry point for semantic matching.
 * Attempts to initialize embeddings if not already done.
 *
 * @param task - Task description to embed
 * @returns Embedding vector or null if unavailable
 */
export async function getTaskEmbedding(task: string): Promise<Float32Array | null> {
  // Try to initialize embeddings (with timeout)
  const available = await tryInitEmbeddings();
  if (!available) {
    return null;
  }

  try {
    const result = await generateEmbedding(task);
    return result.embedding;
  } catch (error) {
    // Log at debug level for troubleshooting, but don't fail
    logger.debug(`Task embedding generation failed: ${error}`);
    return null;
  }
}

/**
 * Semantic similarity result
 */
export interface SemanticSimilarityResult {
  /** Similarity score (0-1), null if embeddings unavailable */
  similarity: number | null;
}

/**
 * Calculate semantic similarity between task and agent
 *
 * @param taskEmbedding - Pre-computed task embedding
 * @param agentName - Agent name
 * @param agentDescription - Agent description
 * @param preComputedAgentEmbedding - Pre-computed agent embedding from index
 * @returns Object with similarity score (null if unavailable, 0-1 if calculated)
 */
export async function calculateSemanticSimilarity(
  taskEmbedding: Float32Array | null,
  agentName: string,
  agentDescription: string,
  preComputedAgentEmbedding?: number[],
): Promise<SemanticSimilarityResult> {
  // No task embedding = no semantic matching available
  if (!taskEmbedding) return { similarity: null };

  const agentEmbedding = await getAgentEmbedding(
    agentName,
    agentDescription,
    preComputedAgentEmbedding,
  );
  // No agent embedding = cannot compute similarity
  if (!agentEmbedding) return { similarity: null };

  // Calculate cosine similarity (can be 0 for orthogonal vectors - valid result!)
  return { similarity: cosineSimilarity(taskEmbedding, agentEmbedding) };
}

/**
 * Check if semantic matching is available
 */
export function isSemanticMatchingAvailable(): boolean {
  return isEmbeddingsAvailable();
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { cachedAgents: number } {
  return {
    cachedAgents: agentEmbeddingCache.size,
  };
}

/**
 * Clear embedding cache (for testing)
 */
export function clearEmbeddingCache(): void {
  agentEmbeddingCache.clear();
}
