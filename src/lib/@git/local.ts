/**
 * @module lib/@git/local
 * @description Git operations for local project repository
 */

import { execLines, shellOpts, tryExec } from '../@shell/shell';
import type { GitAheadBehind, GitCommit, GitStatus } from './types';

const MAGIC_3_VALUE = 3;

const MAGIC_3 = MAGIC_3_VALUE;

/**
 * Check if current directory is a git repository
 */
export function isGitRepo(cwd?: string): boolean {
  const result = tryExec('git rev-parse --is-inside-work-tree', shellOpts(cwd));
  return result.success && result.output === 'true';
}

/**
 * Get current branch name
 */
export function getCurrentBranch(cwd?: string): string | null {
  const result = tryExec('git branch --show-current', shellOpts(cwd));
  return result.success ? result.output : null;
}

/**
 * Get default branch name (main or master)
 */
export function getDefaultBranch(cwd?: string): string {
  const result = tryExec(
    'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed "s@^refs/remotes/origin/@@"',
    shellOpts(cwd),
  );
  return result.success && result.output ? result.output : 'main';
}

/**
 * Get git status (modified, untracked, staged files)
 */
export function getStatus(cwd?: string): GitStatus {
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

/**
 * Get recent commits
 */
export function getRecentCommits(count = 5, cwd?: string): GitCommit[] {
  const lines = execLines(`git log --oneline -${count}`, shellOpts(cwd));

  return lines.map((line) => {
    const [hash, ...messageParts] = line.split(' ');
    return {
      hash: hash ?? '',
      message: messageParts.join(' '),
    };
  });
}

/**
 * Get ahead/behind count from remote
 */
export function getAheadBehind(cwd?: string): GitAheadBehind | null {
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

/**
 * Get diff stats between two refs
 */
export function getDiffStats(
  base: string,
  head: string,
  cwd?: string,
): Array<{ path: string; additions: number; deletions: number }> {
  const result = tryExec(`git diff --numstat ${base}...${head}`, shellOpts(cwd));

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
  const result = tryExec(`git diff ${base}...${head} -- "${filepath}"`, shellOpts(cwd));
  return result.success ? result.output : '';
}

/**
 * Get staged diff
 */
export function getStagedDiff(filepath?: string, cwd?: string): string {
  const fileArg = filepath ? `-- "${filepath}"` : '';
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
    cmd = `git diff ${base}...${head}`;
  } else if (base) {
    cmd = `git diff ${base}`;
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
  const result = tryExec(`git diff --name-only ${base}...${head}`, shellOpts(cwd));
  if (!result.success || !result.output) return [];
  return result.output.split('\n').filter(Boolean);
}

/**
 * Get the merge base between two refs
 */
export function getMergeBase(ref1: string, ref2: string, cwd?: string): string | null {
  const result = tryExec(`git merge-base ${ref1} ${ref2}`, shellOpts(cwd));
  return result.success ? result.output : null;
}

/**
 * Check if a ref exists
 */
export function refExists(ref: string, cwd?: string): boolean {
  const result = tryExec(`git rev-parse --verify ${ref}`, shellOpts(cwd));
  return result.success;
}
