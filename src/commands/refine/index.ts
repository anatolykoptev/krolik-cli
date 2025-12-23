/**
 * @module commands/refine
 * @description Namespace structure analyzer and migration tool
 *
 * Analyzes project lib/ directory structure and suggests @namespace organization
 * following Clean Architecture principles:
 *
 * - @core: Foundation layer (auth, config, utilities)
 * - @domain: Business logic (data access, state management)
 * - @integrations: External services (storage, APIs)
 * - @ui: UI utilities (hooks, providers)
 * - @seo: SEO (metadata, structured data)
 * - @utils: Shared utilities
 */

import type { CommandContext } from '../../types';
import type { RefineOptions, RefineResult } from './types';
import { analyzeStructure } from './analyzer';
import { applyMigration, previewMigration } from './migrator';
import { writeAiConfig } from './generator';
import { detectProjectContext, generateAiNavigation } from './context';
import { analyzeArchHealth, checkStandards } from './standards';
import {
  printRefineAnalysis,
  printEnhancedAnalysis,
  printSummary,
  formatJson,
  formatMarkdown,
  formatAI,
} from './output';

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run refine command
 */
export async function runRefine(
  ctx: CommandContext & { options: RefineOptions },
): Promise<void> {
  const { config, logger, options } = ctx;
  const projectRoot = config.projectRoot;

  // Analyze structure
  const result = analyzeStructure(projectRoot, options.libPath);
  const format = options.format ?? 'ai';

  // Enhance with context, arch health, and standards (always for verbose/full or non-text formats)
  if (options.verbose || format !== 'text') {
    enhanceResult(result, projectRoot);
  }

  // Handle output formats (if not an action command)
  if (!options.apply && !options.dryRun && !options.generateConfig) {
    if (format === 'json') {
      console.log(formatJson(result));
      return;
    }

    if (format === 'markdown') {
      console.log(formatMarkdown(result));
      return;
    }

    if (format === 'ai') {
      console.log(formatAI(result));
      return;
    }
  }

  // No lib directory found
  if (!result.libDir) {
    logger.error('No lib directory found in project');
    logger.info('Expected locations: lib/, src/lib/, apps/web/lib/, packages/shared/src/');
    return;
  }

  // Dry run mode - preview changes
  if (options.dryRun) {
    printRefineAnalysis(result, logger);
    previewMigration(result, logger);
    return;
  }

  // Apply migration
  if (options.apply) {
    printRefineAnalysis(result, logger);

    if (result.plan.moves.length === 0) {
      logger.success('No migrations needed - structure is already optimized!');
    } else {
      logger.section('Applying Migration');

      const migrationResult = applyMigration(result, false, logger);

      if (migrationResult.success) {
        logger.success(`Moved ${migrationResult.movedDirs.length} directories`);
        logger.success(`Updated ${migrationResult.updatedFiles} files`);
      } else {
        logger.error('Migration completed with errors:');
        for (const error of migrationResult.errors) {
          logger.error(`  - ${error}`);
        }
      }
    }

    // Generate ai-config.ts after successful migration
    if (options.generateConfig !== false) {
      logger.section('Generating AI Config');
      writeAiConfig(result, projectRoot, logger);
    }

    return;
  }

  // Generate config only
  if (options.generateConfig) {
    const configPath = writeAiConfig(result, projectRoot, logger);
    if (configPath) {
      logger.success(`Generated: ${configPath}`);
    }
    return;
  }

  // Default: show analysis
  if (options.verbose) {
    printEnhancedAnalysis(result, logger);
  } else {
    printSummary(result, logger);
  }
}

/**
 * Enhance result with full context, arch health, and standards
 */
function enhanceResult(result: RefineResult, projectRoot: string): void {
  // Skip if already enhanced
  if (result.context) return;

  // Detect project context
  result.context = detectProjectContext(projectRoot);

  // Analyze architecture health (only if lib dir exists)
  if (result.libDir) {
    result.archHealth = analyzeArchHealth(result.directories, result.libDir);
    result.standards = checkStandards(projectRoot, result.directories, result.context);
    result.aiNavigation = generateAiNavigation(projectRoot, result.context, result.libDir);
  }
}

/**
 * Get analysis result (for programmatic use)
 */
export function getRefineAnalysis(
  projectRoot: string,
  libPath?: string,
): RefineResult {
  return analyzeStructure(projectRoot, libPath);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { RefineOptions, RefineResult, DirectoryInfo } from './types';
export { analyzeStructure, findLibDir, detectCategory } from './analyzer';
export { applyMigration, previewMigration } from './migrator';
export { writeAiConfig, generateAiConfigContent } from './generator';
