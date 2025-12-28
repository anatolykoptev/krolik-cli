/**
 * @module lib/github
 * @description GitHub CLI (gh) wrapper utilities
 */

import { execLines, shellOpts, tryExec } from '../core/shell';

/**
 * GitHub issue information
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  url: string;
}

/**
 * GitHub PR information
 */
export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  baseBranch: string;
  headBranch: string;
  url: string;
  isDraft: boolean;
}

/**
 * Check if gh CLI is available
 */
export function isGhAvailable(): boolean {
  const result = tryExec('gh --version', { silent: true });
  return result.success;
}

/**
 * Check if user is authenticated with gh
 */
export function isGhAuthenticated(): boolean {
  const result = tryExec('gh auth status', { silent: true });
  return result.success;
}

/**
 * Get current repository info (owner/repo)
 */
export function getRepoInfo(cwd?: string): { owner: string; repo: string } | null {
  const result = tryExec(
    'gh repo view --json owner,name -q ".owner.login + \\"/\\" + .name"',
    shellOpts(cwd),
  );
  if (!result.success || !result.output) return null;

  const [owner, repo] = result.output.split('/');
  if (!owner || !repo) return null;

  return { owner, repo };
}

/**
 * Fetch issue by number
 */
export function getIssue(issueNumber: number, cwd?: string): GitHubIssue | null {
  const result = tryExec(
    `gh issue view ${issueNumber} --json number,title,body,state,labels,assignees,url`,
    shellOpts(cwd),
  );

  if (!result.success || !result.output) return null;

  try {
    const data = JSON.parse(result.output);
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state?.toLowerCase() === 'open' ? 'open' : 'closed',
      labels: (data.labels || []).map((l: { name: string }) => l.name),
      assignees: (data.assignees || []).map((a: { login: string }) => a.login),
      url: data.url,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch PR by number
 */
export function getPR(prNumber: number, cwd?: string): GitHubPR | null {
  const result = tryExec(
    `gh pr view ${prNumber} --json number,title,body,state,baseRefName,headRefName,url,isDraft`,
    shellOpts(cwd),
  );

  if (!result.success || !result.output) return null;

  try {
    const data = JSON.parse(result.output);
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state?.toLowerCase() as GitHubPR['state'],
      baseBranch: data.baseRefName,
      headBranch: data.headRefName,
      url: data.url,
      isDraft: data.isDraft || false,
    };
  } catch {
    return null;
  }
}

/**
 * Get current PR for the branch
 */
export function getCurrentPR(cwd?: string): GitHubPR | null {
  const result = tryExec(
    'gh pr view --json number,title,body,state,baseRefName,headRefName,url,isDraft',
    shellOpts(cwd),
  );

  if (!result.success || !result.output) return null;

  try {
    const data = JSON.parse(result.output);
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state?.toLowerCase() as GitHubPR['state'],
      baseBranch: data.baseRefName,
      headBranch: data.headRefName,
      url: data.url,
      isDraft: data.isDraft || false,
    };
  } catch {
    return null;
  }
}

/**
 * List open issues
 */
export function listIssues(limit = 10, cwd?: string): GitHubIssue[] {
  const lines = execLines(
    `gh issue list --limit ${limit} --json number,title,state,labels,url`,
    shellOpts(cwd),
  );

  if (lines.length === 0) return [];

  try {
    const data = JSON.parse(lines.join(''));
    return data.map((issue: Record<string, unknown>) => ({
      number: issue.number,
      title: issue.title,
      body: '',
      state: (issue.state as string)?.toLowerCase() === 'open' ? 'open' : 'closed',
      labels: ((issue.labels as Array<{ name: string }>) || []).map((l) => l.name),
      assignees: [],
      url: issue.url,
    }));
  } catch {
    return [];
  }
}

/**
 * List open PRs
 */
export function listPRs(limit = 10, cwd?: string): GitHubPR[] {
  const lines = execLines(
    `gh pr list --limit ${limit} --json number,title,state,baseRefName,headRefName,url,isDraft`,
    shellOpts(cwd),
  );

  if (lines.length === 0) return [];

  try {
    const data = JSON.parse(lines.join(''));
    return data.map((pr: Record<string, unknown>) => ({
      number: pr.number,
      title: pr.title,
      body: '',
      state: (pr.state as string)?.toLowerCase() as GitHubPR['state'],
      baseBranch: pr.baseRefName,
      headBranch: pr.headRefName,
      url: pr.url,
      isDraft: pr.isDraft || false,
    }));
  } catch {
    return [];
  }
}
