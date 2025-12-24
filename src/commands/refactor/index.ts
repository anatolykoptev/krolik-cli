/**
 * @module commands/refactor
 * @description Analyze and refactor module structure
 *
 * Features:
 * - Detect duplicate functions using AST analysis
 * - Detect duplicate types/interfaces by structure comparison
 * - Analyze module structure for consistency
 * - Generate migration plan with import updates
 * - Apply migrations safely with rollback support
 * - AI-native output with dependency graphs and navigation hints
 *
 * Usage:
 *   krolik refactor                    # Analyze lib/
 *   krolik refactor --path src/utils   # Analyze specific path
 *   krolik refactor --duplicates-only  # Only find function duplicates
 *   krolik refactor --types-only       # Only find type/interface duplicates
 *   krolik refactor --include-types    # Include type duplicates in analysis
 *   krolik refactor --structure-only   # Only analyze structure
 *   krolik refactor --dry-run          # Show plan without applying
 *   krolik refactor --apply            # Apply migrations
 *   krolik refactor --ai               # AI-native output (default for XML)
 */

import * as path from 'path';
import type {
  RefactorOptions,
  RefactorAnalysis,
} from './core';
import { findDuplicates, findTypeDuplicates, analyzeStructure, createEnhancedAnalysis } from './analyzers';
import { createMigrationPlan, findAffectedImports, executeMigrationPlan } from './migration';
import { formatRefactor, formatMigrationPreview, formatAiNativeXml } from './output';
import {
  exists,
  relativePath,
  createBackupBranch,
  cleanupBackup,
  type GitBackupResult,
} from '../../lib';

/**
 * Run refactor analysis
 */
