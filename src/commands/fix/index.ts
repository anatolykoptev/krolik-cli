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
 *
 * For code quality audit, use: krolik audit
 */

import chalk from 'chalk';
import {
  createBackupWithCommit,
  fileCache,
  formatCacheStats,
  isGitRepoForBackup as isGitRepo,
} from '@/lib';
import type { CommandContext } from '../../types';
import { formatPlan, formatPlanForAI, formatResults } from './formatters';
import { applyFixesParallel } from './parallel-executor';
import { type FixPlan, generateFixPlan, generateFixPlanFromIssues, type SkipStats } from './plan';
import {
  type BiomeResult,
  biomeAutoFix,
  formatAsJson,
  formatAsText,
  formatAsXml,
  getBiomeVersion,
  getSummaryLine,
  hasBiomeConfig,
  hasTsConfig,
  isBiomeAvailable,
  isTscAvailable,
  runTypeCheck,
  type TsCheckResult,
} from './strategies/shared';
import type { FixOptions, FixResult } from './types';

export { applyFix, applyFixes, createBackup, rollbackFix } from './applier';
export { findStrategy } from './strategies';
// Re-export types
export type { FixOperation, FixOptions, FixResult } from './types';
export { getFixDifficulty } from './types';

// Import registry for --list-fixers
import { registry } from './fixers';

// ============================================================================
// LIST FIXERS
// ============================================================================

/**
 * List all available fixers (for --list-fixers flag)
 */
export async function listFixers(): Promise<void> {
  const fixers = registry.all();

  console.log(chalk.bold('\n📦 Available Fixers\n'));

  // Group by difficulty
  const byDifficulty = {
    trivial: fixers.filter((f) => f.metadata.difficulty === 'trivial'),
    safe: fixers.filter((f) => f.metadata.difficulty === 'safe'),
    risky: fixers.filter((f) => f.metadata.difficulty === 'risky'),
  };

  const difficultyLabels = {
    trivial: chalk.green('🟢 Trivial (safe to auto-apply)'),
    safe: chalk.yellow('🟡 Safe (unlikely to break)'),
    risky: chalk.red('🔴 Risky (requires review)'),
  };

  for (const [difficulty, group] of Object.entries(byDifficulty)) {
    if (group.length === 0) continue;

    console.log(difficultyLabels[difficulty as keyof typeof difficultyLabels]);
    console.log('');

    for (const fixer of group) {
      const { name, description, cliFlag, category } = fixer.metadata;
      console.log(`  ${chalk.cyan(cliFlag.padEnd(22))} ${name}`);
      console.log(`  ${''.padEnd(22)} ${chalk.dim(description)}`);
      console.log(`  ${''.padEnd(22)} ${chalk.dim(`Category: ${category}`)}`);
      console.log('');
    }
  }

  console.log(chalk.dim('Usage:'));
  console.log(chalk.dim('  krolik fix --fix-console       # Enable specific fixer'));
  console.log(chalk.dim('  krolik fix --no-console        # Disable specific fixer'));
  console.log(chalk.dim('  krolik fix --trivial           # Only trivial fixers'));
  console.log(chalk.dim('  krolik fix --safe              # Trivial + safe fixers'));
  console.log('');
}

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
    logger.debug('Biome not available in this project');
    return null;
  }

  if (!hasBiomeConfig(projectRoot)) {
    logger.debug('No biome.json found - skipping Biome');
    return null;
  }

  const version = getBiomeVersion(projectRoot);
  logger.info(`Running Biome${version ? ` (${version})` : ''}...`);

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
  const lines: string[] = ['', chalk.bold('🔧 Biome Auto-Fix')];

  if (dryRun) {
    lines.push(chalk.yellow('  (dry run - would run biome check --apply)'));
    return lines.join('\n');
  }

  if (result.success) {
    lines.push(
      result.filesFixed > 0
        ? chalk.green(`  ✅ Fixed ${result.filesFixed} files`)
        : chalk.green('  ✨ No issues to fix'),
    );
  } else {
    lines.push(chalk.red(`  ❌ Error: ${result.error || 'Unknown error'}`));
  }

  if (result.diagnostics.length > 0) {
    lines.push(chalk.dim(`  📋 ${result.diagnostics.length} issues remain (manual fix needed)`));
  }

  return lines.join('\n');
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
    logger.debug('TypeScript not available in this project');
    return null;
  }

  if (!hasTsConfig(projectRoot)) {
    logger.debug('No tsconfig.json found - skipping TypeScript check');
    return null;
  }

  logger.info('Running TypeScript type check...');
  const result = runTypeCheck(projectRoot, targetPath);
  logger.debug(getSummaryLine(result));

  return result;
}

