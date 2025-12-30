/**
 * @module commands/fix/reporter/refactor-analysis
 * @description Refactor analysis integration for audit reports
 *
 * Provides ranking, recommendations, and duplicates data from refactor command.
 * Uses dynamic imports to avoid circular dependencies.
 */

import type { DuplicateSummary, RankingSummary, RecommendationSummary } from './types';

// ============================================================================
// RANKING ANALYSIS
// ============================================================================

/**
 * Compute ranking analysis for dependency hotspots
 */
export async function computeRanking(projectRoot: string): Promise<RankingSummary | undefined> {
  try {
    const { analyzeArchHealth } = await import('../../refactor/analyzers/architecture');
    const { analyzeRanking } = await import('../../refactor/analyzers/ranking');
    const { findLibPath } = await import('../../refactor/paths');

    const libPath = findLibPath(projectRoot);
    if (!libPath) return undefined;

    const archHealth = analyzeArchHealth(libPath, projectRoot);
    if (!archHealth.dependencyGraph || Object.keys(archHealth.dependencyGraph).length === 0) {
      return undefined;
    }

    const ranking = analyzeRanking(archHealth.dependencyGraph, 15);

    return {
      hotspots: ranking.hotspots.slice(0, 15).map((h) => ({
        path: h.path,
        pageRank: h.pageRank,
        percentile: h.percentile,
        risk: h.riskLevel,
        coupling: {
          afferent: h.coupling.afferentCoupling,
          efferent: h.coupling.efferentCoupling,
          instability: h.coupling.instability,
        },
      })),
      safeOrder: ranking.safeOrder.phases.slice(0, 10).map((p) => ({
        order: p.order,
        modules: p.modules.slice(0, 5),
        risk: p.riskLevel,
      })),
      cycles: ranking.safeOrder.cycles.slice(0, 5),
      leafNodes: ranking.safeOrder.leafNodes.slice(0, 10),
      coreNodes: ranking.safeOrder.coreNodes.slice(0, 5),
      stats: ranking.stats,
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// RECOMMENDATIONS ANALYSIS
// ============================================================================

/**
 * Compute top recommendations from refactor analysis
 */
export async function computeRecommendations(
  projectRoot: string,
): Promise<RecommendationSummary[] | undefined> {
  try {
    const { analyzeArchHealth, classifyDomains } = await import(
      '../../refactor/analyzers/architecture'
    );
    const { generateRecommendations } = await import(
      '../../refactor/analyzers/metrics/recommendations'
    );
    const { findLibPath } = await import('../../refactor/paths');
    const { findDuplicates } = await import('../../refactor/analyzers/core/duplicates');

    const libPath = findLibPath(projectRoot);
    if (!libPath) return undefined;

    const archHealth = analyzeArchHealth(libPath, projectRoot);
    const domains = classifyDomains(libPath);
    const duplicates = await findDuplicates(libPath, projectRoot);

    const analysis = {
      duplicates,
      structure: {
        issues: archHealth.violations.map((v) => ({
          type: v.type,
          severity: v.severity,
          message: v.message,
          files: [v.from, v.to],
        })),
      },
    };

    const recs = generateRecommendations(analysis as never, archHealth, domains);

    return recs.slice(0, 10).map((r) => ({
      priority: r.priority,
      category: r.category,
      title: r.title,
      description: r.description,
      effort: r.effort,
      autoFixable: r.autoFixable,
      affectedFiles: r.affectedFiles.slice(0, 3),
    }));
  } catch {
    return undefined;
  }
}

// ============================================================================
// DUPLICATES ANALYSIS
// ============================================================================

/**
 * Compute duplicates summary from refactor analysis
 */
export async function computeDuplicates(
  projectRoot: string,
): Promise<DuplicateSummary | undefined> {
  try {
    const { findLibPath } = await import('../../refactor/paths');
    const { findDuplicates } = await import('../../refactor/analyzers/core/duplicates');

    const libPath = findLibPath(projectRoot);
    if (!libPath) return undefined;

    const duplicates = await findDuplicates(libPath, projectRoot);
    if (duplicates.length === 0) return undefined;

    const mergeCount = duplicates.filter((d) => d.recommendation === 'merge').length;
    const renameCount = duplicates.filter((d) => d.recommendation === 'rename').length;
    const sorted = [...duplicates].sort((a, b) => b.locations.length - a.locations.length);

    return {
      totalGroups: duplicates.length,
      mergeCount,
      renameCount,
      topDuplicates: sorted.slice(0, 10).map((d) => ({
        name: d.name,
        similarity: d.similarity,
        locationCount: d.locations.length,
        recommendation: d.recommendation,
        files: d.locations.slice(0, 5).map((l) => l.file),
      })),
    };
  } catch {
    return undefined;
  }
}
