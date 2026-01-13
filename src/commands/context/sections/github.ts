/**
 * @module commands/context/sections/github
 * @description GitHub issues loading
 */

import { isGhAuthenticated, isGhAvailable, listIssues } from '@/lib/@vcs';
import type { GitHubIssuesData } from '../types';

/**
 * Load GitHub issues from repository using gh CLI
 */
export function loadGitHubIssues(projectRoot: string): GitHubIssuesData | undefined {
  try {
    // Check if gh CLI is available and authenticated
    if (!isGhAvailable() || !isGhAuthenticated()) {
      return undefined;
    }

    // Fetch open issues (limit to 20)
    const issues = listIssues(20, projectRoot);

    if (issues.length === 0) {
      return undefined;
    }

    return {
      count: issues.length,
      source: 'gh cli',
      issues: issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels,
      })),
    };
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] GitHub issues loading failed:', error);
    }
    return undefined;
  }
}
