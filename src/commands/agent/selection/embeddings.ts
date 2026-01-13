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
// PUBLIC API
// ============================================================================

/**
 * Get embedding for an agent description (cached)
 *
 * @param name - Agent name (cache key)
 * @param description - Agent description to embed
 * @returns Embedding vector or null if unavailable
 */
export async function getAgentEmbedding(
  name: string,
  description: string,
): Promise<Float32Array | null> {
  // Graceful fallback if embeddings not available
  if (!isEmbeddingsAvailable()) {
    return null;
  }

  // Check cache first
  const cached = agentEmbeddingCache.get(name);
  if (cached) {
    return cached;
  }

  // Generate and cache
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
 * @param task - Task description to embed
 * @returns Embedding vector or null if unavailable
 */
export async function getTaskEmbedding(task: string): Promise<Float32Array | null> {
  // Graceful fallback if embeddings not available
  if (!isEmbeddingsAvailable()) {
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
 * @returns Similarity score (0-1) or 0 if unavailable
 */
export async function calculateSemanticSimilarity(
  taskEmbedding: Float32Array | null,
  agentName: string,
  agentDescription: string,
): Promise<number> {
  if (!taskEmbedding) return 0;

  const agentEmbedding = await getAgentEmbedding(agentName, agentDescription);
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
