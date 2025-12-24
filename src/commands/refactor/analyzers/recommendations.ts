/**
 * @module commands/refactor/analyzers/recommendations
 * @description Recommendation generation for refactoring
 *
 * Generates prioritized, actionable recommendations based on analysis.
 */

import type { ArchHealth, DomainInfo, Recommendation, RefactorAnalysis } from '../core';

// ============================================================================
// RECOMMENDATION GENERATORS
// ============================================================================

/**
 * Generate recommendations for architecture violations
 */
function generateArchRecommendations(
  archHealth: ArchHealth,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const violation of archHealth.violations.filter((v) => v.severity === 'error')) {
    recommendations.push({
      id: `arch-${priority.value}`,
      priority: priority.value++,
      category: 'architecture',
      title: violation.type === 'circular' ? 'Fix circular dependency' : 'Fix layer violation',
      description: violation.message,
      expectedImprovement: 15,
      effort: 'high',
      affectedFiles: [violation.from, violation.to],
      autoFixable: false,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for duplicate functions
 */
function generateDuplicateRecommendations(
  analysis: RefactorAnalysis,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const dup of analysis.duplicates.filter((d) => d.recommendation === 'merge')) {
    recommendations.push({
      id: `dup-${priority.value}`,
      priority: priority.value++,
      category: 'duplication',
      title: `Merge duplicate function: ${dup.name}`,
      description: `${(dup.similarity * 100).toFixed(0)}% similar functions found in ${dup.locations.length} locations`,
      expectedImprovement: 5,
      effort: 'low',
      affectedFiles: dup.locations.map((l) => l.file),
      autoFixable: true,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for structure issues
 */
function generateStructureRecommendations(
  analysis: RefactorAnalysis,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const issue of analysis.structure.issues.filter((i) => i.severity === 'error')) {
    recommendations.push({
      id: `struct-${priority.value}`,
      priority: priority.value++,
      category: 'structure',
      title: `Fix structure issue: ${issue.type}`,
      description: issue.message,
      expectedImprovement: 10,
      effort: 'medium',
      affectedFiles: issue.files,
      autoFixable: issue.type === 'missing-barrel',
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for domain coherence
 */
function generateDomainRecommendations(
  domains: DomainInfo[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const domain of domains.filter((d) => d.coherence < 0.8)) {
    recommendations.push({
      id: `domain-${priority.value}`,
      priority: priority.value++,
      category: 'structure',
      title: `Improve domain coherence: ${domain.name}`,
      description: domain.suggestion || `Move ${domain.shouldMove.length} misplaced files`,
      expectedImprovement: 5,
      effort: 'medium',
      affectedFiles: domain.shouldMove.map((m) => m.file),
      autoFixable: true,
    });
  }

  return recommendations;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate prioritized recommendations
 */
export function generateRecommendations(
  analysis: RefactorAnalysis,
  archHealth: ArchHealth,
  domains: DomainInfo[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const priority = { value: 1 };

  // 1. Architecture violations (highest priority)
  recommendations.push(...generateArchRecommendations(archHealth, priority));

  // 2. Duplicate functions
  recommendations.push(...generateDuplicateRecommendations(analysis, priority));

  // 3. Structure issues
  recommendations.push(...generateStructureRecommendations(analysis, priority));

  // 4. Domain coherence
  recommendations.push(...generateDomainRecommendations(domains, priority));

  return recommendations;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Filter recommendations by category
 */
export function filterByCategory(
  recommendations: Recommendation[],
  category: Recommendation['category'],
): Recommendation[] {
  return recommendations.filter((r) => r.category === category);
}

/**
 * Get only auto-fixable recommendations
 */
export function getAutoFixable(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter((r) => r.autoFixable);
}

/**
 * Calculate total expected improvement
 */
export function calculateTotalImprovement(recommendations: Recommendation[]): number {
  return recommendations.reduce((sum, r) => sum + r.expectedImprovement, 0);
}

/**
 * Sort recommendations by priority
 */
export function sortByPriority(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => a.priority - b.priority);
}

/**
 * Group recommendations by category
 */
export function groupByCategory(
  recommendations: Recommendation[],
): Map<Recommendation['category'], Recommendation[]> {
  const grouped = new Map<Recommendation['category'], Recommendation[]>();

  for (const rec of recommendations) {
    const existing = grouped.get(rec.category) || [];
    existing.push(rec);
    grouped.set(rec.category, existing);
  }

  return grouped;
}
