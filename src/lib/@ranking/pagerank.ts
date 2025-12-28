/**
 * @module lib/@ranking/pagerank
 * @description Pure PageRank algorithm implementation
 *
 * Provides a reusable, dependency-free PageRank implementation with:
 * - Standard power iteration method
 * - Configurable damping factor
 * - Personalization vector support (topic-sensitive PageRank)
 * - Convergence detection for early termination
 * - Dangling node handling
 *
 * Based on the original Google PageRank algorithm with enhancements
 * for code repository ranking.
 *
 * @see https://en.wikipedia.org/wiki/PageRank
 *
 * @example
 * ```ts
 * import { pageRank, buildAdjacencyMatrix, normalizeWeights } from '@/lib/@ranking';
 *
 * // Build graph
 * const adjacency = new Map([
 *   ['a', new Map([['b', 1], ['c', 2]])],
 *   ['b', new Map([['c', 1]])],
 *   ['c', new Map()],
 * ]);
 *
 * // Compute PageRank
 * const { scores, stats } = pageRank(adjacency, {
 *   damping: 0.85,
 *   iterations: 100,
 * });
 *
 * console.log(scores.get('c')); // Highest score (most linked)
 * ```
 */

import type { AdjacencyList, PageRankOptions, PageRankState, PageRankStats } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default damping factor (standard PageRank value)
 *
 * Represents probability of following a link vs making a random jump.
 * Value of 0.85 is the original Google recommendation.
 */
export const DEFAULT_DAMPING = 0.85;

/**
 * Default maximum number of power iterations
 *
 * 100 iterations is typically sufficient for convergence on most graphs.
 */
export const DEFAULT_ITERATIONS = 100;

/**
 * Default convergence tolerance
 *
 * Algorithm stops when sum of score changes falls below this value.
 * 1e-6 provides high precision without excessive computation.
 */
export const DEFAULT_TOLERANCE = 1e-6;

// ============================================================================
// GRAPH UTILITIES
// ============================================================================

/**
 * Build an adjacency list from a list of weighted edges
 *
 * Converts edge list format to adjacency list for efficient iteration.
 * Accumulates weights for duplicate edges between the same nodes.
 *
 * @param nodes - All node identifiers to include in the graph
 * @param edges - Weighted edges defining the graph structure
 * @returns Adjacency list representation
 *
 * @example
 * ```ts
 * const adjacency = buildAdjacencyMatrix(
 *   ['a', 'b', 'c'],
 *   [
 *     { source: 'a', target: 'b', weight: 1 },
 *     { source: 'b', target: 'c', weight: 2 },
 *   ]
 * );
 * ```
 */
export function buildAdjacencyMatrix(
  nodes: string[],
  edges: Array<{ source: string; target: string; weight: number }>,
): AdjacencyList {
  const adjacency: AdjacencyList = new Map();

  // Initialize all nodes
  for (const node of nodes) {
    adjacency.set(node, new Map());
  }

  // Add edges
  for (const { source, target, weight } of edges) {
    const sourceEdges = adjacency.get(source);
    if (sourceEdges) {
      const currentWeight = sourceEdges.get(target) ?? 0;
      sourceEdges.set(target, currentWeight + weight);
    }
  }

  return adjacency;
}

/**
 * Normalize edge weights so outgoing edges from each node sum to 1
 *
 * This is required for PageRank to interpret edges as transition probabilities.
 * Nodes with no outgoing edges (dangling nodes) get empty edge maps.
 *
 * @param adjacency - Adjacency list with raw weights
 * @returns New adjacency list with normalized weights
 *
 * @example
 * ```ts
 * const raw = new Map([
 *   ['a', new Map([['b', 2], ['c', 3]])],  // Sum: 5
 * ]);
 *
 * const normalized = normalizeWeights(raw);
 * // a -> b: 0.4, a -> c: 0.6
 * ```
 */
