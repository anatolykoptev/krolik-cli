/**
 * @module commands/progress
 * @description Task/epic progress tracking command
 */

import {
  ensureActiveSession,
  formatProgressContext,
  getActiveEpics,
  getBlockedTasks,
  getEpicsSummary,
  getInProgressTasks,
  getProgressSummary,
  getRecentSessions,
  getSuggestedTasks,
  getTasksByProject,
  type ProgressSummary,
  type SyncResult,
  syncGitHubIssues,
} from '../../lib/@storage/progress';
import type { OutputFormat } from '../../types/commands/base';
import { formatJson, formatMarkdown, printProgress } from './output';

/**
 * Progress command options
 */
export interface ProgressOptions {
  /** Output format */
  format?: OutputFormat | undefined;
  /** Sync with GitHub issues */
  sync?: boolean | undefined;
  /** Show verbose output */
  verbose?: boolean | undefined;
}

/**
 * Progress command result
 */
export interface ProgressResult {
  summary: ProgressSummary;
  syncResult?: SyncResult | undefined;
  sessionId: string;
}

/**
 * Get progress summary
 */
export function getProgress(projectName: string, options: ProgressOptions = {}): ProgressResult {
  const { sync = false } = options;

  // Ensure active session exists
  const sessionId = ensureActiveSession(projectName);

  // Sync with GitHub if requested
  let syncResult: SyncResult | undefined;
  if (sync) {
    syncResult = syncGitHubIssues(projectName);
  }

  // Get progress summary
  const summary = getProgressSummary(projectName);

  return {
    summary,
    syncResult,
    sessionId,
  };
}

/**
 * Run progress command
 */
export function runProgressCommand(projectRoot: string, options: ProgressOptions = {}): string {
  const { format = 'text' } = options;
  const projectName = projectRoot.split('/').pop() ?? 'unknown';

  const result = getProgress(projectName, options);

  switch (format) {
    case 'json':
      return formatJson(result);
    case 'markdown':
      return formatMarkdown(result, projectName);
    case 'ai':
      return formatProgressContext(projectName);
    default:
      return printProgress(result, projectName);
  }
}

// Re-export for convenience
export {
  getActiveEpics,
  getBlockedTasks,
  getEpicsSummary,
  getInProgressTasks,
  getSuggestedTasks,
  getTasksByProject,
  getRecentSessions,
  syncGitHubIssues,
};

// ============================================================================
// CLI RUNNER
// ============================================================================

import type { CommandContext } from '../../types/commands/base';

/**
 * Run progress command from CLI
 */
export async function runProgress(
  ctx: CommandContext & { options: ProgressOptions },
): Promise<void> {
  const { config, options } = ctx;
  const projectName = config.projectRoot.split('/').pop() ?? 'unknown';
  const format = options.format ?? 'ai';

  const result = getProgress(projectName, options);

  switch (format) {
    case 'json':
      console.log(formatJson(result));
      break;
    case 'markdown':
      console.log(formatMarkdown(result, projectName));
      break;
    case 'text':
      console.log(printProgress(result, projectName));
      break;
    default:
      // AI-friendly XML
      console.log(formatProgressContext(projectName));
  }
}
