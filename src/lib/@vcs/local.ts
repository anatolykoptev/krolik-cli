/**
 * @module lib/@git/local
 * @description Git operations for local project repository
 *
 * Features:
 * - Individual git commands with caching
 * - Batched getGitInfo() for efficiency (single call replaces 4-6 separate calls)
 * - 5-second TTL cache to reduce redundant git operations
 */

import { execLines, shellOpts, tryExec } from '../@core/shell';
import { escapeShellArg } from '../@security';
import type { GitAheadBehind, GitCommit, GitStatus } from './types';

// ============================================================================
// CACHE SYSTEM
// ============================================================================

const CACHE_TTL_MS = 5000; // 5 seconds

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached value or compute and cache it
 */
function getCached<T>(key: string, compute: () => T): T {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && now - entry.timestamp < CACHE_TTL_MS) {
    return entry.value;
  }

  const value = compute();
  cache.set(key, { value, timestamp: now });
  return value;
}

/**
 * Clear git cache (useful for testing or after git operations)
 */
export function clearGitCache(): void {
  cache.clear();
}

/**
 * Clear cache for specific cwd
 */
export function clearGitCacheFor(cwd: string): void {
  for (const key of cache.keys()) {
    if (key.endsWith(`:${cwd}`) || key.endsWith(':undefined')) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// BATCHED GIT INFO
// ============================================================================

/**
 * Combined git info result
 */
export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  defaultBranch: string;
  status: GitStatus;
  commits: GitCommit[];
  aheadBehind: GitAheadBehind | null;
}

/**
 * Get all common git info in one batched call
 *
 * Combines 6 separate git commands into one cached result.
 * Use this instead of calling individual functions when you need
 * multiple pieces of git information.
 *
 * @param cwd - Working directory
 * @param commitCount - Number of recent commits to fetch (default: 5)
 * @returns Combined git information
 */
export function getGitInfo(cwd?: string, commitCount = 5): GitInfo {
  const cacheKey = `gitInfo:${commitCount}:${cwd}`;

  return getCached(cacheKey, () => {
    const isRepo = isGitRepoUncached(cwd);

    if (!isRepo) {
      return {
        isRepo: false,
        branch: null,
        defaultBranch: 'main',
        status: { modified: [], untracked: [], staged: [], hasChanges: false },
        commits: [],
        aheadBehind: null,
      };
    }

    return {
      isRepo: true,
      branch: getCurrentBranchUncached(cwd),
      defaultBranch: getDefaultBranchUncached(cwd),
      status: getStatusUncached(cwd),
      commits: getRecentCommitsUncached(commitCount, cwd),
      aheadBehind: getAheadBehindUncached(cwd),
    };
  });
}

// ============================================================================
// UNCACHED IMPLEMENTATIONS (internal use)
// ============================================================================

function isGitRepoUncached(cwd?: string): boolean {
  const result = tryExec('git rev-parse --is-inside-work-tree', shellOpts(cwd));
  return result.success && result.output === 'true';
}

function getCurrentBranchUncached(cwd?: string): string | null {
  const result = tryExec('git branch --show-current', shellOpts(cwd));
  return result.success ? result.output : null;
}

function getDefaultBranchUncached(cwd?: string): string {
  const result = tryExec(
    'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed "s@^refs/remotes/origin/@@"',
    shellOpts(cwd),
  );
  return result.success && result.output ? result.output : 'main';
}

function getStatusUncached(cwd?: string): GitStatus {
  const result = tryExec('git status --porcelain', shellOpts(cwd));
  const lines = result.success ? result.output.split('\n').filter(Boolean) : [];

  const modified: string[] = [];
  const untracked: string[] = [];
  const staged: string[] = [];

  for (const line of lines) {
    const status = line.slice(0, 2);
    const file = line.slice(MAGIC_3);

    if (status.startsWith('?')) {
      untracked.push(file);
    } else if (status[0] !== ' ') {
      staged.push(file);
    }

    if (status[1] === 'M' || status[0] === 'M') {
      modified.push(file);
    }
  }

  return {
    modified,
    untracked,
    staged,
    hasChanges: lines.length > 0,
  };
}

function getRecentCommitsUncached(count: number, cwd?: string): GitCommit[] {
  const lines = execLines(`git log --oneline -${count}`, shellOpts(cwd));

  return lines.map((line) => {
    const [hash, ...messageParts] = line.split(' ');
    return {
      hash: hash ?? '',
      message: messageParts.join(' '),
    };
  });
}

function getAheadBehindUncached(cwd?: string): GitAheadBehind | null {
  const result = tryExec(
    'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null',
    shellOpts(cwd),
  );

  if (!result.success || !result.output) {
    return null;
  }

  const [ahead, behind] = result.output.split('\t').map(Number);
  return { ahead: ahead ?? 0, behind: behind ?? 0 };
}

// ============================================================================
// PUBLIC API (with caching)
// ============================================================================

const MAGIC_3_VALUE = 3;
const MAGIC_3 = MAGIC_3_VALUE;

/**
 * Check if current directory is a git repository (cached)
 */
export function isGitRepo(cwd?: string): boolean {
  return getCached(`isGitRepo:${cwd}`, () => isGitRepoUncached(cwd));
}

/**
 * Get current branch name (cached)
 */
export function getCurrentBranch(cwd?: string): string | null {
  return getCached(`getCurrentBranch:${cwd}`, () => getCurrentBranchUncached(cwd));
}

/**
 * Get default branch name (main or master) (cached)
 */
export function getDefaultBranch(cwd?: string): string {
  return getCached(`getDefaultBranch:${cwd}`, () => getDefaultBranchUncached(cwd));
}

/**
 * Get git status (modified, untracked, staged files) (cached)
 */
export function getStatus(cwd?: string): GitStatus {
  return getCached(`getStatus:${cwd}`, () => getStatusUncached(cwd));
}

/**
 * Get recent commits (cached)
 */
export function getRecentCommits(count = 5, cwd?: string): GitCommit[] {
  return getCached(`getRecentCommits:${count}:${cwd}`, () => getRecentCommitsUncached(count, cwd));
}

/**
 * Get ahead/behind count from remote (cached)
 */
export function getAheadBehind(cwd?: string): GitAheadBehind | null {
  return getCached(`getAheadBehind:${cwd}`, () => getAheadBehindUncached(cwd));
}

/**
 * Get diff stats between two refs
 */
export function getDiffStats(
  base: string,
  head: string,
  cwd?: string,
): Array<{ path: string; additions: number; deletions: number }> {
  const result = tryExec(
    `git diff --numstat ${escapeShellArg(base)}...${escapeShellArg(head)}`,
    shellOpts(cwd),
  );

  if (!result.success || !result.output) {
    return [];
  }

  return result.output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [adds, dels, filepath] = line.split('\t');
      return {
        path: filepath ?? '',
        additions: adds === '-' ? 0 : Number.parseInt(adds ?? '0', 10),
        deletions: dels === '-' ? 0 : Number.parseInt(dels ?? '0', 10),
      };
    });
}

