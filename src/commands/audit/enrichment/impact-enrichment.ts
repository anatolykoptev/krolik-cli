/**
 * @module commands/audit/enrichment/impact-enrichment
 * @description Enriches issues with dependency impact information
 *
 * Analyzes how many files depend on the affected code and calculates
 * risk levels based on PageRank centrality, dependents count, and git history.
 *
 * ## Usage
 *
 * ```ts
 * import { ImpactEnricher } from './enrichment/impact-enrichment';
 *
 * const enricher = new ImpactEnricher(projectRoot, dependencyGraph);
 * const enrichedImpact = enricher.enrichIssue(issue);
 *
 * console.log(enrichedImpact.dependentsCount); // 12
 * console.log(enrichedImpact.riskLevel); // 'critical'
 * ```
 */

import { type AdjacencyList, type PageRankResult, pageRank } from '../../../lib/@ranking';
import type { QualityIssue } from '../../fix/core';
import { buildImpactGraph, calculateRiskLevel, type RiskLevel } from '../impact';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enriched impact information for an issue
 */
export interface EnrichedImpact {
  /** Files that depend on the affected file */
  dependents: string[];
  /** Number of direct dependents */
  dependentsCount: number;
  /** PageRank percentile (0-100, higher = more central) */
  pageRankPercentile: number;
  /** Computed risk level */
  riskLevel: RiskLevel;
  /** Human-readable reason for the risk level */
  riskReason: string;
}

/**
 * Cached analysis result for a file
 */
interface FileAnalysisCache {
  dependents: string[];
  dependentsCount: number;
  pageRankScore: number;
  percentile: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of top dependents to include in output */
const MAX_TOP_DEPENDENTS = 5;

/** Percentile thresholds for risk reasons */
const PERCENTILE_THRESHOLDS = {
  critical: 95,
  high: 80,
  medium: 50,
};

/** Dependents thresholds for risk reasons */
const DEPENDENTS_THRESHOLDS = {
  critical: 20,
  high: 10,
  medium: 5,
};

// ============================================================================
// ENRICHER CLASS
// ============================================================================

/**
 * Caches dependency graph analysis for efficient issue enrichment
 *
 * Build the enricher once, then use it to enrich multiple issues efficiently.
 */
export class ImpactEnricher {
  private readonly adjacency: AdjacencyList;
  private readonly dependentsMap: Map<string, string[]>;
  private readonly dependentsCounts: Map<string, number>;
  private readonly pageRankScores: Map<string, number>;
  private readonly sortedScores: number[];
  private readonly fileCache: Map<string, FileAnalysisCache>;

  constructor(_projectRoot: string, dependencyGraph: Record<string, string[]>) {
    // Build impact graph (reverse direction for impact propagation)
    const { adjacency, dependentsCounts } = buildImpactGraph(dependencyGraph);
    this.adjacency = adjacency;
    this.dependentsCounts = dependentsCounts;

    // Build dependents map (which files depend on each file)
    this.dependentsMap = this.buildDependentsMap(dependencyGraph);

    // Run PageRank once
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

    this.pageRankScores = prResult.scores;
    this.sortedScores = [...prResult.scores.values()].sort((a, b) => a - b);
    this.fileCache = new Map();
  }

  /**
   * Build a map of file -> files that depend on it
   */
  private buildDependentsMap(dependencyGraph: Record<string, string[]>): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const [module, deps] of Object.entries(dependencyGraph)) {
      for (const dep of deps) {
        if (!map.has(dep)) {
          map.set(dep, []);
        }
        map.get(dep)!.push(module);
      }
    }