/**
 * Format TypeScript results based on requested format
 */
function formatTsResults(result: TsCheckResult, format: 'json' | 'xml' | 'text' = 'json'): string {
  const lines: string[] = ['', chalk.bold('🔍 TypeScript Type Check')];

  if (result.success) {
    lines.push(chalk.green(`  ✅ No errors (${result.duration}ms)`));
    return lines.join('\n');
  }

  lines.push(
    chalk.red(
      `  ❌ ${result.errorCount} errors, ${result.warningCount} warnings (${result.duration}ms)`,
    ),
  );
  lines.push('');

  switch (format) {
    case 'json':
      lines.push(chalk.dim('  <typescript-errors format="json">'));
      lines.push(formatAsJson(result));
      lines.push(chalk.dim('  </typescript-errors>'));
      break;
    case 'xml':
      lines.push(chalk.dim('  <typescript-errors format="xml">'));
      lines.push(formatAsXml(result));
      lines.push(chalk.dim('  </typescript-errors>'));
      break;
    default:
      lines.push(formatAsText(result));
  }
  return lines.join('\n');
}

// ============================================================================
// APPLY FIXES
// ============================================================================

import type { Fixer, FixerContext } from './core/types';

/**
 * Get unique fixers used in fix plans
 */
function getUsedFixers(plans: FixPlan[]): Fixer[] {
  const fixerIds = new Set<string>();
  const fixers: Fixer[] = [];

  for (const plan of plans) {
    for (const { issue } of plan.fixes) {
      if (issue.fixerId && !fixerIds.has(issue.fixerId)) {
        fixerIds.add(issue.fixerId);
        const fixer = registry.get(issue.fixerId);
        if (fixer) {
          fixers.push(fixer);
        }
      }
    }
  }

  return fixers;
}

/**
 * Apply fixes to files
 *
 * Uses parallel execution across independent files for better performance.
 * Fixes within a single file are still applied sequentially (bottom-to-top)
 * to preserve correct line number ordering.
 *
 * Lifecycle hooks:
 * 1. onStart: Called on each fixer before applying any fixes
 * 2. Apply fixes
 * 3. onComplete: Called on each fixer after all fixes applied
 */
async function applyFixes(
  plans: FixPlan[],
  options: FixOptions,
  projectRoot: string,
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  },
): Promise<FixResult[]> {
  // Create git backup
  const backup = await createGitBackup(projectRoot, logger);

  // Get fixers used in plans
  const fixers = getUsedFixers(plans);
  const totalFixes = plans.reduce((sum, p) => sum + p.fixes.length, 0);

  // Create fixer context
  const context: FixerContext = {
    projectRoot,
    dryRun: options.dryRun ?? false,
    totalIssues: totalFixes,
  };

  // Call onStart lifecycle hooks
  for (const fixer of fixers) {
    if (fixer.onStart) {
      logger.debug(`Initializing ${fixer.metadata.name}...`);
      await fixer.onStart(context);
    }
  }

  // Apply fixes in parallel across files
  logger.info('Applying fixes (parallel execution)...');
  const results = await applyFixesParallel(plans, options, logger);

  // Call onComplete lifecycle hooks
  for (const fixer of fixers) {
    if (fixer.onComplete) {
      await fixer.onComplete(context);
    }
  }

  // Show results
  console.log(formatResults(results));
  showBackupInfo(backup, results);

  return results;
}

interface BackupInfo {
  branchName?: string | undefined;
  hadUncommittedChanges: boolean;
  commitHash?: string | undefined;
}

/**
 * Create git backup with commit
 *
 * If there are uncommitted changes:
 * 1. Creates a backup branch
 * 2. Commits all changes to that branch
 * 3. Switches back to original branch
 *
 * This ensures all changes are safely saved in git history.
 */