/**
 * Get file diff
 */
export function getFileDiff(base: string, head: string, filepath: string, cwd?: string): string {
  const result = tryExec(
    `git diff ${escapeShellArg(base)}...${escapeShellArg(head)} -- ${escapeShellArg(filepath)}`,
    shellOpts(cwd),
  );
  return result.success ? result.output : '';
}

/**
 * Get staged diff
 */
export function getStagedDiff(filepath?: string, cwd?: string): string {
  const fileArg = filepath ? `-- ${escapeShellArg(filepath)}` : '';
  const result = tryExec(`git diff --cached ${fileArg}`, shellOpts(cwd));
  return result.success ? result.output : '';
}

/**
 * Get full diff content between refs or for working directory
 */
export function getDiff(options?: {
  base?: string;
  head?: string;
  staged?: boolean;
  cwd?: string;
}): string {
  const { base, head, staged, cwd } = options ?? {};

  let cmd: string;
  if (staged) {
    cmd = 'git diff --cached';
  } else if (base && head) {
    cmd = `git diff ${escapeShellArg(base)}...${escapeShellArg(head)}`;
  } else if (base) {
    cmd = `git diff ${escapeShellArg(base)}`;
  } else {
    cmd = 'git diff';
  }

  const result = tryExec(cmd, shellOpts(cwd));
  return result.success ? result.output : '';
}

/**
 * Get list of staged files with their status
 */
export function getStagedFiles(cwd?: string): Array<{ path: string; status: string }> {
  const result = tryExec('git diff --cached --name-status', shellOpts(cwd));
  if (!result.success || !result.output) return [];

  return result.output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      return {
        status: status ?? 'M',
        path: pathParts.join('\t'),
      };
    });
}

/**
 * Get list of changed files (unstaged)
 */
export function getChangedFiles(cwd?: string): string[] {
  const result = tryExec('git diff --name-only', shellOpts(cwd));
  if (!result.success || !result.output) return [];
  return result.output.split('\n').filter(Boolean);
}

/**
 * Get files changed between two refs
 */
export function getChangedFilesBetween(base: string, head: string, cwd?: string): string[] {
  const result = tryExec(
    `git diff --name-only ${escapeShellArg(base)}...${escapeShellArg(head)}`,
    shellOpts(cwd),
  );
  if (!result.success || !result.output) return [];
  return result.output.split('\n').filter(Boolean);
}

/**
 * Get the merge base between two refs
 */
export function getMergeBase(ref1: string, ref2: string, cwd?: string): string | null {
  const result = tryExec(
    `git merge-base ${escapeShellArg(ref1)} ${escapeShellArg(ref2)}`,
    shellOpts(cwd),
  );
  return result.success ? result.output : null;
}

/**
 * Check if a ref exists
 */
export function refExists(ref: string, cwd?: string): boolean {
  const result = tryExec(`git rev-parse --verify ${escapeShellArg(ref)}`, shellOpts(cwd));
  return result.success;
}
