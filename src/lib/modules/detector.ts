/**
 * @module lib/modules/detector
 * @description Main orchestrator for reusable code detection
 *
 * Combines all signal analyzers and classification logic to
 * discover reusable modules across a codebase.
 *
 * @example
 * ```ts
 * import { discoverReusableModules } from '@/lib/modules';
 *
 * const result = await discoverReusableModules('/path/to/project');
 * console.log(`Found ${result.stats.totalModules} reusable modules`);
 *
 * for (const module of result.modules) {
 *   console.log(`${module.name}: ${module.category} (${module.reusabilityLevel})`);
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { analyzeSourceFile } from '@/lib/analysis';
import { classifyModule } from './classifier';
import { calculateReusabilityScore, determineReusabilityLevel } from './scorer';
import {
  analyzeContentSignals,
  analyzeDirectorySignals,
  analyzeDocumentationSignals,
  analyzeExportSignals,
  analyzeImportSignals,
  analyzeNamingSignals,
  buildImportGraph,
  extractModuleDescription,
  extractModuleName,
  type ImportGraph,
} from './signals';
import {
  DEFAULT_CONFIG,
  type DetectionSignals,
  type DiscoveredModule,
  type DiscoveryResult,
  type ModuleCategory,
  type ModulesByCategory,
  type ModulesByReusability,
  REUSABLE_DIRECTORY_PATTERNS,
  type ReusabilityLevel,
  type ReusableDetectionConfig,
} from './types';

// ============================================================================
// DISCOVERY OPTIONS
// ============================================================================

interface DiscoveryOptions {
  /** Custom configuration */
  config?: ReusableDetectionConfig;
  /** Pre-built import graph (for performance) */
  importGraph?: ImportGraph;
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

// ============================================================================
// FILE COLLECTION
// ============================================================================

/**
 * Collect candidate files for analysis
 */
async function collectCandidateFiles(
  projectRoot: string,
  config: ReusableDetectionConfig,
): Promise<string[]> {
  // Build include patterns
  const includePatterns: string[] = [...(config.include ?? [])];

  // Add default reusable directory patterns
  for (const pattern of Object.keys(REUSABLE_DIRECTORY_PATTERNS)) {
    // Convert glob pattern to file pattern
    const filePattern = pattern.endsWith('/**')
      ? pattern.replace('/**', '/**/*.{ts,tsx,js,jsx}')
      : `${pattern}/*.{ts,tsx,js,jsx}`;
    includePatterns.push(filePattern);
  }

  // Add common src patterns if no includes specified
  if (config.include?.length === 0 || !config.include) {
    includePatterns.push('src/**/*.{ts,tsx,js,jsx}');
    includePatterns.push('packages/**/*.{ts,tsx,js,jsx}');
    includePatterns.push('apps/*/src/**/*.{ts,tsx,js,jsx}');
  }

  // Build exclude patterns
  const excludePatterns = [...(config.exclude ?? DEFAULT_CONFIG.exclude)];

  // Add force-not-reusable patterns to exclude
  if (config.forceNotReusable) {
    excludePatterns.push(...config.forceNotReusable);
  }

  // Find all matching files
  const files = await glob(includePatterns, {
    cwd: projectRoot,
    ignore: excludePatterns,
    absolute: true,
    nodir: true,
  });

  // Deduplicate
  return [...new Set(files)];
}

/**
 * Check if file should be force-included
 */
