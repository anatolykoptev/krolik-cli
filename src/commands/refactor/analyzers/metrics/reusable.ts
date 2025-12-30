/**
 * @module commands/refactor/analyzers/metrics/reusable
 * @description Reusable modules analyzer integration
 *
 * Integrates the @reusable module detection system into refactor analysis.
 * Discovers reusable modules and provides categorized summaries for AI.
 */

import {
  type DiscoveredModule,
  type DiscoveryResult,
  discoverReusableModules,
} from '@/lib/@discovery/reusables';
import type {
  ReusableCategory,
  ReusableModuleSummary,
  ReusableModulesByCategory,
  ReusableModulesInfo,
} from '../../core/types-ai';

// ============================================================================
// CONVERSION
// ============================================================================

/**
 * Convert DiscoveredModule to ReusableModuleSummary
 */
function toSummary(module: DiscoveredModule): ReusableModuleSummary {
  const summary: ReusableModuleSummary = {
    path: module.path,
    name: module.name,
    category: module.category as ReusableCategory,
    level: module.reusabilityLevel,
    score: module.reusabilityScore,
    exportCount: module.exportCount,
    importedByCount: module.importedByCount,
  };

  if (module.description) {
    summary.description = module.description;
  }

  return summary;
}

/**
 * Convert ModulesByCategory to ReusableModulesByCategory
 */
function convertByCategory(result: DiscoveryResult): ReusableModulesByCategory {
  const categories: (keyof ReusableModulesByCategory)[] = [
    'ui-component',
    'hook',
    'utility',
    'type',
    'schema',
    'service',
    'constant',
    'context',
    'hoc',
    'model',
    'unknown',
  ];

  const converted: Partial<ReusableModulesByCategory> = {};

  for (const category of categories) {
    const modules = result.byCategory[category] ?? [];
    converted[category] = modules.map(toSummary);
  }

  return converted as ReusableModulesByCategory;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze reusable modules in a project
 *
 * @param projectRoot - Project root directory
 * @param targetPath - Optional target path (for focused analysis)
 * @returns Reusable modules info for AI output
 *
 * @example
 * ```ts
 * const reusableInfo = await analyzeReusableModules('/path/to/project');
 * console.log(`Found ${reusableInfo.totalModules} reusable modules`);
 * console.log(`Top modules: ${reusableInfo.topModules.map(m => m.name).join(', ')}`);
 * ```
 */
export async function analyzeReusableModules(
  projectRoot: string,
  _targetPath?: string,
): Promise<ReusableModulesInfo> {
  // Discover all reusable modules
  const result = await discoverReusableModules(projectRoot, {
    config: {
      minReusabilityLevel: 'low',
      minScore: 10,
      includeUnused: false,
    },
  });

  // Get top modules (core + high reusability)
  const topModules = [...result.byReusability.core, ...result.byReusability.high]
    .slice(0, 20)
    .map(toSummary);

  return {
    totalModules: result.stats.totalModules,
    totalExports: result.stats.totalExports,
    byCategory: convertByCategory(result),
    topModules,
    scanDurationMs: result.stats.scanDurationMs,
  };
}

/**
 * Get a quick summary of reusable modules (faster, less detailed)
 */
export async function getQuickReusableSummary(projectRoot: string): Promise<{
  totalModules: number;
  categoryCounts: Record<ReusableCategory, number>;
  topModules: ReusableModuleSummary[];
}> {
  const result = await discoverReusableModules(projectRoot, {
    config: {
      minReusabilityLevel: 'medium',
      minScore: 30,
    },
  });

  const categoryCounts: Record<ReusableCategory, number> = {
    'ui-component': result.byCategory['ui-component'].length,
    hook: result.byCategory.hook.length,
    utility: result.byCategory.utility.length,
    type: result.byCategory.type.length,
    schema: result.byCategory.schema.length,
    service: result.byCategory.service.length,
    constant: result.byCategory.constant.length,
    context: result.byCategory.context.length,
    hoc: result.byCategory.hoc.length,
    model: result.byCategory.model.length,
    unknown: result.byCategory.unknown.length,
  };

  const topModules = result.modules.slice(0, 10).map(toSummary);

  return {
    totalModules: result.stats.totalModules,
    categoryCounts,
    topModules,
  };
}
