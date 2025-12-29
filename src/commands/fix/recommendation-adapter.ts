/**
 * @module commands/fix/recommendation-adapter
 * @description Adapter to convert Refactor Recommendations to Fix QualityIssues
 *
 * This module provides the bridge between refactor analysis output
 * and the fix command's execution infrastructure.
 *
 * Mapping strategy:
 * - Recommendation.category → QualityCategory (with appropriate mapping)
 * - Recommendation.autoFixable → determines if issue can be processed
 * - Recommendation.affectedFiles → QualityIssue.file (first file)
 * - Recommendation.title → QualityIssue.message
 * - Recommendation.description → QualityIssue.suggestion
 * - Derived fixerId based on category
 */

import type { Recommendation, RecommendationCategory } from '../refactor/core';
import type { QualityCategory, QualityIssue, QualitySeverity } from './types';

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

/**
 * Map RecommendationCategory to QualityCategory
 *
 * Uses existing QualityCategory values where possible,
 * falls back to 'refine' for structural changes.
 */
const CATEGORY_MAP: Record<RecommendationCategory, QualityCategory> = {
  duplication: 'lint', // Handled by new duplicate fixer
  structure: 'refine', // Handled by refine fixer
  architecture: 'circular-dep', // Not auto-fixable, but map for completeness
  naming: 'refine', // Naming issues are structural
  documentation: 'documentation', // Direct mapping
};

/**
 * Map RecommendationCategory to fixerId
 *
 * This determines which fixer will handle the issue.
 */
const FIXER_MAP: Record<RecommendationCategory, string> = {
  duplication: 'duplicate',
  structure: 'refine',
  architecture: 'architecture', // Not auto-fixable
  naming: 'refine',
  documentation: 'documentation',
};

/**
 * Map effort level to severity
 *
 * Higher effort = more severe issue
 */
const EFFORT_TO_SEVERITY: Record<string, QualitySeverity> = {
  low: 'info',
  medium: 'warning',
  high: 'error',
};

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Convert a single Recommendation to QualityIssue
 *
 * @param rec - Recommendation from refactor analysis
 * @returns QualityIssue for fix command
 */
export function adaptRecommendation(rec: Recommendation): QualityIssue {
  const category = CATEGORY_MAP[rec.category] ?? 'refine';
  const fixerId = FIXER_MAP[rec.category] ?? 'refine';
  const severity = EFFORT_TO_SEVERITY[rec.effort] ?? 'warning';

  // Use first affected file as the primary file
  const primaryFile = rec.affectedFiles[0] ?? '';

  // Build suggestion with context
  const suggestion = buildSuggestion(rec);

  // Build snippet with affected files context
  const snippet = buildSnippet(rec);

  const result: QualityIssue = {
    file: primaryFile,
    severity,
    category,
    message: rec.title,
    fixerId,
  };

  // Add optional fields only if they have values
  if (suggestion) result.suggestion = suggestion;
  if (snippet) result.snippet = snippet;

  return result;
}

/**
 * Build suggestion text from recommendation
 */
function buildSuggestion(rec: Recommendation): string {
  const parts: string[] = [rec.description];

  if (rec.expectedImprovement > 0) {
    parts.push(`Expected improvement: +${rec.expectedImprovement} points`);
  }

  if (rec.affectedFiles.length > 1) {
    parts.push(`Affects ${rec.affectedFiles.length} files`);
  }

  return parts.join('. ');
}

/**
 * Build snippet with affected files list
 */
function buildSnippet(rec: Recommendation): string | undefined {
  if (rec.affectedFiles.length <= 1) return undefined;

  // Show up to 5 affected files
  const displayFiles = rec.affectedFiles.slice(0, 5);
  const overflow = rec.affectedFiles.length - 5;

  let snippet = `Affected files:\n${displayFiles.map((f) => `  - ${f}`).join('\n')}`;

  if (overflow > 0) {
    snippet += `\n  ... and ${overflow} more`;
  }

  return snippet;
}

/**
 * Convert array of Recommendations to QualityIssues
 *
 * Filters out non-auto-fixable recommendations unless includeAll is true.
 *
 * @param recommendations - Recommendations from refactor analysis
 * @param options - Conversion options
 * @returns Array of QualityIssue for fix command
 */
export function adaptRecommendationsToIssues(
  recommendations: Recommendation[],
  options: { includeAll?: boolean } = {},
): QualityIssue[] {
  const { includeAll = false } = options;

  // Filter to auto-fixable unless includeAll
  const filtered = includeAll ? recommendations : recommendations.filter((r) => r.autoFixable);

  // Convert each recommendation
  return filtered.map(adaptRecommendation);
}

/**
 * Group recommendations by fixerId
 *
 * Useful for batching fixes by fixer type.
 */
export function groupByFixer(recommendations: Recommendation[]): Map<string, Recommendation[]> {
  const groups = new Map<string, Recommendation[]>();

  for (const rec of recommendations) {
    const fixerId = FIXER_MAP[rec.category] ?? 'refine';
    const existing = groups.get(fixerId) ?? [];
    existing.push(rec);
    groups.set(fixerId, existing);
  }

  return groups;
}

/**
 * Get statistics about recommendations
 */
export function getRecommendationStats(recommendations: Recommendation[]): {
  total: number;
  autoFixable: number;
  byCategory: Record<string, number>;
  byFixer: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byFixer: Record<string, number> = {};

  for (const rec of recommendations) {
    // Count by category
    byCategory[rec.category] = (byCategory[rec.category] ?? 0) + 1;

    // Count by fixer
    const fixerId = FIXER_MAP[rec.category] ?? 'refine';
    byFixer[fixerId] = (byFixer[fixerId] ?? 0) + 1;
  }

  return {
    total: recommendations.length,
    autoFixable: recommendations.filter((r) => r.autoFixable).length,
    byCategory,
    byFixer,
  };
}
