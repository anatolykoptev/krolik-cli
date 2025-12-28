/**
 * @module lib/integrations/context7/registry/scoring
 * @description Library search result scoring algorithm
 *
 * Provides relevance scoring for Context7 search results.
 * Scoring weights are documented and configurable.
 */

import type { SearchResult } from '../client';

// ============================================================================
// SCORING CONFIGURATION
// ============================================================================

/**
 * Weights for library relevance scoring.
 * Total weight sums to approximately 1.0.
 */
export const SCORING_WEIGHTS = {
  /**
   * Weight for exact match in Context7 library ID.
   * Highest weight as ID match is most reliable.
   */
  ID_MATCH: 0.4,

  /**
   * Weight for exact match in library display title.
   * High weight as title usually matches npm name.
   */
  TITLE_MATCH: 0.3,

  /**
   * Weight for Context7 benchmark quality score.
   * Indicates documentation completeness and quality.
   */
  BENCHMARK_QUALITY: 0.15,

  /**
   * Weight for GitHub star popularity.
   * Popular libraries are more likely correct match.
   */
  STAR_POPULARITY: 0.1,

  /**
   * Weight for documentation coverage.
   * More snippets = better documentation.
   */
  DOC_COVERAGE: 0.05,
} as const;

/**
 * Minimum confidence score to accept API result.
 * Results below this threshold are rejected.
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Minimum stars to get popularity bonus.
 */
export const MIN_STARS_FOR_BONUS = 1000;

/**
 * Minimum snippets to get coverage bonus.
 */
export const MIN_SNIPPETS_FOR_BONUS = 100;

// ============================================================================
// SCORING FUNCTION
// ============================================================================

/**
 * Score a search result for relevance to a query.
 *
 * Scoring is based on:
 * 1. ID match (40%): Does the Context7 ID contain the query?
 * 2. Title match (30%): Does the title contain the query?
 * 3. Benchmark score (15%): Context7's quality score
 * 4. Star count (10%): GitHub popularity
 * 5. Doc coverage (5%): Number of code snippets
 *
 * @param result - Search result from Context7 API
 * @param query - Original search query (npm package name)
 * @returns Score from 0.0 to 1.0
 *
 * @example
 * ```ts
 * const score = scoreSearchResult(result, 'next');
 * if (score >= MIN_CONFIDENCE_THRESHOLD) {
 *   // Accept this result
 * }
 * ```
 */
export function scoreSearchResult(result: SearchResult, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const titleLower = result.title.toLowerCase();
  const idLower = result.id.toLowerCase();

  // ID match (highest weight - most reliable indicator)
  if (idLower.includes(queryLower)) {
    score += SCORING_WEIGHTS.ID_MATCH;
  }

  // Title match
  if (titleLower.includes(queryLower)) {
    score += SCORING_WEIGHTS.TITLE_MATCH;
  }

  // Benchmark quality (0-100 scale)
  if (result.benchmarkScore) {
    score += (result.benchmarkScore / 100) * SCORING_WEIGHTS.BENCHMARK_QUALITY;
  }

  // Star popularity
  if (result.stars && result.stars > MIN_STARS_FOR_BONUS) {
    score += SCORING_WEIGHTS.STAR_POPULARITY;
  }

  // Documentation coverage
  if (result.totalSnippets > MIN_SNIPPETS_FOR_BONUS) {
    score += SCORING_WEIGHTS.DOC_COVERAGE;
  }

  return Math.min(1, score);
}

/**
 * Select the best result from search results.
 *
 * @param results - Array of search results
 * @param query - Original search query
 * @returns Best result with score, or null if none pass threshold
 */
export function selectBestResult(
  results: SearchResult[],
  query: string,
): { result: SearchResult; score: number } | null {
  const scored = results
    .filter((r) => r.state === 'finalized')
    .map((r) => ({
      result: r,
      score: scoreSearchResult(r, query),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < MIN_CONFIDENCE_THRESHOLD) {
    return null;
  }

  return best;
}