export function normalizeWeights(adjacency: AdjacencyList): AdjacencyList {
  const normalized: AdjacencyList = new Map();

  for (const [node, edges] of adjacency) {
    const totalWeight = Array.from(edges.values()).reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
      normalized.set(node, new Map());
      continue;
    }

    const normalizedEdges = new Map<string, number>();
    for (const [target, weight] of edges) {
      normalizedEdges.set(target, weight / totalWeight);
    }
    normalized.set(node, normalizedEdges);
  }

  return normalized;
}

/**
 * Count total number of edges in an adjacency list
 *
 * @param adjacency - Graph adjacency list
 * @returns Number of edges
 */
export function countEdges(adjacency: AdjacencyList): number {
  let count = 0;
  for (const edges of adjacency.values()) {
    count += edges.size;
  }
  return count;
}

// ============================================================================
// PAGERANK HELPERS
// ============================================================================

/**
 * Build teleportation vector from personalization map
 *
 * The teleportation vector determines where random jumps land.
 * Without personalization, jumps are uniform across all nodes.
 * With personalization, jumps favor specified nodes proportionally.
 *
 * @param nodes - All node identifiers
 * @param personalization - Optional bias weights for nodes
 * @returns Normalized teleportation probability for each node
 */
function buildTeleportVector(
  nodes: string[],
  personalization: Map<string, number>,
): Map<string, number> {
  const n = nodes.length;
  const teleportVector = new Map<string, number>();

  if (personalization.size > 0) {
    const totalPersonalization = Array.from(personalization.values()).reduce((s, v) => s + v, 0);
    for (const node of nodes) {
      const personalValue = personalization.get(node) ?? 0;
      teleportVector.set(node, personalValue / totalPersonalization || 1 / n);
    }
  } else {
    // Uniform teleportation
    for (const node of nodes) {
      teleportVector.set(node, 1 / n);
    }
  }

  return teleportVector;
}

/**
 * Calculate sum of scores from dangling nodes (nodes with no outgoing edges)
 *
 * Dangling nodes would otherwise "absorb" PageRank without distributing it.
 * Their score is redistributed according to the teleportation vector.
 *
 * @param nodes - All node identifiers
 * @param adjacency - Graph adjacency list
 * @param scores - Current PageRank scores
 * @returns Sum of scores from dangling nodes
 */
function calculateDanglingSum(
  nodes: string[],
  adjacency: AdjacencyList,
  scores: Map<string, number>,
): number {
  let danglingSum = 0;
  for (const node of nodes) {
    const edges = adjacency.get(node);
    if (!edges || edges.size === 0) {
      danglingSum += scores.get(node) ?? 0;
    }
  }
  return danglingSum;
}

/**
 * Calculate new PageRank score for a single node
 *
 * Score components:
 * 1. Teleportation: (1-d) * teleport_prob
 * 2. Dangling redistribution: d * dangling_sum * teleport_prob
 * 3. Incoming links: d * sum(source_score * edge_weight)
 *
 * @param node - Node to calculate score for
 * @param state - Current PageRank computation state
 * @param danglingSum - Pre-computed sum of dangling node scores
 * @returns New score for the node
 */
function calculateNodeScore(node: string, state: PageRankState, danglingSum: number): number {
  const { damping, teleportVector, adjacency, scores, n } = state;

  // Start with teleportation probability
  let score = (1 - damping) * (teleportVector.get(node) ?? 1 / n);

  // Add dangling node contribution (distributed according to teleport vector)
  score += damping * danglingSum * (teleportVector.get(node) ?? 1 / n);

  // Add contributions from incoming edges
  for (const [sourceNode, edges] of adjacency) {
    const weight = edges.get(node);
    if (weight !== undefined) {
      score += damping * (scores.get(sourceNode) ?? 0) * weight;
    }
  }

  return score;
}

/**
 * Perform one iteration of PageRank power method
 *
 * Updates all node scores simultaneously (parallel update).
 *
 * @param state - Current computation state
 * @returns New scores and convergence delta
 */
