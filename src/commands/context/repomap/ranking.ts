/**
 * @module commands/context/repomap/ranking
 * @description PageRank-based file ranking for Smart Context
 *
 * Implements file ranking for the RepoMap system using the reusable
 * PageRank algorithm from @/lib/@ranking.
 *
 * Key features:
 * - Symbol graph to PageRank graph conversion
 * - Feature/domain personalization
 * - File statistics (definition/reference counts)
 *
 * @see @/lib/@ranking for the core PageRank implementation
 */

import {
  type AdjacencyList,
  calculatePathBoost,
  calculateSymbolWeight,
  pageRank as corePageRank,
  matchesFeatureOrDomain,
  normalizeWeights,
  type PageRankOptions,
} from '@/lib/@ranking';
import type { RankedFile, RepoMapOptions, SymbolGraph, Tag } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Boost multiplier for symbols that directly match feature/domain identifiers
 *
 * Applied on top of the base feature/domain matching when a symbol
 * is a strong identifier match (exact name or prominent position).
 */
const MENTIONED_IDENTIFIER_BOOST = 10;

// ============================================================================
// MENTIONED IDENTIFIERS DETECTION
// ============================================================================

/**
 * Check if a symbol is a strong match for mentioned identifiers
 *
 * Returns true if the symbol:
 * - Exactly equals the feature/domain name (case-insensitive)
 * - Starts with the feature/domain name (e.g., `BookingService` for feature `booking`)
 * - Ends with the feature/domain name (e.g., `createBooking` for feature `booking`)
 *
 * These are stronger matches than just "contains" and deserve additional boost.
 *
 * @param symbolName - Symbol name to check
 * @param feature - Feature name to match
 * @param domains - Domain names to match
 * @returns True if symbol is a strong identifier match
 */
