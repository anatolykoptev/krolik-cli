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
import {
  createMigrationPlan,
  findAffectedImports,
  executeMigrationPlan,
  createTypeMigrationPlan,
  executeTypeMigrationPlan,
  previewTypeMigrationPlan,
} from './migration';
import { formatRefactor, formatMigrationPreview, formatAiNativeXml } from './output';
import {
  exists,
  relativePath,
  createBackupBranch,
  cleanupBackup,
  type GitBackupResult,
} from '../../lib';
import { detectFeatures, detectMonorepoPackages, type MonorepoPackage } from '../../config';

/**
 * Run refactor analysis
 */
export async function runRefactor(
  projectRoot: string,
  options: RefactorOptions = {},
): Promise<RefactorAnalysis> {
  // For type analysis (--types-only, --include-types, --fix-types), use src as default
  // For structure/function analysis, use src/lib as default
  const isTypeAnalysis = options.typesOnly || options.includeTypes || options.fixTypes;
  const defaultPath = isTypeAnalysis ? 'src' : path.join('src', 'lib');

  const targetPath = options.path
    ? path.resolve(projectRoot, options.path)
    : path.join(projectRoot, defaultPath);

  // Verify target exists (sync function)
  if (!exists(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  // Determine libPath for migrations
  // If analyzing 'src' for types, libPath should still be 'src/lib' (or 'lib')
  // If analyzing specific path with 'lib' in name, use that
  let libPath: string;
  if (options.path) {
    // Explicit path - use as libPath if it looks like a lib directory
    if (path.basename(targetPath) === 'lib' || targetPath.includes('/lib')) {
      libPath = targetPath;
    } else {
      // Try to find lib within the target
      const libInTarget = path.join(targetPath, 'lib');
      const srcLibInTarget = path.join(targetPath, 'src', 'lib');
      if (exists(libInTarget)) {
        libPath = libInTarget;
      } else if (exists(srcLibInTarget)) {
        libPath = srcLibInTarget;
      } else {
        libPath = path.join(targetPath, 'lib'); // Fallback
      }
    }
  } else if (isTypeAnalysis) {
    // Type analysis uses 'src', but migrations need 'src/lib'
    const srcLib = path.join(projectRoot, 'src', 'lib');
    const lib = path.join(projectRoot, 'lib');
    if (exists(srcLib)) {
      libPath = srcLib;
    } else if (exists(lib)) {
      libPath = lib;
    } else {
      libPath = srcLib; // Fallback to src/lib
    }
  } else {
    // Default: targetPath is already the lib path
    libPath = targetPath;
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

  // Create migration plan (using libPath for file operations)
  let migration = createMigrationPlan(duplicates, structure, libPath);

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
    libPath,
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
    analysis.libPath,
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
 * Resolve target path for refactor analysis
 * Handles monorepo packages automatically
 */
function resolveTargetPath(
  projectRoot: string,
  options: RefactorOptions,
): { targetPath: string; packageInfo?: MonorepoPackage } {
  // If explicit path is provided, use it
  if (options.path) {
    return { targetPath: path.resolve(projectRoot, options.path) };
  }

  // Check if this is a monorepo
  const features = detectFeatures(projectRoot);

  // Determine default path based on analysis type
  const isTypeAnalysis = options.typesOnly || options.includeTypes || options.fixTypes;
  const defaultPath = isTypeAnalysis ? 'src' : path.join('src', 'lib');

  if (features.monorepo) {
    const packages = detectMonorepoPackages(projectRoot);

    if (packages.length === 0) {
      // No packages with lib found, fall back to default
      return { targetPath: path.join(projectRoot, defaultPath) };
    }

    // If --package specified, find that package
    if (options.package) {
      const pkg = packages.find(p => p.name === options.package);
      if (!pkg) {
        const available = packages.map(p => p.name).join(', ');
        throw new Error(
          `Package "${options.package}" not found or has no lib directory.\n` +
          `Available packages: ${available}`
        );
      }
      return {
        targetPath: path.join(projectRoot, pkg.libPath),
        packageInfo: pkg,
      };
    }

    // If --all-packages, we'll handle it in refactorCommand
    if (options.allPackages) {
      // Return first package, refactorCommand will iterate
      const pkg = packages[0]!; // Safe: we checked packages.length > 0 above
      return {
        targetPath: path.join(projectRoot, pkg.libPath),
        packageInfo: pkg,
      };
    }

    // No package specified - use first available (usually 'web')
    const pkg = packages.find(p => p.name === 'web') ?? packages[0]!; // Safe: packages.length > 0
    console.log(`📦 Monorepo detected. Analyzing: ${pkg.name} (${pkg.libPath})`);
    console.log(`   Available packages: ${packages.map(p => p.name).join(', ')}`);
    console.log(`   Use --package <name> to analyze a specific package\n`);

    return {
      targetPath: path.join(projectRoot, pkg.libPath),
      packageInfo: pkg,
    };
  }

  // Not a monorepo, use default path
  return { targetPath: path.join(projectRoot, defaultPath) };
}

/**
 * Command handler for CLI
 */
export async function refactorCommand(
  projectRoot: string,
  options: RefactorOptions = {},
): Promise<void> {
  try {
    const features = detectFeatures(projectRoot);
    const packages = features.monorepo ? detectMonorepoPackages(projectRoot) : [];

    // Handle --all-packages for monorepo
    if (options.allPackages && packages.length > 0) {
      console.log(`📦 Analyzing all ${packages.length} packages...\n`);

      for (const pkg of packages) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📁 Package: ${pkg.name} (${pkg.libPath})`);
        console.log(`${'='.repeat(60)}\n`);

        const targetPath = path.join(projectRoot, pkg.libPath);
        const pkgOptions = { ...options, path: pkg.libPath };

        const analysis = await runRefactor(projectRoot, pkgOptions);
        printAnalysis(analysis, projectRoot, targetPath, options);

        // Apply if requested
        if (options.apply && !options.dryRun) {
          const migrateOpts: { dryRun?: boolean; verbose?: boolean; backup?: boolean } = {
            dryRun: false,
          };
          if (options.verbose !== undefined) migrateOpts.verbose = options.verbose;
          if (options.backup !== undefined) migrateOpts.backup = options.backup;
          await applyMigrations(analysis, projectRoot, migrateOpts);
        }
      }

      return;
    }

    // Single package or non-monorepo analysis
    const { targetPath, packageInfo } = resolveTargetPath(projectRoot, options);

    // Update options.path for runRefactor
    const analysisOptions = { ...options };
    if (!options.path && packageInfo) {
      analysisOptions.path = packageInfo.libPath;
    }

    // Run analysis
    const analysis = await runRefactor(projectRoot, analysisOptions);

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

    // Apply type fixes if requested
    if (options.fixTypes && analysis.typeDuplicates) {
      const typeFixOpts: { dryRun?: boolean; verbose?: boolean; backup?: boolean; onlyIdentical?: boolean } = {
        onlyIdentical: options.fixTypesIdenticalOnly !== false,
      };
      if (options.dryRun !== undefined) typeFixOpts.dryRun = options.dryRun;
      if (options.verbose !== undefined) typeFixOpts.verbose = options.verbose;
      if (options.backup !== undefined) typeFixOpts.backup = options.backup;
      await applyTypeFixes(analysis, projectRoot, typeFixOpts);
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
  options: { dryRun?: boolean; verbose?: boolean; backup?: boolean; onlyIdentical?: boolean } = {},
): Promise<{ success: boolean; typesFixed: number; importsUpdated: number }> {
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
    return { success: true, typesFixed: plan.stats.typesToRemove, importsUpdated: plan.stats.importsToUpdate };
  }

  // Execute migration
  console.log('\n🚀 Applying type migrations...');
  const execOpts: { dryRun?: boolean; backup?: boolean; verbose?: boolean } = {
    dryRun: false,
    backup: options.backup ?? true,
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

// Re-export types and functions from modules
export type * from './core';
export { findDuplicates, findTypeDuplicates, analyzeStructure, visualizeStructure } from './analyzers';
export { createMigrationPlan, executeMigrationPlan, createTypeMigrationPlan, executeTypeMigrationPlan } from './migration';
export { formatRefactor, formatMigrationPreview, formatAiNativeXml } from './output';
