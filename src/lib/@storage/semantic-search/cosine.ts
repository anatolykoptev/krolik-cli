/**
 * @module lib/@storage/semantic-search/cosine
 * @description Cosine similarity calculation for embeddings
 *
 * Provides optimized cosine similarity computation for comparing
 * semantic embeddings in high-dimensional vector space.
 */

/**
 * Calculate cosine similarity between two embeddings
 *
 * Measures the cosine of the angle between two vectors in n-dimensional space.
 * Returns a value between -1 and 1:
 * - 1 = identical direction (very similar)
 * - 0 = orthogonal (unrelated)
 * - -1 = opposite direction (very dissimilar)
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (higher = more similar)
 *
 * @throws {Error} If embedding dimensions don't match
 *
 * @example
 * ```typescript
 * const embedding1 = new Float32Array([0.1, 0.2, 0.3]);
 * const embedding2 = new Float32Array([0.15, 0.25, 0.35]);
 * const similarity = cosineSimilarity(embedding1, embedding2);
 * console.log(similarity); // ~0.999 (very similar)
 * ```
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
