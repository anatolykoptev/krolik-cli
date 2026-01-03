/**
 * @module commands/status
 * @description Project status and diagnostics command
 */

import chalk from 'chalk';
import { createMissingSubDocs, DOCS_VERSION, needsSync, syncClaudeMd } from '../../lib/@claude';
import { measureTime } from '../../lib/@core/time';
import { generateRoadmap, needsRoadmapRefresh } from '../../lib/@roadmap';
import { recent as getRecentMemories } from '../../lib/@storage/memory';
import type { CommandContext, OutputFormat } from '../../types/commands/base';
import type { StatusResult } from '../../types/commands/status';
import type { RoadmapConfig } from '../../types/config';
import { checkGit, checkLint, checkTypecheck, toStatusResult } from './checks';
import { formatAI, formatJson, formatMarkdown, printStatus } from './output';
import { getProjectInfo } from './project-info';
import { countTodosSimple } from './todos';

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

    // Get recent memories (5 items, no project filter for cross-project visibility)
    const memories = getRecentMemories(undefined, 5);

    return { git, typecheck, lint, todoCount, projectInfo, memories };
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
    const {
      package: pkg,
      techStack,
      recentCommits,
      fileStats,
      workspaces,
      aiRules,
      branchContext,
    } = result.projectInfo;

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
      ...(result.memories.length > 0
        ? {
            memory: result.memories.map((m) => ({
              type: m.type,
              title: m.title,
              tags: m.tags,
            })),
          }
        : {}),
    };
  }

  // Add memory to base result if no rich project info
  if (result.memories.length > 0) {
    return {
      ...baseResult,
      memory: result.memories.map((m) => ({
        type: m.type,
        title: m.title,
        tags: m.tags,
      })),
    };
  }

  return baseResult;
}

/**
 * Auto-sync CLAUDE.md if needed
 * Runs silently and only shows output if something changed
 */
function autoSyncClaudeMd(projectRoot: string, isTextFormat: boolean): void {
  if (!needsSync(projectRoot)) {
    return;
  }

  const result = syncClaudeMd(projectRoot, { silent: true });

  if (result.action === 'skipped') {
    return;
  }

  // Show sync message
  if (isTextFormat) {
    // Human-readable format
    if (result.action === 'created') {
      console.log(chalk.green(`\n📄 Created CLAUDE.md (v${DOCS_VERSION})`));
    } else if (result.previousVersion) {
      console.log(
        chalk.green(`\n📄 CLAUDE.md updated: v${result.previousVersion} → v${DOCS_VERSION}`),
      );
    } else {
      console.log(chalk.green(`\n📄 Added krolik section to CLAUDE.md (v${DOCS_VERSION})`));
    }
  } else {
    // AI-friendly format
    const action = result.action === 'created' ? 'created' : 'updated';
    const versionInfo = result.previousVersion
      ? `${result.previousVersion} → ${DOCS_VERSION}`
      : `v${DOCS_VERSION}`;
    console.log(`\n<!-- CLAUDE.md ${action}: ${versionInfo} -->`);
  }
}

/**
 * Auto-create missing CLAUDE.md for packages
 * Runs silently and only shows output if something was created
 */
function autoCreateSubDocs(projectRoot: string, isTextFormat: boolean): void {
  const results = createMissingSubDocs(projectRoot);
  const created = results.filter((r) => r.action === 'created');

  if (created.length === 0) {
    return;
  }

  if (isTextFormat) {
    console.log(chalk.green(`\n📄 Created ${created.length} package CLAUDE.md file(s):`));
    for (const r of created) {
      console.log(chalk.dim(`   • ${r.path}`));
    }
  } else {
    console.log(
      `\n<!-- Created ${created.length} sub-docs: ${created.map((r) => r.path).join(', ')} -->`,
    );
  }
}

/**
 * Auto-refresh roadmap if configured and stale
 * Runs when roadmap.auto is enabled in config
 */
function autoRefreshRoadmap(
  projectRoot: string,
  roadmapConfig: RoadmapConfig | undefined,
  isTextFormat: boolean,
): void {
  if (!roadmapConfig?.auto) {
    return;
  }

  if (!needsRoadmapRefresh(projectRoot, roadmapConfig)) {
    return;
  }

  const result = generateRoadmap(projectRoot, roadmapConfig);

  if (!result.generated) {
    if (isTextFormat) {
      console.log(chalk.yellow(`\n⚠️  Roadmap: ${result.error ?? 'Generation failed'}`));
    } else {
      console.log(`\n<!-- roadmap-error: ${result.error ?? 'Generation failed'} -->`);
    }
    return;
  }

  if (isTextFormat) {
    console.log(
      chalk.green(
        `\n📊 Roadmap refreshed: ${result.stats.done}/${result.stats.total} done (${result.stats.progress}%)`,
      ),
    );
    console.log(chalk.dim(`   → ${result.path}`));
  } else {
    console.log(
      `\n<!-- roadmap-refreshed: ${result.stats.done}/${result.stats.total} (${result.stats.progress}%) → ${result.path} -->`,
    );
  }
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
    autoSyncClaudeMd(config.projectRoot, false);
    autoCreateSubDocs(config.projectRoot, false);
    autoRefreshRoadmap(config.projectRoot, config.roadmap, false);
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(status));
    autoSyncClaudeMd(config.projectRoot, false);
    autoCreateSubDocs(config.projectRoot, false);
    autoRefreshRoadmap(config.projectRoot, config.roadmap, false);
    return;
  }

  if (format === 'text') {
    printStatus(status, logger, options.verbose);
    autoSyncClaudeMd(config.projectRoot, true);
    autoCreateSubDocs(config.projectRoot, true);
    autoRefreshRoadmap(config.projectRoot, config.roadmap, true);
    return;
  }

  // Default: AI-friendly XML format
  console.log(formatAI(status));
  autoSyncClaudeMd(config.projectRoot, false);
  autoCreateSubDocs(config.projectRoot, false);
  autoRefreshRoadmap(config.projectRoot, config.roadmap, false);
}

// Re-export types for external use
export type { GitCheck, LintResult, TypecheckResult } from './checks';
export type { TodoCount } from './todos';
