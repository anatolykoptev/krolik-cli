/**
 * @module commands/fix/formatters/plan-text
 * @description CLI text formatter for fix plans
 */

import * as fs from "node:fs";
import chalk from "chalk";
import type { FixOperation, FixResult, QualityIssue } from "../types";
import { FixPlanItem, FixPlan, SkipStats } from "../plan";

const MAX_PAGE_SIZE = 50;
const DIFF_CONTEXT_LINES = 3;

// ============================================================================
// TYPES
// ============================================================================

interface FormatOptions {
  dryRun?: boolean;
  showDiff?: boolean;
}

// ============================================================================
// DIFF GENERATION
// ============================================================================

/**
 * Generate unified diff for a fix operation
 */
function generateUnifiedDiff(filepath: string, operation: FixOperation): string[] {
  const lines: string[] = [];

  // Try to read the file for context
  let fileLines: string[] = [];
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    fileLines = content.split("\n");
  } catch {
    return formatSimpleDiff(operation);
  }

  const lineNum = operation.line ?? 1;
  const endLineNum = operation.endLine ?? lineNum;

  // Header
  lines.push(chalk.bold(`--- a/${operation.file}`));
  lines.push(chalk.bold(`+++ b/${operation.file}`));

  // Calculate context range
  const startContext = Math.max(0, lineNum - 1 - DIFF_CONTEXT_LINES);
  const endContext = Math.min(fileLines.length, endLineNum + DIFF_CONTEXT_LINES);

  // Hunk header
  const oldLines = endLineNum - lineNum + 1;
  const newLines = operation.action === "delete-line" ? 0 :
                   operation.newCode?.split("\n").length ?? oldLines;
  lines.push(chalk.cyan(`@@ -${lineNum},${oldLines} +${lineNum},${newLines} @@`));

  // Context before
  for (let i = startContext; i < lineNum - 1; i++) {
    lines.push(chalk.dim(` ${fileLines[i] ?? ""}`));
  }

  // Show the change
  if (operation.action === "delete-line" || operation.action === "replace-line" || operation.action === "replace-range") {
    for (let i = lineNum - 1; i < endLineNum && i < fileLines.length; i++) {
      lines.push(chalk.red(`-${fileLines[i] ?? ""}`));
    }
  }

  if (operation.action !== "delete-line" && operation.newCode) {
    const newCodeLines = operation.newCode.split("\n");
    for (const newLine of newCodeLines) {
      lines.push(chalk.green(`+${newLine}`));
    }
  }

  // Context after
  for (let i = endLineNum; i < endContext; i++) {
    lines.push(chalk.dim(` ${fileLines[i] ?? ""}`));
  }

  return lines;
}

/**
 * Simple diff when file can't be read
 */
function formatSimpleDiff(operation: FixOperation): string[] {
  const lines: string[] = [];

  if (operation.oldCode) {
    for (const line of operation.oldCode.split("\n")) {
      lines.push(chalk.red(`- ${line}`));
    }
  }

  if (operation.newCode) {
    for (const line of operation.newCode.split("\n")) {
      lines.push(chalk.green(`+ ${line}`));
    }
  }

  return lines;
}

// ============================================================================
// FIX ITEM FORMATTER
// ============================================================================

/**
 * Format single fix item
 */
