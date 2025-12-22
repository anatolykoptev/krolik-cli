/**
 * @module commands/status
 * @description Project status and diagnostics command
 */

import type { CommandContext, StatusResult } from '../../types';
import { checkGit, checkTypecheck, checkLint, toStatusResult } from './checks';
import { countTodosSimple } from './todos';
import { printStatus, formatJson, formatMarkdown } from './output';

/**
 * Status command options
 */
export interface StatusOptions {
  fast?: boolean;
  json?: boolean;
  markdown?: boolean;
  verbose?: boolean;
}

/**
 * Get project status
 */
export function getProjectStatus(projectRoot: string, options: StatusOptions = {}): StatusResult {
  const start = performance.now();
  const { fast = false } = options;

  const git = checkGit(projectRoot);
  const typecheck = checkTypecheck(projectRoot, fast);
  const lint = checkLint(projectRoot, fast);
  const todoCount = countTodosSimple(projectRoot);
  const durationMs = Math.round(performance.now() - start);

  return toStatusResult(git, typecheck, lint, { count: todoCount }, durationMs);
}

/**
 * Run status command
 */
export async function runStatus(ctx: CommandContext & { options: StatusOptions }): Promise<void> {
  const { config, logger, options } = ctx;
  const status = getProjectStatus(config.projectRoot, options);

  if (options.json) {
    console.log(formatJson(status));
    return;
  }

  if (options.markdown) {
    console.log(formatMarkdown(status));
    return;
  }

  printStatus(status, logger, options.verbose);
}

// Re-export types for external use
export type { GitCheck, TypecheckResult, LintResult } from './checks';
export type { TodoCount } from './todos';