async function createGitBackup(
  projectRoot: string,
  logger: { info: (msg: string) => void },
): Promise<BackupInfo> {
  if (!isGitRepo(projectRoot)) {
    console.log(chalk.dim('Not a git repo - skipping backup'));
    return { hadUncommittedChanges: false };
  }

  logger.info('Creating git backup...');
  const backupResult = createBackupWithCommit(projectRoot, 'fix');

  if (backupResult.success) {
    console.log(chalk.green(`✅ Backup branch: ${backupResult.backupBranch}`));
    if (backupResult.hadUncommittedChanges) {
      console.log(chalk.dim(`   Changes committed: ${backupResult.commitHash?.slice(0, 7)}`));
      console.log(chalk.dim(`   To restore: git checkout ${backupResult.backupBranch}`));
    }
    return {
      branchName: backupResult.backupBranch,
      hadUncommittedChanges: backupResult.hadUncommittedChanges,
      commitHash: backupResult.commitHash,
    };
  }

  console.log(chalk.yellow(`⚠️  Could not create backup: ${backupResult.error}`));
  console.log(chalk.dim('   Proceeding without git backup...'));
  return { hadUncommittedChanges: false };
}

/**
 * Show backup info after applying fixes
 */
function showBackupInfo(backup: BackupInfo, results: FixResult[]): void {
  if (!backup.branchName) return;

  const failed = results.filter((r) => !r.success);
  console.log('');

  if (failed.length > 0) {
    console.log(chalk.yellow(`💾 Backup available:`));
    console.log(chalk.dim(`   Restore: git checkout ${backup.branchName}`));
    if (backup.hadUncommittedChanges) {
      console.log(
        chalk.dim(
          `   Your uncommitted changes are saved in commit ${backup.commitHash?.slice(0, 7)}`,
        ),
      );
    }
  } else {
    console.log(chalk.dim(`💾 Backup branch: ${backup.branchName}`));
    console.log(chalk.dim(`   To delete: git branch -D ${backup.branchName}`));
  }
}

// ============================================================================
// AUDIT INTEGRATION
// ============================================================================

import { formatAuditAge, hasAuditData, isAuditDataStale, readAuditData } from './audit-reader';

// ============================================================================
// REFACTOR INTEGRATION
// ============================================================================

import {
  formatRefactorAge,
  hasRefactorData,
  isRefactorDataStale,
  readRefactorData,
} from './refactor-reader';

/**
 * Run fix with cached audit data
 */
async function runFixFromAudit(
  projectRoot: string,
  options: FixOptions,
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  },
): Promise<{ plans: FixPlan[]; skipStats: SkipStats; totalIssues: number } | null> {
  // Check if audit data exists
  if (!hasAuditData(projectRoot)) {
    logger.error("No audit data found. Run 'krolik audit' first.");
    console.log(chalk.dim('  Then use: krolik fix --from-audit'));
    return null;
  }

  // Warn if stale
  if (isAuditDataStale(projectRoot, 60)) {
    logger.warn("Audit data is stale (>1 hour old). Consider running 'krolik audit' again.");
  }

  // Read audit data
  const result = readAuditData(projectRoot, options.quickWinsOnly ?? false);
  if (!result.success) {
    logger.error(result.error);
    return null;
  }

  const ageLabel = formatAuditAge(result.age);
  logger.info(`Using cached audit data (${ageLabel}, ${result.issues.length} issues)`);

  // Generate plan from cached issues
  return generateFixPlanFromIssues(projectRoot, result.issues, options);
}

/**
 * Run fix with cached refactor data
 *
 * Uses auto-fixable recommendations from `krolik refactor` command.
 */
