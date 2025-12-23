/**
 * @module commands/fix
 * @description Autofixer for code quality issues
 *
 * Usage:
 *   krolik fix                      # Fix issues in current directory
 *   krolik fix --path=apps/web      # Fix issues in specific path
 *   krolik fix --dry-run            # Show what would be fixed
 *   krolik fix --trivial            # Only fix trivial issues (console, debugger)
 *   krolik fix --category=lint      # Only fix lint issues
 *   krolik fix --yes                # Auto-confirm all fixes
 *   krolik fix --biome              # Run Biome auto-fix first (default if available)
 *   krolik fix --biome-only         # Only run Biome, skip custom fixes
 *   krolik fix --no-biome           # Skip Biome even if available
 *   krolik fix --typecheck          # Run TypeScript check first (default)
 *   krolik fix --typecheck-only     # Only run TypeScript check
 *   krolik fix --no-typecheck       # Skip TypeScript check
 *   krolik fix --typecheck-format=json  # Output format (json, xml, text)
 */

import * as fs from "node:fs";
import chalk from "chalk";
import type { CommandContext } from "../../types";
import type { FixOptions, FixResult, FixOperation } from "./types";
import { getFixDifficulty } from "./types";
import { analyzeQuality } from "../quality";
import { findStrategyDetailed } from "./strategies";
import { applyFix } from "./applier";
import { createBackupBranch, isGitRepo } from "./git-backup";
import {
  // Biome
  isBiomeAvailable,
  hasBiomeConfig,
  biomeAutoFix,
  getBiomeVersion,
  type BiomeResult,
  // TypeScript
  isTscAvailable,
  hasTsConfig,
  runTypeCheck,
  formatAsJson,
  formatAsXml,
  formatAsText,
  getSummaryLine,
  type TsCheckResult,
} from "./strategies/shared";

const MAX_PAGE_SIZE = 50;

// ============================================================================
// BIOME INTEGRATION
// ============================================================================

/**
 * Run Biome auto-fix if available
 * @returns Result with filesFixed count, or null if Biome not available
 */
function runBiomeFixes(
  projectRoot: string,
  targetPath: string | undefined,
  logger: { info: (msg: string) => void; debug: (msg: string) => void },
  dryRun: boolean,
): BiomeResult | null {
  // Check if Biome is available
  if (!isBiomeAvailable(projectRoot)) {
    logger.debug("Biome not available in this project");
    return null;
  }

  // Check for biome.json config
  if (!hasBiomeConfig(projectRoot)) {
    logger.debug("No biome.json found - skipping Biome");
    return null;
  }

  const version = getBiomeVersion(projectRoot);
  logger.info(`Running Biome${version ? ` (${version})` : ""}...`);

  if (dryRun) {
    // In dry run, just report that Biome would run
    return {
      success: true,
      diagnostics: [],
      filesFixed: 0,
    };
  }

  // Run biome check --apply
  const result = biomeAutoFix(projectRoot, targetPath);

  if (result.success) {
    logger.debug(`Biome fixed ${result.filesFixed} files`);
  } else if (result.error) {
    logger.debug(`Biome error: ${result.error}`);
  }

  return result;
}

/**
 * Format Biome results for display
 */
function formatBiomeResults(result: BiomeResult, dryRun: boolean): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("🔧 Biome Auto-Fix"));

  if (dryRun) {
    lines.push(chalk.yellow("  (dry run - would run biome check --apply)"));
    return lines.join("\n");
  }

  if (result.success) {
    if (result.filesFixed > 0) {
      lines.push(chalk.green(`  ✅ Fixed ${result.filesFixed} files`));
    } else {
      lines.push(chalk.green("  ✨ No issues to fix"));
    }
  } else {
    lines.push(chalk.red(`  ❌ Error: ${result.error || "Unknown error"}`));
  }

  // Show remaining diagnostics if any
  if (result.diagnostics.length > 0) {
    lines.push(chalk.dim(`  📋 ${result.diagnostics.length} issues remain (manual fix needed)`));
  }

  return lines.join("\n");
}

// ============================================================================
// TYPESCRIPT INTEGRATION
// ============================================================================

/**
 * Run TypeScript type check
 * @returns Check result with diagnostics, or null if tsc not available
 */
function runTsCheck(
  projectRoot: string,
  targetPath: string | undefined,
  logger: { info: (msg: string) => void; debug: (msg: string) => void },
): TsCheckResult | null {
  // Check if tsc is available
  if (!isTscAvailable(projectRoot)) {
    logger.debug("TypeScript not available in this project");
    return null;
  }

  // Check for tsconfig.json
  if (!hasTsConfig(projectRoot)) {
    logger.debug("No tsconfig.json found - skipping TypeScript check");
    return null;
  }

  logger.info("Running TypeScript type check...");

  const result = runTypeCheck(projectRoot, targetPath);

  logger.debug(getSummaryLine(result));

  return result;
}

