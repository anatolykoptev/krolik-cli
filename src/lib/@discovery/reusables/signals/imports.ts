/**
 * @module lib/@modules/signals/imports
 * @description Import frequency analysis for reusable code detection
 *
 * Analyzes how often modules are imported across the codebase.
 * Frequently imported modules are more reusable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import type { ImportSignals } from '../types';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORES = {
  /** Score for being imported by 5+ files */
  HIGH_IMPORT_COUNT: 25,
  /** Score for being imported from 3+ different directories */
  CROSS_DIRECTORY: 20,
  /** Score for cross-package imports */
  CROSS_PACKAGE: 30,
  /** Score per importer (diminishing) */
  PER_IMPORTER: 3,
  /** Max bonus from importer count */
  MAX_IMPORTER_BONUS: 30,
};

// ============================================================================
// IMPORT GRAPH TYPES
// ============================================================================

/**
 * Import relationship between files
 */
interface ImportRelation {
  /** Path of the importing file */
  importer: string;
  /** Path of the imported module */
  imported: string;
  /** Import specifier as written in code */
  importSpecifier: string;
}

/**
 * Import graph for a project
 */
export interface ImportGraph {
  /** All import relations */
  relations: ImportRelation[];
  /** Map from module path to files that import it */
  importedBy: Map<string, Set<string>>;
  /** Map from file path to modules it imports */
  imports: Map<string, Set<string>>;
  /** Total files scanned */
  filesScanned: number;
  /** Scan duration in ms */
  scanDurationMs: number;
}

// ============================================================================
// IMPORT EXTRACTION
// ============================================================================

/**
 * Extract import specifiers from file content using regex
 *
 * Fast regex-based approach for extracting module sources.
 * For accurate AST-based extraction, use extractImports from @/lib/@ast/swc.
 */
function extractImportSpecifiers(content: string): string[] {
  const imports: string[] = [];

  // Match: import ... from 'specifier'
  const importFromRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  match = importFromRegex.exec(content);
  while (match !== null) {
    const specifier = match[1];
    if (specifier) imports.push(specifier);
    match = importFromRegex.exec(content);
  }

  // Match: import 'specifier' (side-effect imports)
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
  match = sideEffectRegex.exec(content);
  while (match !== null) {
    const specifier = match[1];
    if (specifier && !imports.includes(specifier)) {
      imports.push(specifier);
    }
    match = sideEffectRegex.exec(content);
  }

  return imports;
}

/**
 * Resolve import specifier to absolute path
 *
 * Handles:
 * - Relative imports (./foo, ../bar)
 * - Alias imports (@/lib, ~/utils)
 * - Bare imports (lodash) - skipped
 */
function resolveImportPath(
  specifier: string,
  importerPath: string,
  projectRoot: string,
  aliases: Record<string, string> = {},
): string | null {
  // Skip node_modules / external packages
  if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('~/')) {
    // Check if it's an alias
    for (const [alias, target] of Object.entries(aliases)) {
      if (specifier.startsWith(alias)) {
        const rest = specifier.slice(alias.length);
        return path.join(projectRoot, target, rest);
      }
    }
    return null; // External package
  }

  // Handle common aliases
  if (specifier.startsWith('@/')) {
    return path.join(projectRoot, 'src', specifier.slice(2));
  }
  if (specifier.startsWith('~/')) {
    return path.join(projectRoot, specifier.slice(2));
  }

  // Relative import
  const importerDir = path.dirname(importerPath);
  return path.resolve(importerDir, specifier);
}

/**
 * Normalize a path to a module path
 *
 * Handles file extensions and index files.
 */
