/**
 * @module commands/review/diff
 * @description Git diff analysis utilities
 */

import {
  escapeShellArg,
  getCurrentBranch,
  getDefaultBranch,
  getDiff,
  getFileDiff,
  getPR,
  getStagedDiff,
  tryExec,
} from '../../lib';
import type { FileChange } from '../../types';

/**
 * PR information for review
 */
export interface PRInfo {
  title: string;
  description: string;
  baseBranch: string;
  headBranch: string;
}

/**
 * Get PR info by number
 */
export function getPRInfo(prNumber: number, cwd?: string): PRInfo | null {
  const pr = getPR(prNumber, cwd);
  if (!pr) return null;

  return {
    title: pr.title,
    description: pr.body,
    baseBranch: pr.baseBranch,
    headBranch: pr.headBranch,
  };
}

/**
 * Get changed files between refs
 */
export function getChangedFiles(
  baseBranch: string,
  headBranch: string,
  cwd?: string,
): FileChange[] {
  const numstatResult = tryExec(
    `git diff --numstat ${escapeShellArg(baseBranch)}...${escapeShellArg(headBranch)}`,
    {
      ...(cwd ? { cwd } : {}),
      silent: true,
    },
  );
  if (!numstatResult.success || !numstatResult.output) return [];

  const files: FileChange[] = [];

  for (const line of numstatResult.output.split('\n').filter(Boolean)) {
    const [adds, dels, filepath] = line.split('\t');
    if (!filepath) continue;

    const binary = adds === '-';
    files.push({
      path: filepath,
      status: 'modified',
      additions: binary ? 0 : Number.parseInt(adds ?? '0', 10),
      deletions: binary ? 0 : Number.parseInt(dels ?? '0', 10),
      binary,
    });
  }

  // Get actual status (added/modified/deleted/renamed)
  const statusResult = tryExec(
    `git diff --name-status ${escapeShellArg(baseBranch)}...${escapeShellArg(headBranch)}`,
    {
      ...(cwd ? { cwd } : {}),
      silent: true,
    },
  );
  if (statusResult.success && statusResult.output) {
    for (const line of statusResult.output.split('\n').filter(Boolean)) {
      const [status, ...pathParts] = line.split('\t');
      const filepath = pathParts[pathParts.length - 1];

      const file = files.find((f) => f.path === filepath);
      if (file && status) {
        switch (status[0]) {
          case 'A':
            file.status = 'added';
            break;
          case 'D':
            file.status = 'deleted';
            break;
          case 'R':
            file.status = 'renamed';
            break;
          default:
            file.status = 'modified';
        }
      }
    }
  }

  return files;
}

/**
 * Get staged files
 */
export function getStagedChanges(cwd?: string): FileChange[] {
  const result = tryExec('git diff --cached --numstat', { ...(cwd ? { cwd } : {}), silent: true });
  if (!result.success || !result.output) return [];

  const files: FileChange[] = [];

  for (const line of result.output.split('\n').filter(Boolean)) {
    const [adds, dels, filepath] = line.split('\t');
    if (!filepath) continue;

    const binary = adds === '-';
    files.push({
      path: filepath,
      status: 'modified',
      additions: binary ? 0 : Number.parseInt(adds ?? '0', 10),
      deletions: binary ? 0 : Number.parseInt(dels ?? '0', 10),
      binary,
    });
  }

  return files;
}

/**
 * Get diff content for a file
 */
export function getFileChanges(
  filepath: string,
  options: { staged?: boolean; base?: string; head?: string; cwd?: string },
): string {
  const { staged, base, head, cwd } = options;

  if (staged) {
    return getStagedDiff(filepath, cwd);
  }

  if (base && head) {
    return getFileDiff(base, head, filepath, cwd);
  }

  return getDiff({ ...(cwd ? { cwd } : {}) }) || '';
}

/**
 * Get base and head branches for review
 */
export function getReviewBranches(cwd?: string): { base: string; head: string } {
  return {
    base: getDefaultBranch(cwd),
    head: getCurrentBranch(cwd) || 'HEAD',
  };
}
