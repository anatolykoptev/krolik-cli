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
 */

import chalk from 'chalk';
import type { CommandContext } from '../../types';
import type { FixOptions, FixResult, FixOperation } from './types';
import { getFixDifficulty } from './types';
import { analyzeQuality } from '../quality';
import { findStrategyDetailed } from './strategies';
import { applyFix } from './applier';
import { createBackupBranch, isGitRepo } from './git-backup';

// ============================================================================
// TYPES
// ============================================================================

export type { FixOptions, FixResult, FixOperation };

interface FixPlan {
  file: string;
  fixes: Array<{
    issue: import('../quality/types').QualityIssue;
    operation: FixOperation;
    difficulty: 'trivial' | 'safe' | 'risky';
  }>;
}

interface SkipStats {
  noStrategy: number;      // No strategy for this category
  noContent: number;       // File content not available
  contextSkipped: number;  // Skipped by context (CLI output, etc)
  noFix: number;           // Strategy couldn't generate fix
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

  const { report, fileContents } = await analyzeQuality(projectRoot, qualityOptions);

  const plans: Map<string, FixPlan> = new Map();
  const skipStats: SkipStats = {
    noStrategy: 0,
    noContent: 0,
    contextSkipped: 0,
    noFix: 0,
    categories: new Map(),
  };

  for (const issue of report.topIssues) {
    // Track category
    const cat = issue.category;
    skipStats.categories.set(cat, (skipStats.categories.get(cat) || 0) + 1);

    // Filter by difficulty if trivialOnly
    const difficulty = getFixDifficulty(issue);
    if (options.trivialOnly && difficulty !== 'trivial') {
      continue;
    }

    // Get file content
    const content = fileContents.get(issue.file) || '';
    if (!content) {
      skipStats.noContent++;
      continue;
    }

    // Find strategy for this issue
    const strategyResult = findStrategyDetailed(issue, content);

    if (strategyResult.status === 'no-strategy') {
      skipStats.noStrategy++;
      continue;
    }

    if (strategyResult.status === 'context-skipped') {
      skipStats.contextSkipped++;
      continue;
    }

    // Generate fix operation
    const operation = strategyResult.strategy.generateFix(issue, content);
    if (!operation) {
      skipStats.noFix++;
      continue;
    }

    // Add to plan
    let plan = plans.get(issue.file);
    if (!plan) {
      plan = { file: issue.file, fixes: [] };
      plans.set(issue.file, plan);
    }

    plan.fixes.push({ issue, operation, difficulty });
  }

  // Apply limit if specified
  let allPlans = [...plans.values()];
  if (options.limit) {
    let count = 0;
    allPlans = allPlans.map((plan) => {
      const remaining = options.limit! - count;
      if (remaining <= 0) {
        return { ...plan, fixes: [] };
      }
      count += plan.fixes.length;
      if (plan.fixes.length > remaining) {
        return { ...plan, fixes: plan.fixes.slice(0, remaining) };
      }
      return plan;
    }).filter((plan) => plan.fixes.length > 0);
  }

  return { plans: allPlans, skipStats, totalIssues: report.topIssues.length };
}

// ============================================================================
// FORMATTING
// ============================================================================

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

    lines.push('');
    lines.push(chalk.cyan(`📁 ${plan.file}`));

    for (const { issue, operation, difficulty } of plan.fixes) {
      totalFixes++;
      const diffIcon = difficulty === 'trivial' ? '✅' : difficulty === 'safe' ? '🔶' : '⚠️';
      const action = chalk.yellow(operation.action);
      const line = issue.line ? `:${issue.line}` : '';

      lines.push(`  ${diffIcon} ${action} ${line}`);
      lines.push(`     ${chalk.dim(issue.message)}`);

      if (operation.oldCode && operation.action !== 'insert-before') {
        const preview = operation.oldCode.slice(0, 50).replace(/\n/g, '↵');
        lines.push(`     ${chalk.red('- ' + preview)}${operation.oldCode.length > 50 ? '...' : ''}`);
      }

      if (operation.newCode && operation.action !== 'delete-line') {
        const preview = operation.newCode.slice(0, 50).replace(/\n/g, '↵');
        lines.push(`     ${chalk.green('+ ' + preview)}${operation.newCode.length > 50 ? '...' : ''}`);
      }
    }
  }

  if (totalFixes === 0) {
    lines.push('');
    lines.push(chalk.green('✨ No auto-fixable issues found!'));

    // Show why issues were skipped
    if (totalIssues > 0) {
      lines.push('');
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
        lines.push('');
        lines.push(chalk.dim('By category:'));
        for (const [cat, count] of cats) {
          const fixable = cat === 'lint' ? '(partially fixable)' : '(manual fix needed)';
          lines.push(chalk.dim(`  • ${cat}: ${count} ${fixable}`));
        }
      }
    }
  } else {
    lines.push('');
    lines.push(chalk.bold(`Total: ${totalFixes} fixes in ${plans.length} files`));

    if (options.dryRun) {
      lines.push(chalk.yellow('(dry run - no changes made)'));
    }
  }

  return lines.join('\n');
}

