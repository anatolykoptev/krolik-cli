/**
 * @module commands/status/output
 * @description Status command output formatters
 */

import type { Logger, StatusResult } from "../../types";
import { formatDuration } from "../../lib/timing";

const MAX_PAGE_SIZE = 50;

// Re-export for backwards compatibility
export { formatDuration };

/**
 * Get status icon
 */
function icon(ok: boolean): string {
  return ok ? "✅" : "❌";
}

/**
 * Print status in text format
 */
export function printStatus(
  status: StatusResult,
  logger: Logger,
  verbose = false,
): void {
  logger.section("Project Status");

  // Branch
  logger.info(`${icon(status.branch.isCorrect)} Branch: ${status.branch.name}`);

  // Git status
  if (status.git.hasChanges) {
    const changes = status.git.modified + status.git.untracked;
    logger.info(
      `⚠️  Working tree: ${changes} changes (${status.git.staged} staged)`,
    );
  } else {
    logger.info(`${icon(true)} Working tree: clean`);
  }

  // Typecheck
  const typecheckStatus = status.typecheck.status;
  const typecheckOk =
    typecheckStatus === "passed" || typecheckStatus === "skipped";
  const typecheckSuffix = status.typecheck.cached ? " (cached)" : "";
  logger.info(
    `${icon(typecheckOk)} Typecheck: ${typecheckStatus}${typecheckSuffix}`,
  );

  // Lint
  const lintOk = status.lint.errors === 0;
  logger.info(
    `${icon(lintOk)} Lint: ${status.lint.warnings} warnings, ${status.lint.errors} errors`,
  );

  // TODOs
  const todoIcon =
    status.todos.count > MAX_PAGE_SIZE
      ? "⚠️ "
      : status.todos.count > 0
        ? "📝"
        : "✅";
  logger.info(`${todoIcon} TODOs: ${status.todos.count}`);

  // Verbose mode - show additional info
  if (verbose) {
    console.log("");
    if (status.typecheck.errors) {
      logger.warn("Typecheck errors:");
      console.log(status.typecheck.errors);
    }
  }

  // Health summary
  console.log("");
  const healthIcon =
    status.health === "good" ? "🟢" : status.health === "warning" ? "🟡" : "🔴";
  logger.info(
    `${healthIcon} Health: ${status.health.toUpperCase()} (${formatDuration(status.durationMs)})`,
  );
}

/**
 * Format status as JSON
 */
export function formatJson(status: StatusResult): string {
  return JSON.stringify(status, null, 2);
}

/**
 * Format status as markdown
 */
export function formatMarkdown(status: StatusResult): string {
  const healthEmoji =
    status.health === "good" ? "🟢" : status.health === "warning" ? "🟡" : "🔴";

  return `# Project Status

${healthEmoji} **Health: ${status.health.toUpperCase()}**

## Git
- **Branch:** ${status.branch.name}
- **Changes:** ${status.git.modified} modified, ${status.git.untracked} untracked, ${status.git.staged} staged

## Checks
- **Typecheck:** ${status.typecheck.status}${status.typecheck.cached ? " (cached)" : ""}
- **Lint:** ${status.lint.warnings} warnings, ${status.lint.errors} errors
- **TODOs:** ${status.todos.count}

---
*Completed in ${formatDuration(status.durationMs)}*
`;
}