/**
 * Format TypeScript results based on requested format
 */
function formatTsResults(
  result: TsCheckResult,
  format: 'json' | 'xml' | 'text' = 'json',
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("🔍 TypeScript Type Check"));

  if (result.success) {
    lines.push(chalk.green(`  ✅ No errors (${result.duration}ms)`));
    return lines.join("\n");
  }

  lines.push(chalk.red(`  ❌ ${result.errorCount} errors, ${result.warningCount} warnings (${result.duration}ms)`));
  lines.push("");

  // Output in requested format
  switch (format) {
    case 'json':
      lines.push(chalk.dim("  <typescript-errors format=\"json\">"));
      lines.push(formatAsJson(result));
      lines.push(chalk.dim("  </typescript-errors>"));
      break;
    case 'xml':
      lines.push(chalk.dim("  <typescript-errors format=\"xml\">"));
      lines.push(formatAsXml(result));
      lines.push(chalk.dim("  </typescript-errors>"));
      break;
    case 'text':
    default:
      lines.push(formatAsText(result));
      break;
  }

  return lines.join("\n");
}

// ============================================================================
// TYPES
// ============================================================================

export type { FixOptions, FixResult, FixOperation };

interface FixPlan {
  file: string;
  fixes: Array<{
    issue: import("../quality/types").QualityIssue;
    operation: FixOperation;
    difficulty: "trivial" | "safe" | "risky";
  }>;
}

interface SkipStats {
  noStrategy: number; // No strategy for this category
  noContent: number; // File content not available
  contextSkipped: number; // Skipped by context (CLI output, etc)
  noFix: number; // Strategy couldn't generate fix
  categories: Map<string, number>;
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

/**
 * Generate fix plan from quality report
 */
async function generateFixPlan(
  projectRoot: string,
  options: FixOptions,
): Promise<{ plans: FixPlan[]; skipStats: SkipStats; totalIssues: number }> {
  const qualityOptions: Parameters<typeof analyzeQuality>[1] = {};
  if (options.path) qualityOptions.path = options.path;
  if (options.category) qualityOptions.category = options.category;

  const { report, fileContents } = await analyzeQuality(
    projectRoot,
    qualityOptions,
  );

  // Collect ALL issues from all files, not just topIssues (which is limited to 20)
  // Apply category filter if specified (since files[] contains all issues)
  const allIssues: import("../quality/types").QualityIssue[] = [];
  for (const fileAnalysis of report.files) {
    for (const issue of fileAnalysis.issues) {
      if (options.category && issue.category !== options.category) {
        continue;
      }
      allIssues.push(issue);
    }
  }

  const plans: Map<string, FixPlan> = new Map();
  const skipStats: SkipStats = {
    noStrategy: 0,
    noContent: 0,
    contextSkipped: 0,
    noFix: 0,
    categories: new Map(),
  };

  for (const issue of allIssues) {
    // Track category
    const cat = issue.category;
    skipStats.categories.set(cat, (skipStats.categories.get(cat) || 0) + 1);

    // Filter by difficulty if trivialOnly
    const difficulty = getFixDifficulty(issue);
    if (options.trivialOnly && difficulty !== "trivial") {
      continue;
    }

    // Get file content
    const content = fileContents.get(issue.file) || "";
    if (!content) {
      skipStats.noContent++;
      continue;
    }

    // Find strategy for this issue
    const strategyResult = findStrategyDetailed(issue, content);

    if (strategyResult.status === "no-strategy") {
      skipStats.noStrategy++;
      continue;
    }

    if (strategyResult.status === "context-skipped") {
      skipStats.contextSkipped++;
      continue;
    }

    // Generate fix operation (async to support formatting)
    const operation = await strategyResult.strategy.generateFix(issue, content);
    if (!operation) {
      skipStats.noFix++;
      continue;
    }

    // Add to plan - ONE fix per file only to avoid conflicts
    // When fix replaces entire file content, multiple fixes on same file
    // would conflict because each is based on original content
    let plan = plans.get(issue.file);
    if (!plan) {
      plan = { file: issue.file, fixes: [] };
      plans.set(issue.file, plan);
      plan.fixes.push({ issue, operation, difficulty });
    }
    // Skip additional fixes for this file - user needs to run fix again
  }

  // Apply limit if specified
  let allPlans = [...plans.values()];
  if (options.limit) {
    let count = 0;
    allPlans = allPlans
      .map((plan) => {
        const remaining = options.limit! - count;
        if (remaining <= 0) {
          return { ...plan, fixes: [] };
        }
        count += plan.fixes.length;
        if (plan.fixes.length > remaining) {
          return { ...plan, fixes: plan.fixes.slice(0, remaining) };
        }
        return plan;
      })
      .filter((plan) => plan.fixes.length > 0);
  }

  return { plans: allPlans, skipStats, totalIssues: allIssues.length };
}

// ============================================================================
// FORMATTING
// ============================================================================

const DIFF_CONTEXT_LINES = 3;

/**
 * Generate unified diff for a fix operation
 */
function generateUnifiedDiff(
  filepath: string,
  operation: FixOperation,
): string[] {
  const lines: string[] = [];

  // Try to read the file for context
  let fileLines: string[] = [];
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    fileLines = content.split("\n");
  } catch {
    // File not readable, show simple diff
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
    // Show old lines being removed
    for (let i = lineNum - 1; i < endLineNum && i < fileLines.length; i++) {
      lines.push(chalk.red(`-${fileLines[i] ?? ""}`));
    }
  }