/**
 * Format results after applying fixes
 */
function formatResults(results: FixResult[]): string {
  const lines: string[] = [];
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  lines.push('');
  lines.push(chalk.bold('Fix Results:'));
  lines.push(chalk.green(`  ✅ ${successful.length} fixes applied`));

  if (failed.length > 0) {
    lines.push(chalk.red(`  ❌ ${failed.length} fixes failed`));
    for (const result of failed) {
      lines.push(chalk.red(`     ${result.issue.file}:${result.issue.line} - ${result.error}`));
    }
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

/**
 * Run fix command
 */
export async function runFix(ctx: CommandContext & { options: FixOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  logger.info('Analyzing code quality...');

  // Generate fix plan
  const { plans, skipStats, totalIssues } = await generateFixPlan(config.projectRoot, options);

  // Show plan
  console.log(formatPlan(plans, skipStats, totalIssues, options));

  // If dry run, stop here
  if (options.dryRun) {
    return;
  }

  // Count total fixes
  const totalFixes = plans.reduce((sum: number, p: FixPlan) => sum + p.fixes.length, 0);

  if (totalFixes === 0) {
    return;
  }

  // Confirm unless --yes
  if (!options.yes) {
    console.log('');
    console.log(chalk.yellow('⚠️  This will modify your files.'));
    console.log(chalk.dim('Use --dry-run to preview changes without applying.'));
    console.log(chalk.dim('Use --yes to skip this confirmation.'));
    console.log('');

    // In CLI we'd use readline, but for now just require --yes
    logger.warn('Pass --yes to apply fixes');
    return;
  }

  // Create git backup branch before applying fixes
  let backupBranchName: string | undefined;

  if (isGitRepo(config.projectRoot)) {
    logger.info('Creating git backup branch...');
    const backupResult = createBackupBranch(config.projectRoot);

    if (backupResult.success) {
      backupBranchName = backupResult.branchName;
      console.log(chalk.green(`✅ Backup branch created: ${backupBranchName}`));
      if (backupResult.hadUncommittedChanges) {
        console.log(chalk.dim('   (uncommitted changes saved to backup)'));
      }
    } else {
      console.log(chalk.yellow(`⚠️  Could not create backup: ${backupResult.error}`));
      console.log(chalk.dim('   Proceeding without git backup...'));
    }
  } else {
    console.log(chalk.dim('Not a git repo - skipping backup'));
  }

  // Apply fixes
  logger.info('Applying fixes...');
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

  // Show backup info
  const failed = results.filter((r) => !r.success);
  if (backupBranchName) {
    console.log('');
    if (failed.length > 0) {
      console.log(chalk.yellow(`💾 Backup available: git checkout ${backupBranchName}`));
      console.log(chalk.dim('   To restore: git checkout ' + backupBranchName + ' -- .'));
    } else {
      console.log(chalk.dim(`💾 Backup branch: ${backupBranchName}`));
      console.log(chalk.dim(`   To delete: git branch -D ${backupBranchName}`));
    }
  }
}

// Re-export types
export { getFixDifficulty } from './types';
export { findStrategy } from './strategies';
export { applyFix, applyFixes, createBackup, rollbackFix } from './applier';
