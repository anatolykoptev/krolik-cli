/**
 * @module commands/context/helpers/ranking
 * @description PageRank implementation for Smart Context symbol ranking
 *
 * Implements a custom PageRank algorithm to rank files by their importance
 * in the codebase based on symbol references. Files that define symbols
 * used by many other files rank higher.
 *
 * Based on the Aider RepoMap approach:
 * - Build adjacency graph from symbol references
 * - Apply iterative PageRank with damping factor
 * - Support personalization for feature/domain boosting
 *
 * @example
 * ```ts
 * import { getRankedFiles, pageRank } from '@/commands/context/helpers/ranking';
 *
 * const scores = pageRank(symbolGraph, { damping: 0.85, featureBoost: 'booking' });
 * const ranked = getRankedFiles(symbolGraph, { featureBoost: 'auth' });
 * ```
 */

import {
  detectNamingPattern,
  isHookName,
  isSchemaName,
  isServiceName,
  isUtilityName,
} from '@/lib/modules/signals';
import type { RankedFile, SymbolGraph } from '../repomap/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for PageRank algorithm
 */
export interface PageRankOptions {
  /** Damping factor (probability of following a link). Default: 0.85 */
  damping?: number;
  /** Maximum number of iterations. Default: 100 */
  iterations?: number;
  /** Convergence threshold. Default: 1e-6 */
  epsilon?: number;
  /** Personalization map: file -> boost factor */
  personalization?: Map<string, number>;
  /** Feature name to boost (files matching this pattern get higher rank) */
  featureBoost?: string;
  /** Weight multiplier for definitions vs references. Default: 1.0 */
  definitionWeight?: number;
}

/**
 * Internal adjacency structure for PageRank
 */
interface AdjacencyGraph {
  /** All nodes (file paths) */
  nodes: string[];
  /** Outgoing edges: node -> Set of nodes it references */
  outEdges: Map<string, Set<string>>;
  /** Incoming edges: node -> Set of nodes that reference it */
  inEdges: Map<string, Set<string>>;
  /** Edge weights: "from|to" -> weight */
  edgeWeights: Map<string, number>;
}

// ============================================================================
// SYMBOL WEIGHT CALCULATION
// ============================================================================

/**
 * Calculate weight for a symbol based on naming patterns and context
 *
 * Higher weights indicate more "meaningful" symbols that should
 * contribute more to the ranking.
 *
 * @param symbolName - The symbol name to analyze
 * @param definitionCount - How many files define this symbol
 * @param matchesFeature - Whether symbol matches the target feature
 * @returns Weight multiplier (higher = more important)
 */
export function calculateSymbolWeight(
  symbolName: string,
  definitionCount: number,
  matchesFeature: boolean,
): number {
  let weight = 1.0;

  // Analyze naming pattern
  const pattern = detectNamingPattern(symbolName);

  // Meaningful names (camelCase/PascalCase with 8+ chars) are more specific
  if (pattern !== null && symbolName.length >= 8) {
    weight *= 10;
  } else if (pattern !== null && symbolName.length >= 5) {
    weight *= 5;
  }

  // Private/internal symbols get lower weight
  if (symbolName.startsWith('_')) {
    weight *= 0.1;
  }

  // Generic symbols defined in many places are less meaningful
  // (e.g., 'id', 'name', 'value' defined everywhere)
  if (definitionCount > 10) {
    weight *= 0.05;
  } else if (definitionCount > 5) {
    weight *= 0.1;
  } else if (definitionCount > 3) {
    weight *= 0.5;
  }

  // Feature/domain boost for targeted context
  if (matchesFeature) {
    weight *= 10;
  }

  // Specific pattern bonuses - these indicate reusable/important code
  if (isHookName(symbolName)) {
    weight *= 5; // Hooks are typically important shared code
  }
  if (isUtilityName(symbolName)) {
    weight *= 3; // Utilities are commonly reused
  }
  if (isSchemaName(symbolName)) {
    weight *= 4; // Schemas define data contracts
  }
  if (isServiceName(symbolName)) {
    weight *= 3; // Services are core business logic
  }

  // Very short names are likely generic (e.g., 'x', 'fn', 'cb')
  if (symbolName.length <= 2) {
    weight *= 0.1;
  }

  return weight;
}

/**
 * Check if a symbol name matches a feature pattern
 */
function matchesFeature(symbolName: string, feature: string): boolean {
  const lowerSymbol = symbolName.toLowerCase();
  const lowerFeature = feature.toLowerCase();

  // Direct substring match
  if (lowerSymbol.includes(lowerFeature)) {
    return true;
  }

  // Handle common variations (e.g., 'booking' matches 'book', 'Booking', 'BOOKING')
  const featureRoot = lowerFeature.replace(/(s|ing|ed|er)$/, '');
  if (featureRoot.length >= 3 && lowerSymbol.includes(featureRoot)) {
    return true;
  }

  return false;
}