  if (operation.action !== "delete-line" && operation.newCode) {
    // Show new lines being added
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

/**
 * Format fix plan for display
 */
function formatPlan(
  plans: FixPlan[],
  skipStats: SkipStats,
  totalIssues: number,
  options: FixOptions,
): string {
  const lines: string[] = [];
  let totalFixes = 0;

  for (const plan of plans) {
    if (plan.fixes.length === 0) continue;

    lines.push("");
    lines.push(chalk.cyan(`📁 ${plan.file}`));

    for (const { issue, operation, difficulty } of plan.fixes) {
      totalFixes++;
      const diffIcon =
        difficulty === "trivial" ? "✅" : difficulty === "safe" ? "🔶" : "⚠️";
      const action = chalk.yellow(operation.action);
      const line = issue.line ? `:${issue.line}` : "";

      lines.push(`  ${diffIcon} ${action} ${line}`);
      lines.push(`     ${chalk.dim(issue.message)}`);

      // Show unified diff if --diff flag is set
      if (options.showDiff && options.dryRun) {
        lines.push("");
        const diffLines = generateUnifiedDiff(plan.file, operation);
        for (const diffLine of diffLines) {
          lines.push(`     ${diffLine}`);
        }
        lines.push("");
      } else {
        // Show compact preview
        if (operation.oldCode && operation.action !== "insert-before") {
          const preview = operation.oldCode
            .slice(0, MAX_PAGE_SIZE)
            .replace(/\n/g, "↵");
          lines.push(
            `     ${chalk.red("- " + preview)}${operation.oldCode.length > MAX_PAGE_SIZE ? "..." : ""}`,
          );
        }

        if (operation.newCode && operation.action !== "delete-line") {
          const preview = operation.newCode
            .slice(0, MAX_PAGE_SIZE)
            .replace(/\n/g, "↵");
          lines.push(
            `     ${chalk.green("+ " + preview)}${operation.newCode.length > MAX_PAGE_SIZE ? "..." : ""}`,
          );
        }
      }
    }
  }

  if (totalFixes === 0) {
    lines.push("");
    lines.push(chalk.green("✨ No auto-fixable issues found!"));

    // Show why issues were skipped
    if (totalIssues > 0) {
      lines.push("");
      lines.push(chalk.dim(`Analyzed ${totalIssues} issues:`));

      if (skipStats.noStrategy > 0) {
        lines.push(
          chalk.dim(
            `  • ${skipStats.noStrategy} have no fix strategy (size, hardcoded, etc)`,
          ),
        );
      }
      if (skipStats.noFix > 0) {
        lines.push(
          chalk.dim(
            `  • ${skipStats.noFix} could not generate fix (complex patterns)`,
          ),
        );
      }
      if (skipStats.contextSkipped > 0) {
        lines.push(
          chalk.dim(
            `  • ${skipStats.contextSkipped} skipped by context (CLI output, tests)`,
          ),
        );
      }

      // Show by category
      const cats = [...skipStats.categories.entries()];
      if (cats.length > 0) {
        lines.push("");
        lines.push(chalk.dim("By category:"));
        for (const [cat, count] of cats) {
          const fixable =
            cat === "lint" ? "(partially fixable)" : "(manual fix needed)";
          lines.push(chalk.dim(`  • ${cat}: ${count} ${fixable}`));
        }
      }
    }
  } else {
    lines.push("");
    lines.push(
      chalk.bold(`Total: ${totalFixes} fixes in ${plans.length} files`),
    );

    if (options.dryRun) {
      lines.push(chalk.yellow("(dry run - no changes made)"));
    }
  }

  return lines.join("\n");
}

/**
 * Format results after applying fixes
 */
function formatResults(results: FixResult[]): string {
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
        chalk.red(
          `     ${result.issue.file}:${result.issue.line} - ${result.error}`,
        ),
      );
    }
  }

  return lines.join("\n");
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

