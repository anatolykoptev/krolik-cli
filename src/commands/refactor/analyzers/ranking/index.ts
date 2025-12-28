/**
 * @module commands/refactor/analyzers/ranking
 * @description PageRank-based dependency analysis for refactor command
 *
 * ## Features
 *
 * - **Dependency Hotspots**: Identify highly central modules using PageRank
 * - **Coupling Metrics**: Calculate Ca, Ce, Instability for each module
 * - **Safe Refactoring Order**: Generate topologically-sorted phases
 * - **Risk Assessment**: Score modules by centrality × coupling
 *
 * ## Usage
 *
 * ```ts
 * import { analyzeRanking } from './analyzers/ranking';
 *
 * const ranking = analyzeRanking(archHealth.dependencyGraph);
 *
 * // Access hotspots (top N by PageRank)
 * for (const hotspot of ranking.hotspots) {
 *   console.log(`${hotspot.path}: PR=${hotspot.pageRank}, risk=${hotspot.riskLevel}`);
 * }
 *
 * // Access safe refactoring order
 * for (const phase of ranking.safeOrder.phases) {
 *   console.log(`Phase ${phase.order}: ${phase.modules.join(', ')}`);
 * }
 * ```
 *
 * @see detectHotspots for PageRank-based hotspot detection
 * @see generateSafeRefactoringOrder for topological sorting
 */

import { DEFAULT_HOTSPOT_COUNT, detectHotspots } from './hotspots.js';
import { generateSafeRefactoringOrder } from './safe-order.js';
import type { RankingAnalysis } from './types.js';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  CouplingMetrics,
  DependencyHotspot,
  PriorityEnrichment,
  RankingAnalysis,
  RankingStats,
  RefactoringPhase,
  SafeRefactoringOrder,
} from './types.js';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

export { calculateCouplingMetrics, DEFAULT_HOTSPOT_COUNT, detectHotspots } from './hotspots.js';

export {
  classifyNode,
  findStronglyConnectedComponents,
  generateSafeRefactoringOrder,
  topologicalSort,
} from './safe-order.js';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform complete ranking analysis on a dependency graph
 *
 * Combines:
 * - PageRank computation for centrality scores
 * - Hotspot detection for critical modules
 * - Coupling metrics (Ca, Ce, Instability)
 * - Safe refactoring order with topological sorting
 *
 * @param dependencyGraph - Record<module, dependencies[]> from ArchHealth
 * @param hotspotCount - Number of hotspots to return (default: 10)
 */
export function analyzeRanking(
  dependencyGraph: Record<string, string[]>,
  hotspotCount: number = DEFAULT_HOTSPOT_COUNT,
): RankingAnalysis {
  // 1. Detect hotspots (also computes PageRank and coupling)
  const { hotspots, pageRankScores, couplingMetrics, stats } = detectHotspots(
    dependencyGraph,
    hotspotCount,
  );

  // 2. Generate safe refactoring order
  const safeOrder = generateSafeRefactoringOrder(dependencyGraph, couplingMetrics, pageRankScores);

  // Update stats with cycle count
  stats.cycleCount = safeOrder.cycles.length;

  return {
    pageRankScores,
    hotspots,
    couplingMetrics,
    safeOrder,
    stats,
  };
}

// ============================================================================
// PRIORITY ENRICHMENT
// ============================================================================

/**
 * Enrich recommendation priority with PageRank scores
 *
 * @param originalPriority - Sequential priority from recommendations.ts
 * @param affectedFiles - Files affected by the recommendation
 * @param pageRankScores - PageRank scores from analyzeRanking
 * @param couplingMetrics - Coupling metrics from analyzeRanking
 */
export function enrichPriority(
  originalPriority: number,
  affectedFiles: string[],
  pageRankScores: Map<string, number>,
  couplingMetrics: { path: string; afferentCoupling: number }[],
): {
  finalPriority: number;
  pageRankBoost: number;
  couplingBoost: number;
  reason: string;
} {
  if (affectedFiles.length === 0) {
    return {
      finalPriority: originalPriority,
      pageRankBoost: 0,
      couplingBoost: 0,
      reason: 'no affected files',
    };
  }

  // Calculate average PageRank of affected files
  let totalPageRank = 0;
  let totalCoupling = 0;
  let matchedFiles = 0;

  for (const file of affectedFiles) {
    // Try to match file to module in graph
    const moduleKey = findMatchingModule(file, pageRankScores);
    if (moduleKey) {
      totalPageRank += pageRankScores.get(moduleKey) ?? 0;
      const coupling = couplingMetrics.find((c) => c.path === moduleKey);
      if (coupling) {
        totalCoupling += coupling.afferentCoupling;
      }
      matchedFiles++;
    }
  }

  if (matchedFiles === 0) {
    return {
      finalPriority: originalPriority,
      pageRankBoost: 0,
      couplingBoost: 0,
      reason: 'no matching modules',
    };
  }

  const avgPageRank = totalPageRank / matchedFiles;
  const avgCoupling = totalCoupling / matchedFiles;

  // Calculate boosts (higher PageRank/coupling = lower priority number = higher priority)
  // PageRank boost: 0-5 points (inverted: high PR = negative adjustment = higher priority)
  const pageRankBoost = -Math.round(avgPageRank * 500) / 100;

  // Coupling boost: 0-3 points per average dependent
  const couplingBoost = -Math.round(avgCoupling * 0.3 * 100) / 100;

  const finalPriority = Math.max(1, originalPriority + pageRankBoost + couplingBoost);

  const reasons: string[] = [];
  if (pageRankBoost < -1) reasons.push(`high centrality (PR boost: ${pageRankBoost})`);
  if (couplingBoost < -0.5) reasons.push(`high coupling (Ca boost: ${couplingBoost})`);

  return {
    finalPriority: Math.round(finalPriority * 10) / 10,
    pageRankBoost,
    couplingBoost,
    reason: reasons.length > 0 ? reasons.join(', ') : 'standard priority',
  };
}

/**
 * Find matching module key in PageRank scores
 */
function findMatchingModule(
  filePath: string,
  pageRankScores: Map<string, number>,
): string | undefined {
  // Direct match
  if (pageRankScores.has(filePath)) {
    return filePath;
  }

  // Try to extract directory name
  const parts = filePath.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i];
    if (segment && pageRankScores.has(segment)) {
      return segment;
    }
    // Try with @ prefix
    if (segment && pageRankScores.has(`@${segment}`)) {
      return `@${segment}`;
    }
  }

  return undefined;
}