function isForceReusable(relativePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    if (regex.test(relativePath)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// MODULE ANALYSIS
// ============================================================================

/**
 * Analyze a single file and create module info
 */
function analyzeFile(
  filePath: string,
  projectRoot: string,
  importGraph: ImportGraph,
  config: ReusableDetectionConfig,
): DiscoveredModule | null {
  const relativePath = path.relative(projectRoot, filePath);
  const moduleName = extractModuleName(relativePath);

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Analyze exports
  const analysisResult = analyzeSourceFile(filePath, content);
  if (!analysisResult.success || analysisResult.exports.length === 0) {
    // No exports = not reusable (unless forced)
    if (!isForceReusable(relativePath, config.forceReusable ?? [])) {
      return null;
    }
  }

  const exports = analysisResult.exports;

  // Collect all signals
  const signals: DetectionSignals = {
    directory: analyzeDirectorySignals(relativePath, config.directoryScores),
    exports: analyzeExportSignals(filePath, content),
    imports: analyzeImportSignals(relativePath, importGraph),
    naming: analyzeNamingSignals(moduleName, exports),
    documentation: analyzeDocumentationSignals(filePath, content),
    content: analyzeContentSignals(filePath, content),
  };

  // Classify the module
  const category = classifyModule(signals, exports);

  // Check category overrides
  const overriddenCategory = config.categoryOverrides?.[relativePath] ?? category;

  // Calculate score
  const reusabilityScore = calculateReusabilityScore(signals, overriddenCategory);
  const reusabilityLevel = determineReusabilityLevel(reusabilityScore);

  // Check minimum score
  const minScore = config.minScore ?? DEFAULT_CONFIG.minScore;
  if (reusabilityScore < minScore && !isForceReusable(relativePath, config.forceReusable ?? [])) {
    return null;
  }

  // Check minimum level
  const minLevel = config.minReusabilityLevel ?? DEFAULT_CONFIG.minReusabilityLevel;
  if (!meetsMinimumLevel(reusabilityLevel, minLevel)) {
    return null;
  }

  // Check import count
  const minImports = config.minImportCount ?? DEFAULT_CONFIG.minImportCount;
  const includeUnused = config.includeUnused ?? DEFAULT_CONFIG.includeUnused;
  if (!includeUnused && signals.imports.importedByCount < minImports) {
    // Low imports but still include if in reusable directory
    if (
      !signals.directory.isInReusableDir &&
      !isForceReusable(relativePath, config.forceReusable ?? [])
    ) {
      return null;
    }
  }

  // Determine if it's a directory module
  const isDirectory = /index\.(ts|tsx|js|jsx)$/.test(filePath);

  // Build the module object
  const module: DiscoveredModule = {
    path: relativePath,
    absolutePath: filePath,
    name: moduleName,
    isDirectory,
    category: overriddenCategory,
    reusabilityLevel,
    reusabilityScore,
    exports,
    exportCount: exports.length,
    importedBy: signals.imports.importers,
    importedByCount: signals.imports.importedByCount,
    signals,
  };

  // Add optional description if present
  const description = extractModuleDescription(filePath, content);
  if (description) {
    module.description = description;
  }

  return module;
}

/**
 * Check if level meets minimum
 */
function meetsMinimumLevel(level: ReusabilityLevel, minLevel: ReusabilityLevel): boolean {
  const levelOrder: ReusabilityLevel[] = ['none', 'low', 'medium', 'high', 'core'];
  return levelOrder.indexOf(level) >= levelOrder.indexOf(minLevel);
}

// ============================================================================
// RESULT AGGREGATION
// ============================================================================

/**
 * Group modules by category
 */
function groupByCategory(modules: DiscoveredModule[]): ModulesByCategory {
  const groups: ModulesByCategory = {
    'ui-component': [],
    hook: [],
    utility: [],
    type: [],
    schema: [],
    service: [],
    constant: [],
    context: [],
    hoc: [],
    model: [],
    unknown: [],
  };

  for (const module of modules) {
    groups[module.category].push(module);
  }

  return groups;
}

/**
 * Group modules by reusability level
 */
function groupByReusability(modules: DiscoveredModule[]): ModulesByReusability {
  const groups: ModulesByReusability = {
    core: [],
    high: [],
    medium: [],
    low: [],
    none: [],
  };

  for (const module of modules) {
    groups[module.reusabilityLevel].push(module);
  }

  return groups;
}

/**
 * Detect project type
 */
function detectProjectType(projectRoot: string): 'app' | 'library' | 'monorepo' {
  // Check for monorepo indicators
  if (
    fs.existsSync(path.join(projectRoot, 'packages')) ||
    fs.existsSync(path.join(projectRoot, 'apps')) ||
    fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(projectRoot, 'lerna.json'))
  ) {
    return 'monorepo';
  }

  // Check for library indicators
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.main || pkg.module || pkg.exports) {
        return 'library';
      }
    } catch {
      // Ignore
    }
  }

  return 'app';
}

