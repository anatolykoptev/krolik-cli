/**
 * @module commands/audit/impact/git-history
 * @description Git history analysis for impact scoring
 *
 * Analyzes git history to identify:
 * - Bug-fix commits (messages containing fix, bug, hotfix, patch)
 * - Change frequency (commits per file)
 * - Hot files (most frequently changed)
 *
 * Reuses @vcs/git for underlying git operations.
 */

import { execLines, shellOpts, tryExec } from '../../../lib/@core/shell';
import { escapeShellArg } from '../../../lib/@security';
import { isGitRepo } from '../../../lib/@vcs';
import type { GitHistoryAnalysis } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default analysis period in days */
export const DEFAULT_PERIOD_DAYS = 30;

/** Bug-fix commit message patterns (case-insensitive) */
const BUG_FIX_PATTERNS = [
  'fix',
  'bug',
  'hotfix',
  'patch',
  'repair',
  'resolve',
  'issue',
  'crash',
  'error',
  'broken',
];

/** Feature commit message patterns (case-insensitive) */
const FEATURE_PATTERNS = ['feat', 'add', 'new', 'implement', 'create', 'introduce'];

// ============================================================================
// COMMIT FETCHING
// ============================================================================

/**
 * Commit information for analysis
 */
export interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  files: string[];
}

/**
 * Get commits for a specific file within a time period
 *
 * @param projectRoot - Project root directory
 * @param file - File path (relative to project root)
 * @param days - Number of days to look back
 */
export function getFileCommits(projectRoot: string, file: string, days: number): CommitInfo[] {
  if (!isGitRepo(projectRoot)) {
    return [];
  }

  const since = `${days} days ago`;
  const escapedFile = escapeShellArg(file);

  // Get commits with hash, message, and date
  const result = tryExec(
    `git log --since="${since}" --pretty=format:"%H|%s|%ad" --date=short -- ${escapedFile}`,
    shellOpts(projectRoot),
  );

  if (!result.success || !result.output) {
    return [];
  }

  return result.output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, date] = line.split('|');
      return {
        hash: hash ?? '',
        message: message ?? '',
        date: date ?? '',
        files: [file],
      };
    });
}

/**
 * Get all commits in a project within a time period
 *
 * @param projectRoot - Project root directory
 * @param days - Number of days to look back
 */
export function getAllCommits(projectRoot: string, days: number): CommitInfo[] {
  if (!isGitRepo(projectRoot)) {
    return [];
  }

  const since = `${days} days ago`;

  // Get commits with file changes
  const lines = execLines(
    `git log --since="${since}" --pretty=format:"%H|%s|%ad" --date=short --name-only`,
    shellOpts(projectRoot),
  );

  const commits: CommitInfo[] = [];
  let current: CommitInfo | null = null;

  for (const line of lines) {
    if (line.includes('|')) {
      // New commit header
      if (current) {
        commits.push(current);
      }
      const [hash, message, date] = line.split('|');
      current = {
        hash: hash ?? '',
        message: message ?? '',
        date: date ?? '',
        files: [],
      };
    } else if (current && line.trim()) {
      // File path
      current.files.push(line.trim());
    }
  }

  if (current) {
    commits.push(current);
  }

  return commits;
}

// ============================================================================
// COMMIT CLASSIFICATION
// ============================================================================

/**
 * Check if a commit message indicates a bug fix
 */
