/**
 * @module commands/refactor/analyzers/ranking/classification
 * @description Node classification and risk calculation for refactoring
 *
 * Classifies modules as:
 * - Leaf: No dependents, safe to refactor first
 * - Core: Many dependents, refactor last (high impact)
 * - Intermediate: Between leaf and core
 *
 * Also calculates risk scores for refactoring phases.
 */

import type { CouplingMetrics, RefactoringPhase } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for "core" classification (percentile of afferent coupling) */
export const CORE_THRESHOLD_PERCENTILE = 80;

/** Risk multiplier for cycles */
export const CYCLE_RISK_MULTIPLIER = 1.5;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a lookup map for coupling metrics (O(n) -> enables O(1) lookups)
 */
export function buildCouplingMap(couplingMetrics: CouplingMetrics[]): Map<string, CouplingMetrics> {
  return new Map(couplingMetrics.map((c) => [c.path, c]));
}

/**
 * Calculate percentile rank of a value within a distribution
 */
export function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;
  return Math.round((rank / sorted.length) * 100);
}

// ============================================================================
// NODE CLASSIFICATION
// ============================================================================

/**
 * Classify a node as leaf, intermediate, or core based on coupling
 *
 * For batch operations, use classifyNodeWithMaps() which uses pre-computed data
 *
 * @param node - Module path to classify
 * @param couplingMetrics - Array of coupling metrics for all modules
 * @param pageRankScores - PageRank scores for all modules
 */
export function classifyNode(
  node: string,
  couplingMetrics: CouplingMetrics[],
  pageRankScores: Map<string, number>,
): 'leaf' | 'intermediate' | 'core' {
  // Build map for O(1) lookup (avoids O(n^2) when called in loop)
  const couplingMap = buildCouplingMap(couplingMetrics);
  const coupling = couplingMap.get(node);
  if (!coupling) return 'intermediate';

  const Ca = coupling.afferentCoupling;
  const pageRank = pageRankScores.get(node) ?? 0;

  // Calculate percentiles
  const allCa = couplingMetrics.map((c) => c.afferentCoupling);
  const allPageRank = Array.from(pageRankScores.values());

  const caPercentile = calculatePercentile(Ca, allCa);
  const prPercentile = calculatePercentile(pageRank, allPageRank);

  // Leaf: no dependents or very low PageRank
  if (Ca === 0 || (caPercentile < 20 && prPercentile < 20)) {
    return 'leaf';
  }

  // Core: high dependents or high PageRank
  if (caPercentile >= CORE_THRESHOLD_PERCENTILE || prPercentile >= CORE_THRESHOLD_PERCENTILE) {
    return 'core';
  }

  return 'intermediate';
}

/**
 * Classify a node using pre-built maps for O(1) lookups
 * Internal function optimized for batch operations
 *
 * @param node - Module path to classify
 * @param couplingMap - Pre-built coupling metrics map
 * @param pageRankScores - PageRank scores for all modules
 * @param allCa - Pre-computed array of all afferent coupling values
 * @param allPageRank - Pre-computed array of all PageRank values
 */
export function classifyNodeWithMaps(
  node: string,
  couplingMap: Map<string, CouplingMetrics>,
  pageRankScores: Map<string, number>,
  allCa: number[],
  allPageRank: number[],
): 'leaf' | 'intermediate' | 'core' {
  const coupling = couplingMap.get(node);
  if (!coupling) return 'intermediate';

  const Ca = coupling.afferentCoupling;
  const pageRank = pageRankScores.get(node) ?? 0;

  const caPercentile = calculatePercentile(Ca, allCa);
  const prPercentile = calculatePercentile(pageRank, allPageRank);

  // Leaf: no dependents or very low PageRank
  if (Ca === 0 || (caPercentile < 20 && prPercentile < 20)) {
    return 'leaf';
  }

  // Core: high dependents or high PageRank
  if (caPercentile >= CORE_THRESHOLD_PERCENTILE || prPercentile >= CORE_THRESHOLD_PERCENTILE) {
    return 'core';
  }

  return 'intermediate';
}

// ============================================================================
// RISK CALCULATION
// ============================================================================

/**
 * Calculate risk score for a phase
 *
 * Uses pre-built coupling map for O(1) lookups (avoids O(n*m) complexity)
 *
 * @param modules - Array of module paths in the phase
 * @param couplingMap - Pre-built coupling metrics map
 * @param pageRankScores - PageRank scores for all modules
 * @param isCycle - Whether this phase is a circular dependency
 */
export function calculatePhaseRisk(
  modules: string[],
  couplingMap: Map<string, CouplingMetrics>,
  pageRankScores: Map<string, number>,
  isCycle: boolean,
): number {
  if (modules.length === 0) return 0;

  let totalRisk = 0;
  for (const module of modules) {
    const coupling = couplingMap.get(module);
    const Ca = coupling?.afferentCoupling ?? 0;
    const pageRank = pageRankScores.get(module) ?? 0;
    totalRisk += Ca * 10 + pageRank * 100;
  }

  const avgRisk = totalRisk / modules.length;
  return Math.round(avgRisk * (isCycle ? CYCLE_RISK_MULTIPLIER : 1));
}

/**
 * Convert numeric risk score to risk level
 */
export function getRiskLevel(riskScore: number): RefactoringPhase['riskLevel'] {
  if (riskScore >= 50) return 'critical';
  if (riskScore >= 30) return 'high';
  if (riskScore >= 10) return 'medium';
  return 'low';
}
