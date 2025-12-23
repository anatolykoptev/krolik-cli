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

import chalk from "chalk";
import type { CommandContext } from "../../types";
import type { FixOptions, FixResult, QualityOptions } from "./types";
import { analyzeQuality } from "./analyze";
import { formatAI as formatQualityAI, formatText as formatQualityText } from "./output";
import { checkRecommendations, getTopRecommendations, type RecommendationResult } from "./recommendations";
import { generateFixPlan, type FixPlan } from "./plan";
import { formatPlanForAI, formatPlan, formatResults } from "./formatters";
import { applyFix } from "./applier";
import { createBackupBranch, isGitRepo } from "./git-backup";
import {
  isBiomeAvailable,
  hasBiomeConfig,
  biomeAutoFix,
  getBiomeVersion,
  type BiomeResult,
  isTscAvailable,
  hasTsConfig,
  runTypeCheck,
  formatAsJson,
  formatAsXml,
  formatAsText,
  getSummaryLine,
  type TsCheckResult,
} from "./strategies/shared";

// Re-export types
export type { FixOptions, FixResult, FixOperation } from "./types";
export { getFixDifficulty } from "./types";
export { findStrategy } from "./strategies";
export { applyFix, applyFixes, createBackup, rollbackFix } from "./applier";

// ============================================================================
// BIOME INTEGRATION
// ============================================================================

/**
 * Run Biome auto-fix if available
 */
