/**
 * @module commands/refactor/command
 * @description CLI command handler for refactor
 */

import { detectFeatures, detectMonorepoPackages } from '../../config';
import type { RefactorOptions } from './core';
import { getModeFlags, resolveMode } from './core';
import { resolvePackagePaths, resolvePaths } from './paths';
import {
  applyMigrations,
  applyTypeFixes,
  type MigrationOptions,
  printAnalysis,
  runRefactor,
  type TypeFixOptions,
} from './runner';
import { printSummaryReport, runTypecheck } from './utils';

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

    // Use mode system to determine if type analysis is needed
    const mode = resolveMode(options);
    const modeFlags = getModeFlags(mode);
    const isTypeAnalysis = modeFlags.analyzeTypeDuplicates;

    // Handle --all-packages for monorepo
    if (options.allPackages && packages.length > 0) {
      console.log(`📦 Analyzing all ${packages.length} packages...\n`);

      for (const pkg of packages) {
        // Use resolvePackagePaths for correct type analysis handling
        const resolved = resolvePackagePaths(projectRoot, pkg, isTypeAnalysis ?? false);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📁 Package: ${pkg.name} (${resolved.relativePath})`);
        console.log(`${'='.repeat(60)}\n`);

        // Pass the resolved path to runRefactor
        const pkgOptions = { ...options, path: resolved.relativePath };

        const analysis = await runRefactor(projectRoot, pkgOptions);
        await printAnalysis(analysis, projectRoot, resolved.targetPath, options);

        // Apply if requested
        if (options.apply && !options.dryRun) {
          const migrateOpts: MigrationOptions = {
            dryRun: false,
          };
          if (options.verbose !== undefined) migrateOpts.verbose = options.verbose;
          await applyMigrations(analysis, projectRoot, migrateOpts);
        }
      }

      return;
    }

    // Single package or non-monorepo analysis
    const resolved = resolvePaths(projectRoot, options);

    // Run analysis with already resolved paths (avoid duplicate resolvePaths call)
    const analysis = await runRefactor(projectRoot, { ...options, path: resolved.relativePath });

    // Print results
    await printAnalysis(analysis, projectRoot, resolved.targetPath, options);

    // Track what was applied
    let appliedMigrations = false;
    let appliedTypeFixes = false;

    // Apply if requested
    if (options.apply && !options.dryRun) {
      const migrateOpts: MigrationOptions = {
        dryRun: false,
      };
      if (options.verbose !== undefined) migrateOpts.verbose = options.verbose;
      const result = await applyMigrations(analysis, projectRoot, migrateOpts);
      appliedMigrations = result.success;
    }

    // Apply type fixes if requested
    if (options.fixTypes && analysis.typeDuplicates) {
      const typeFixOpts: TypeFixOptions = {
        onlyIdentical: true, // Always use safe mode (100% identical types only)
      };
      if (options.dryRun !== undefined) typeFixOpts.dryRun = options.dryRun;
      if (options.verbose !== undefined) typeFixOpts.verbose = options.verbose;
      const result = await applyTypeFixes(analysis, projectRoot, typeFixOpts);
      appliedTypeFixes = result.success;
    }

    // Run typecheck after applying changes
    if (appliedMigrations || appliedTypeFixes) {
      console.log('\n🔍 Running typecheck...');
      const typecheckResult = await runTypecheck(projectRoot);
      printSummaryReport(analysis, typecheckResult, appliedMigrations, appliedTypeFixes);
    } else {
      // Just show analysis summary without typecheck
      printSummaryReport(analysis, null, false, false);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}`);
    process.exit(1);
  }
}
