/**
 * @module commands/audit/impact/analyzer
 * @description Main impact analysis for audit command
 *
 * Combines PageRank from dependency graph with git history to calculate
 * impact scores for files and issues.
 *
 * Reuses:
 * - `@ranking` module for PageRank algorithm
 * - `ranking/hotspots` from refactor command for dependency analysis
 * - `git-history` from this module for bug correlation
 */

import {
  type AdjacencyList,
  buildAdjacencyMatrix,
  normalizeWeights,
  type PageRankResult,
  pageRank,
} from '../../../lib/@ranking';
import {
  analyzeFilesHistory,
  DEFAULT_PERIOD_DAYS,
  getBuggyFiles,
  getHotFiles,
} from './git-history';
import type {
  BatchImpactAnalysis,
  FileImpactAnalysis,
  ImpactAnalysisOptions,
  ImpactScore,
  RiskLevel,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for critical risk: dependents count */
const CRITICAL_DEPENDENTS = 20;

/** Threshold for high risk: dependents count */
const HIGH_DEPENDENTS = 10;

/** Threshold for medium risk: dependents count */
const MEDIUM_DEPENDENTS = 5;

/** Threshold for critical risk: bug-fix commits */
const CRITICAL_BUG_FIXES = 3;

/** Threshold for high risk: bug-fix commits */
const HIGH_BUG_FIXES = 1;

/** Percentile for critical PageRank */
const CRITICAL_PERCENTILE = 95;

/** Percentile for high PageRank */
const HIGH_PERCENTILE = 80;

/** Percentile for medium PageRank */
const MEDIUM_PERCENTILE = 50;

// ============================================================================
// DEPENDENCY GRAPH BUILDING
// ============================================================================

/**
 * Build adjacency list from dependency graph
 *
 * For impact analysis, we reverse the direction:
 * If A depends on B, then changes in B impact A.
 * So we create edge B -> A.
 */
export function buildImpactGraph(dependencyGraph: Record<string, string[]>): {
  adjacency: AdjacencyList;
  dependentsCounts: Map<string, number>;
} {
  const nodes = new Set<string>();
  const edges: Array<{ source: string; target: string; weight: number }> = [];
  const dependentsCounts = new Map<string, number>();

  // Initialize all nodes and count dependents
  for (const [module, deps] of Object.entries(dependencyGraph)) {
    nodes.add(module);
    for (const dep of deps) {
      nodes.add(dep);
      // Reverse direction for impact propagation
      edges.push({ source: dep, target: module, weight: 1 });
      // Count dependents
      dependentsCounts.set(dep, (dependentsCounts.get(dep) ?? 0) + 1);
    }
  }

  const adjacency = buildAdjacencyMatrix([...nodes], edges);
  const normalized = normalizeWeights(adjacency);

  return { adjacency: normalized, dependentsCounts };
}

// ============================================================================
// RISK CALCULATION
// ============================================================================

/**
 * Calculate risk level based on combined factors
 *
 * Uses a weighted scoring system:
 * - Dependents: 3 points for >20, 2 for >10, 1 for >5
 * - Bug history: 3 points for >3 fixes, 2 for >1, 0 otherwise
 * - Change frequency: 2 points for top 10%, 1 for top 20%
 * - PageRank: 2 points for top 5%, 1 for top 20%
 */
export function calculateRiskLevel(
  dependents: number,
  bugHistory: number,
  changeFrequency: number,
  percentile: number,
): RiskLevel {
  let score = 0;

  // Dependents scoring
  if (dependents >= CRITICAL_DEPENDENTS) score += 3;
  else if (dependents >= HIGH_DEPENDENTS) score += 2;
  else if (dependents >= MEDIUM_DEPENDENTS) score += 1;

  // Bug history scoring
  if (bugHistory > CRITICAL_BUG_FIXES) score += 3;
  else if (bugHistory >= HIGH_BUG_FIXES) score += 2;

  // PageRank percentile scoring
  if (percentile >= CRITICAL_PERCENTILE) score += 2;
  else if (percentile >= HIGH_PERCENTILE) score += 1;
  else if (percentile >= MEDIUM_PERCENTILE) score += 0.5;

  // Change frequency scoring (based on changeFrequency being high)
  if (changeFrequency > 10) score += 2;
  else if (changeFrequency > 5) score += 1;

  // Determine risk level
  if (score >= 8) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Generate reason for risk level
 */
function generateReason(impact: ImpactScore): string {
  const parts: string[] = [];

  if (impact.dependents >= CRITICAL_DEPENDENTS) {
    parts.push(`${impact.dependents} dependents (critical)`);
  } else if (impact.dependents >= HIGH_DEPENDENTS) {
    parts.push(`${impact.dependents} dependents (high)`);
  } else if (impact.dependents >= MEDIUM_DEPENDENTS) {
    parts.push(`${impact.dependents} dependents`);
  }

  if (impact.bugHistory > CRITICAL_BUG_FIXES) {
    parts.push(`${impact.bugHistory} bug fixes in 30d`);
  } else if (impact.bugHistory >= HIGH_BUG_FIXES) {
    parts.push(`${impact.bugHistory} bug fix in 30d`);
  }

  if (impact.percentile >= CRITICAL_PERCENTILE) {
    parts.push(`top ${100 - impact.percentile}% centrality`);
  } else if (impact.percentile >= HIGH_PERCENTILE) {
    parts.push(`top ${100 - impact.percentile}% centrality`);
  }

  if (impact.changeFrequency > 10) {
    parts.push('frequently changed');
  }

  return parts.length > 0 ? parts.join(', ') : 'low impact';
}

// ============================================================================
// SINGLE FILE ANALYSIS
// ============================================================================

/**
 * Analyze impact for a single file
 *
 * @param file - File path (relative to project root)
 * @param projectRoot - Project root directory
 * @param dependencyGraph - Dependency graph from architecture analysis
 * @param options - Analysis options
 */
export function analyzeFileImpact(
  file: string,
  projectRoot: string,
  dependencyGraph: Record<string, string[]>,
  options: Partial<ImpactAnalysisOptions> = {},
): FileImpactAnalysis {
  const periodDays = options.periodDays ?? DEFAULT_PERIOD_DAYS;

  // Build impact graph and run PageRank
  const { adjacency, dependentsCounts } = buildImpactGraph(dependencyGraph);

  let prResult: PageRankResult;
  try {
    prResult = pageRank(adjacency, { damping: 0.85, iterations: 100 });
  } catch {
    // Empty graph
    prResult = {
      scores: new Map(),
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        iterationsPerformed: 0,
        converged: true,
        finalDelta: 0,
        durationMs: 0,
      },
    };
  }

  // Get PageRank score and percentile
  const pageRankScore = prResult.scores.get(file) ?? 0;
  const allScores = [...prResult.scores.values()].sort((a, b) => a - b);
  const percentile = calculatePercentile(pageRankScore, allScores);

  // Get dependents count
  const dependents = dependentsCounts.get(file) ?? 0;

  // Get git history
  const gitHistoryMap = analyzeFilesHistory(projectRoot, [file], periodDays);
  const gitHistory = gitHistoryMap.get(file) ?? {
    file,
    totalCommits: 0,
    bugFixCommits: 0,
    featureCommits: 0,
    periodDays,
    changeRank: 'bottom-50%',
  };

  // Calculate risk level
  const riskLevel = calculateRiskLevel(
    dependents,
    gitHistory.bugFixCommits,
    gitHistory.totalCommits,
    percentile,
  );

  const impact: ImpactScore = {
    dependents,
    bugHistory: gitHistory.bugFixCommits,
    changeFrequency: gitHistory.totalCommits,
    pageRank: pageRankScore,
    percentile,
    riskLevel,
  };

  return {
    file,
    impact,
    gitHistory,
    reason: generateReason(impact),
  };
}

/**
 * Calculate percentile for a value
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const rank = sortedValues.filter((v) => v < value).length;
  return Math.round((rank / sortedValues.length) * 100);
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Analyze impact for multiple files
 *
 * More efficient than calling analyzeFileImpact repeatedly.
 *
 * @param files - File paths (relative to project root)
 * @param projectRoot - Project root directory
 * @param dependencyGraph - Dependency graph from architecture analysis
 * @param options - Analysis options
 */
export function analyzeImpact(
  files: string[],
  projectRoot: string,
  dependencyGraph: Record<string, string[]>,
  options: Partial<ImpactAnalysisOptions> = {},
): BatchImpactAnalysis {
  const startTime = Date.now();
  const periodDays = options.periodDays ?? DEFAULT_PERIOD_DAYS;
  const topCount = options.topCount ?? 10;

  // Build impact graph and run PageRank once
  const { adjacency, dependentsCounts } = buildImpactGraph(dependencyGraph);

  let prResult: PageRankResult;
  try {
    prResult = pageRank(adjacency, { damping: 0.85, iterations: 100 });
  } catch {
    prResult = {
      scores: new Map(),
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        iterationsPerformed: 0,
        converged: true,
        finalDelta: 0,
        durationMs: 0,
      },
    };
  }

  // Calculate all percentiles
  const allScores = [...prResult.scores.values()].sort((a, b) => a - b);

  // Get git history for all files at once
  const gitHistoryMap = analyzeFilesHistory(projectRoot, files, periodDays);

  // Get hot and buggy files
  const hotFiles = getHotFiles(projectRoot, periodDays, topCount);
  const buggyFiles = getBuggyFiles(projectRoot, periodDays, topCount);

  // Analyze each file
  const filesMap = new Map<string, FileImpactAnalysis>();
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let totalBugFixes = 0;
  let totalChanges = 0;

  for (const file of files) {
    const pageRankScore = prResult.scores.get(file) ?? 0;
    const percentile = calculatePercentile(pageRankScore, allScores);
    const dependents = dependentsCounts.get(file) ?? 0;

    const gitHistory = gitHistoryMap.get(file) ?? {
      file,
      totalCommits: 0,
      bugFixCommits: 0,
      featureCommits: 0,
      periodDays,
      changeRank: 'bottom-50%',
    };

    const riskLevel = calculateRiskLevel(
      dependents,
      gitHistory.bugFixCommits,
      gitHistory.totalCommits,
      percentile,
    );

    const impact: ImpactScore = {
      dependents,
      bugHistory: gitHistory.bugFixCommits,
      changeFrequency: gitHistory.totalCommits,
      pageRank: pageRankScore,
      percentile,
      riskLevel,
    };

    const analysis: FileImpactAnalysis = {
      file,
      impact,
      gitHistory,
      reason: generateReason(impact),
    };

    filesMap.set(file, analysis);

    // Count by risk level
    switch (riskLevel) {
      case 'critical':
        criticalCount++;
        break;
      case 'high':
        highCount++;
        break;
      case 'medium':
        mediumCount++;
        break;
      case 'low':
        lowCount++;
        break;
    }

    totalBugFixes += gitHistory.bugFixCommits;
    totalChanges += gitHistory.totalCommits;
  }

  // Sort by risk level
  const byRisk = [...filesMap.values()].sort((a, b) => {
    const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return riskOrder[a.impact.riskLevel] - riskOrder[b.impact.riskLevel];
  });

  return {
    files: filesMap,
    byRisk,
    hotFiles: hotFiles.map((h) => h.file),
    buggyFiles: buggyFiles.map((b) => b.file),
    stats: {
      filesAnalyzed: files.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalBugFixes,
      totalChanges,
      durationMs: Date.now() - startTime,
    },
  };
}

// ============================================================================
// ISSUE ENRICHMENT
// ============================================================================

/**
 * Get impact score for an issue's file
 *
 * Convenience function to get just the ImpactScore for a file.
 *
 * @param file - File path
 * @param projectRoot - Project root directory
 * @param dependencyGraph - Dependency graph
 */
export function getFileImpactScore(
  file: string,
  projectRoot: string,
  dependencyGraph: Record<string, string[]>,
): ImpactScore {
  const analysis = analyzeFileImpact(file, projectRoot, dependencyGraph);
  return analysis.impact;
}
