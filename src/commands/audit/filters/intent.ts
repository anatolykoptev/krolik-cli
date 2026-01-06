/**
 * @module commands/audit/filters/intent
 * @description Intent-based filtering for audit issues
 *
 * Filters issues by:
 * - Feature/domain (e.g., --feature booking)
 * - Mode (e.g., --mode release, --mode refactor)
 *
 * Reuses matchesDomain() from context/collectors/entrypoints
 */

import { matchesDomain } from '@/commands/context/collectors/entrypoints';
import type { QualityCategory, QualityIssue } from '@/commands/fix/core';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Audit mode determines which categories are relevant
 */
export type AuditMode =
  | 'all'
  | 'release'
  | 'refactor'
  | 'hardcoded'
  | 'lint'
  | 'types'
  | 'security'
  | 'pre-commit'
  | 'queries';

/**
 * Intent configuration for filtering
 */
export interface AuditIntent {
  /** Audit mode (determines category filter) */
  mode: AuditMode;
  /** Feature/domain to filter by (e.g., "booking", "auth") */
  feature?: string;
  /** Override categories (takes precedence over mode) */
  categories?: QualityCategory[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Categories relevant to each audit mode
 *
 * - all: No category filter (show everything)
 * - release: Issues that could cause production bugs
 * - refactor: Issues about code structure/maintainability
 * - hardcoded: Hardcoded strings, magic numbers, URLs, colors
 * - lint: Console.log, debugger, alert - 100% auto-fixable
 * - types: Type-safety issues (any, ts-ignore)
 * - security: Security vulnerabilities only
 * - pre-commit: Combined check before committing
 * - queries: Duplicate database/API queries
 */
const MODE_CATEGORIES: Record<AuditMode, QualityCategory[]> = {
  all: [], // Empty = no filtering
  release: ['security', 'type-safety', 'circular-dep'],
  refactor: ['complexity', 'srp', 'mixed-concerns', 'size'],
  hardcoded: ['hardcoded', 'i18n'],
  lint: ['lint'],
  types: ['type-safety'],
  security: ['security'],
  'pre-commit': ['lint', 'security', 'type-safety'],
  queries: ['duplicate-query'],
};

// ============================================================================
// MAIN FILTER
// ============================================================================

/**
 * Filter issues by intent (feature and/or mode)
 *
 * @param issues - Array of quality issues to filter
 * @param intent - Intent configuration
 * @returns Filtered issues
 *
 * @example
 * ```ts
 * // Filter to booking feature only
 * filterByIntent(issues, { mode: 'all', feature: 'booking' });
 *
 * // Filter to release-critical categories
 * filterByIntent(issues, { mode: 'release' });
 *
 * // Combine feature + mode
 * filterByIntent(issues, { mode: 'release', feature: 'booking' });
 * ```
 */
export function filterByIntent(issues: QualityIssue[], intent: AuditIntent): QualityIssue[] {
  let filtered = issues;

  // 1. Filter by feature (domain matching on file path)
  if (intent.feature) {
    filtered = filtered.filter((issue) => matchesDomain(issue.file, [intent.feature!]));
  }

  // 2. Filter by mode categories (or override categories)
  const categories = intent.categories ?? MODE_CATEGORIES[intent.mode];
  if (categories.length > 0) {
    filtered = filtered.filter((issue) => categories.includes(issue.category));
  }

  return filtered;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse intent from CLI options
 *
 * @param options - CLI options object
 * @returns AuditIntent or null if no intent filtering needed
 */
export function parseIntent(options: {
  feature?: string | undefined;
  mode?: string | undefined;
}): AuditIntent | null {
  const hasFeature = Boolean(options.feature);
  const hasMode = Boolean(options.mode) && options.mode !== 'all';

  if (!hasFeature && !hasMode) {
    return null;
  }

  // Validate mode
  const mode = validateMode(options.mode);

  return {
    mode,
    ...(options.feature && { feature: options.feature }),
  };
}

/**
 * Validate and normalize mode string
 */
function validateMode(mode?: string): AuditMode {
  if (!mode || mode === 'all') return 'all';

  const validModes: AuditMode[] = [
    'release',
    'refactor',
    'hardcoded',
    'lint',
    'types',
    'security',
    'pre-commit',
    'queries',
  ];

  if (validModes.includes(mode as AuditMode)) {
    return mode as AuditMode;
  }

  // Invalid mode, default to 'all'
  return 'all';
}

/**
 * Get available modes for CLI help
 */
export function getAvailableModes(): string[] {
  return Object.keys(MODE_CATEGORIES);
}

/**
 * Get categories for a given mode
 */
export function getCategoriesForMode(mode: AuditMode): QualityCategory[] {
  return MODE_CATEGORIES[mode];
}