function isMentionedIdentifier(symbolName: string, feature?: string, domains?: string[]): boolean {
  if (!feature && (!domains || domains.length === 0)) {
    return false;
  }

  const lowerSymbol = symbolName.toLowerCase();
  const identifiers = [
    ...(feature ? [feature.toLowerCase()] : []),
    ...(domains ?? []).map((d) => d.toLowerCase()),
  ];

  for (const identifier of identifiers) {
    // Exact match
    if (lowerSymbol === identifier) {
      return true;
    }

    // Starts with identifier (e.g., BookingService, booking_utils)
    if (lowerSymbol.startsWith(identifier)) {
      // Check for word boundary (next char is uppercase or underscore)
      const nextChar = symbolName[identifier.length];
      if (
        !nextChar ||
        nextChar === '_' ||
        nextChar === '-' ||
        nextChar === nextChar.toUpperCase()
      ) {
        return true;
      }
    }

    // Ends with identifier (e.g., createBooking, user_booking)
    if (lowerSymbol.endsWith(identifier)) {
      // Check for word boundary (prev char is lowercase with this uppercase, or underscore)
      const prevIndex = symbolName.length - identifier.length - 1;
      if (prevIndex < 0) {
        return true;
      }
      const prevChar = symbolName[prevIndex];
      if (
        prevChar &&
        (prevChar === '_' || prevChar === '-' || prevChar === prevChar.toLowerCase())
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate mentioned identifier boost for a symbol
 *
 * @param symbolName - Symbol name to check
 * @param feature - Feature name
 * @param domains - Domain names
 * @returns Boost multiplier (1.0 or MENTIONED_IDENTIFIER_BOOST)
 */
function getMentionedIdentifierBoost(
  symbolName: string,
  feature?: string,
  domains?: string[],
): number {
  if (isMentionedIdentifier(symbolName, feature, domains)) {
    return MENTIONED_IDENTIFIER_BOOST;
  }
  return 1.0;
}

// ============================================================================
// GRAPH BUILDING
// ============================================================================

/**
 * Build adjacency list from symbol graph with weighted edges
 *
 * Creates a directed graph where:
 * - Nodes are files
 * - Edges go from files that reference symbols to files that define them
 * - Edge weights are based on symbol importance
 *
 * @param graph - Symbol graph with definitions and references
 * @param options - Options for feature/domain matching
 * @returns Adjacency list with weighted edges
 */
function buildAdjacencyList(graph: SymbolGraph, options: RepoMapOptions): AdjacencyList {
  const adjacency: AdjacencyList = new Map();

  // Initialize all files as nodes
  for (const file of graph.fileToTags.keys()) {
    adjacency.set(file, new Map());
  }

  // For each symbol, create edges from referencing files to defining files
  for (const [symbolName, definingFiles] of graph.definitions) {
    addSymbolEdges(graph, adjacency, symbolName, definingFiles, options);
  }

  return adjacency;
}

/**
 * Add edges for a single symbol to the adjacency list
 */
function addSymbolEdges(
  graph: SymbolGraph,
  adjacency: AdjacencyList,
  symbolName: string,
  definingFiles: string[],
  options: RepoMapOptions,
): void {
  const referencingFiles = graph.references.get(symbolName) ?? [];

  // Calculate symbol weight using the reusable function
  const { matchesFeature, matchesDomain } = matchesFeatureOrDomain(
    symbolName,
    options.feature,
    options.domains,
  );

  let weight = calculateSymbolWeight(symbolName, {
    definitionCount: definingFiles.length,
    matchesFeature,
    matchesDomain,
  });

  // Apply additional boost for symbols that are strong identifier matches
  // (e.g., "BookingService" when feature is "booking")
  const mentionedBoost = getMentionedIdentifierBoost(symbolName, options.feature, options.domains);
  weight *= mentionedBoost;

  // Create edges from each referencing file to each defining file
  for (const refFile of referencingFiles) {
    for (const defFile of definingFiles) {
      // Skip self-references
      if (refFile === defFile) continue;

      const edges = adjacency.get(refFile) ?? new Map();
      const currentWeight = edges.get(defFile) ?? 0;
      edges.set(defFile, currentWeight + weight);
      adjacency.set(refFile, edges);
    }
  }
}

// ============================================================================
// FILE STATISTICS
// ============================================================================

/**
 * Count definitions and references for each file
 *
 * @param graph - Symbol graph
 * @returns Map of file path to counts
 */
function countFileStats(graph: SymbolGraph): Map<string, { defCount: number; refCount: number }> {
  const stats = new Map<string, { defCount: number; refCount: number }>();

  // Initialize
  for (const file of graph.fileToTags.keys()) {
    stats.set(file, { defCount: 0, refCount: 0 });
  }

  // Count definitions
  for (const files of graph.definitions.values()) {
    for (const file of files) {
      const s = stats.get(file);
      if (s) {
        s.defCount++;
      }
    }
  }

  // Count references (how many times symbols IN this file are referenced)
  for (const [symbolName, definingFiles] of graph.definitions) {
    const refCount = (graph.references.get(symbolName) ?? []).length;
    for (const file of definingFiles) {
      const s = stats.get(file);
      if (s) {
        s.refCount += refCount;
      }
    }
  }

  return stats;
}

// ============================================================================
// PERSONALIZATION
// ============================================================================

/**
 * Calculate boost for file tags based on feature/domain matching
 */
function calculateTagsBoost(tags: Tag[], feature?: string, domains?: string[]): number {
  /** Tag feature match boost multiplier */
  const TAG_FEATURE_BOOST = 2;
  /** Tag domain match boost multiplier */
  const TAG_DOMAIN_BOOST = 1.5;

  let boost = 1.0;

  for (const tag of tags) {
    const { matchesFeature, matchesDomain } = matchesFeatureOrDomain(tag.name, feature, domains);
    if (matchesFeature) {
      boost *= TAG_FEATURE_BOOST;
      break;
    }
    if (matchesDomain) {
      boost *= TAG_DOMAIN_BOOST;
    }
  }

  return boost;
}

/**
 * Build personalization vector based on feature matching
 *
 * @param graph - Symbol graph
 * @param feature - Feature to match
 * @param domains - Additional domains to match
 * @returns Personalization map for PageRank
 */
function buildPersonalization(
  graph: SymbolGraph,
  feature?: string,
  domains?: string[],
): Map<string, number> {
  if (!feature && (!domains || domains.length === 0)) {
    return new Map();
  }

  const personalization = new Map<string, number>();

  for (const [file, tags] of graph.fileToTags) {
    const pathBoost = calculatePathBoost(file, feature, domains);
    const tagsBoost = calculateTagsBoost(tags, feature, domains);
    const totalBoost = pathBoost * tagsBoost;

    if (totalBoost > 1) {
      personalization.set(file, totalBoost);
    }
  }

  return personalization;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Compute PageRank scores for a symbol graph
 *
 * Adapter function that converts a SymbolGraph to the format expected
 * by the core PageRank algorithm.
 *
 * @param graph - Symbol graph to analyze
 * @param options - PageRank and feature/domain options
 * @returns Map of file paths to PageRank scores
 *
 * @example
 * ```ts
 * const scores = pageRank(graph, {
 *   damping: 0.85,
 *   iterations: 100,
 *   feature: 'booking',
 *   domains: ['calendar'],
 * });
 * ```
 */
export function pageRank(
  graph: SymbolGraph,
  options: PageRankOptions & Pick<RepoMapOptions, 'feature' | 'domains'> = {},
): Map<string, number> {
  // Build personalization from feature/domains if not provided
  const personalization =
    options.personalization ?? buildPersonalization(graph, options.feature, options.domains);

  // Build and normalize adjacency list
  const adjacency = normalizeWeights(buildAdjacencyList(graph, options));

  // Compute PageRank using core algorithm
  const pageRankOpts: PageRankOptions = { personalization };
  if (options.damping !== undefined) pageRankOpts.damping = options.damping;
  if (options.iterations !== undefined) pageRankOpts.iterations = options.iterations;
  if (options.tolerance !== undefined) pageRankOpts.tolerance = options.tolerance;

  const result = corePageRank(adjacency, pageRankOpts);

  return result.scores;
}

/**
 * Rank files by importance using PageRank algorithm
 *
 * Main entry point for file ranking. Combines PageRank scores
 * with file statistics to produce ranked results.
 *
 * @param graph - Symbol graph with definitions and references
 * @param options - Ranking options including feature/domain filters
 * @returns Array of ranked files sorted by importance (descending)
 *
 * @example
 * ```ts
 * const rankedFiles = rankFiles(graph, {
 *   feature: 'booking',
 *   domains: ['calendar', 'schedule'],
 *   damping: 0.85,
 *   iterations: 100,
 * });
 *
 * // Use top 10 most important files for context
 * const topFiles = rankedFiles.slice(0, 10);
 * ```
 */
export function rankFiles(graph: SymbolGraph, options: RepoMapOptions = {}): RankedFile[] {
  // Build PageRank options
  const pageRankOptions: PageRankOptions & Pick<RepoMapOptions, 'feature' | 'domains'> = {};

  if (options.damping !== undefined) {
    pageRankOptions.damping = options.damping;
  }
  if (options.iterations !== undefined) {
    pageRankOptions.iterations = options.iterations;
  }
  if (options.feature !== undefined) {
    pageRankOptions.feature = options.feature;
  }
  if (options.domains !== undefined) {
    pageRankOptions.domains = options.domains;
  }

  // Compute PageRank scores
  const scores = pageRank(graph, pageRankOptions);

  // Get file statistics
  const stats = countFileStats(graph);

  // Build ranked file list
  const rankedFiles: RankedFile[] = [];

  for (const [path, rank] of scores) {
    const { defCount, refCount } = stats.get(path) ?? { defCount: 0, refCount: 0 };
    rankedFiles.push({
      path,
      rank,
      defCount,
      refCount,
    });
  }

  // Sort by rank descending
  rankedFiles.sort((a, b) => b.rank - a.rank);

  return rankedFiles;
}
