/**
 * @module commands/refactor/analyzers/ranking/hotspots
 * @description Dependency hotspot detection using PageRank
 *
 * Identifies highly central modules that affect many others.
 * Uses PageRank to find "hub" files that should be refactored carefully.
 */

import {
  type AdjacencyList,
  buildAdjacencyMatrix,
  normalizeWeights,
  type PageRankResult,
  pageRank,
} from '../../../../lib/@ranking/index.js';
import type { CouplingMetrics, DependencyHotspot, RankingStats } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Top N hotspots to report */
export const DEFAULT_HOTSPOT_COUNT = 10;

/** Percentile threshold for "critical" risk */
const CRITICAL_PERCENTILE = 95;

/** Percentile threshold for "high" risk */
const HIGH_PERCENTILE = 80;

/** Percentile threshold for "medium" risk */
const MEDIUM_PERCENTILE = 50;

// ============================================================================
// GRAPH BUILDING
// ============================================================================

/**
 * Convert dependency graph to adjacency list for PageRank
 *
 * @param dependencyGraph - Record<module, dependencies[]>
 * @returns AdjacencyList for PageRank algorithm
 */
export function buildDependencyAdjacency(dependencyGraph: Record<string, string[]>): {
  adjacency: AdjacencyList;
  nodeCount: number;
  edgeCount: number;
} {
  const nodes = Object.keys(dependencyGraph);
  const edges: Array<{ source: string; target: string; weight: number }> = [];

  // Build edges from dependencies
  // Note: For change impact, we reverse the direction
  // If A depends on B, changes in B affect A (B → A in PageRank)
  for (const [module, deps] of Object.entries(dependencyGraph)) {
    for (const dep of deps) {
      // Reverse direction for change propagation
      edges.push({
        source: dep,
        target: module,
        weight: 1,
      });
    }
  }

  const adjacency = buildAdjacencyMatrix(nodes, edges);
  const normalized = normalizeWeights(adjacency);

  return {
    adjacency: normalized,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

// ============================================================================
// COUPLING CALCULATION
// ============================================================================

/**
 * Calculate coupling metrics for all modules
 *
 * @param dependencyGraph - Record<module, dependencies[]>
 * @param pageRankScores - PageRank scores for each module
 */
export function calculateCouplingMetrics(
  dependencyGraph: Record<string, string[]>,
  pageRankScores: Map<string, number>,
): CouplingMetrics[] {
  const result: CouplingMetrics[] = [];

  // Build reverse graph (dependents)
  const dependents: Record<string, string[]> = {};
  for (const module of Object.keys(dependencyGraph)) {
    dependents[module] = [];
  }

  for (const [module, deps] of Object.entries(dependencyGraph)) {
    for (const dep of deps) {
      if (!dependents[dep]) {
        dependents[dep] = [];
      }
      dependents[dep].push(module);
    }
  }

  // Calculate metrics for each module
  for (const [module, deps] of Object.entries(dependencyGraph)) {
    const Ca = dependents[module]?.length ?? 0; // Afferent coupling
    const Ce = deps.length; // Efferent coupling
    const total = Ca + Ce;
    const instability = total > 0 ? Ce / total : 0;
    const pageRank = pageRankScores.get(module) ?? 0;
    const riskScore = pageRank * Ca * 100; // Scale for readability

    result.push({
      path: module,
      afferentCoupling: Ca,
      efferentCoupling: Ce,
      instability: Math.round(instability * 100) / 100,
      riskScore: Math.round(riskScore * 100) / 100,
    });
  }

  return result.sort((a, b) => b.riskScore - a.riskScore);
}

// ============================================================================
// HOTSPOT DETECTION
// ============================================================================

/**
 * Determine risk level based on percentile
 */
function getRiskLevel(percentile: number): DependencyHotspot['riskLevel'] {
  if (percentile >= CRITICAL_PERCENTILE) return 'critical';
  if (percentile >= HIGH_PERCENTILE) return 'high';
  if (percentile >= MEDIUM_PERCENTILE) return 'medium';
  return 'low';
}

/**
 * Calculate percentile for a value in a distribution
 */
function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;
  return Math.round((rank / sorted.length) * 100);
}

/**
 * Generate reason for hotspot
 */
function getHotspotReason(hotspot: Omit<DependencyHotspot, 'reason'>): string {
  const parts: string[] = [];

  if (hotspot.percentile >= CRITICAL_PERCENTILE) {
    parts.push(`Top ${100 - hotspot.percentile}% by PageRank`);
  }

  if (hotspot.dependentCount > 5) {
    parts.push(`${hotspot.dependentCount} dependents`);
  }

  if (hotspot.coupling.instability < 0.3) {
    parts.push('stable core module');
  }

  if (parts.length === 0) {
    parts.push('central in dependency graph');
  }

  return parts.join(', ');
}

/**
 * Detect dependency hotspots using PageRank
 *
 * @param dependencyGraph - Record<module, dependencies[]>
 * @param count - Number of hotspots to return
 */
export function detectHotspots(
  dependencyGraph: Record<string, string[]>,
  count: number = DEFAULT_HOTSPOT_COUNT,
): {
  hotspots: DependencyHotspot[];
  pageRankScores: Map<string, number>;
  couplingMetrics: CouplingMetrics[];
  stats: RankingStats;
} {
  const startTime = Date.now();

  // Build adjacency list
  const { adjacency, nodeCount, edgeCount } = buildDependencyAdjacency(dependencyGraph);

  // Run PageRank
  let prResult: PageRankResult;
  try {
    prResult = pageRank(adjacency, {
      damping: 0.85,
      iterations: 100,
      tolerance: 1e-6,
    });
  } catch {
    // Empty graph or other error
    return {
      hotspots: [],
      pageRankScores: new Map(),
      couplingMetrics: [],
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        iterations: 0,
        converged: false,
        durationMs: Date.now() - startTime,
        cycleCount: 0,
      },
    };
  }

  // Calculate coupling metrics
  const couplingMetrics = calculateCouplingMetrics(dependencyGraph, prResult.scores);

  // Build reverse graph for dependent counts
  const dependents: Record<string, string[]> = {};
  for (const module of Object.keys(dependencyGraph)) {
    dependents[module] = [];
  }
  for (const [module, deps] of Object.entries(dependencyGraph)) {
    for (const dep of deps) {
      if (!dependents[dep]) {
        dependents[dep] = [];
      }
      dependents[dep].push(module);
    }
  }

  // Get all PageRank values for percentile calculation
  const allScores = Array.from(prResult.scores.values());

  // Build coupling lookup map for O(1) access (avoids O(n^2) from find() in loop)
  const couplingMap = new Map(couplingMetrics.map((c) => [c.path, c]));

  // Create hotspots from top PageRank scores
  const sortedModules = Array.from(prResult.scores.entries()).sort((a, b) => b[1] - a[1]);

  const hotspots: DependencyHotspot[] = [];

  const defaultCoupling: CouplingMetrics = {
    path: '',
    afferentCoupling: 0,
    efferentCoupling: 0,
    instability: 0,
    riskScore: 0,
  };

  for (const [module, score] of sortedModules.slice(0, count)) {
    const percentile = calculatePercentile(score, allScores);
    const coupling = couplingMap.get(module) ?? { ...defaultCoupling, path: module };

    const hotspotBase = {
      path: module,
      pageRank: Math.round(score * 10000) / 10000,
      percentile,
      dependentCount: dependents[module]?.length ?? 0,
      dependencyCount: dependencyGraph[module]?.length ?? 0,
      riskLevel: getRiskLevel(percentile),
      coupling,
    };

    hotspots.push({
      ...hotspotBase,
      reason: getHotspotReason(hotspotBase),
    });
  }

  return {
    hotspots,
    pageRankScores: prResult.scores,
    couplingMetrics,
    stats: {
      nodeCount,
      edgeCount,
      iterations: prResult.stats.iterationsPerformed,
      converged: prResult.stats.converged,
      durationMs: Date.now() - startTime,
      cycleCount: 0, // Will be set by safe-order analysis
    },
  };
}
