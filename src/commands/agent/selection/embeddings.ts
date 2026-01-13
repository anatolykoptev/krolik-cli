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

import {
  cosineSimilarity,
  generateEmbedding,
  isEmbeddingsAvailable,
  isEmbeddingsLoading,
  preloadEmbeddingPool,
} from '@/lib/@storage/memory/embeddings';

// ============================================================================
// CACHE
// ============================================================================

/**
 * In-memory cache for agent embeddings
 * Key: agent name, Value: embedding vector
 */
const agentEmbeddingCache = new Map<string, Float32Array>();

// ============================================================================
// INITIALIZATION
// ============================================================================

/** Whether we've already tried to initialize embeddings */
let initAttempted = false;

/**
 * Maximum time to wait for embeddings to load (ms)
 *
 * Production optimization: Use short timeout (100ms) for agent selection
 * to ensure instant response. If embeddings not ready, gracefully
 * degrade to keyword-only scoring (still 40/100 points max).
 *
 * Note: MCP server preloads embeddings at startup, so most calls
 * will hit the cache and return instantly.
 */
const INIT_TIMEOUT_MS = 100;

/**
 * Try to initialize embeddings with timeout
 * Returns true if embeddings become available within timeout
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

  // Start loading if not already
  if (!isEmbeddingsLoading()) {
    preloadEmbeddingPool();
  }

  // Wait for embeddings to become available with timeout
  // Use 10ms polling for quick detection within 100ms window
  const startTime = Date.now();
  while (Date.now() - startTime < INIT_TIMEOUT_MS) {
    if (isEmbeddingsAvailable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
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
    agentEmbeddingCache.set(name, embedding);
    return embedding;
  }

  // Fallback to on-demand generation if embeddings available
  if (!isEmbeddingsAvailable()) {
    return null;
  }

  try {
    const result = await generateEmbedding(description);
    agentEmbeddingCache.set(name, result.embedding);
    return result.embedding;
  } catch {
    // Silently fail - scoring will fall back to keyword-only
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
  } catch {
    // Silently fail - scoring will fall back to keyword-only
    return null;
  }
}

/**
 * Calculate semantic similarity between task and agent
 *
 * @param taskEmbedding - Pre-computed task embedding
 * @param agentName - Agent name
 * @param agentDescription - Agent description
 * @param preComputedAgentEmbedding - Pre-computed agent embedding from index
 * @returns Similarity score (0-1) or 0 if unavailable
 */
export async function calculateSemanticSimilarity(
  taskEmbedding: Float32Array | null,
  agentName: string,
  agentDescription: string,
  preComputedAgentEmbedding?: number[],
): Promise<number> {
  if (!taskEmbedding) return 0;

  const agentEmbedding = await getAgentEmbedding(
    agentName,
    agentDescription,
    preComputedAgentEmbedding,
  );
  if (!agentEmbedding) return 0;

  return cosineSimilarity(taskEmbedding, agentEmbedding);
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
