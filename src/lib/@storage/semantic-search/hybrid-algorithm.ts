/**
 * @module lib/@storage/semantic-search/hybrid-algorithm
 * @description Generic hybrid search algorithm
 *
 * Combines BM25 (keyword precision) + semantic similarity (meaning recall)
 * with configurable weights for optimal search results.
 */

import type {
  HybridSearchOptions,
  SearchableEntity,
  SearchResult,
  SemanticSearchResult,
} from './types';

/**
 * Default hybrid search options
 */
const DEFAULT_OPTIONS: Required<HybridSearchOptions> = {
  semanticWeight: 0.5,
  bm25Weight: 0.5,
  minSimilarity: 0.3,
  limit: 10,
};

/**
 * Perform hybrid search combining BM25 + semantic similarity
 *
 * Merges results from two search strategies:
 * 1. BM25 (keyword-based): Fast, precise for exact matches
 * 2. Semantic (embedding-based): Understands meaning and context
 *
 * Algorithm:
 * 1. Normalize BM25 scores to 0-1 range
 * 2. Semantic scores already 0-1 (cosine similarity)
 * 3. Combine with weighted average: score = (bm25 * w1) + (semantic * w2)
 * 4. Sort by combined score descending
 * 5. Return top N results
 *
 * @param query - Search query (not used directly, but helpful for debugging)
 * @param bm25Results - Results from BM25 text search
 * @param semanticResults - Results from semantic embedding search
 * @param options - Hybrid search configuration
 * @returns Combined and re-ranked search results
 *
 * @example
 * ```typescript
 * const bm25Results = [
 *   { entity: { id: 1, title: 'JWT auth' }, relevance: 80 },
 *   { entity: { id: 2, title: 'Session tokens' }, relevance: 60 },
 * ];
 *
 * const semanticResults = [
 *   { entityId: 1, similarity: 0.9 },
 *   { entityId: 3, similarity: 0.7 },
 * ];
 *
 * const results = hybridSearch('authentication', bm25Results, semanticResults, {
 *   semanticWeight: 0.6,
 *   bm25Weight: 0.4,
 *   limit: 5,
 * });
 * // Returns: id=1 (high in both), id=2 (high BM25), id=3 (high semantic)
 * ```
 */
export function hybridSearch<TEntity extends SearchableEntity>(
  _query: string,
  bm25Results: SearchResult<TEntity>[],
  semanticResults: SemanticSearchResult[],
  options: HybridSearchOptions = {},
): SearchResult<TEntity>[] {
  const { semanticWeight, bm25Weight, minSimilarity, limit } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // If no semantic results, return BM25 only
  if (semanticResults.length === 0) {
    return bm25Results.slice(0, limit);
  }

  // Build score map: entityId -> { entity, bm25Score, semanticScore }
  const scoreMap = new Map<number | string, { entity: TEntity; bm25: number; semantic: number }>();

  // Normalize BM25 scores to 0-1 range
  const maxBm25 = Math.max(...bm25Results.map((r) => r.relevance), 1);

  for (const result of bm25Results) {
    scoreMap.set(result.entity.id, {
      entity: result.entity,
      bm25: result.relevance / maxBm25,
      semantic: 0,
    });
  }

  // Add semantic scores
  for (const result of semanticResults) {
    // Skip if below similarity threshold
    if (result.similarity < minSimilarity) continue;

    const existing = scoreMap.get(result.entityId);
    if (existing) {
      // Entity found in both BM25 and semantic results
      existing.semantic = result.similarity;
    } else {
      // Semantic-only result - need to find entity from BM25 results
      const entityFromBm25 = bm25Results.find((r) => r.entity.id === result.entityId);
      if (entityFromBm25) {
        scoreMap.set(result.entityId, {
          entity: entityFromBm25.entity,
          bm25: 0,
          semantic: result.similarity,
        });
      }
    }
  }

  // Calculate combined scores and sort
  const combined = Array.from(scoreMap.values())
    .map((item) => ({
      entity: item.entity,
      relevance: (item.bm25 * bm25Weight + item.semantic * semanticWeight) * 100,
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return combined;
}

/**
 * Calculate weighted score for a single entity
 *
 * Helper function for custom scoring strategies.
 *
 * @param bm25Score - BM25 relevance (0-1, normalized)
 * @param semanticScore - Semantic similarity (0-1)
 * @param bm25Weight - Weight for BM25 (default 0.5)
 * @param semanticWeight - Weight for semantic (default 0.5)
 * @returns Combined score (0-100)
 *
 * @example
 * ```typescript
 * const score = calculateWeightedScore(0.8, 0.6, 0.7, 0.3);
 * // Returns: (0.8 * 0.7 + 0.6 * 0.3) * 100 = 74
 * ```
 */
export function calculateWeightedScore(
  bm25Score: number,
  semanticScore: number,
  bm25Weight = 0.5,
  semanticWeight = 0.5,
): number {
  return (bm25Score * bm25Weight + semanticScore * semanticWeight) * 100;
}

/**
 * Normalize scores to 0-1 range
 *
 * Helper function for score normalization.
 *
 * @param scores - Array of scores to normalize
 * @returns Array of normalized scores (0-1)
 *
 * @example
 * ```typescript
 * const scores = [10, 20, 30, 40];
 * const normalized = normalizeScores(scores);
 * // Returns: [0.25, 0.5, 0.75, 1.0]
 * ```
 */
export function normalizeScores(scores: number[]): number[] {
  const max = Math.max(...scores, 1);
  return scores.map((s) => s / max);
}
