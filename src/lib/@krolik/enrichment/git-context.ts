/**
 * @module commands/audit/enrichment/git-context
 * @description Git context enrichment for audit issues
 *
 * Provides git history context to show why an issue matters:
 * - Recent bug fixes indicate areas with recurring problems
 * - Change frequency indicates hotspots
 * - Author information shows who to consult
 *
 * Reuses existing git-history.ts functions from impact module.
 */

import { DEFAULT_PERIOD_DAYS, isBugFixCommit } from '../../../commands/audit/impact/git-history';
import { execLines, shellOpts, tryExec } from '../../../lib/@core/shell';
import { escapeXml } from '../../../lib/@core/xml/escape';
import { escapeShellArg } from '../../../lib/@security';
import { isGitRepo } from '../../../lib/@vcs';
import type { BugFixCommit, GitContext, GitContextCacheEntry, GitContextOptions } from './types';

// ============================================================================
// CACHE
// ============================================================================

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Cache for git context by file path */
const contextCache = new Map<string, GitContextCacheEntry>();

/** Cache for all file change counts (expensive operation) */
interface ChangeCountsCache {
  counts: Map<string, number>;
  cachedAt: number;
  key: string; // projectRoot:days
}
let changeCountsCache: ChangeCountsCache | null = null;

/**
 * Clear the git context cache
 */
export function clearGitContextCache(): void {
  contextCache.clear();
  changeCountsCache = null;
}

/**
 * Get cache key for a file
 */
function getCacheKey(file: string, projectRoot: string): string {
  return `${projectRoot}:${file}`;
}

// ============================================================================
// COMMIT FETCHING WITH AUTHORS
// ============================================================================

/**
 * Commit information with author
 */
interface CommitWithAuthor {
  hash: string;
  message: string;
  date: string;
  author: string;
}

/**
 * Get commits for a file with author information
 */
function getFileCommitsWithAuthors(
  projectRoot: string,
  file: string,
  days: number,
): CommitWithAuthor[] {
  if (!isGitRepo(projectRoot)) {
    return [];
  }

  const since = `${days} days ago`;
  const escapedFile = escapeShellArg(file);

  // Get commits with hash, message, date, and author
  const result = tryExec(
    `git log --since="${since}" --pretty=format:"%h|%s|%ad|%an" --date=short -- ${escapedFile}`,
    shellOpts(projectRoot),
  );

  if (!result.success || !result.output) {
    return [];
  }

  return result.output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] ?? '',
        message: parts[1] ?? '',
        date: parts[2] ?? '',
        author: parts[3] ?? '',
      };
    });
}

/**
 * Get the last modified date for a file
 */
function getLastModifiedDate(projectRoot: string, file: string): string {
  const escapedFile = escapeShellArg(file);
  const result = tryExec(
    `git log -1 --pretty=format:"%ad" --date=short -- ${escapedFile}`,
    shellOpts(projectRoot),
  );

  if (!result.success || !result.output) {
    return new Date().toISOString().split('T')[0] ?? '';
  }

  return result.output;
}

/**
 * Get total change count for all files in project (for hotspot detection)
 * CACHED: This is an expensive operation, cached with TTL
 */
function getAllFileChangeCounts(projectRoot: string, days: number): Map<string, number> {
  const cacheKey = `${projectRoot}:${days}`;
  const now = Date.now();

  // Check cache
  if (
    changeCountsCache &&
    changeCountsCache.key === cacheKey &&
    now - changeCountsCache.cachedAt < CACHE_TTL_MS
  ) {
    return changeCountsCache.counts;
  }

  const lines = execLines(
    `git log --since="${days} days ago" --pretty=format: --name-only | sort | uniq -c | sort -rn`,
    shellOpts(projectRoot),
  );

  const counts = new Map<string, number>();

  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (match) {
      const count = parseInt(match[1] ?? '0', 10);
      const file = match[2] ?? '';
      if (file) {
        counts.set(file, count);
      }
    }
  }

  // Cache the result
  changeCountsCache = { counts, cachedAt: now, key: cacheKey };

  return counts;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get git context for a file
 *
 * Provides historical context to help prioritize issues:
 * - Files with many bug fixes need careful handling
 * - Frequently changed files are hotspots
 * - Related bug commits show patterns
 *
 * Results are cached for 5 minutes to avoid repeated git calls.
 *
 * @param file - File path (relative to project root)
 * @param options - Git context options
 * @returns Git context for the file
 *
 * @example
 * ```ts
 * const context = getGitContext('src/utils.ts', {
 *   projectRoot: '/path/to/project',
 *   periodDays: 30,
 * });
 *
 * if (context.isHotspot) {
 *   console.log('This file changes frequently!');
 * }
 *
 * if (context.recentBugFixes > 3) {
 *   console.log('High bug frequency - careful refactoring needed');
 * }
 * ```
 */
