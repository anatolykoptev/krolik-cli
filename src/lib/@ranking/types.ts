/**
 * @module lib/@ranking/types
 * @description Type definitions for PageRank-based ranking algorithms
 *
 * Provides reusable types for graph-based ranking operations across the codebase.
 * These types are decoupled from specific use cases (like RepoMap) to enable
 * broader reuse.
 */

// ============================================================================
// CORE GRAPH TYPES
// ============================================================================

/**
 * Weighted directed edge in a graph
 *
 * Represents a connection from one node to another with an associated weight.
 *
 * @example
 * ```ts
 * const edge: WeightedEdge = {
 *   source: 'src/auth.ts',
 *   target: 'src/utils.ts',
 *   weight: 2.5,
 * };
 * ```
 */
export interface WeightedEdge {
  /** Source node identifier */
  source: string;
  /** Target node identifier */
  target: string;
  /** Edge weight (positive number) */
  weight: number;
}

/**
 * Adjacency list representation of a weighted directed graph
 *
 * Outer map: source node -> inner map
 * Inner map: target node -> edge weight
 *
 * @example
 * ```ts
 * const adjacency: AdjacencyList = new Map([
 *   ['a', new Map([['b', 0.5], ['c', 0.3]])],
 *   ['b', new Map([['c', 0.8]])],
 * ]);
 * ```
 */
export type AdjacencyList = Map<string, Map<string, number>>;

// ============================================================================
// PAGERANK CONFIGURATION
// ============================================================================

/**
 * Configuration options for PageRank computation
 *
 * All parameters are optional with sensible defaults based on the original
 * Google PageRank paper.
 *
 * @example
 * ```ts
 * const options: PageRankOptions = {
 *   damping: 0.85,           // Standard damping factor
 *   iterations: 100,         // Max iterations
 *   tolerance: 1e-6,         // Convergence threshold
 *   personalization: myMap,  // Bias towards specific nodes
 * };
 * ```
 */
export interface PageRankOptions {
  /**
   * Damping factor (probability of following a link vs random jump)
   *
   * Higher values (closer to 1) give more weight to link structure.
   * Lower values give more weight to uniform/personalized distribution.
   *
   * @default 0.85
   */
  damping?: number;

  /**
   * Maximum number of power iterations
   *
   * Algorithm may terminate earlier if convergence is reached.
   *
   * @default 100
   */
  iterations?: number;

  /**
   * Convergence tolerance threshold
   *
   * Algorithm stops when score changes fall below this value.
   * Lower values produce more accurate results but take longer.
   *
   * @default 1e-6
   */
  tolerance?: number;

  /**
   * Personalization vector to bias ranking towards specific nodes
   *
   * Maps node identifiers to boost weights (higher = more important).
   * Used for topic-sensitive or feature-focused ranking.
   *
   * @example
   * ```ts
   * const personalization = new Map([
   *   ['src/booking.ts', 5.0],    // Strong boost
   *   ['src/calendar.ts', 2.0],   // Moderate boost
   * ]);
   * ```
   */
  personalization?: Map<string, number>;
}

/**
 * Internal state maintained during PageRank iteration
 *
 * Used by the algorithm to track computation progress.
 */
export interface PageRankState {
  /** All node identifiers in the graph */
  nodes: string[];
  /** Number of nodes (cached for performance) */
  n: number;
  /** Current score for each node */
  scores: Map<string, number>;
  /** Teleportation/personalization vector (normalized) */
  teleportVector: Map<string, number>;
  /** Normalized adjacency list */
  adjacency: AdjacencyList;
  /** Damping factor */
  damping: number;
  /** Convergence tolerance */
  tolerance: number;
}

// ============================================================================
// SYMBOL WEIGHT TYPES
// ============================================================================

/**
 * Context for calculating symbol importance weight
 *
 * Provides metadata about a symbol to determine its ranking significance.
 *
 * @example
 * ```ts
 * const context: SymbolWeightContext = {
 *   definitionCount: 1,      // Unique symbol
 *   matchesFeature: true,    // Relevant to current feature
 *   matchesDomain: false,
 * };
 * ```
 */
export interface SymbolWeightContext {
  /**
   * Number of files that define this symbol
   *
   * Symbols defined in many places are typically generic
   * (e.g., `id`, `name`, `value`) and get reduced weight.
   */
  definitionCount: number;

  /**
   * Whether the symbol matches the target feature/domain
   *
   * Symbols directly related to the focus area get boosted.
   */
  matchesFeature: boolean;

  /**
   * Whether the symbol matches a related domain
   *
   * Symbols in adjacent domains get a smaller boost than direct matches.
   */
  matchesDomain: boolean;
}

/**
 * Result of feature/domain matching for a symbol
 */
export interface FeatureDomainMatch {
  /** Symbol directly matches the target feature */
  matchesFeature: boolean;
  /** Symbol matches a related domain */
  matchesDomain: boolean;
}

// ============================================================================
// RANKING RESULT TYPES
// ============================================================================

/**
 * A ranked item with score and metadata
 *
 * Generic structure for ranked results that can be extended
 * for specific use cases.
 *
 * @example
 * ```ts
 * const result: RankedItem = {
 *   id: 'src/auth/login.ts',
 *   score: 0.0234,
 *   metadata: { defCount: 15, refCount: 42 },
 * };
 * ```
 */
export interface RankedItem<T = Record<string, unknown>> {
  /** Unique identifier for the ranked item */
  id: string;
  /** Computed PageRank score (higher = more important) */
  score: number;
  /** Additional metadata associated with the item */
  metadata?: T;
}

/**
 * Statistics about a PageRank computation
 */
export interface PageRankStats {
  /** Number of nodes in the graph */
  nodeCount: number;
  /** Number of edges in the graph */
  edgeCount: number;
  /** Actual iterations performed (may be less than max due to convergence) */
  iterationsPerformed: number;
  /** Whether algorithm converged before max iterations */
  converged: boolean;
  /** Final convergence delta (difference from last iteration) */
  finalDelta: number;
  /** Computation time in milliseconds */
  durationMs: number;
}