/**
 * Run fix command
 */
export async function runFix(
  ctx: CommandContext & { options: FixOptions },
): Promise<void> {
  const { config, logger, options } = ctx;

  // ========================================================================
  // STEP 0: Run TypeScript check (if available and not disabled)
  // ========================================================================

  const shouldRunTypecheck = !options.noTypecheck && (options.typecheck || options.typecheckOnly || true);
  let tsResult: TsCheckResult | null = null;

  if (shouldRunTypecheck) {
    tsResult = runTsCheck(config.projectRoot, options.path, logger);

    if (tsResult) {
      console.log(formatTsResults(tsResult, options.typecheckFormat ?? 'json'));
    }
  }

  // If --typecheck-only, stop here
  if (options.typecheckOnly) {
    if (!tsResult) {
      logger.warn("TypeScript not available in this project");
    }
    return;
  }

  // ========================================================================
  // STEP 1: Run Biome (if available and not disabled)
  // ========================================================================

  const shouldRunBiome = !options.noBiome && (options.biome || options.biomeOnly || true);
  let biomeResult: BiomeResult | null = null;

  if (shouldRunBiome) {
    biomeResult = runBiomeFixes(
      config.projectRoot,
      options.path,
      logger,
      options.dryRun ?? false,
    );

    if (biomeResult) {
      console.log(formatBiomeResults(biomeResult, options.dryRun ?? false));
    }
  }

  // If --biome-only, stop here
  if (options.biomeOnly) {
    if (!biomeResult) {
      logger.warn("Biome not available in this project");
    }
    return;
  }

  // ========================================================================
  // STEP 2: Run custom fixes
  // ========================================================================

  logger.info("Analyzing code quality...");

  // Generate fix plan
  const { plans, skipStats, totalIssues } = await generateFixPlan(
    config.projectRoot,
    options,
  );

  // Show plan
  console.log(formatPlan(plans, skipStats, totalIssues, options));

  // If dry run, stop here
  if (options.dryRun) {
    return;
  }

  // Count total fixes
  const totalFixes = plans.reduce(
    (sum: number, p: FixPlan) => sum + p.fixes.length,
    0,
  );

  if (totalFixes === 0) {
    return;
  }

  // Confirm unless --yes
  if (!options.yes) {
    console.log("");
    console.log(chalk.yellow("⚠️  This will modify your files."));
    console.log(
      chalk.dim("Use --dry-run to preview changes without applying."),
    );
    console.log(chalk.dim("Use --yes to skip this confirmation."));
    console.log("");

    // In CLI we'd use readline, but for now just require --yes
    logger.warn("Pass --yes to apply fixes");
    return;
  }

  // Create git backup branch before applying fixes
  let backupBranchName: string | undefined;

  if (isGitRepo(config.projectRoot)) {
    logger.info("Creating git backup branch...");
    const backupResult = createBackupBranch(config.projectRoot);

    if (backupResult.success) {
      backupBranchName = backupResult.branchName;
      console.log(chalk.green(`✅ Backup branch created: ${backupBranchName}`));
      if (backupResult.hadUncommittedChanges) {
        console.log(chalk.dim("   (uncommitted changes saved to backup)"));
      }
    } else {
      console.log(
        chalk.yellow(`⚠️  Could not create backup: ${backupResult.error}`),
      );
      console.log(chalk.dim("   Proceeding without git backup..."));
    }
  } else {
    console.log(chalk.dim("Not a git repo - skipping backup"));
  }

  // Apply fixes
  logger.info("Applying fixes...");
  const results: FixResult[] = [];

  for (const plan of plans) {
    for (const { issue, operation } of plan.fixes) {
      const result = applyFix(operation, issue, {
        backup: options.backup ?? false,
      });
      results.push(result);

      if (result.success) {
        logger.debug(`Fixed: ${issue.file}:${issue.line}`);
      } else {
        logger.error(`Failed: ${issue.file}:${issue.line} - ${result.error}`);
      }
    }
  }

  // Show results
  console.log(formatResults(results));

  // Show backup info
  const failed = results.filter((r) => !r.success);
  if (backupBranchName) {
    console.log("");
    if (failed.length > 0) {
      console.log(
        chalk.yellow(`💾 Backup available: git checkout ${backupBranchName}`),
      );
      console.log(
        chalk.dim("   To restore: git checkout " + backupBranchName + " -- ."),
      );
    } else {
      console.log(chalk.dim(`💾 Backup branch: ${backupBranchName}`));
      console.log(chalk.dim(`   To delete: git branch -D ${backupBranchName}`));
    }
  }
}

// Re-export types
export { getFixDifficulty } from "./types";
export { findStrategy } from "./strategies";
export { applyFix, applyFixes, createBackup, rollbackFix } from "./applier";