// ============================================================================
// GRAPH BUILDING
// ============================================================================

/**
 * Build adjacency graph from symbol graph
 *
 * Creates directed edges: file A -> file B when A references a symbol defined in B
 *
 * @param graph - Symbol graph with definitions and references
 * @param options - Options including feature boost
 * @returns Adjacency graph for PageRank
 */
function buildAdjacencyGraph(graph: SymbolGraph, options: PageRankOptions = {}): AdjacencyGraph {
  const { featureBoost } = options;

  const nodes = new Set<string>();
  const outEdges = new Map<string, Set<string>>();
  const inEdges = new Map<string, Set<string>>();
  const edgeWeights = new Map<string, number>();

  // Collect all files as nodes
  for (const [file] of graph.fileToTags) {
    nodes.add(file);
    outEdges.set(file, new Set());
    inEdges.set(file, new Set());
  }

  // Build edges from references to definitions
  for (const [symbolName, refFiles] of graph.references) {
    const defFiles = graph.definitions.get(symbolName);
    if (!defFiles || defFiles.length === 0) continue;

    // Calculate symbol weight
    const symbolMatchesFeature = featureBoost ? matchesFeature(symbolName, featureBoost) : false;
    const weight = calculateSymbolWeight(symbolName, defFiles.length, symbolMatchesFeature);

    // Create edges: each referencing file -> each defining file
    for (const refFile of refFiles) {
      for (const defFile of defFiles) {
        // Skip self-references
        if (refFile === defFile) continue;

        // Ensure nodes exist
        if (!nodes.has(refFile)) {
          nodes.add(refFile);
          outEdges.set(refFile, new Set());
          inEdges.set(refFile, new Set());
        }
        if (!nodes.has(defFile)) {
          nodes.add(defFile);
          outEdges.set(defFile, new Set());
          inEdges.set(defFile, new Set());
        }

        // Add edge: refFile -> defFile (referencing file points to definition)
        outEdges.get(refFile)!.add(defFile);
        inEdges.get(defFile)!.add(refFile);

        // Accumulate edge weight
        const edgeKey = `${refFile}|${defFile}`;
        const currentWeight = edgeWeights.get(edgeKey) ?? 0;
        edgeWeights.set(edgeKey, currentWeight + weight);
      }
    }
  }

  return {
    nodes: Array.from(nodes),
    outEdges,
    inEdges,
    edgeWeights,
  };
}

// ============================================================================
// PAGERANK ALGORITHM
// ============================================================================

/**
 * Run PageRank algorithm on the symbol graph
 *
 * Computes importance scores for each file based on:
 * - How many files reference symbols defined in this file
 * - The importance of those referencing files (recursive)
 * - Symbol weight based on naming patterns
 * - Optional personalization for feature boosting
 *
 * @param graph - Symbol graph with definitions and references
 * @param options - PageRank options
 * @returns Map from file path to PageRank score
 *
 * @example
 * ```ts
 * const scores = pageRank(symbolGraph, {
 *   damping: 0.85,
 *   iterations: 100,
 *   featureBoost: 'booking'
 * });
 * const topFile = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
 * ```
 */
