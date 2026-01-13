/**
 * @module commands/context/builders/git-info
 * @description Git context information builder
 */

import { getCurrentBranch, getDiff, getRecentCommits, getStatus } from '@/lib/@vcs';
import { MAX_COMMITS } from '../constants';
import type { GitContextInfo } from '../types';

/**
 * Build git context info from repository
 */
export function buildGitInfo(projectRoot: string): GitContextInfo {
  const branch = getCurrentBranch(projectRoot);
  const status = getStatus(projectRoot);
  const commits = getRecentCommits(MAX_COMMITS, projectRoot);

  const gitInfo: GitContextInfo = {
    branch: branch ?? 'unknown',
    changedFiles: [
      ...status.modified,
      ...status.staged.filter((f) => !status.modified.includes(f)),
    ],
    stagedFiles: status.staged,
    untrackedFiles: status.untracked.slice(0, 10),
    recentCommits: commits.map((c) => `${c.hash} ${c.message}`),
  };

  // Add diff if there are changes (smart truncation happens in formatter)
  if (status.hasChanges) {
    const diff = getDiff({ cwd: projectRoot });
    if (diff) {
      gitInfo.diff = diff;
    }
  }

  return gitInfo;
}
