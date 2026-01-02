/**
 * @module commands/audit/grouping/issue-clustering
 * @description Clusters related issues by file and root cause
 *
 * Transforms a flat list of issues into clusters for more efficient processing.
 * A cluster groups issues that:
 * - Are in the same file
 * - Have the same category
 * - Share a common root cause pattern
 *
 * @example
 * ```typescript
 * import { clusterIssues } from './issue-clustering';
 *
 * const clusters = clusterIssues(enrichedIssues);
 * // Returns IssueCluster[] with grouped issues
 * ```
 */

import { groupBy } from '@/lib/@core';
import { normalizePath } from '../../fix/reporter/grouping';
import type { EnrichedIssue, IssuePatternId } from '../../fix/reporter/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A cluster of related issues in the same file with the same category
 */
export interface IssueCluster {
  /** Normalized file path */
  file: string;
  /** Issue category (e.g., 'type-safety', 'lint') */
  category: string;
  /** Number of issues in this cluster */
  count: number;
  /** Line numbers where issues occur */
  locations: number[];
  /** Detected root cause pattern */
  rootCause: string;
  /** Whether issues can be fixed together in one operation */
  fixTogether: boolean;
  /** Suggested approach for fixing */
  suggestedApproach: string;
  /** Original issues (for access to full data) */
  issues: EnrichedIssue[];
}

/**
 * Result of clustering operation
 */
export interface ClusteringResult {
  /** Clusters with 3+ issues (worth grouping) */
  clusters: IssueCluster[];
  /** Individual issues that didn't form clusters */
  unclustered: EnrichedIssue[];
  /** Statistics about clustering */
  stats: {
    totalIssues: number;
    clusteredIssues: number;
    unclusteredIssues: number;
    clusterCount: number;
  };
}

// ============================================================================
// ROOT CAUSE DETECTION
// ============================================================================

/**
 * Root cause patterns with their detection logic and suggested fixes
 */
const ROOT_CAUSE_PATTERNS: Array<{
  pattern: IssuePatternId;
  detect: (issues: EnrichedIssue[]) => boolean;
  rootCause: string;
  suggestedApproach: string;
  fixTogether: boolean;
}> = [
  {
    pattern: 'any-usage',
    detect: (issues) => issues.every((i) => i.issue.message.toLowerCase().includes('any')),
    rootCause: 'Functions lack proper generic types',
    suggestedApproach: 'Add generic type parameters to functions or use unknown with type guards',
    fixTogether: true,
  },
  {
    pattern: 'missing-return-type',
    detect: (issues) => issues.every((i) => i.issue.message.toLowerCase().includes('return type')),
    rootCause: 'Exported functions missing explicit return types',
    suggestedApproach: 'Add explicit return type annotations to all exported functions',
    fixTogether: true,
  },
  {
    pattern: 'console-log',
    detect: (issues) => issues.every((i) => i.issue.message.toLowerCase().includes('console')),
    rootCause: 'Debug statements left in code',
    suggestedApproach: 'Remove all console statements or replace with proper logging',
    fixTogether: true,
  },
  {
    pattern: 'hardcoded-string',
    detect: (issues) =>
      issues.every(
        (i) =>
          i.issue.category === 'hardcoded' ||
          i.issue.message.toLowerCase().includes('hardcoded') ||
          i.issue.message.toLowerCase().includes('magic'),
      ),
    rootCause: 'Magic values scattered throughout code',
    suggestedApproach: 'Extract to constants file or environment variables',
    fixTogether: false, // Need to decide names individually
  },
  {
    pattern: 'ts-ignore',
    detect: (issues) =>
      issues.every(
        (i) =>
          i.issue.message.toLowerCase().includes('@ts-ignore') ||
          i.issue.message.toLowerCase().includes('@ts-nocheck'),
      ),
    rootCause: 'Type errors suppressed instead of fixed',
    suggestedApproach: 'Fix underlying type issues and remove suppressions',
    fixTogether: false, // Each needs individual analysis
  },
  {
    pattern: 'i18n-hardcoded',
    detect: (issues) => issues.every((i) => i.issue.category === 'i18n'),
    rootCause: 'User-facing text not internationalized',
    suggestedApproach: 'Extract strings to translation keys using t() function',
    fixTogether: true,
  },
  {
    pattern: 'high-complexity',
    detect: (issues) =>
      issues.every(
        (i) =>
          i.issue.category === 'complexity' || i.issue.message.toLowerCase().includes('complexity'),
      ),
    rootCause: 'Functions with high cyclomatic complexity',
    suggestedApproach: 'Extract helper functions and simplify control flow',
    fixTogether: false, // Each function needs individual refactoring
  },
];

/**
 * Detect root cause pattern for a group of issues
 */