function formatFixItem(
  item: FixPlanItem,
  options: FormatOptions,
): string[] {
  const { issue, operation, difficulty } = item;
  const lines: string[] = [];

  const diffIcon = difficulty === "trivial" ? "✅" : difficulty === "safe" ? "🔶" : "⚠️";
  const action = chalk.yellow(operation.action);
  const line = issue.line ? `:${issue.line}` : "";

  lines.push(`  ${diffIcon} ${action} ${line}`);
  lines.push(`     ${chalk.dim(issue.message)}`);

  // Show unified diff if --diff flag is set
  if (options.showDiff && options.dryRun) {
    lines.push("");
    const diffLines = generateUnifiedDiff(issue.file, operation);
    for (const diffLine of diffLines) {
      lines.push(`     ${diffLine}`);
    }
    lines.push("");
  } else {
    // Show compact preview
    if (operation.oldCode && operation.action !== "insert-before") {
      const preview = operation.oldCode.slice(0, MAX_PAGE_SIZE).replace(/\n/g, "↵");
      lines.push(
        `     ${chalk.red("- " + preview)}${operation.oldCode.length > MAX_PAGE_SIZE ? "..." : ""}`,
      );
    }

    if (operation.newCode && operation.action !== "delete-line") {
      const preview = operation.newCode.slice(0, MAX_PAGE_SIZE).replace(/\n/g, "↵");
      lines.push(
        `     ${chalk.green("+ " + preview)}${operation.newCode.length > MAX_PAGE_SIZE ? "..." : ""}`,
      );
    }
  }

  return lines;
}

// ============================================================================
// SKIP STATS FORMATTER
// ============================================================================

/**
 * Format skip statistics
 */
function formatSkipStats(skipStats: SkipStats, totalIssues: number): string[] {
  const lines: string[] = [];

  lines.push(chalk.dim(`Analyzed ${totalIssues} issues:`));

  if (skipStats.noStrategy > 0) {
    lines.push(chalk.dim(`  • ${skipStats.noStrategy} have no fix strategy (size, hardcoded, etc)`));
  }
  if (skipStats.noFix > 0) {
    lines.push(chalk.dim(`  • ${skipStats.noFix} could not generate fix (complex patterns)`));
  }
  if (skipStats.contextSkipped > 0) {
    lines.push(chalk.dim(`  • ${skipStats.contextSkipped} skipped by context (CLI output, tests)`));
  }

  // Show by category
  const cats = [...skipStats.categories.entries()];
  if (cats.length > 0) {
    lines.push("");
    lines.push(chalk.dim("By category:"));
    for (const [cat, count] of cats) {
      const fixable = cat === "lint" ? "(partially fixable)" : "(manual fix needed)";
      lines.push(chalk.dim(`  • ${cat}: ${count} ${fixable}`));
    }
  }

  return lines;
}

// ============================================================================
// MAIN FORMATTERS
// ============================================================================

/**
 * Format fix plan for CLI display
 */
export function formatPlan(
  plans: FixPlan[],
  skipStats: SkipStats,
  totalIssues: number,
  options: FormatOptions,
): string {
  const lines: string[] = [];
  let totalFixes = 0;

  for (const plan of plans) {
    if (plan.fixes.length === 0) continue;

    lines.push("");
    lines.push(chalk.cyan(`📁 ${plan.file}`));

    for (const item of plan.fixes) {
      totalFixes++;
      lines.push(...formatFixItem(item, options));
    }
  }

  if (totalFixes === 0) {
    lines.push("");
    lines.push(chalk.green("✨ No auto-fixable issues found!"));

    if (totalIssues > 0) {
      lines.push("");
      lines.push(...formatSkipStats(skipStats, totalIssues));
    }
  } else {
    lines.push("");
    lines.push(chalk.bold(`Total: ${totalFixes} fixes in ${plans.length} files`));

    if (options.dryRun) {
      lines.push(chalk.yellow("(dry run - no changes made)"));
    }
  }

  return lines.join("\n");
}

/**
 * Format results after applying fixes
 */
export function formatResults(results: FixResult[]): string {
  const lines: string[] = [];
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  lines.push("");
  lines.push(chalk.bold("Fix Results:"));
  lines.push(chalk.green(`  ✅ ${successful.length} fixes applied`));

  if (failed.length > 0) {
    lines.push(chalk.red(`  ❌ ${failed.length} fixes failed`));
    for (const result of failed) {
      lines.push(
        chalk.red(`     ${result.issue.file}:${result.issue.line} - ${result.error}`),
      );
    }
  }

  return lines.join("\n");
}

// Re-export for convenience
export { generateUnifiedDiff, formatSimpleDiff };
