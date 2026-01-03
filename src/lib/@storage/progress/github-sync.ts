/**
 * @module lib/@storage/progress/github-sync
 * @description Sync tasks with GitHub issues via gh CLI
 */

import { execSync } from 'node:child_process';
import { getTaskByExternalId, upsertTask } from './tasks';
import type { TaskPriority, TaskStatus } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * GitHub issue from gh CLI
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'OPEN' | 'CLOSED';
  labels: Array<{ name: string }>;
  milestone: { title: string } | null;
  assignees: Array<{ login: string }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

// ============================================================================
// GITHUB CLI INTEGRATION
// ============================================================================

/**
 * Check if gh CLI is available and authenticated
 */
export function isGitHubAvailable(): boolean {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get repository owner/name from current directory
 */
export function getRepoInfo(): { owner: string; repo: string } | null {
  try {
    const remote = execSync('gh repo view --json owner,name', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const data = JSON.parse(remote) as { owner: { login: string }; name: string };
    return { owner: data.owner.login, repo: data.name };
  } catch {
    return null;
  }
}

/**
 * Fetch issues from GitHub
 */
export function fetchGitHubIssues(
  owner: string,
  repo: string,
  options: {
    state?: 'open' | 'closed' | 'all' | undefined;
    labels?: string[] | undefined;
    limit?: number | undefined;
  } = {},
): GitHubIssue[] {
  const { state = 'open', labels = [], limit = 100 } = options;

  try {
    let cmd = `gh issue list --repo ${owner}/${repo} --json number,title,body,state,labels,milestone,assignees,createdAt,updatedAt --limit ${limit}`;

    if (state !== 'all') {
      cmd += ` --state ${state}`;
    }

    if (labels.length > 0) {
      cmd += ` --label "${labels.join(',')}"`;
    }

    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return JSON.parse(output) as GitHubIssue[];
  } catch {
    return [];
  }
}

/**
 * Fetch single issue details
 */
export function fetchGitHubIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): GitHubIssue | null {
  try {
    const cmd = `gh issue view ${issueNumber} --repo ${owner}/${repo} --json number,title,body,state,labels,milestone,assignees,createdAt,updatedAt`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return JSON.parse(output) as GitHubIssue;
  } catch {
    return null;
  }
}

// ============================================================================
// CONVERSION
// ============================================================================

/**
 * Map GitHub labels to task priority
 */
function labelsToPriority(labels: Array<{ name: string }>): TaskPriority {
  const labelNames = labels.map((l) => l.name.toLowerCase());

  if (labelNames.some((l) => l.includes('critical') || l.includes('urgent') || l.includes('p0'))) {
    return 'critical';
  }
  if (labelNames.some((l) => l.includes('high') || l.includes('important') || l.includes('p1'))) {
    return 'high';
  }
  if (labelNames.some((l) => l.includes('low') || l.includes('minor') || l.includes('p3'))) {
    return 'low';
  }
  return 'medium';
}

/**
 * Map GitHub state to task status
 */
function stateToStatus(state: 'OPEN' | 'CLOSED'): TaskStatus {
  return state === 'CLOSED' ? 'done' : 'backlog';
}

/**
 * Extract epic from milestone or labels
 */
function extractEpic(issue: GitHubIssue): string | undefined {
  // First check milestone
  if (issue.milestone) {
    return issue.milestone.title;
  }

  // Check for epic label
  const epicLabel = issue.labels.find(
    (l) => l.name.toLowerCase().startsWith('epic:') || l.name.toLowerCase().startsWith('epic/'),
  );

  if (epicLabel) {
    return epicLabel.name.replace(/^epic[:/]\s*/i, '');
  }

  return undefined;
}

/**
 * Extract labels (excluding priority and epic labels)
 */
function extractLabels(issue: GitHubIssue): string[] {
  const priorityPatterns = [
    'critical',
    'urgent',
    'high',
    'medium',
    'low',
    'minor',
    'p0',
    'p1',
    'p2',
    'p3',
  ];
  const epicPatterns = ['epic:', 'epic/'];

  return issue.labels
    .map((l) => l.name)
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        !priorityPatterns.some((p) => lower.includes(p)) &&
        !epicPatterns.some((p) => lower.startsWith(p))
      );
    });
}

// ============================================================================
// SYNC
// ============================================================================

/**
 * Sync a single GitHub issue to local task
 */
export function syncIssueToTask(project: string, issue: GitHubIssue): number {
  const externalId = String(issue.number);

  return upsertTask({
    source: 'github',
    externalId,
    project,
    title: issue.title,
    description: issue.body ?? undefined,
    status: stateToStatus(issue.state),
    epic: extractEpic(issue),
    priority: labelsToPriority(issue.labels),
    labels: extractLabels(issue),
  });
}

/**
 * Sync all open issues from GitHub
 */
export function syncGitHubIssues(project: string): SyncResult {
  const result: SyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  if (!isGitHubAvailable()) {
    result.errors.push('GitHub CLI not available or not authenticated');
    return result;
  }

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    result.errors.push('Could not determine repository info');
    return result;
  }

  const issues = fetchGitHubIssues(repoInfo.owner, repoInfo.repo, { state: 'all' });

  for (const issue of issues) {
    try {
      const existing = getTaskByExternalId(project, 'github', String(issue.number));
      const taskId = syncIssueToTask(project, issue);

      if (taskId > 0) {
        result.synced++;
        if (existing) {
          result.updated++;
        } else {
          result.created++;
        }
      }
    } catch (err) {
      result.errors.push(`Failed to sync issue #${issue.number}: ${String(err)}`);
    }
  }

  return result;
}

/**
 * Sync specific issue by number
 */
export function syncGitHubIssue(project: string, issueNumber: number): number | null {
  if (!isGitHubAvailable()) {
    return null;
  }

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    return null;
  }

  const issue = fetchGitHubIssue(repoInfo.owner, repoInfo.repo, issueNumber);
  if (!issue) {
    return null;
  }

  return syncIssueToTask(project, issue);
}

// ============================================================================
// BIDIRECTIONAL SYNC (FUTURE)
// ============================================================================

/**
 * Update GitHub issue from local task (future feature)
 */
export function updateGitHubIssue(
  _owner: string,
  _repo: string,
  _issueNumber: number,
  _updates: { state?: 'open' | 'closed'; labels?: string[] },
): boolean {
  // TODO: Implement when needed
  // gh issue edit <number> --repo owner/repo [--state open|closed] [--add-label "label"]
  return false;
}

/**
 * Create GitHub issue from local task (future feature)
 */
export function createGitHubIssue(
  _owner: string,
  _repo: string,
  _title: string,
  _body: string,
  _labels: string[],
): number | null {
  // TODO: Implement when needed
  // gh issue create --repo owner/repo --title "..." --body "..." --label "..."
  return null;
}
