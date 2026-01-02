/**
 * @module commands/audit/grouping
 * @description Smart grouping for audit issues
 *
 * This module provides pattern-based issue grouping for the audit command.
 * It transforms a flat list of issues into structured groups that enable
 * batch operations and reduce noise in the output.
 *
 * Key features:
 * - Pattern recognition (any-usage, console-log, etc.)
 * - Issue clustering by file and category
 * - Deduplication of identical issues
 * - Batch fix command mapping
 * - File-level grouping within patterns
 *
 * @example
 * ```typescript
 * import {
 *   groupIssuesByPattern,
 *   clusterIssues,
 *   deduplicateEnrichedIssues,
 *   getBatchCommand,
 * } from './grouping';
 *
 * // Deduplicate first
 * const unique = deduplicateEnrichedIssues(enrichedIssues);
 *
 * // Cluster related issues
 * const { clusters, unclustered } = clusterIssues(unique);
 *
 * // Then group by pattern
 * const patterns = groupIssuesByPattern(unique);
 *
 * // Access batch fix commands
 * for (const pattern of patterns) {
 *   if (pattern.batchFix.available) {
 *     console.log(pattern.batchFix.command);
 *   }
 * }
 * ```
 */

// Batch commands
export {
  BATCH_FIXABLE_PATTERNS,
  getBatchCommand,
  getBatchCommandConfig,
  hasBatchFix,
  isSafeBatchFix,
} from './batch-commands';
// Deduplication
export {
  countDuplicates,
  deduplicateEnrichedIssues,
  deduplicateIssues,
  findDuplicateGroups,
} from './deduplicator';
// Issue clustering
export {
  type ClusteringResult,
  clusterByRootCause,
  clusterIssues,
  getClusteringSummary,
  type IssueCluster,
} from './issue-clustering';
// Pattern grouping
export { getPatternSummary, groupIssuesByPattern } from './pattern-grouper';
