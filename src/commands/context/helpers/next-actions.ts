/**
 * @module commands/context/helpers/next-actions
 * @description Generate recommended next actions based on context state
 */

import type { ContextQualityIssue, GitContextInfo } from '../types';

export interface NextAction {
  tool: string;
  params: Record<string, unknown>;
  reason: string;
  priority: 1 | 2 | 3;
}

export interface NextActionsContext {
  git?: GitContextInfo | undefined;
  qualityIssues?: ContextQualityIssue[] | undefined;
  domains?: string[] | undefined;
  memory?: { title: string }[] | undefined;
}

/**
 * Generate next actions based on current context state
 *
 * Priority 1: Immediate actions (staged changes, critical issues)
 * Priority 2: Recommended actions (many changes, quality issues)
 * Priority 3: Optional actions (memory, documentation)
 */
export function generateNextActions(ctx: NextActionsContext): NextAction[] {
  const actions: NextAction[] = [];

  // Priority 1: Staged changes need review
  if (ctx.git?.stagedFiles && ctx.git.stagedFiles.length > 0) {
    actions.push({
      tool: 'krolik_review',
      params: { staged: true },
      reason: `${ctx.git.stagedFiles.length} staged changes`,
      priority: 1,
    });
  }

  // Priority 2: Many changed files
  if (ctx.git?.changedFiles && ctx.git.changedFiles.length > 5) {
    actions.push({
      tool: 'krolik_review',
      params: {},
      reason: `${ctx.git.changedFiles.length} changed files`,
      priority: 2,
    });
  }

  // Priority 2: Auto-fixable quality issues
  const fixable = ctx.qualityIssues?.filter((i) => i.autoFixable).length || 0;
  if (fixable > 0) {
    actions.push({
      tool: 'krolik_fix',
      params: { dryRun: true },
      reason: `${fixable} auto-fixable issues`,
      priority: 2,
    });
  }

  // Priority 3: Check memory for context (if domains exist and memory available)
  if (ctx.domains && ctx.domains.length > 0 && ctx.memory && ctx.memory.length > 0) {
    actions.push({
      tool: 'krolik_mem_search',
      params: { query: ctx.domains[0] },
      reason: 'check previous decisions',
      priority: 3,
    });
  }

  return actions.slice(0, 3); // Max 3 actions
}