/**
 * Get project name
 */
function getProjectName(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.name ?? path.basename(projectRoot);
    } catch {
      // Ignore
    }
  }
  return path.basename(projectRoot);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Discover reusable modules across a codebase
 *
 * This is the main entry point for the reusable code detection system.
 *
 * @param projectRoot - Root directory of the project
 * @param options - Discovery options
 * @returns Discovery result with all modules and stats
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await discoverReusableModules('/path/to/project');
 *
 * // With custom config
 * const result = await discoverReusableModules('/path/to/project', {
 *   config: {
 *     include: ['custom-lib/**'],
 *     minImportCount: 3,
 *   },
 * });
 *
 * // With progress tracking
 * const result = await discoverReusableModules('/path/to/project', {
 *   onProgress: (current, total, file) => {
 *     console.log(`[${current}/${total}] Analyzing ${file}`);
 *   },
 * });
 * ```
 */
export async function discoverReusableModules(
  projectRoot: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const config: ReusableDetectionConfig = { ...DEFAULT_CONFIG, ...options.config };

  // Build import graph if not provided
  const importGraphOptions: { exclude?: string[] } = {};
  if (config.exclude) {
    importGraphOptions.exclude = config.exclude;
  }
  const importGraph =
    options.importGraph ?? (await buildImportGraph(projectRoot, importGraphOptions));

  // Collect candidate files
  const files = await collectCandidateFiles(projectRoot, config);

  // Analyze each file
  const modules: DiscoveredModule[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    // Report progress
    options.onProgress?.(i + 1, files.length, path.relative(projectRoot, file));

    // Analyze the file
    const module = analyzeFile(file, projectRoot, importGraph, config);
    if (module) {
      modules.push(module);
    }
  }

  // Sort modules by score (descending)
  modules.sort((a, b) => b.reusabilityScore - a.reusabilityScore);

  // Calculate stats
  const totalExports = modules.reduce((sum, m) => sum + m.exportCount, 0);

  return {
    modules,
    byCategory: groupByCategory(modules),
    byReusability: groupByReusability(modules),
    stats: {
      totalModules: modules.length,
      totalExports,
      scanDurationMs: Date.now() - startTime,
      filesScanned: files.length,
    },
    project: {
      root: projectRoot,
      name: getProjectName(projectRoot),
      type: detectProjectType(projectRoot),
    },
  };
}

/**
 * Quick check if a file is likely reusable
 *
 * Faster than full discovery - useful for incremental checks.
 *
 * @param filePath - Path to the file
 * @param projectRoot - Project root directory
 * @returns True if file appears to be reusable
 */
export function isLikelyReusable(filePath: string, projectRoot: string): boolean {
  const relativePath = path.relative(projectRoot, filePath);

  // Check directory patterns
  const dirSignals = analyzeDirectorySignals(relativePath);
  if (dirSignals.isInReusableDir) {
    return true;
  }

  // Check exports
  const exportSignals = analyzeExportSignals(filePath);
  if (exportSignals.namedExportCount >= 3) {
    return true;
  }

  // Check naming
  const moduleName = extractModuleName(relativePath);
  const namingSignals = analyzeNamingSignals(moduleName, []);
  if (namingSignals.isHookNaming || namingSignals.isUtilityNaming) {
    return true;
  }

  return false;
}

/**
 * Find the most reusable modules in a project
 *
 * @param projectRoot - Project root directory
 * @param limit - Maximum number of modules to return
 * @returns Top N most reusable modules
 */
export async function findTopReusableModules(
  projectRoot: string,
  limit = 20,
): Promise<DiscoveredModule[]> {
  const result = await discoverReusableModules(projectRoot, {
    config: {
      minReusabilityLevel: 'medium',
    },
  });

  return result.modules.slice(0, limit);
}

/**
 * Find modules by category
 *
 * @param projectRoot - Project root directory
 * @param category - Category to filter by
 * @returns Modules matching the category
 */
export async function findModulesByCategory(
  projectRoot: string,
  category: ModuleCategory,
): Promise<DiscoveredModule[]> {
  const result = await discoverReusableModules(projectRoot);
  return result.byCategory[category];
}