function pageRankIteration(state: PageRankState): { newScores: Map<string, number>; diff: number } {
  const newScores = new Map<string, number>();
  let diff = 0;

  const danglingSum = calculateDanglingSum(state.nodes, state.adjacency, state.scores);

  for (const node of state.nodes) {
    const score = calculateNodeScore(node, state, danglingSum);
    newScores.set(node, score);
    diff += Math.abs(score - (state.scores.get(node) ?? 0));
  }

  return { newScores, diff };
}

// ============================================================================
// MAIN PAGERANK FUNCTION
// ============================================================================

/**
 * Result of PageRank computation
 */
export interface PageRankResult {
  /** PageRank scores for each node (higher = more important) */
  scores: Map<string, number>;
  /** Computation statistics */
  stats: PageRankStats;
}

/**
 * Compute PageRank scores for a graph
 *
 * Implements the standard PageRank algorithm with power iteration:
 * 1. Initialize all nodes with equal scores (1/n)
 * 2. Iteratively update scores based on incoming links
 * 3. Apply damping factor for random jumps
 * 4. Continue until convergence or max iterations
 *
 * Supports personalized PageRank via the personalization option,
 * which biases random jumps towards specified nodes.
 *
 * @param adjacency - Normalized adjacency list (use normalizeWeights first)
 * @param options - PageRank configuration
 * @returns Map of node identifiers to PageRank scores
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = pageRank(adjacency, {
 *   damping: 0.85,
 *   iterations: 100,
 * });
 * console.log(result.scores.get('important-file.ts'));
 *
 * // Personalized PageRank (topic-sensitive)
 * const result = pageRank(adjacency, {
 *   personalization: new Map([
 *     ['src/auth.ts', 5.0],    // Boost auth-related files
 *     ['src/login.ts', 3.0],
 *   ]),
 * });
 * ```
 */
export function pageRank(adjacency: AdjacencyList, options: PageRankOptions = {}): PageRankResult {
  const startTime = Date.now();
  const damping = options.damping ?? DEFAULT_DAMPING;
  const maxIterations = options.iterations ?? DEFAULT_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const personalization = options.personalization ?? new Map<string, number>();

  const nodes = Array.from(adjacency.keys());
  const n = nodes.length;

  // Handle empty graph
  if (n === 0) {
    return {
      scores: new Map(),
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        iterationsPerformed: 0,
        converged: true,
        finalDelta: 0,
        durationMs: Date.now() - startTime,
      },
    };
  }

  // Initialize scores uniformly
  const initialScore = 1 / n;
  let scores = new Map<string, number>();
  for (const node of nodes) {
    scores.set(node, initialScore);
  }

  // Build teleportation vector
  const teleportVector = buildTeleportVector(nodes, personalization);

  // Create state object
  const state: PageRankState = {
    nodes,
    n,
    scores,
    teleportVector,
    adjacency,
    damping,
    tolerance,
  };

  // Power iteration
  let converged = false;
  let finalDelta = 0;
  let iterationsPerformed = 0;

  for (let i = 0; i < maxIterations; i++) {
    const { newScores, diff } = pageRankIteration(state);
    state.scores = newScores;
    scores = newScores;
    finalDelta = diff;
    iterationsPerformed = i + 1;

    // Check convergence
    if (diff < tolerance) {
      converged = true;
      break;
    }
  }

  return {
    scores,
    stats: {
      nodeCount: n,
      edgeCount: countEdges(adjacency),
      iterationsPerformed,
      converged,
      finalDelta,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Get top-ranked nodes from PageRank results
 *
 * Utility function to extract the most important nodes.
 *
 * @param scores - PageRank scores from computation
 * @param limit - Maximum number of nodes to return
 * @returns Array of [nodeId, score] pairs, sorted by score descending
 *
 * @example
 * ```ts
 * const result = pageRank(adjacency, options);
 * const top10 = getTopRanked(result.scores, 10);
 * // [['important.ts', 0.15], ['utils.ts', 0.12], ...]
 * ```
 */
export function getTopRanked(scores: Map<string, number>, limit: number): Array<[string, number]> {
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
