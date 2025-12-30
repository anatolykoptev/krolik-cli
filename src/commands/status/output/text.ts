/**
 * @module commands/status/output/text
 * @description Text format output for CLI
 */

import { formatJson as formatJsonBase } from '@/lib/@format';
import type { Logger } from '../../../types/commands/base';
import type { StatusResult } from '../../../types/commands/status';
import {
  buildStackSummary,
  formatAheadBehind,
  formatDuration,
  icon,
  MAX_PAGE_SIZE,
} from './shared';

// ============================================================================
// SECTION PRINTERS
// ============================================================================

/** Print package info section */
function printPackageSection(status: StatusResult): void {
  if (!status.package) return;
}

/** Print tech stack section */
function printTechStackSection(status: StatusResult): void {
  const stack = buildStackSummary(status.techStack);
  if (stack.length === 0) return;
  console.log(`🛠️  Stack: ${stack.join(' · ')}`);
  console.log('');
}

/** Print git status section */
function printGitSection(status: StatusResult, logger: Logger): void {
  logger.info(`${icon(status.branch.isCorrect)} Branch: ${status.branch.name}`);

  const suffix = formatAheadBehind(status.git.ahead, status.git.behind);

  if (status.git.hasChanges) {
    const changes = status.git.modified + status.git.untracked;
    logger.info(`⚠️  Working tree: ${changes} changes (${status.git.staged} staged)${suffix}`);
  } else {
    logger.info(`${icon(true)} Working tree: clean${suffix}`);
  }
}

/** Print checks section */
function printChecksSection(status: StatusResult, logger: Logger): void {
  const typecheckOk = status.typecheck.status === 'passed' || status.typecheck.status === 'skipped';
  const typecheckSuffix = status.typecheck.cached ? ' (cached)' : '';
  logger.info(`${icon(typecheckOk)} Typecheck: ${status.typecheck.status}${typecheckSuffix}`);

  const lintOk = status.lint.errors === 0;
  logger.info(
    `${icon(lintOk)} Lint: ${status.lint.warnings} warnings, ${status.lint.errors} errors`,
  );

  const todoIcon = status.todos.count > MAX_PAGE_SIZE ? '⚠️ ' : status.todos.count > 0 ? '📝' : '✅';
  logger.info(`${todoIcon} TODOs: ${status.todos.count}`);
}

/** Print extended info sections */
function printExtendedSections(status: StatusResult): void {
  if (status.fileStats?.sourceFiles && status.fileStats.sourceFiles > 0) {
    console.log(
      `📁 Files: ${status.fileStats.sourceFiles} source, ${status.fileStats.testFiles} tests`,
    );
  }

  if (status.workspaces && status.workspaces.length > 0) {
    const apps = status.workspaces.filter((w) => w.type === 'app').length;
    const packages = status.workspaces.filter((w) => w.type === 'package').length;
    console.log(`📦 Monorepo: ${apps} apps, ${packages} packages`);
  }

  if (status.aiRules && status.aiRules.length > 0) {
    console.log(
      `📋 AI Rules: ${status.aiRules.length} files (${status.aiRules.map((r) => r.relativePath).join(', ')})`,
    );
  }

  if (status.branchContext) {
    const ctx = status.branchContext;
    let branchInfo = `🔀 Branch: ${ctx.name} (${ctx.type})`;
    if (ctx.issueNumber) branchInfo += ` #${ctx.issueNumber}`;
    if (ctx.description) branchInfo += ` — ${ctx.description}`;
    console.log(branchInfo);
  }
}

/** Print verbose sections */
function printVerboseSections(status: StatusResult, logger: Logger, verbose: boolean): void {
  if (!verbose) return;

  if (status.recentCommits && status.recentCommits.length > 0) {
    console.log('');
    console.log('\x1b[2m─── Recent Commits ───\x1b[0m');
    for (const commit of status.recentCommits) {
      console.log(
        `  \x1b[33m${commit.hash}\x1b[0m ${commit.message} \x1b[2m(${commit.relativeDate})\x1b[0m`,
      );
    }
  }

  if (status.typecheck.errors) {
    console.log('');
    logger.warn('Typecheck errors:');
    console.log(status.typecheck.errors);
  }
}

/** Print health summary */
function printHealthSummary(status: StatusResult, logger: Logger): void {
  console.log('');
  const healthIcon = status.health === 'good' ? '🟢' : status.health === 'warning' ? '🟡' : '🔴';
  logger.info(
    `${healthIcon} Health: ${status.health.toUpperCase()} (${formatDuration(status.durationMs)})`,
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Print status in text format to console
 */
export function printStatus(status: StatusResult, logger: Logger, verbose = false): void {
  logger.section('Project Status');
  printPackageSection(status);
  printTechStackSection(status);
  printGitSection(status, logger);
  printChecksSection(status, logger);
  printExtendedSections(status);
  printVerboseSections(status, logger, verbose);
  printHealthSummary(status, logger);
}

/**
 * Format status as JSON string
 */
export function formatJson(status: StatusResult): string {
  return formatJsonBase(status);
}
