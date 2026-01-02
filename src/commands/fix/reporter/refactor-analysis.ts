/**
 * @module commands/fix/reporter/refactor-analysis
 * @description Refactor analysis integration for audit reports
 *
 * Provides ranking, recommendations, and duplicates data from refactor command.
 * Uses dynamic imports to avoid circular dependencies.
 */

import * as path from 'node:path';
import { detectMonorepoPackages } from '../../../config/detect';
import type { ImpactEnricher } from '../../audit/enrichment';
import type { DuplicateSummary, RankingSummary, RecommendationSummary } from './types';

// ============================================================================
// LIB PATH DETECTION (with monorepo support)
// ============================================================================

/**
 * Find lib path with monorepo support
 *
 * Uses dynamic detection for monorepos, falls back to findLibPath() for single projects.
 * Returns absolute path to lib directory.
 */
async function findLibPathWithMonorepo(projectRoot: string): Promise<string | undefined> {
  // First try monorepo detection
  const packages = detectMonorepoPackages(projectRoot);
  const firstPackage = packages[0];
  if (firstPackage) {
    // Return the first package's libPath as absolute path
    return path.join(projectRoot, firstPackage.libPath);
  }

  // Fall back to findLibPath for non-monorepo projects
  const { findLibPath } = await import('../../refactor/paths');
  return findLibPath(projectRoot);
}

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

    const libPath = await findLibPathWithMonorepo(projectRoot);
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
    const { findDuplicates } = await import('../../refactor/analyzers/core/duplicates');

    const libPath = await findLibPathWithMonorepo(projectRoot);
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
    const { findDuplicates } = await import('../../refactor/analyzers/core/duplicates');

    const libPath = await findLibPathWithMonorepo(projectRoot);
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

// ============================================================================
// IMPACT ENRICHMENT
// ============================================================================

/**
 * Create an ImpactEnricher for enriching issues with dependency impact data
 *
 * Reuses the same dependency graph used for ranking analysis.
 * Uses monorepo detection to find lib paths dynamically.
 * Returns undefined if no dependency graph is available.
 */
export async function createImpactEnricher(
  projectRoot: string,
): Promise<ImpactEnricher | undefined> {
  try {
    const { analyzeArchHealth } = await import('../../refactor/analyzers/architecture');
    const { ImpactEnricher: Enricher } = await import('../../audit/enrichment');

    const libPath = await findLibPathWithMonorepo(projectRoot);
    if (!libPath) return undefined;

    const archHealth = analyzeArchHealth(libPath, projectRoot);
    if (!archHealth.dependencyGraph || Object.keys(archHealth.dependencyGraph).length === 0) {
      return undefined;
    }

    return new Enricher(projectRoot, archHealth.dependencyGraph);
  } catch {
    return undefined;
  }
}
