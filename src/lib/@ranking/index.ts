/**
 * @module lib/@ranking
 * @description PageRank-based ranking algorithms for code analysis
 *
 * Provides reusable graph ranking algorithms originally developed for
 * Smart Context / RepoMap but applicable to any graph-based ranking scenario.
 *
 * ## Core Features
 *
 * - **PageRank Algorithm**: Pure implementation with damping, iterations,
 *   personalization, and convergence detection
 * - **Symbol Weights**: Context-aware weight calculation for code symbols
 * - **Graph Utilities**: Adjacency list construction and normalization
 *
 * ## Usage Examples
 *
 * ### Basic PageRank
 *
 * ```ts
 * import { pageRank, normalizeWeights, buildAdjacencyMatrix } from '@/lib/@ranking';
 *
 * // Build graph from edges
 * const adjacency = buildAdjacencyMatrix(
 *   ['a', 'b', 'c'],
 *   [
 *     { source: 'a', target: 'b', weight: 1 },
 *     { source: 'b', target: 'c', weight: 2 },
 *   ]
 * );
 *
 * // Normalize and compute
 * const normalized = normalizeWeights(adjacency);
 * const { scores, stats } = pageRank(normalized, { damping: 0.85 });
 * ```
 *
 * ### Personalized PageRank
 *
 * ```ts
 * const { scores } = pageRank(adjacency, {
 *   personalization: new Map([
 *     ['src/auth.ts', 5.0],     // Strong bias
 *     ['src/login.ts', 2.0],    // Moderate bias
 *   ]),
 * });
 * ```
 *
 * ### Symbol Weight Calculation
 *
 * ```ts
 * import { calculateSymbolWeight, matchesFeatureOrDomain } from '@/lib/@ranking';
 *
 * const match = matchesFeatureOrDomain('getUserBooking', 'booking', ['user']);
 * const weight = calculateSymbolWeight('getUserBooking', {
 *   definitionCount: 1,
 *   matchesFeature: match.matchesFeature,
 *   matchesDomain: match.matchesDomain,
 * });
 * ```
 *
 * @see PageRankOptions for configuration details
 * @see calculateSymbolWeight for weight heuristics
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Graph types
  AdjacencyList,
  // Weight types
  FeatureDomainMatch,
  // PageRank types
  PageRankOptions,
  PageRankState,
  PageRankStats,
  // Result types
  RankedItem,
  SymbolWeightContext,
  WeightedEdge,
} from './types.js';

// ============================================================================
// PAGERANK EXPORTS
// ============================================================================

export {
  // Graph utilities
  buildAdjacencyMatrix,
  countEdges,
  // Constants
  DEFAULT_DAMPING,
  DEFAULT_ITERATIONS,
  DEFAULT_TOLERANCE,
  // Result utilities
  getTopRanked,
  normalizeWeights,
  type PageRankResult,
  // Core algorithm
  pageRank,
} from './pagerank.js';

// ============================================================================
// WEIGHT EXPORTS
// ============================================================================

export {
  calculatePathBoost,
  // Core function
  calculateSymbolWeight,
  GENERIC_DEFINITION_THRESHOLD,
  MEANINGFUL_PATTERNS,
  MIN_MEANINGFUL_LENGTH,
  // Matching utilities
  matchesFeatureOrDomain,
  // Constants
  WEIGHT_MULTIPLIERS,
} from './weights.js';