function detectRootCause(issues: EnrichedIssue[]): {
  rootCause: string;
  suggestedApproach: string;
  fixTogether: boolean;
} {
  // Try to match against known patterns
  for (const pattern of ROOT_CAUSE_PATTERNS) {
    if (pattern.detect(issues)) {
      return {
        rootCause: pattern.rootCause,
        suggestedApproach: pattern.suggestedApproach,
        fixTogether: pattern.fixTogether,
      };
    }
  }

  // Default fallback based on category
  const categories = new Set(issues.map((i) => i.issue.category));
  if (categories.size === 1) {
    const category = [...categories][0];
    return {
      rootCause: `Multiple ${category} issues in file`,
      suggestedApproach: `Address all ${category} issues systematically`,
      fixTogether: false,
    };
  }

  return {
    rootCause: 'Mixed issue types in file',
    suggestedApproach: 'Address issues by priority',
    fixTogether: false,
  };
}

// ============================================================================
// CLUSTERING LOGIC
// ============================================================================

/**
 * Create a cluster from a group of issues
 */
function createCluster(file: string, category: string, issues: EnrichedIssue[]): IssueCluster {
  const { rootCause, suggestedApproach, fixTogether } = detectRootCause(issues);

  // Extract line numbers, filtering out undefined
  const locations = issues
    .map((i) => i.issue.line)
    .filter((line): line is number => line !== undefined)
    .sort((a, b) => a - b);

  return {
    file,
    category,
    count: issues.length,
    locations,
    rootCause,
    fixTogether,
    suggestedApproach,
    issues,
  };
}

/**
 * Generate a clustering key for an issue
 * Groups by normalized file path and category
 */
function getClusterKey(issue: EnrichedIssue): string {
  const file = normalizePath(issue.issue.file);
  return `${file}:${issue.issue.category}`;
}

/**
 * Cluster issues by file and category
 *
 * Groups related issues that can be addressed together.
 * Only creates clusters for 3+ issues in the same file with the same category.
 *
 * @param issues - Array of enriched issues to cluster
 * @param minClusterSize - Minimum issues to form a cluster (default: 3)
 * @returns ClusteringResult with clusters and unclustered issues
 */
export function clusterIssues(issues: EnrichedIssue[], minClusterSize = 3): ClusteringResult {
  // Group by file:category
  const grouped = groupBy(issues, getClusterKey);

  const clusters: IssueCluster[] = [];
  const unclustered: EnrichedIssue[] = [];

  for (const [key, groupIssues] of grouped) {
    if (groupIssues.length >= minClusterSize) {
      // Extract file and category from key
      const lastColonIdx = key.lastIndexOf(':');
      const file = key.substring(0, lastColonIdx);
      const category = key.substring(lastColonIdx + 1);

      clusters.push(createCluster(file, category, groupIssues));
    } else {
      unclustered.push(...groupIssues);
    }
  }

  // Sort clusters by count (largest first)
  clusters.sort((a, b) => b.count - a.count);

  const clusteredIssues = clusters.reduce((sum, c) => sum + c.count, 0);

  return {
    clusters,
    unclustered,
    stats: {
      totalIssues: issues.length,
      clusteredIssues,
      unclusteredIssues: unclustered.length,
      clusterCount: clusters.length,
    },
  };
}

/**
 * Cluster issues by root cause pattern across files
 *
 * Groups issues that share the same root cause regardless of file.
 * Useful for batch operations like "fix all any types".
 *
 * @param issues - Array of enriched issues to cluster
 * @returns Map of root cause to clusters
 */
export function clusterByRootCause(issues: EnrichedIssue[]): Map<string, IssueCluster[]> {
  // First cluster by file:category
  const { clusters } = clusterIssues(issues, 1);

  // Group clusters by root cause
  const byRootCause = new Map<string, IssueCluster[]>();

  for (const cluster of clusters) {
    const existing = byRootCause.get(cluster.rootCause) ?? [];
    existing.push(cluster);
    byRootCause.set(cluster.rootCause, existing);
  }

  return byRootCause;
}

/**
 * Get clustering summary statistics
 */
export function getClusteringSummary(result: ClusteringResult): {
  clustersFormed: number;
  issuesClustered: number;
  issuesUnclustered: number;
  avgClusterSize: number;
  largestCluster: number;
  fixTogetherCount: number;
} {
  const { clusters, stats } = result;

  return {
    clustersFormed: stats.clusterCount,
    issuesClustered: stats.clusteredIssues,
    issuesUnclustered: stats.unclusteredIssues,
    avgClusterSize:
      stats.clusterCount > 0 ? Math.round(stats.clusteredIssues / stats.clusterCount) : 0,
    largestCluster: clusters.length > 0 ? Math.max(...clusters.map((c) => c.count)) : 0,
    fixTogetherCount: clusters.filter((c) => c.fixTogether).length,
  };
}