    return map;
  }

  /**
   * Calculate percentile for a PageRank score
   */
  private calculatePercentile(score: number): number {
    if (this.sortedScores.length === 0) return 0;
    const rank = this.sortedScores.filter((v) => v < score).length;
    return Math.round((rank / this.sortedScores.length) * 100);
  }

  /**
   * Get cached analysis for a file, or compute it
   */
  private getFileAnalysis(file: string): FileAnalysisCache {
    const cached = this.fileCache.get(file);
    if (cached) return cached;

    const dependents = this.dependentsMap.get(file) ?? [];
    const dependentsCount = this.dependentsCounts.get(file) ?? 0;
    const pageRankScore = this.pageRankScores.get(file) ?? 0;
    const percentile = this.calculatePercentile(pageRankScore);

    const analysis: FileAnalysisCache = {
      dependents,
      dependentsCount,
      pageRankScore,
      percentile,
    };

    this.fileCache.set(file, analysis);
    return analysis;
  }

  /**
   * Generate risk reason based on impact factors
   */
  private generateRiskReason(
    dependentsCount: number,
    percentile: number,
    riskLevel: RiskLevel,
  ): string {
    const parts: string[] = [];

    // Add file role description based on dependents
    if (dependentsCount >= DEPENDENTS_THRESHOLDS.critical) {
      parts.push(`Core module with ${dependentsCount} dependents`);
    } else if (dependentsCount >= DEPENDENTS_THRESHOLDS.high) {
      parts.push(`Shared module with ${dependentsCount} dependents`);
    } else if (dependentsCount >= DEPENDENTS_THRESHOLDS.medium) {
      parts.push(`${dependentsCount} dependents`);
    }

    // Add centrality info
    if (percentile >= PERCENTILE_THRESHOLDS.critical) {
      parts.push(`${100 - percentile}th percentile centrality`);
    } else if (percentile >= PERCENTILE_THRESHOLDS.high) {
      parts.push(`top ${100 - percentile}% centrality`);
    }

    if (parts.length === 0) {
      return riskLevel === 'low' ? 'Low impact module' : 'Moderate impact';
    }

    return parts.join(', ');
  }

  /**
   * Enrich a single issue with impact information
   *
   * @param issue - The quality issue to enrich
   * @returns Enriched impact data for the issue
   */
  enrichIssue(issue: QualityIssue): EnrichedImpact {
    const analysis = this.getFileAnalysis(issue.file);

    // Calculate risk level using the shared function
    const riskLevel = calculateRiskLevel(
      analysis.dependentsCount,
      0, // bugHistory - not available at issue level, would need git integration
      0, // changeFrequency - not available at issue level
      analysis.percentile,
    );

    const riskReason = this.generateRiskReason(
      analysis.dependentsCount,
      analysis.percentile,
      riskLevel,
    );

    return {
      dependents: analysis.dependents.slice(0, MAX_TOP_DEPENDENTS),
      dependentsCount: analysis.dependentsCount,
      pageRankPercentile: analysis.percentile,
      riskLevel,
      riskReason,
    };
  }

  /**
   * Enrich multiple issues efficiently
   *
   * @param issues - Array of quality issues to enrich
   * @returns Map of file path to enriched impact
   */
  enrichIssues(issues: QualityIssue[]): Map<string, EnrichedImpact> {
    const result = new Map<string, EnrichedImpact>();

    for (const issue of issues) {
      if (!result.has(issue.file)) {
        result.set(issue.file, this.enrichIssue(issue));
      }
    }

    return result;
  }

  /**
   * Get statistics about the dependency graph
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    maxDependents: number;
    avgDependents: number;
  } {
    const counts = [...this.dependentsCounts.values()];
    const maxDependents = counts.length > 0 ? Math.max(...counts) : 0;
    const avgDependents =
      counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0;

    return {
      nodeCount: this.adjacency.size,
      edgeCount: [...this.adjacency.values()].reduce((sum, edges) => sum + edges.size, 0),
      maxDependents,
      avgDependents,
    };
  }
}

// ============================================================================
// STANDALONE FUNCTION
// ============================================================================

/**
 * Enrich a single issue with impact information
 *
 * Creates a temporary enricher - for batch operations, use the ImpactEnricher class.
 *
 * @param issue - The quality issue to enrich
 * @param projectRoot - Project root directory
 * @param dependencyGraph - Dependency graph from architecture analysis
 * @returns Enriched impact data
 */
export function enrichIssueWithImpact(
  issue: QualityIssue,
  projectRoot: string,
  dependencyGraph: Record<string, string[]>,
): EnrichedImpact {
  const enricher = new ImpactEnricher(projectRoot, dependencyGraph);
  return enricher.enrichIssue(issue);
}
