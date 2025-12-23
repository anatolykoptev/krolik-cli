/**
 * @module commands/status
 * @description Project status and diagnostics command
 */

import type { CommandContext, StatusResult, OutputFormat } from '../../types';
import { measureTime } from '../../lib/timing';
import { checkGit, checkTypecheck, checkLint, toStatusResult } from './checks';
import { countTodosSimple } from './todos';
import { getProjectInfo } from './project-info';
import { printStatus, formatJson, formatMarkdown, formatAI } from './output';

/**
 * Status command options
 */
export interface StatusOptions {
  fast?: boolean;
  format?: OutputFormat;
  verbose?: boolean;
}

/**
 * Get project status
 */
export function getProjectStatus(projectRoot: string, options: StatusOptions = {}): StatusResult {
  const { fast = false } = options;

  const { result, durationMs } = measureTime(() => {
    const git = checkGit(projectRoot);
    const typecheck = checkTypecheck(projectRoot, fast);
    const lint = checkLint(projectRoot, fast);
    const todoCount = countTodosSimple(projectRoot);
    const projectInfo = getProjectInfo(projectRoot, fast);
    return { git, typecheck, lint, todoCount, projectInfo };
  });

  const baseResult = toStatusResult(
    result.git,
    result.typecheck,
    result.lint,
    { count: result.todoCount },
    durationMs,
  );

  // Add rich project info
  if (result.projectInfo) {
    const { package: pkg, techStack, recentCommits, fileStats, workspaces, aiRules, branchContext } = result.projectInfo;

    return {
      ...baseResult,
      git: {
        ...baseResult.git,
        ahead: result.git.ahead,
        behind: result.git.behind,
      },
      package: {
        name: pkg.name,
        version: pkg.version,
        depsCount: pkg.depsCount,
        devDepsCount: pkg.devDepsCount,
      },
      techStack: {
        ...(techStack.framework ? { framework: techStack.framework } : {}),
        language: techStack.language,
        ui: techStack.ui,
        database: techStack.database,
        api: techStack.api,
        packageManager: techStack.packageManager,
      },
      recentCommits: recentCommits.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author,
        relativeDate: c.relativeDate,
      })),
      fileStats: {
        sourceFiles: fileStats.sourceFiles,
        testFiles: fileStats.testFiles,
      },
      ...(workspaces.length > 0 ? { workspaces } : {}),
      ...(aiRules.length > 0 ? { aiRules } : {}),
      branchContext: {
        name: branchContext.name,
        type: branchContext.type,
        ...(branchContext.issueNumber ? { issueNumber: branchContext.issueNumber } : {}),
        ...(branchContext.description ? { description: branchContext.description } : {}),
      },
    };
  }

  return baseResult;
}

/**
 * Run status command
 */
export async function runStatus(ctx: CommandContext & { options: StatusOptions }): Promise<void> {
  const { config, logger, options } = ctx;
  const status = getProjectStatus(config.projectRoot, options);

  // Default format is 'ai' (AI-friendly XML)
  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(formatJson(status));
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(status));
    return;
  }

  if (format === 'text') {
    printStatus(status, logger, options.verbose);
    return;
  }

  // Default: AI-friendly XML format
  console.log(formatAI(status));
}

// Re-export types for external use
export type { GitCheck, TypecheckResult, LintResult } from './checks';
export type { TodoCount } from './todos';