export function pageRank(graph: SymbolGraph, options: PageRankOptions = {}): Map<string, number> {
  const {
    damping = 0.85,
    iterations = 100,
    epsilon = 1e-6,
    personalization,
    featureBoost,
  } = options;

  // Build adjacency graph
  const adjGraph = buildAdjacencyGraph(graph, featureBoost ? { featureBoost } : {});
  const { nodes, inEdges, outEdges, edgeWeights } = adjGraph;
  const n = nodes.length;

  if (n === 0) {
    return new Map();
  }

  // Initialize scores uniformly or with personalization
  const scores = new Map<string, number>();
  const personalSum = personalization
    ? Array.from(personalization.values()).reduce((a, b) => a + b, 0)
    : 0;

  for (const node of nodes) {
    if (personalization && personalization.has(node)) {
      // Personalized initial score
      scores.set(node, personalization.get(node)! / (personalSum || 1));
    } else {
      // Uniform initial score
      scores.set(node, 1 / n);
    }
  }

  // Precompute out-degree weighted sums for each node
  const outWeightSum = new Map<string, number>();
  for (const node of nodes) {
    let sum = 0;
    const neighbors = outEdges.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      const edgeKey = `${node}|${neighbor}`;
      sum += edgeWeights.get(edgeKey) ?? 1;
    }
    outWeightSum.set(node, sum || 1); // Avoid division by zero
  }

  // Compute personalization vector for teleportation
  const personalizationVector = new Map<string, number>();
  if (personalization && personalization.size > 0) {
    for (const node of nodes) {
      const pVal = personalization.get(node) ?? 0;
      personalizationVector.set(node, pVal / (personalSum || 1));
    }
  } else {
    // Uniform teleportation
    for (const node of nodes) {
      personalizationVector.set(node, 1 / n);
    }
  }

  // Iterative PageRank with weighted edges
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<string, number>();
    let diff = 0;

    // Handle dangling nodes (nodes with no outgoing edges)
    let danglingSum = 0;
    for (const node of nodes) {
      const neighbors = outEdges.get(node);
      if (!neighbors || neighbors.size === 0) {
        danglingSum += scores.get(node) ?? 0;
      }
    }

    for (const node of nodes) {
      // Teleportation (random jump)
      let rank = (1 - damping) * (personalizationVector.get(node) ?? 1 / n);

      // Dangling node contribution (distributed uniformly or via personalization)
      rank += damping * danglingSum * (personalizationVector.get(node) ?? 1 / n);

      // Contribution from incoming edges (weighted)
      const inNeighbors = inEdges.get(node) ?? new Set();
      for (const inNode of inNeighbors) {
        const inScore = scores.get(inNode) ?? 0;
        const edgeKey = `${inNode}|${node}`;
        const edgeWeight = edgeWeights.get(edgeKey) ?? 1;
        const totalOutWeight = outWeightSum.get(inNode) ?? 1;

        // Weighted contribution
        rank += damping * inScore * (edgeWeight / totalOutWeight);
      }

      newScores.set(node, rank);
      diff += Math.abs(rank - (scores.get(node) ?? 0));
    }

    // Update scores
    for (const [node, rank] of newScores) {
      scores.set(node, rank);
    }

    // Check convergence
    if (diff < epsilon) {
      break;
    }
  }

  return scores;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get ranked files sorted by PageRank score
 *
 * Returns files ordered by importance with additional metadata
 * about definitions and references.
 *
 * @param graph - Symbol graph with definitions and references
 * @param options - PageRank options
 * @returns Array of ranked files, sorted by rank descending
 *
 * @example
 * ```ts
 * const ranked = getRankedFiles(symbolGraph, {
 *   featureBoost: 'auth',
 *   damping: 0.85
 * });
 *
 * // Top 10 most important files for auth feature
 * const top10 = ranked.slice(0, 10);
 * ```
 */
export function getRankedFiles(graph: SymbolGraph, options: PageRankOptions = {}): RankedFile[] {
  const scores = pageRank(graph, options);
  const result: RankedFile[] = [];

  for (const [path, rank] of scores) {
    // Count definitions in this file
    let defCount = 0;
    const tags = graph.fileToTags.get(path) ?? [];
    for (const tag of tags) {
      if (tag.kind === 'def') {
        defCount++;
      }
    }

    // Count references to symbols defined in this file
    let refCount = 0;
    for (const tag of tags) {
      if (tag.kind === 'def') {
        const refs = graph.references.get(tag.name);
        if (refs) {
          // Count references from other files
          for (const refFile of refs) {
            if (refFile !== path) {
              refCount++;
            }
          }
        }
      }
    }

    result.push({
      path,
      rank,
      defCount,
      refCount,
    });
  }

  // Sort by rank descending
  result.sort((a, b) => b.rank - a.rank);

  return result;
}

/**
 * Get top N files by PageRank score
 *
 * Convenience function for getting the most important files.
 *
 * @param graph - Symbol graph
 * @param n - Number of files to return
 * @param options - PageRank options
 * @returns Top N ranked files
 */
export function getTopFiles(
  graph: SymbolGraph,
  n: number,
  options: PageRankOptions = {},
): RankedFile[] {
  return getRankedFiles(graph, options).slice(0, n);
}

/**
 * Create personalization map from file patterns
 *
 * Helper to boost files matching certain patterns.
 *
 * @param files - All file paths
 * @param patterns - Patterns to boost (regex or string includes)
 * @param boostFactor - How much to boost matching files (default: 10)
 * @returns Personalization map for PageRank
 */
export function createPersonalization(
  files: string[],
  patterns: (string | RegExp)[],
  boostFactor = 10,
): Map<string, number> {
  const personalization = new Map<string, number>();

  for (const file of files) {
    let boost = 1;

    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (file.toLowerCase().includes(pattern.toLowerCase())) {
          boost = boostFactor;
          break;
        }
      } else if (pattern.test(file)) {
        boost = boostFactor;
        break;
      }
    }

    personalization.set(file, boost);
  }

  return personalization;
}