export function getGitContext(file: string, options: GitContextOptions): GitContext {
  const {
    projectRoot,
    periodDays = DEFAULT_PERIOD_DAYS,
    hotspotThreshold = 80,
    bugWarningThreshold = 3,
  } = options;

  // Check cache
  const cacheKey = getCacheKey(file, projectRoot);
  const cached = contextCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.context;
  }

  // Not in git repo - return empty context
  if (!isGitRepo(projectRoot)) {
    const emptyContext: GitContext = {
      recentBugFixes: 0,
      totalChanges: 0,
      lastModified: '',
      authors: [],
      isHotspot: false,
      relatedBugs: [],
    };
    return emptyContext;
  }

  // Get commits with authors
  const commits = getFileCommitsWithAuthors(projectRoot, file, periodDays);

  // Extract bug-fix commits
  const bugFixCommits: BugFixCommit[] = commits
    .filter((c) => isBugFixCommit(c.message))
    .map((c) => ({
      hash: c.hash,
      message: c.message,
      date: c.date,
    }));

  // Get unique authors
  const authors = Array.from(new Set(commits.map((c) => c.author))).filter(Boolean);

  // Get last modified date
  const lastModified = getLastModifiedDate(projectRoot, file);

  // Determine if hotspot
  const allChangeCounts = getAllFileChangeCounts(projectRoot, periodDays);
  const fileChangeCount = commits.length;
  const allCounts = Array.from(allChangeCounts.values()).sort((a, b) => a - b);
  const percentile = calculatePercentile(fileChangeCount, allCounts);
  const isHotspot = percentile >= hotspotThreshold;

  // Generate warning if needed
  let warning: string | undefined;
  if (bugFixCommits.length >= bugWarningThreshold) {
    warning = 'High bug frequency - careful refactoring needed';
  } else if (isHotspot && bugFixCommits.length > 0) {
    warning = 'Hotspot with bug history - review changes carefully';
  }

  const context: GitContext = {
    recentBugFixes: bugFixCommits.length,
    totalChanges: commits.length,
    lastModified,
    authors,
    isHotspot,
    relatedBugs: bugFixCommits.slice(0, 5), // Limit to 5 most recent
    ...(warning && { warning }),
  };

  // Cache the result
  contextCache.set(cacheKey, { context, cachedAt: now });

  return context;
}

/**
 * Calculate percentile for a value in a sorted array
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const rank = sortedValues.filter((v) => v < value).length;
  return Math.round((rank / sortedValues.length) * 100);
}

// ============================================================================
// XML FORMATTING
// ============================================================================

/**
 * Format git context as XML
 *
 * @param context - Git context to format
 * @param indent - Number of spaces to indent (default: 0)
 * @returns Array of XML lines
 *
 * @example
 * ```xml
 * <git-context hotspot="true">
 *   <changes last-30d="8" bug-fixes="3"/>
 *   <last-modified>2025-12-15</last-modified>
 *   <authors>alice, bob</authors>
 *   <evidence>
 *     <commit hash="abc123">fix: slot calculation edge case</commit>
 *     <commit hash="def456">fix: timezone handling in slots</commit>
 *   </evidence>
 *   <warning>High bug frequency - careful refactoring needed</warning>
 * </git-context>
 * ```
 */
export function formatGitContextXml(context: GitContext, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  lines.push(`${pad}<git-context hotspot="${context.isHotspot}">`);
  lines.push(
    `${pad}  <changes last-30d="${context.totalChanges}" bug-fixes="${context.recentBugFixes}"/>`,
  );

  if (context.lastModified) {
    lines.push(`${pad}  <last-modified>${context.lastModified}</last-modified>`);
  }

  if (context.authors.length > 0) {
    lines.push(`${pad}  <authors>${context.authors.join(', ')}</authors>`);
  }

  if (context.relatedBugs.length > 0) {
    lines.push(`${pad}  <evidence>`);
    for (const bug of context.relatedBugs) {
      // Escape XML special characters in message
      const escapedMessage = escapeXml(bug.message);
      lines.push(`${pad}    <commit hash="${bug.hash}">${escapedMessage}</commit>`);
    }
    lines.push(`${pad}  </evidence>`);
  }

  if (context.warning) {
    lines.push(`${pad}  <warning>${escapeXml(context.warning)}</warning>`);
  }

  lines.push(`${pad}</git-context>`);

  return lines;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Get git context for multiple files efficiently
 *
 * More efficient than calling getGitContext repeatedly as it
 * fetches all file change counts once.
 *
 * @param files - File paths (relative to project root)
 * @param options - Git context options
 * @returns Map of file path to git context
 */
export function getGitContextBatch(
  files: string[],
  options: GitContextOptions,
): Map<string, GitContext> {
  const results = new Map<string, GitContext>();

  for (const file of files) {
    results.set(file, getGitContext(file, options));
  }

  return results;
}

/**
 * Check if an issue should have git context attached
 *
 * Git context is attached for:
 * - Issues with complexity > 15 (complex code needs history context)
 * - Issues with critical priority (high-risk changes)
 * - Issues in hotspot files (frequently changed)
 *
 * @param complexity - Cyclomatic complexity score (if available)
 * @param priority - Issue priority level
 * @param isHotspot - Whether the file is a hotspot
 * @returns Whether to attach git context
 */
export function shouldAttachGitContext(
  complexity: number | undefined,
  priority: 'critical' | 'high' | 'medium' | 'low',
  isHotspot: boolean,
): boolean {
  // Complex code needs history context
  if (complexity !== undefined && complexity > 15) {
    return true;
  }

  // Critical issues always get context
  if (priority === 'critical') {
    return true;
  }

  // Hotspots get context for high priority issues
  if (isHotspot && priority === 'high') {
    return true;
  }

  return false;
}
