/**
 * @module commands/status
 * @description Project status and diagnostics command
 */

import * as path from 'node:path';
import type { CommandContext, StatusResult } from '../../types';
import { isGitRepo, getCurrentBranch, getStatus as getGitStatus } from '../../lib/git';
import { tryExec } from '../../lib/shell';

/**
 * Status command options
 */
interface StatusOptions {
  fast?: boolean;
  json?: boolean;
}

/**
 * Check typecheck status
 */
function checkTypecheck(projectRoot: string, skip: boolean): StatusResult['typecheck'] {
  if (skip) {
    return { status: 'skipped', cached: false };
  }

  const result = tryExec('pnpm typecheck', { cwd: projectRoot, timeout: 60000 });
  return {
    status: result.success ? 'passed' : 'failed',
    cached: false,
    errors: result.success ? undefined : result.error,
  };
}

/**
 * Check lint status
 */
function checkLint(projectRoot: string, skip: boolean): StatusResult['lint'] {
  if (skip) {
    return { warnings: 0, errors: 0 };
  }

  const result = tryExec('pnpm lint 2>&1', { cwd: projectRoot, timeout: 60000 });
  const output = result.output || '';

  const warnings = Number.parseInt(output.match(/(\d+)\s*warnings?/i)?.[1] ?? '0', 10);
  const errors = Number.parseInt(output.match(/(\d+)\s*errors?/i)?.[1] ?? '0', 10);

  return { warnings, errors };
}

/**
 * Count TODOs in codebase
 */
function countTodos(projectRoot: string): number {
  const result = tryExec('grep -r "TODO\\|FIXME" --include="*.ts" --include="*.tsx" | wc -l', {
    cwd: projectRoot,
  });
  return Number.parseInt(result.output ?? '0', 10);
}

/**
 * Get project status
 */
export function getProjectStatus(
  projectRoot: string,
  options: StatusOptions = {},
): StatusResult {
  const start = performance.now();
  const { fast = false } = options;

  // Git info
  const branch = getCurrentBranch(projectRoot);
  const gitStatus = getGitStatus(projectRoot);

  // Checks
  const typecheck = checkTypecheck(projectRoot, fast);
  const lint = checkLint(projectRoot, fast);
  const todos = countTodos(projectRoot);

  // Determine health
  let health: StatusResult['health'] = 'good';
  if (typecheck.status === 'failed' || lint.errors > 0) {
    health = 'error';
  } else if (lint.warnings > 10 || todos > 50) {
    health = 'warning';
  }

  return {
    health,
    branch: {
      name: branch ?? 'unknown',
      isCorrect: true, // Can be configured per-project
    },
    git: {
      hasChanges: gitStatus.hasChanges,
      modified: gitStatus.modified.length,
      untracked: gitStatus.untracked.length,
      staged: gitStatus.staged.length,
    },
    typecheck,
    lint,
    todos: { count: todos },
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Run status command
 */
export async function runStatus(context: CommandContext & { options: StatusOptions }): Promise<void> {
  const { config, logger, options } = context;

  const status = getProjectStatus(config.projectRoot, options);

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  logger.section('Project Status');

  const icon = (ok: boolean) => (ok ? '✅' : '❌');
  const warn = '⚠️';

  logger.info(`${icon(status.branch.isCorrect)} Branch: ${status.branch.name}`);
  logger.info(
    `${status.git.hasChanges ? warn : icon(true)} Working tree: ${
      status.git.hasChanges
        ? `${status.git.modified + status.git.untracked} changes`
        : 'clean'
    }`,
  );
  logger.info(
    `${icon(status.typecheck.status === 'passed')} Typecheck: ${status.typecheck.status}${
      status.typecheck.cached ? ' (cached)' : ''
    }`,
  );
  logger.info(
    `${icon(status.lint.errors === 0)} Lint: ${status.lint.warnings} warnings, ${status.lint.errors} errors`,
  );
  logger.info(`${status.todos.count > 0 ? '📝' : '✅'} TODOs: ${status.todos.count}`);

  console.log('');
  const healthIcon = status.health === 'good' ? '🟢' : status.health === 'warning' ? '🟡' : '🔴';
  logger.info(`${healthIcon} Health: ${status.health.toUpperCase()} (${status.durationMs}ms)`);
}
