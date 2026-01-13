/**
 * @module commands/audit/grouping/pattern-grouper
 * @description Groups issues by pattern for smart audit output
 *
 * Transforms a flat list of issues into pattern-based groups that enable
 * batch operations. For example, 23 separate "any usage" issues become
 * a single issue-group with batch-fix command.
 *
 * Pattern recognition:
 * - Analyzes issue category and message content
 * - Maps to known patterns (any-usage, console-log, etc.)
 * - Falls back to 'other' for unrecognized patterns
 *
 * @example
 * ```typescript
 * import { groupIssuesByPattern } from './pattern-grouper';
 *
 * const patterns = groupIssuesByPattern(enrichedIssues);
 * // Returns IssuePattern[] with grouped issues and batch-fix info
 * ```
 */

import { groupBy } from '@/lib/@core';
import { normalizePath } from '../../../lib/@reporter/grouping';
import type {
  BatchFixInfo,
  EnrichedIssue,
  IssuePattern,
  IssuePatternId,
  PatternFileInfo,
} from '../../../lib/@reporter/types';
import type { QualityCategory } from '../../fix/core';
import { getBatchCommand, hasBatchFix } from './batch-commands';

// ============================================================================
// PATTERN EXTRACTION
// ============================================================================

/**
 * Human-readable names for each pattern
 */
const PATTERN_NAMES: Record<IssuePatternId, string> = {
  'any-usage': 'Using `any` type',
  'console-log': 'Console statements',
  debugger: 'Debugger statements',
  alert: 'Alert calls',
  'ts-ignore': '@ts-ignore comments',
  'ts-nocheck': '@ts-nocheck comments',
  'high-complexity': 'High complexity',
  'missing-return-type': 'Missing return types',
  'hardcoded-url': 'Hardcoded URLs',
  'hardcoded-number': 'Magic numbers',
  'hardcoded-string': 'Hardcoded strings',
  'path-traversal': 'Path traversal risk',
  'command-injection': 'Command injection risk',
  'i18n-hardcoded': 'Hardcoded text (i18n)',
  other: 'Other issues',
};

/**
 * Extract pattern identifier from an issue
 *
 * Analyzes the issue message and category to determine which pattern
 * it belongs to. Uses keyword matching for reliable classification.
 *
 * @param issue - The enriched issue to classify
 * @returns The pattern identifier
 */
function extractPattern(issue: EnrichedIssue): IssuePatternId {
  const msg = issue.issue.message.toLowerCase();
  const category = issue.issue.category;

  // Type-safety patterns
  if (category === 'type-safety') {
    if (msg.includes('any') && !msg.includes('ts-ignore')) {
      return 'any-usage';
    }
    if (msg.includes('@ts-ignore')) {
      return 'ts-ignore';
    }
    if (msg.includes('@ts-nocheck')) {
      return 'ts-nocheck';
    }
    if (msg.includes('return type')) {
      return 'missing-return-type';
    }
  }

  // Lint patterns
  if (category === 'lint') {
    if (msg.includes('console')) {
      return 'console-log';
    }
    if (msg.includes('debugger')) {
      return 'debugger';
    }
    if (msg.includes('alert')) {
      return 'alert';
    }
  }

  // Complexity patterns
  if (category === 'complexity') {
    if (msg.includes('complexity') || msg.includes('complex')) {
      return 'high-complexity';
    }
  }

  // Hardcoded patterns
  if (category === 'hardcoded') {
    if (msg.includes('url') || msg.includes('http')) {
      return 'hardcoded-url';
    }
    if (msg.includes('magic number') || msg.includes('number')) {
      return 'hardcoded-number';
    }
    return 'hardcoded-string';
  }

  // Security patterns
  if (category === 'security') {
    if (msg.includes('path traversal')) {
      return 'path-traversal';
    }
    if (msg.includes('injection') || msg.includes('command')) {
      return 'command-injection';
    }
  }

  // I18n patterns
  if (category === 'i18n') {
    return 'i18n-hardcoded';
  }

  return 'other';
}

/**
 * Generate a composite key for grouping: category:pattern
 */
function getPatternKey(issue: EnrichedIssue): string {
  const pattern = extractPattern(issue);
  return `${issue.issue.category}:${pattern}`;
}

// ============================================================================
// FILE GROUPING
// ============================================================================

