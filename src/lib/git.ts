/**
 * @module lib/git
 * @description Git operations utilities
 */

import { tryExec, execLines, type ShellOptions } from './shell';

/**
 * Create shell options with optional cwd
 */
function shellOpts(cwd?: string): ShellOptions {
  const opts: ShellOptions = { silent: true };
  if (cwd) opts.cwd = cwd;
  return opts;
}

/**
 * Git status information
 */
export interface GitStatus {
  /** Files with modifications */
  modified: string[];
  /** Untracked files */
  untracked: string[];
  /** Staged files */
  staged: string[];
  /** Has any changes */
  hasChanges: boolean;
}

/**
 * Commit information
 */
export interface GitCommit {
  hash: string;
  message: string;
  author?: string;
  date?: string;
}

/**
 * Ahead/behind remote status
 */
export interface GitAheadBehind {
  ahead: number;
  behind: number;
}

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
    const file = line.slice(3);

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