function normalizeModulePath(modulePath: string): string {
  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];

  for (const ext of extensions) {
    const withExt = modulePath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  // Try as directory with index
  const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
  for (const indexFile of indexFiles) {
    const indexPath = path.join(modulePath, indexFile);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return modulePath;
}

// ============================================================================
// IMPORT GRAPH BUILDING
// ============================================================================

/**
 * Build import graph for a project
 *
 * @param projectRoot - Project root directory
 * @param options - Scan options
 * @returns Import graph
 *
 * @example
 * ```ts
 * const graph = await buildImportGraph('/path/to/project');
 * const importers = graph.importedBy.get('src/lib/utils.ts');
 * console.log(`utils.ts is imported by ${importers?.size ?? 0} files`);
 * ```
 */
export async function buildImportGraph(
  projectRoot: string,
  options: {
    include?: string[];
    exclude?: string[];
    aliases?: Record<string, string>;
  } = {},
): Promise<ImportGraph> {
  const startTime = Date.now();

  // Default patterns
  const includePatterns = options.include ?? ['**/*.{ts,tsx,js,jsx}'];
  const excludePatterns = options.exclude ?? [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/*.d.ts',
  ];

  // Find all source files
  const files = await glob(includePatterns, {
    cwd: projectRoot,
    ignore: excludePatterns,
    absolute: true,
  });

  const relations: ImportRelation[] = [];
  const importedBy = new Map<string, Set<string>>();
  const imports = new Map<string, Set<string>>();

  // Process each file
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const specifiers = extractImportSpecifiers(content);

      const fileImports = new Set<string>();

      for (const specifier of specifiers) {
        const resolvedPath = resolveImportPath(specifier, file, projectRoot, options.aliases);

        if (!resolvedPath) continue; // External package

        const normalizedPath = normalizeModulePath(resolvedPath);
        const relativePath = path.relative(projectRoot, normalizedPath);

        // Add to relations
        relations.push({
          importer: path.relative(projectRoot, file),
          imported: relativePath,
          importSpecifier: specifier,
        });

        // Update importedBy map
        if (!importedBy.has(relativePath)) {
          importedBy.set(relativePath, new Set());
        }
        importedBy.get(relativePath)!.add(path.relative(projectRoot, file));

        // Track what this file imports
        fileImports.add(relativePath);
      }

      imports.set(path.relative(projectRoot, file), fileImports);
    } catch {
      // Skip files that can't be read
    }
  }

  return {
    relations,
    importedBy,
    imports,
    filesScanned: files.length,
    scanDurationMs: Date.now() - startTime,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze import signals for a module
 *
 * @param modulePath - Relative path to the module
 * @param graph - Pre-built import graph
 * @returns Import signals with score
 *
 * @example
 * ```ts
 * const graph = await buildImportGraph(projectRoot);
 * const signals = analyzeImportSignals('src/lib/utils.ts', graph);
 * // { importedByCount: 15, importedByDifferentDirs: 5, score: 45, ... }
 * ```
 */
export function analyzeImportSignals(modulePath: string, graph: ImportGraph): ImportSignals {
  const importers = graph.importedBy.get(modulePath);

  if (!importers || importers.size === 0) {
    return {
      importedByCount: 0,
      importedByDifferentDirs: 0,
      isImportedAcrossPackages: false,
      importers: [],
      score: 0,
    };
  }

  const importerList = Array.from(importers);
  const importedByCount = importerList.length;

  // Count unique directories
  const uniqueDirs = new Set(importerList.map((p) => path.dirname(p)));
  const importedByDifferentDirs = uniqueDirs.size;

  // Check for cross-package imports (monorepo)
  const packagePattern = /^packages\/([^/]+)/;
  const packages = new Set<string>();
  const modulePackage = modulePath.match(packagePattern)?.[1];

  for (const importer of importerList) {
    const match = importer.match(packagePattern);
    if (match?.[1]) {
      packages.add(match[1]);
    }
  }

  const isImportedAcrossPackages = modulePackage
    ? packages.size > 1 || !packages.has(modulePackage)
    : false;

  // Calculate score
  let score = 0;

  // High import count
  if (importedByCount >= 5) {
    score += SCORES.HIGH_IMPORT_COUNT;
  }

  // Cross-directory usage
  if (importedByDifferentDirs >= 3) {
    score += SCORES.CROSS_DIRECTORY;
  }

  // Cross-package usage
  if (isImportedAcrossPackages) {
    score += SCORES.CROSS_PACKAGE;
  }

  // Per-importer bonus (diminishing)
  const importerBonus = Math.min(importedByCount * SCORES.PER_IMPORTER, SCORES.MAX_IMPORTER_BONUS);
  score += importerBonus;

  return {
    importedByCount,
    importedByDifferentDirs,
    isImportedAcrossPackages,
    importers: importerList,
    score,
  };
}

/**
 * Find orphan modules (not imported by anything)
 *
 * @param graph - Import graph
 * @returns List of orphan module paths
 */
export function findOrphanModules(graph: ImportGraph): string[] {
  const allModules = new Set<string>();
  const importedModules = new Set<string>();

  // Collect all modules
  for (const [file] of graph.imports) {
    allModules.add(file);
  }

  // Collect all imported modules
  for (const [imported] of graph.importedBy) {
    importedModules.add(imported);
  }

  // Find orphans
  const orphans: string[] = [];
  for (const module of allModules) {
    if (!importedModules.has(module)) {
      orphans.push(module);
    }
  }

  return orphans;
}

/**
 * Find highly connected modules (imported by many files)
 *
 * @param graph - Import graph
 * @param minImports - Minimum import count (default: 5)
 * @returns List of module paths sorted by import count
 */
export function findHighlyConnectedModules(
  graph: ImportGraph,
  minImports = 5,
): Array<{
  path: string;
  importCount: number;
}> {
  const result: Array<{ path: string; importCount: number }> = [];

  for (const [modulePath, importers] of graph.importedBy) {
    if (importers.size >= minImports) {
      result.push({
        path: modulePath,
        importCount: importers.size,
      });
    }
  }

  // Sort by import count descending
  return result.sort((a, b) => b.importCount - a.importCount);
}