export async function runRefactor(
  projectRoot: string,
  options: RefactorOptions = {},
): Promise<RefactorAnalysis> {
  const targetPath = options.path
    ? path.resolve(projectRoot, options.path)
    : path.join(projectRoot, 'src', 'lib');

  // Verify target exists (sync function)
  if (!exists(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  const relPath = relativePath(projectRoot, targetPath);

  // Run analysis
  let duplicates: RefactorAnalysis['duplicates'] = [];
  let typeDuplicates: RefactorAnalysis['typeDuplicates'];
  let structure: RefactorAnalysis['structure'];

  // Function duplicates (unless types-only or structure-only)
  if (!options.structureOnly && !options.typesOnly) {
    duplicates = await findDuplicates(targetPath, projectRoot);
  }

  // Type/interface duplicates (if types-only or includeTypes)
  if (options.typesOnly || options.includeTypes) {
    typeDuplicates = await findTypeDuplicates(targetPath, projectRoot);
  }

  // Structure analysis (unless duplicates-only or types-only)
  if (!options.duplicatesOnly && !options.typesOnly) {
    structure = analyzeStructure(targetPath, projectRoot);
  } else {
    structure = {
      flatFiles: [],
      namespacedFolders: [],
      doubleNested: [],
      ungroupedFiles: [],
      score: 100,
      issues: [],
    };
  }

  // Create migration plan
  let migration = createMigrationPlan(duplicates, structure, projectRoot);

  // Find affected imports for each action
  for (const action of migration.actions) {
    action.affectedImports = await findAffectedImports(action.source, projectRoot);
  }

  // Recalculate imports count
  migration = {
    ...migration,
    importsToUpdate: migration.actions.reduce(
      (sum, a) => sum + a.affectedImports.length,
      0,
    ),
  };

  const result: RefactorAnalysis = {
    path: relPath,
    duplicates,
    structure,
    migration,
    timestamp: new Date().toISOString(),
  };

  if (typeDuplicates) {
    result.typeDuplicates = typeDuplicates;
  }

  return result;
}

/**
 * Format and print analysis
 */
export function printAnalysis(
  analysis: RefactorAnalysis,
  projectRoot: string,
  targetPath: string,
  options: RefactorOptions = {},
): void {
  const format = options.format ?? 'text';

  // For XML format or --ai flag, use enhanced AI-native output
  if (format === 'xml' || options.aiNative) {
    const enhanced = createEnhancedAnalysis(analysis, projectRoot, targetPath);
    console.log(formatAiNativeXml(enhanced));
    return;
  }

  const output = formatRefactor(analysis, format);
  console.log(output);

  if (options.dryRun && analysis.migration.actions.length > 0) {
    console.log(formatMigrationPreview(analysis.migration));
  }
}

/**
 * Apply migrations from analysis
 *
 * @param analysis - Refactor analysis with migration plan
 * @param projectRoot - Project root directory
 * @param options - Options for migration
 * @param options.dryRun - Preview changes without applying
 * @param options.verbose - Verbose output
 * @param options.backup - Create git backup before applying (default: true)
 */
export async function applyMigrations(
  analysis: RefactorAnalysis,
  projectRoot: string,
  options: { dryRun?: boolean; verbose?: boolean; backup?: boolean } = {},
): Promise<{ success: boolean; results: string[]; backup?: GitBackupResult }> {
  if (analysis.migration.actions.length === 0) {
    return { success: true, results: ['No migrations to apply'] };
  }

  const shouldBackup = options.backup !== false;
  let backupResult: GitBackupResult | undefined;

  // Create git backup before applying migrations
  if (shouldBackup && !options.dryRun) {
    console.log('\n📦 Creating git backup...');
    backupResult = createBackupBranch(projectRoot, 'refactor');

    if (backupResult.success) {
      console.log(`   ✓ Backup branch: ${backupResult.branchName}`);
      if (backupResult.hadUncommittedChanges) {
        console.log('   ✓ Uncommitted changes stashed');
      }
    } else {
      console.log(`   ⚠️  Backup failed: ${backupResult.error}`);
      console.log('   Continuing without backup...');
    }
  }

  console.log('\n🚀 Applying migrations...\n');

  const result = await executeMigrationPlan(
    analysis.migration,
    projectRoot,
    options,
  );

  if (result.success) {
    console.log('\n✅ All migrations applied successfully!');

    // Cleanup backup on success
    if (backupResult?.success) {
      cleanupBackup(projectRoot, backupResult, false); // Keep stash for safety
      console.log(`   ✓ Backup branch ${backupResult.branchName} deleted`);
    }
  } else {
    console.log('\n⚠️  Some migrations failed. Check the logs above.');

    // Offer restore option
    if (backupResult?.success && backupResult.branchName) {
      console.log(`\n💡 To restore from backup:`);
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
 * Command handler for CLI
 */
export async function refactorCommand(
  projectRoot: string,
  options: RefactorOptions = {},
): Promise<void> {
  try {
    const targetPath = options.path
      ? path.resolve(projectRoot, options.path)
      : path.join(projectRoot, 'src', 'lib');

    // Run analysis
    const analysis = await runRefactor(projectRoot, options);

    // Print results
    printAnalysis(analysis, projectRoot, targetPath, options);

    // Apply if requested
    if (options.apply && !options.dryRun) {
      if (!options.yes) {
        // Would prompt for confirmation here
        // For now, just apply
      }
      const migrateOpts: { dryRun?: boolean; verbose?: boolean; backup?: boolean } = {
        dryRun: false,
      };
      if (options.verbose !== undefined) migrateOpts.verbose = options.verbose;
      if (options.backup !== undefined) migrateOpts.backup = options.backup;
      await applyMigrations(analysis, projectRoot, migrateOpts);
    }

    // Generate ai-config.ts if requested
    if (options.generateConfig) {
      const { writeAiConfig } = await import('./generator');
      const { analyzeNamespaceStructure } = await import('./analyzers/namespace');
      const namespaceResult = analyzeNamespaceStructure(projectRoot, targetPath);
      // Convert to RefineResult format expected by generator
      const refineResult = {
        projectRoot: namespaceResult.projectRoot,
        libDir: namespaceResult.libDir,
        directories: namespaceResult.directories,
        currentScore: namespaceResult.currentScore,
        suggestedScore: namespaceResult.suggestedScore,
        plan: namespaceResult.plan,
        timestamp: namespaceResult.timestamp,
      };
      const configPath = writeAiConfig(refineResult, projectRoot);
      if (configPath) {
        console.log(`\n✅ Generated: ${configPath}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}`);
    process.exit(1);
  }
}

// Re-export types and functions from modules
export type * from './core';
export { findDuplicates, findTypeDuplicates, analyzeStructure, visualizeStructure } from './analyzers';
export { createMigrationPlan, executeMigrationPlan } from './migration';
export { formatRefactor, formatMigrationPreview, formatAiNativeXml } from './output';
