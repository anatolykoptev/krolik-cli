/**
 * @module commands/refactor/command
 * @description CLI command handler for refactor
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectFeatures, detectMonorepoPackages } from '../../config';
import { createEnhancedAnalysis } from './analyzers/enhanced';
import type { RefactorOptions } from './core/options';
import { getModeFlags, resolveMode } from './core/options';
import type { Recommendation } from './core/types-ai';
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

// ============================================================================
// RECOMMENDATION CACHING
// ============================================================================

const REFACTOR_DATA_FILE = '.krolik/refactor-data.json';

interface RefactorDataCache {
  timestamp: string;
  path: string;
  recommendations: Recommendation[];
}

/**
 * Cache recommendations for fix --from-refactor integration
 *
 * @param projectRoot - Project root directory
 * @param targetPath - Analyzed path (relative)
 * @param recommendations - All recommendations from analysis
 */
function cacheRecommendations(
  projectRoot: string,
  targetPath: string,
  recommendations: Recommendation[],
): void {
  const krolikDir = path.join(projectRoot, '.krolik');
  const cachePath = path.join(projectRoot, REFACTOR_DATA_FILE);

  // Ensure .krolik directory exists
  if (!fs.existsSync(krolikDir)) {
    fs.mkdirSync(krolikDir, { recursive: true });
  }

  const cache: RefactorDataCache = {
    timestamp: new Date().toISOString(),
    path: targetPath,
    recommendations,
  };

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Print hint about auto-fixable recommendations
 */
function printAutoFixHint(recommendations: Recommendation[]): void {
  const autoFixable = recommendations.filter((r) => r.autoFixable);
  if (autoFixable.length === 0) return;

  console.log('\n💡 Auto-fixable recommendations detected:');

  // Group by category
  const byCategory = new Map<string, number>();
  for (const rec of autoFixable) {
    byCategory.set(rec.category, (byCategory.get(rec.category) ?? 0) + 1);
  }

  for (const [category, count] of byCategory) {
    console.log(`   • ${category}: ${count} issue${count > 1 ? 's' : ''}`);
  }

  console.log(`\n   Run: krolik fix --from-refactor`);
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
    // Let runRefactor call resolvePaths to get all source paths
    const analysis = await runRefactor(projectRoot, options);

    // Get resolved paths for output
    const resolved = resolvePaths(projectRoot, options);

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

    // Cache recommendations for fix --from-refactor integration
    // Create enhanced analysis to get recommendations (same as printAnalysis does internally)
    const enhanced = await createEnhancedAnalysis(analysis, projectRoot, resolved.targetPath);
    if (enhanced.recommendations?.length > 0) {
      cacheRecommendations(projectRoot, resolved.relativePath, enhanced.recommendations);
      printAutoFixHint(enhanced.recommendations);
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
