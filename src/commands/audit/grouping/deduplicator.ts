/**
 * @module commands/audit/grouping/deduplicator
 * @description Removes duplicate issues from audit results
 *
 * Deduplicates issues that have the same:
 * - File path
 * - Line number
 * - Message content
 *
 * This prevents the same issue from appearing multiple times in the output,
 * which can happen when multiple analyzers detect the same problem.
 */

import type { EnrichedIssue } from '../../../lib/@reporter/types';
import type { QualityIssue } from '../../fix/core';

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Generate a unique key for an issue
 *
 * The key combines file path, line number, and message to create
 * a unique identifier for deduplication purposes.
 *
 * @param issue - The quality issue to generate a key for
 * @returns A unique string key for the issue
 */
function getIssueKey(issue: QualityIssue): string {
  const line = issue.line ?? 0;
  // Normalize message by trimming and lowercasing for consistent comparison
  const normalizedMessage = issue.message.trim().toLowerCase();
  return `${issue.file}:${line}:${normalizedMessage}`;
}

/**
 * Deduplicate raw quality issues
 *
 * Removes exact duplicates where file, line, and message match.
 * Keeps the first occurrence of each unique issue.
 *
 * @param issues - Array of quality issues to deduplicate
 * @returns Deduplicated array of issues
 *
 * @example
 * const issues = [
 *   { file: 'a.ts', line: 10, message: 'Using any', ... },
 *   { file: 'a.ts', line: 10, message: 'Using any', ... }, // duplicate
 *   { file: 'b.ts', line: 5, message: 'Using any', ... },  // different file
 * ];
 * const unique = deduplicateIssues(issues);
 * // Returns 2 issues (duplicate removed)
 */
export function deduplicateIssues(issues: QualityIssue[]): QualityIssue[] {
  const seen = new Set<string>();
  const result: QualityIssue[] = [];

  for (const issue of issues) {
    const key = getIssueKey(issue);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(issue);
    }
  }

  return result;
}

/**
 * Deduplicate enriched issues
 *
 * Same as deduplicateIssues but works with EnrichedIssue objects.
 * Preserves the first occurrence with its enrichment data.
 *
 * @param enrichedIssues - Array of enriched issues to deduplicate
 * @returns Deduplicated array of enriched issues
 */
export function deduplicateEnrichedIssues(enrichedIssues: EnrichedIssue[]): EnrichedIssue[] {
  const seen = new Set<string>();
  const result: EnrichedIssue[] = [];

  for (const enriched of enrichedIssues) {
    const key = getIssueKey(enriched.issue);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(enriched);
    }
  }

  return result;
}

/**
 * Count duplicates in an issue array
 *
 * Returns the number of duplicate issues that would be removed
 * by deduplication. Useful for reporting statistics.
 *
 * @param issues - Array of quality issues
 * @returns Number of duplicate issues
 */
export function countDuplicates(issues: QualityIssue[]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const issue of issues) {
    const key = getIssueKey(issue);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

/**
 * Find duplicate groups
 *
 * Returns groups of issues that have the same key (duplicates of each other).
 * Useful for understanding duplication patterns.
 *
 * @param issues - Array of quality issues
 * @returns Map of issue key to array of duplicate issues
 */
export function findDuplicateGroups(issues: QualityIssue[]): Map<string, QualityIssue[]> {
  const groups = new Map<string, QualityIssue[]>();

  for (const issue of issues) {
    const key = getIssueKey(issue);
    const group = groups.get(key) ?? [];
    group.push(issue);
    groups.set(key, group);
  }

  // Filter to only groups with more than 1 issue (actual duplicates)
  const duplicates = new Map<string, QualityIssue[]>();
  for (const [key, group] of groups) {
    if (group.length > 1) {
      duplicates.set(key, group);
    }
  }

  return duplicates;
}