async function runFixFromRefactor(
  projectRoot: string,
  options: FixOptions,
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  },
): Promise<{ plans: FixPlan[]; skipStats: SkipStats; totalIssues: number } | null> {
  // Check if refactor data exists
  if (!hasRefactorData(projectRoot)) {
    logger.error("No refactor data found. Run 'krolik refactor' first.");
    console.log(chalk.dim('  Then use: krolik fix --from-refactor'));
    return null;
  }

  // Warn if stale
  if (isRefactorDataStale(projectRoot, 60)) {
    logger.warn("Refactor data is stale (>1 hour old). Consider running 'krolik refactor' again.");
  }

  // Read refactor data (only auto-fixable recommendations)
  const result = readRefactorData(projectRoot, true);
  if (!result.success) {
    logger.error(result.error);
    return null;
  }

  const ageLabel = formatRefactorAge(result.age);
  const autoFixableCount = result.recommendations.length;
  logger.info(
    `Using cached refactor data (${ageLabel}, ${autoFixableCount} auto-fixable recommendations)`,
  );

  if (autoFixableCount === 0) {
    logger.info('No auto-fixable recommendations found in refactor analysis.');
    return {
      plans: [],
      skipStats: {
        noStrategy: 0,
        noContent: 0,
        contextSkipped: 0,
        noFix: 0,
        noFixer: 0,
        categories: new Map(),
      },
      totalIssues: 0,
    };
  }

  // Generate plan from converted issues
  return generateFixPlanFromIssues(projectRoot, result.issues, options);
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

/**
 * Run fix command
 */
export async function runFix(ctx: CommandContext & { options: FixOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  try {
    // Step 0: TypeScript check
    if (await runTypecheckStep(config.projectRoot, options, logger)) return;

    // Step 1: Biome fixes
    if (await runBiomeStep(config.projectRoot, options, logger)) return;

    // Step 2: Generate fix plan (from cache or fresh analysis)
    let planResult: { plans: FixPlan[]; skipStats: SkipStats; totalIssues: number };

    if (options.fromRefactor) {
      // Use cached refactor recommendations
      const refactorResult = await runFixFromRefactor(config.projectRoot, options, logger);
      if (!refactorResult) return;
      planResult = refactorResult;
    } else if (options.fromAudit) {
      // Use cached audit data
      const auditResult = await runFixFromAudit(config.projectRoot, options, logger);
      if (!auditResult) return;
      planResult = auditResult;
    } else {
      // Fresh analysis
      logger.info('Analyzing code quality...');
      planResult = await generateFixPlan(config.projectRoot, options);
    }

    const { plans, skipStats, totalIssues } = planResult;

    // Show plan
    const format = options.format ?? 'ai';
    console.log(
      format === 'text'
        ? formatPlan(plans, skipStats, totalIssues, options)
        : formatPlanForAI(plans, skipStats, totalIssues),
    );

    // Count fixes
    const totalFixes = plans.reduce((sum, p) => sum + p.fixes.length, 0);
    if (totalFixes === 0) return;

    // Handle dry run - still call lifecycle hooks to show stats
    if (options.dryRun) {
      const fixers = getUsedFixers(plans);
      const context: FixerContext = {
        projectRoot: config.projectRoot,
        dryRun: true,
        totalIssues: totalFixes,
      };

      // Call onStart to initialize (e.g., load catalogs)
      for (const fixer of fixers) {
        if (fixer.onStart) {
          await fixer.onStart(context);
        }
      }

      // Run fix generation to populate stats (without applying)
      for (const plan of plans) {
        for (const { issue } of plan.fixes) {
          const fixer = issue.fixerId ? registry.get(issue.fixerId) : null;
          if (fixer) {
            const content = fileCache.get(plan.file);
            fixer.fix(issue, content);
          }
        }
      }

      // Call onComplete to show stats
      for (const fixer of fixers) {
        if (fixer.onComplete) {
          await fixer.onComplete(context);
        }
      }

      return;
    }

    // Confirm unless --yes
    if (!options.yes) {
      console.log('');
      console.log(chalk.yellow('⚠️  This will modify your files.'));
      console.log(chalk.dim('Use --dry-run to preview changes without applying.'));
      console.log(chalk.dim('Use --yes to skip this confirmation.'));
      console.log('');
      logger.warn('Pass --yes to apply fixes');
      return;
    }

    // Apply fixes
    await applyFixes(plans, options, config.projectRoot, logger);
  } finally {
    // Clear cache and log statistics (for debugging/performance tracking)
    const stats = fileCache.getStats();
    logger.debug(formatCacheStats(stats));
    fileCache.clear();
  }
}

/**
 * Run TypeScript check step
 * @returns true if should stop processing
 */
async function runTypecheckStep(
  projectRoot: string,
  options: FixOptions,
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
  },
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
      logger.warn('TypeScript not available in this project');
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
  logger: {
    info: (msg: string) => void;
    debug: (msg: string) => void;
    warn: (msg: string) => void;
  },
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
      logger.warn('Biome not available in this project');
    }
    return true;
  }

  return false;
}
