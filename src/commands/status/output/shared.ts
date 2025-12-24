/**
 * @module commands/status/output/shared
 * @description Shared output helpers and types
 */

import type { StatusResult } from '../../../types';

/** Next action recommendation */
export interface NextAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  reason?: string;
}

/** Re-export formatDuration for backwards compatibility */
export { formatDuration } from '../../../lib';

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_PAGE_SIZE = 50;

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Get status icon (checkmark or cross)
 */
export function icon(ok: boolean): string {
  return ok ? '✅' : '❌';
}

/**
 * Get health emoji based on status
 */
export function getHealthEmoji(health: StatusResult['health']): string {
  return health === 'good' ? '🟢' : health === 'warning' ? '🟡' : '🔴';
}

/**
 * Format ahead/behind suffix for git status
 */
export function formatAheadBehind(ahead?: number, behind?: number): string {
  const parts: string[] = [];
  if (ahead && ahead > 0) parts.push(`↑${ahead}`);
  if (behind && behind > 0) parts.push(`↓${behind}`);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/**
 * Build tech stack summary array
 */
export function buildStackSummary(techStack: StatusResult['techStack']): string[] {
  if (!techStack) return [];
  const stack: string[] = [];
  if (techStack.framework) stack.push(techStack.framework);
  stack.push(techStack.language === 'typescript' ? 'TypeScript' : 'JavaScript');
  if (techStack.ui.length > 0) stack.push(...techStack.ui.slice(0, 2));
  if (techStack.database.length > 0) stack.push(techStack.database[0]!);
  if (techStack.api.length > 0) stack.push(techStack.api[0]!);
  return stack;
}

// ============================================================================
// NEXT ACTION LOGIC
// ============================================================================

/**
 * Determine the next action based on project status
 */
export function determineNextAction(status: StatusResult): NextAction {
  // Priority order: AI rules > pull behind > fix errors > commit > ready

  // 1. AI rules files should be read first
  if (status.aiRules && status.aiRules.length > 0) {
    return {
      priority: 'critical',
      action: `Read AI rules files: ${status.aiRules.map((r) => r.relativePath).join(', ')}`,
      reason: 'Project has AI configuration files that define conventions and rules',
    };
  }

  // 2. If behind remote, pull first
  if (status.git.behind && status.git.behind > 0) {
    return {
      priority: 'high',
      action: `Pull ${status.git.behind} commit(s) from remote`,
      reason: 'You are behind the remote branch and may have conflicts',
    };
  }

  // 3. Fix TypeScript errors
  if (status.typecheck.status === 'failed') {
    return {
      priority: 'high',
      action: 'Fix TypeScript errors (run: pnpm typecheck)',
      reason: 'Code will not compile until errors are fixed',
    };
  }

  // 4. Fix lint errors
  if (status.lint.errors > 0) {
    return {
      priority: 'high',
      action: `Fix ${status.lint.errors} lint error(s) (run: pnpm lint --fix)`,
      reason: 'Lint errors indicate code quality issues',
    };
  }

  // 5. Commit staged changes
  if (status.git.staged > 0) {
    return {
      priority: 'medium',
      action: `Commit ${status.git.staged} staged file(s)`,
      reason: 'You have changes ready to commit',
    };
  }

  // 6. Stage and commit unstaged changes
  if (status.git.hasChanges) {
    const changes = status.git.modified + status.git.untracked;
    return {
      priority: 'medium',
      action: `Stage and commit ${changes} changed file(s)`,
      reason: 'Uncommitted changes should be saved before continuing',
    };
  }

  // 7. Push unpushed commits
  if (status.git.ahead && status.git.ahead > 0) {
    return {
      priority: 'low',
      action: `Push ${status.git.ahead} commit(s) to remote`,
      reason: 'Share your work with the team',
    };
  }

  // 8. Ready for development
  return {
    priority: 'low',
    action: 'Start development - project is in good state',
    reason: 'All checks pass, working tree is clean',
  };
}