export function isBugFixCommit(message: string): boolean {
  const lower = message.toLowerCase();
  return BUG_FIX_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Check if a commit message indicates a feature
 */
export function isFeatureCommit(message: string): boolean {
  const lower = message.toLowerCase();
  return FEATURE_PATTERNS.some((pattern) => lower.includes(pattern));
}

// ============================================================================
// FILE ANALYSIS
// ============================================================================

/**
 * Analyze git history for a single file
 *
 * @param projectRoot - Project root directory
 * @param file - File path (relative to project root)
 * @param days - Number of days to look back
 */
export function analyzeFileHistory(
  projectRoot: string,
  file: string,
  days: number = DEFAULT_PERIOD_DAYS,
): GitHistoryAnalysis {
  const commits = getFileCommits(projectRoot, file, days);

  const bugFixCommits = commits.filter((c) => isBugFixCommit(c.message)).length;
  const featureCommits = commits.filter((c) => isFeatureCommit(c.message)).length;

  return {
    file,
    totalCommits: commits.length,
    bugFixCommits,
    featureCommits,
    periodDays: days,
    changeRank: '', // Will be calculated in batch analysis
  };
}

/**
 * Analyze git history for multiple files
 *
 * @param projectRoot - Project root directory
 * @param files - File paths (relative to project root)
 * @param days - Number of days to look back
 */
export function analyzeFilesHistory(
  projectRoot: string,
  files: string[],
  days: number = DEFAULT_PERIOD_DAYS,
): Map<string, GitHistoryAnalysis> {
  const results = new Map<string, GitHistoryAnalysis>();

  // Get all commits once for efficiency
  const allCommits = getAllCommits(projectRoot, days);

  // Build file -> commit count map
  const fileCommitCounts = new Map<string, CommitInfo[]>();
  for (const commit of allCommits) {
    for (const file of commit.files) {
      if (!fileCommitCounts.has(file)) {
        fileCommitCounts.set(file, []);
      }
      fileCommitCounts.get(file)!.push(commit);
    }
  }

  // Calculate change rank percentiles
  const allCounts = [...fileCommitCounts.values()].map((c) => c.length);
  allCounts.sort((a, b) => a - b);

  // Analyze each requested file
  for (const file of files) {
    const commits = fileCommitCounts.get(file) ?? [];
    const bugFixCommits = commits.filter((c) => isBugFixCommit(c.message)).length;
    const featureCommits = commits.filter((c) => isFeatureCommit(c.message)).length;

    // Calculate percentile rank
    const rank = calculatePercentile(commits.length, allCounts);

    results.set(file, {
      file,
      totalCommits: commits.length,
      bugFixCommits,
      featureCommits,
      periodDays: days,
      changeRank: formatRank(rank),
    });
  }

  return results;
}

/**
 * Get files with most bug-fix commits (buggy files)
 *
 * @param projectRoot - Project root directory
 * @param days - Number of days to look back
 * @param limit - Maximum files to return
 */
export function getBuggyFiles(
  projectRoot: string,
  days: number = DEFAULT_PERIOD_DAYS,
  limit: number = 10,
): Array<{ file: string; bugFixCount: number }> {
  const allCommits = getAllCommits(projectRoot, days);

  // Count bug-fix commits per file
  const fileBugCounts = new Map<string, number>();
  for (const commit of allCommits) {
    if (isBugFixCommit(commit.message)) {
      for (const file of commit.files) {
        fileBugCounts.set(file, (fileBugCounts.get(file) ?? 0) + 1);
      }
    }
  }

  // Sort by bug-fix count
  return [...fileBugCounts.entries()]
    .map(([file, bugFixCount]) => ({ file, bugFixCount }))
    .sort((a, b) => b.bugFixCount - a.bugFixCount)
    .slice(0, limit);
}

/**
 * Get hot files (most frequently changed)
 *
 * @param projectRoot - Project root directory
 * @param days - Number of days to look back
 * @param limit - Maximum files to return
 */
export function getHotFiles(
  projectRoot: string,
  days: number = DEFAULT_PERIOD_DAYS,
  limit: number = 10,
): Array<{ file: string; commitCount: number; percentile: number }> {
  const allCommits = getAllCommits(projectRoot, days);

  // Count commits per file
  const fileCommitCounts = new Map<string, number>();
  for (const commit of allCommits) {
    for (const file of commit.files) {
      fileCommitCounts.set(file, (fileCommitCounts.get(file) ?? 0) + 1);
    }
  }

  // Calculate percentiles
  const allCounts = [...fileCommitCounts.values()].sort((a, b) => a - b);

  // Sort by commit count and add percentile
  return [...fileCommitCounts.entries()]
    .map(([file, commitCount]) => ({
      file,
      commitCount,
      percentile: calculatePercentile(commitCount, allCounts),
    }))
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, limit);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate percentile for a value in a distribution
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const rank = sortedValues.filter((v) => v < value).length;
  return Math.round((rank / sortedValues.length) * 100);
}

/**
 * Format percentile as human-readable rank
 */
function formatRank(percentile: number): string {
  if (percentile >= 95) return 'top-5%';
  if (percentile >= 90) return 'top-10%';
  if (percentile >= 80) return 'top-20%';
  if (percentile >= 50) return 'top-50%';
  return 'bottom-50%';
}