/**
 * Group issues by file within a pattern
 *
 * Creates file-level summaries showing how many issues of this pattern
 * exist in each file and how many are auto-fixable.
 *
 * @param issues - Issues belonging to a single pattern
 * @returns Array of file info sorted by issue count (descending)
 */
function groupByFile(issues: EnrichedIssue[]): PatternFileInfo[] {
  const fileMap = new Map<string, { count: number; auto: number }>();

  for (const issue of issues) {
    const path = normalizePath(issue.issue.file);
    const existing = fileMap.get(path) ?? { count: 0, auto: 0 };
    existing.count++;
    if (issue.autoFixable) {
      existing.auto++;
    }
    fileMap.set(path, existing);
  }

  return Array.from(fileMap.entries())
    .map(([path, data]) => ({
      path,
      count: data.count,
      auto: data.auto,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// BATCH FIX INFO
// ============================================================================

/**
 * Build batch fix information for a pattern
 *
 * Determines if a batch fix is available and calculates statistics
 * about how many issues can be auto-fixed vs require manual work.
 *
 * @param pattern - The pattern identifier
 * @param issues - Issues belonging to this pattern
 * @returns BatchFixInfo with availability and statistics
 */
function buildBatchFixInfo(pattern: IssuePatternId, issues: EnrichedIssue[]): BatchFixInfo {
  const autoFixable = issues.filter((i) => i.autoFixable).length;
  const manualRequired = issues.length - autoFixable;

  // Get unique files
  const files = new Set(issues.map((i) => normalizePath(i.issue.file)));

  const available = hasBatchFix(pattern);
  const command = getBatchCommand(pattern);

  const result: BatchFixInfo = {
    available,
    filesAffected: files.size,
    autoFixable,
    manualRequired,
  };

  // Only add command if it exists
  if (command) {
    result.command = command;
  }

  return result;
}

// ============================================================================
// MAIN GROUPING FUNCTION
// ============================================================================

/**
 * Group enriched issues by pattern
 *
 * Transforms a flat list of issues into pattern-based groups.
 * Each pattern group includes:
 * - All issues matching the pattern
 * - Batch fix availability and command
 * - File-level breakdown
 *
 * @param issues - Array of enriched issues to group
 * @returns Array of issue patterns sorted by count (descending)
 *
 * @example
 * ```typescript
 * const patterns = groupIssuesByPattern(enrichedIssues);
 * for (const pattern of patterns) {
 *   console.log(`${pattern.patternName}: ${pattern.issues.length} issues`);
 *   if (pattern.batchFix.available) {
 *     console.log(`  Fix with: ${pattern.batchFix.command}`);
 *   }
 * }
 * ```
 */
export function groupIssuesByPattern(issues: EnrichedIssue[]): IssuePattern[] {
  // Group by composite key (category:pattern)
  const grouped = groupBy(issues, getPatternKey);

  const patterns: IssuePattern[] = [];

  for (const [key, patternIssues] of grouped) {
    const [category, patternId] = key.split(':') as [QualityCategory, IssuePatternId];

    const pattern: IssuePattern = {
      category,
      pattern: patternId,
      patternName: PATTERN_NAMES[patternId],
      issues: patternIssues,
      batchFix: buildBatchFixInfo(patternId, patternIssues),
      byFile: groupByFile(patternIssues),
    };

    patterns.push(pattern);
  }

  // Sort by issue count (largest groups first)
  return patterns.sort((a, b) => b.issues.length - a.issues.length);
}

/**
 * Get pattern summary statistics
 *
 * Returns high-level stats about the pattern grouping for reporting.
 *
 * @param patterns - Array of issue patterns
 * @returns Summary statistics
 */
export function getPatternSummary(patterns: IssuePattern[]): {
  totalPatterns: number;
  totalIssues: number;
  batchFixablePatterns: number;
  batchFixableIssues: number;
} {
  let totalIssues = 0;
  let batchFixablePatterns = 0;
  let batchFixableIssues = 0;

  for (const pattern of patterns) {
    totalIssues += pattern.issues.length;
    if (pattern.batchFix.available) {
      batchFixablePatterns++;
      batchFixableIssues += pattern.batchFix.autoFixable;
    }
  }

  return {
    totalPatterns: patterns.length,
    totalIssues,
    batchFixablePatterns,
    batchFixableIssues,
  };
}
