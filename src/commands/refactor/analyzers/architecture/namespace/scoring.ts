/**
 * @module commands/refactor/analyzers/architecture/namespace/scoring
 * @description Namespace scoring and categorization logic
 */

import { NAMESPACE_KEYWORDS } from '../../../core/constants';
import type { DirectoryInfo, NamespaceCategory } from '../../../core/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_PRIORITY: NamespaceCategory[] = [
  'core',
  'domain',
  'integrations',
  'ui',
  'utils',
  'seo',
];

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function matchesCategory(name: string, category: NamespaceCategory): boolean {
  const keywords = NAMESPACE_KEYWORDS[category] || [];
  return keywords.some((keyword) => name.includes(keyword));
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Detect category from name and subdirectories
 */
export function detectNamespaceCategory(name: string, subdirs: string[]): NamespaceCategory {
  const lowerName = name.toLowerCase().replace(/^@/, '');
  const lowerSubdirs = subdirs.map((s) => s.toLowerCase().replace(/^@/, ''));

  // Priority 1: Exact match
  for (const category of CATEGORY_PRIORITY) {
    if (lowerName === category) {
      return category;
    }
  }

  // Priority 2: Keyword match in name
  for (const category of CATEGORY_PRIORITY) {
    if (matchesCategory(lowerName, category)) {
      return category;
    }
  }

  // Priority 3: Keyword match in subdirs
  for (const category of CATEGORY_PRIORITY) {
    if (lowerSubdirs.some((subdir) => matchesCategory(subdir, category))) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * Calculate namespace organization score
 */
export function calculateNamespaceScore(directories: DirectoryInfo[]): number {
  if (directories.length === 0) return 100;
  const namespacedCount = directories.filter((d) => d.isNamespaced).length;
  return Math.round((namespacedCount / directories.length) * 100);
}