function runBiomeFixes(
  projectRoot: string,
  targetPath: string | undefined,
  logger: { info: (msg: string) => void; debug: (msg: string) => void },
  dryRun: boolean,
): BiomeResult | null {
  if (!isBiomeAvailable(projectRoot)) {
    logger.debug("Biome not available in this project");
    return null;
  }

  if (!hasBiomeConfig(projectRoot)) {
    logger.debug("No biome.json found - skipping Biome");
    return null;
  }

  const version = getBiomeVersion(projectRoot);
  logger.info(`Running Biome${version ? ` (${version})` : ""}...`);

  if (dryRun) {
    return { success: true, diagnostics: [], filesFixed: 0 };
  }

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
  const lines: string[] = ["", chalk.bold("🔧 Biome Auto-Fix")];

  if (dryRun) {
    lines.push(chalk.yellow("  (dry run - would run biome check --apply)"));
    return lines.join("\n");
  }

  if (result.success) {
    lines.push(
      result.filesFixed > 0
        ? chalk.green(`  ✅ Fixed ${result.filesFixed} files`)
        : chalk.green("  ✨ No issues to fix"),
    );
  } else {
    lines.push(chalk.red(`  ❌ Error: ${result.error || "Unknown error"}`));
  }

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
 */
function runTsCheck(
  projectRoot: string,
  targetPath: string | undefined,
  logger: { info: (msg: string) => void; debug: (msg: string) => void },
): TsCheckResult | null {
  if (!isTscAvailable(projectRoot)) {
    logger.debug("TypeScript not available in this project");
    return null;
  }

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
function formatTsResults(result: TsCheckResult, format: 'json' | 'xml' | 'text' = 'json'): string {
  const lines: string[] = ["", chalk.bold("🔍 TypeScript Type Check")];

  if (result.success) {
    lines.push(chalk.green(`  ✅ No errors (${result.duration}ms)`));
    return lines.join("\n");
  }

  lines.push(chalk.red(`  ❌ ${result.errorCount} errors, ${result.warningCount} warnings (${result.duration}ms)`));
  lines.push("");

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
    default:
      lines.push(formatAsText(result));
  }
  return lines.join("\n");
}

// ============================================================================
// ANALYZE-ONLY MODE
// ============================================================================

/**
 * Run analyze-only mode (replaces quality command)
 */
async function runAnalyzeOnly(
  projectRoot: string,
  options: FixOptions,
): Promise<void> {
  const qualityOpts: QualityOptions = {};
  if (options.path) qualityOpts.path = options.path;
  if (options.category) qualityOpts.category = options.category;

  const { report, fileContents } = await analyzeQuality(projectRoot, qualityOpts);

  // Collect recommendations if enabled
  if (options.recommendations !== false) {
    const allRecommendations = collectRecommendations(report.files, fileContents);
    report.recommendations = formatRecommendations(allRecommendations);
  }

  // Output based on format
  const format = options.format ?? 'ai';
  console.log(
    format === 'text'
      ? formatQualityText(report, qualityOpts)
      : formatQualityAI(report, fileContents),
  );
}

/**
 * Collect recommendations from all files
 */
function collectRecommendations(
  files: Array<{ path: string }>,
  fileContents: Map<string, string>,
): RecommendationResult[] {
  const allRecommendations: RecommendationResult[] = [];

  for (const analysis of files) {
    const content = fileContents.get(analysis.path);
    if (content) {
      const recs = checkRecommendations(content, analysis as Parameters<typeof checkRecommendations>[1]);
      allRecommendations.push(...recs);
    }
  }

  return allRecommendations;
}

/**
 * Format recommendations for report
 */
function formatRecommendations(allRecommendations: RecommendationResult[]) {
  const topRecs = getTopRecommendations(allRecommendations, 10);

  return topRecs.map(rec => {
    const matching = allRecommendations.find(r => r.recommendation.id === rec.id);
    return {
      id: rec.id,
      title: rec.title,
      description: rec.description,
      category: rec.category,
      severity: rec.severity,
      file: matching?.file ?? '',
      line: matching?.line,
      snippet: matching?.snippet,
      count: allRecommendations.filter(r => r.recommendation.id === rec.id).length,
    };
  });
}

// ============================================================================
// APPLY FIXES
// ============================================================================

/**
 * Apply fixes to files
 */
async function applyFixes(
  plans: FixPlan[],
  options: FixOptions,
  projectRoot: string,
  logger: { info: (msg: string) => void; debug: (msg: string) => void; error: (msg: string) => void; warn: (msg: string) => void },
): Promise<FixResult[]> {
  // Create git backup
  const backupBranchName = await createGitBackup(projectRoot, logger);

  // Apply fixes
  logger.info("Applying fixes...");
  const results: FixResult[] = [];

  for (const plan of plans) {
    for (const { issue, operation } of plan.fixes) {
      const result = applyFix(operation, issue, { backup: options.backup ?? false });
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
  showBackupInfo(backupBranchName, results);

  return results;
}

/**
 * Create git backup branch
 */
async function createGitBackup(
  projectRoot: string,
  logger: { info: (msg: string) => void },
): Promise<string | undefined> {
  if (!isGitRepo(projectRoot)) {
    console.log(chalk.dim("Not a git repo - skipping backup"));
    return undefined;
  }

  logger.info("Creating git backup branch...");
  const backupResult = createBackupBranch(projectRoot);

  if (backupResult.success) {
    console.log(chalk.green(`✅ Backup branch created: ${backupResult.branchName}`));
    if (backupResult.hadUncommittedChanges) {
      console.log(chalk.dim("   (uncommitted changes saved to backup)"));
    }
    return backupResult.branchName;
  }

  console.log(chalk.yellow(`⚠️  Could not create backup: ${backupResult.error}`));
  console.log(chalk.dim("   Proceeding without git backup..."));
  return undefined;
}

/**
 * Show backup info after applying fixes
 */
function showBackupInfo(backupBranchName: string | undefined, results: FixResult[]): void {
  if (!backupBranchName) return;

  const failed = results.filter(r => !r.success);
  console.log("");

  if (failed.length > 0) {
    console.log(chalk.yellow(`💾 Backup available: git checkout ${backupBranchName}`));
    console.log(chalk.dim(`   To restore: git checkout ${backupBranchName} -- .`));
  } else {
    console.log(chalk.dim(`💾 Backup branch: ${backupBranchName}`));
    console.log(chalk.dim(`   To delete: git branch -D ${backupBranchName}`));
  }
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

  // Step 0: TypeScript check
  if (await runTypecheckStep(config.projectRoot, options, logger)) return;

  // Step 1: Biome fixes
  if (await runBiomeStep(config.projectRoot, options, logger)) return;

  // Step 2: Analyze-only mode
  if (options.analyzeOnly) {
    logger.info("Analyzing code quality...");
    await runAnalyzeOnly(config.projectRoot, options);
    return;
  }

  // Step 3: Generate and show fix plan
  logger.info("Analyzing code quality...");
  const { plans, skipStats, totalIssues } = await generateFixPlan(config.projectRoot, options);

  // Show plan
  const format = options.format ?? 'ai';
  console.log(
    format === 'text'
      ? formatPlan(plans, skipStats, totalIssues, options)
      : formatPlanForAI(plans, skipStats, totalIssues),
  );

  // Stop if dry run
  if (options.dryRun) return;

  // Count fixes
  const totalFixes = plans.reduce((sum, p) => sum + p.fixes.length, 0);
  if (totalFixes === 0) return;

  // Confirm unless --yes
  if (!options.yes) {
    console.log("");
    console.log(chalk.yellow("⚠️  This will modify your files."));
    console.log(chalk.dim("Use --dry-run to preview changes without applying."));
    console.log(chalk.dim("Use --yes to skip this confirmation."));
    console.log("");
    logger.warn("Pass --yes to apply fixes");
    return;
  }

  // Apply fixes
  await applyFixes(plans, options, config.projectRoot, logger);
}

/**
 * Run TypeScript check step
 * @returns true if should stop processing
 */
async function runTypecheckStep(
  projectRoot: string,
  options: FixOptions,
  logger: { info: (msg: string) => void; debug: (msg: string) => void; warn: (msg: string) => void },
): Promise<boolean> {
  const shouldRun = !options.noTypecheck && (options.typecheck || options.typecheckOnly || true);

  if (shouldRun) {
    const tsResult = runTsCheck(projectRoot, options.path, logger);
    if (tsResult) {
      console.log(formatTsResults(tsResult, options.typecheckFormat ?? 'json'));
    }
  }

  if (options.typecheckOnly) {
    if (!runTsCheck(projectRoot, options.path, logger)) {
      logger.warn("TypeScript not available in this project");
    }
    return true;
  }

  return false;
}

/**
 * Run Biome step
 * @returns true if should stop processing
 */
async function runBiomeStep(
  projectRoot: string,
  options: FixOptions,
  logger: { info: (msg: string) => void; debug: (msg: string) => void; warn: (msg: string) => void },
): Promise<boolean> {
  const shouldRun = !options.noBiome && (options.biome || options.biomeOnly || true);

  if (shouldRun) {
    const biomeResult = runBiomeFixes(projectRoot, options.path, logger, options.dryRun ?? false);
    if (biomeResult) {
      console.log(formatBiomeResults(biomeResult, options.dryRun ?? false));
    }
  }

  if (options.biomeOnly) {
    if (!runBiomeFixes(projectRoot, options.path, logger, false)) {
      logger.warn("Biome not available in this project");
    }
    return true;
  }

  return false;
}
