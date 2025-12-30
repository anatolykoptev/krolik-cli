/**
 * @module commands/refactor/runner/migration
 * @description Migration execution for refactor command
 */

import {
  cleanupBackup,
  commitAndPushChanges,
  createBackupBranch,
  type GitBackupResult,
  hasUncommittedChanges,
} from '../../../lib/@vcs';
import type { RefactorAnalysis } from '../core/types';
import {
  createTypeMigrationPlan,
  executeMigrationPlan,
  executeTypeMigrationPlan,
  previewTypeMigrationPlan,
} from '../migration';

/**
 * Migration options
 * Note: backup and commitFirst are now always-on (Epic 3 simplification)
 * Push is never done automatically (safety)
 */
export interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  results: string[];
  backup?: GitBackupResult;
}

/**
 * Apply migrations from analysis
 *
 * Flow:
 * 1. Commit + push all uncommitted changes (safety net)
 * 2. Create git backup branch
 * 3. Apply migrations
 *
 * @param analysis - Refactor analysis with migration plan
 * @param projectRoot - Project root directory
 * @param options - Options for migration
 */
export async function applyMigrations(
  analysis: RefactorAnalysis,
  projectRoot: string,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  if (analysis.migration.actions.length === 0) {
    return { success: true, results: ['No migrations to apply'] };
  }

  let backupResult: GitBackupResult | undefined;

  // Step 1: Always commit uncommitted changes first (never push - safety)
  if (!options.dryRun && hasUncommittedChanges(projectRoot)) {
    console.log('\n[Save] Saving uncommitted changes...');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const commitMessage = `chore: auto-save before refactor (${timestamp})`;

    const commitResult = commitAndPushChanges(projectRoot, commitMessage, false);

    if (commitResult.committed) {
      console.log(`   Done. Changes committed: ${commitResult.commitHash?.slice(0, 7)}`);
    } else if (!commitResult.success) {
      console.log(`   Warning: Commit failed: ${commitResult.error}`);
      console.log('   Continuing with stash backup...');
    }
  }

  // Step 2: Always create git backup before applying migrations
  if (!options.dryRun) {
    console.log('\n[Backup] Creating git backup...');
    backupResult = createBackupBranch(projectRoot, 'refactor');

    if (backupResult.success) {
      console.log(`   Done. Backup branch: ${backupResult.branchName}`);
      if (backupResult.hadUncommittedChanges) {
        console.log('   Done. Uncommitted changes stashed');
      }
    } else {
      console.log(`   Warning: Backup failed: ${backupResult.error}`);
      console.log('   Continuing without backup...');
    }
  }

  console.log('\n[Apply] Applying migrations...\n');

  const result = await executeMigrationPlan(
    analysis.migration,
    projectRoot,
    analysis.libPath,
    options,
  );

  if (result.success) {
    console.log('\n[Done] All migrations applied successfully!');

    // Cleanup backup on success
    if (backupResult?.success) {
      cleanupBackup(projectRoot, backupResult, false); // Keep stash for safety
      console.log(`   Done. Backup branch ${backupResult.branchName} deleted`);
    }
  } else {
    console.log('\n[Warning] Some migrations failed. Check the logs above.');

    // Offer restore option
    if (backupResult?.success && backupResult.branchName) {
      console.log(`\nTo restore from backup:`);
      console.log(`   git checkout ${backupResult.branchName} -- .`);
      if (backupResult.hadUncommittedChanges) {
        console.log('   git stash apply  # restore uncommitted changes');
      }
    }
  }

  // Only include backup if it exists (exactOptionalPropertyTypes)
  if (backupResult) {
    return { ...result, backup: backupResult };
  }
  return result;
}

/**
 * Type fix options
 * Note: backup is now always-on (Epic 3 simplification)
 */
export interface TypeFixOptions {
  dryRun?: boolean;
  verbose?: boolean;
  onlyIdentical?: boolean;
}

/**
 * Type fix result
 */
export interface TypeFixResult {
  success: boolean;
  typesFixed: number;
  importsUpdated: number;
}

/**
 * Apply type duplicate fixes
 *
 * @param analysis - Refactor analysis with type duplicates
 * @param projectRoot - Project root directory
 * @param options - Options for migration
 */
export async function applyTypeFixes(
  analysis: RefactorAnalysis,
  projectRoot: string,
  options: TypeFixOptions = {},
): Promise<TypeFixResult> {
  if (!analysis.typeDuplicates || analysis.typeDuplicates.length === 0) {
    console.log('\n✅ No type duplicates to fix.');
    return { success: true, typesFixed: 0, importsUpdated: 0 };
  }

  const { dryRun = false, onlyIdentical = true } = options;

  // Create type migration plan
  console.log('\n🔍 Creating type migration plan...');
  const plan = await createTypeMigrationPlan(analysis.typeDuplicates, projectRoot, {
    onlyIdentical,
  });

  if (plan.actions.length === 0) {
    console.log('   No safe type migrations found.');
    return { success: true, typesFixed: 0, importsUpdated: 0 };
  }

  console.log(`   Found ${plan.stats.typesToRemove} types to merge`);
  console.log(`   ${plan.stats.importsToUpdate} imports to update`);
  console.log(`   ${plan.stats.filesAffected} files affected`);

  if (dryRun) {
    console.log('\n📋 Type Migration Plan (dry run):');
    console.log(previewTypeMigrationPlan(plan));
    return {
      success: true,
      typesFixed: plan.stats.typesToRemove,
      importsUpdated: plan.stats.importsToUpdate,
    };
  }

  // Execute migration (backup is always-on)
  console.log('\n[Apply] Applying type migrations...');
  const execOpts: { dryRun?: boolean; backup?: boolean; verbose?: boolean } = {
    dryRun: false,
    backup: true,
  };
  if (options.verbose !== undefined) execOpts.verbose = options.verbose;
  const result = await executeTypeMigrationPlan(plan, projectRoot, execOpts);

  if (result.success) {
    console.log(`\n✅ Type migration complete!`);
    console.log(`   ${result.summary.succeeded} actions succeeded`);
  } else {
    console.log(`\n⚠️  Some type migrations failed.`);
    console.log(`   ${result.summary.succeeded} succeeded, ${result.summary.failed} failed`);
  }

  return {
    success: result.success,
    typesFixed: plan.stats.typesToRemove,
    importsUpdated: plan.stats.importsToUpdate,
  };
}
