/**
 * @module commands/refactor/analyzers/architecture/architecture
 * @description Architecture health analysis
 *
 * Analyzes layer violations, circular dependencies, and dependency graphs.
 */

import * as path from 'node:path';
import type { ImportDeclaration, Module } from '@swc/core';
import { parseSync } from '@swc/core';
import { exists, findFiles, readFile } from '../../../../lib/@core/fs';
import { ALLOWED_DEPS, detectCategory, isBoundaryFile, NAMESPACE_INFO } from '../../core/constants';
import type { NamespaceCategory } from '../../core/types';
import type { ArchHealth, ArchViolation } from '../../core/types-ai';
import { getSubdirectories } from '../shared';

// ============================================================================
// TYPES
// ============================================================================

interface DirectoryWithCategory {
  name: string;
  path: string;
  category: NamespaceCategory;
}

// ============================================================================
// DIRECTORY CATEGORIZATION
// ============================================================================

/**
 * Get all directories with their detected categories
 */
export function getDirectoriesWithCategories(targetPath: string): DirectoryWithCategory[] {
  const result: DirectoryWithCategory[] = [];

  if (!exists(targetPath)) return result;

  const subdirs = getSubdirectories(targetPath);
  for (const name of subdirs) {
    const fullPath = path.join(targetPath, name);
    const category = detectCategory(name);
    result.push({ name, path: fullPath, category });
  }

  return result;
}

// ============================================================================
// DEPENDENCY ANALYSIS
// ============================================================================

/**
 * Extract runtime imports from a file using SWC AST
 *
 * Only returns REAL dependencies:
 * - Skips type-only imports (import type { ... })
 * - Skips re-exports (export { ... } from, export * from)
 * - Handles multiline imports correctly
 */
function extractRuntimeImports(content: string, filePath: string): string[] {
  const imports: string[] = [];

  try {
    const ast = parseSync(content, {
      syntax: 'typescript',
      tsx: filePath.endsWith('.tsx'),
      target: 'es2022',
    }) as Module;

    for (const item of ast.body) {
      // Only process ImportDeclaration (not ExportNamedDeclaration, ExportAllDeclaration)
      if (item.type !== 'ImportDeclaration') continue;

      const imp = item as ImportDeclaration;

      // Skip type-only imports (import type { ... } from '...')
      if (imp.typeOnly) continue;

      // Check if ALL specifiers are type-only (import { type A, type B } from '...')
      const specifiers = imp.specifiers || [];
      const hasRuntimeSpecifier = specifiers.some((spec) => {
        if (spec.type === 'ImportSpecifier') {
          return !spec.isTypeOnly;
        }
        // Default and namespace imports are runtime
        return true;
      });

      // Skip if no runtime specifiers
      if (specifiers.length > 0 && !hasRuntimeSpecifier) continue;

      imports.push(imp.source.value);
    }
  } catch {
    // Fallback to regex for unparseable files
    const importRegex = /^import\s+(?!type\s)/gm;
    const fromRegex = /from\s+['"]([^'"]+)['"]/g;

    if (importRegex.test(content)) {
      let match: RegExpExecArray | null;
      while ((match = fromRegex.exec(content)) !== null) {
        if (match[1]) imports.push(match[1]);
      }
    }
  }

  return imports;
}

/**
 * Build directory lookup maps for O(1) access
 * Handles variations: name, @name, name without @
 */
function buildDirLookupMaps(allDirs: DirectoryWithCategory[]): Map<string, DirectoryWithCategory> {
  const map = new Map<string, DirectoryWithCategory>();
  for (const dir of allDirs) {
    // Direct name lookup
    map.set(dir.name, dir);
    // Also index without @ prefix if present
    if (dir.name.startsWith('@')) {
      map.set(dir.name.slice(1), dir);
    } else {
      // Also index with @ prefix
      map.set(`@${dir.name}`, dir);
    }
  }
  return map;
}

/**
 * Analyze dependencies of a directory
 *
 * Uses SWC AST for accurate detection:
 * - Skips re-exports (export { ... } from, export * from)
 * - Skips type-only imports (import type, import { type X })
 * - Skips boundary files (factory.ts, bootstrap.ts, etc.) - they are allowed to cross layers
 * - Handles multiline imports correctly
 */
export function analyzeDependencies(dirPath: string, allDirs: DirectoryWithCategory[]): string[] {
  const deps = new Set<string>();

  // Build lookup map for O(1) access (avoids O(n^2) from find() in nested loop)
  const dirLookup = buildDirLookupMaps(allDirs);

  const files = findFiles(dirPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules'],
  });

  for (const file of files) {
    // Skip boundary files - they are allowed to import from any layer
    // as they handle DI wiring and infrastructure setup
    if (isBoundaryFile(file)) {
      continue;
    }

    const content = readFile(file);
    if (!content) continue;

    const importPaths = extractRuntimeImports(content, file);

    for (const importPath of importPaths) {
      // Check for lib imports
      if (importPath.includes('@/lib/') || importPath.includes('/lib/')) {
        const libMatch = importPath.match(/lib\/(@?[\w-]+)/);
        if (libMatch) {
          const depName = libMatch[1]!;
          const depDir = dirLookup.get(depName);
          if (depDir && depDir.path !== dirPath) {
            deps.add(depDir.name);
          }
        }
      }
    }
  }

  return Array.from(deps);
}

// ============================================================================
// CIRCULAR DEPENDENCY DETECTION
// ============================================================================

/**
 * Find circular dependencies in a dependency graph
 */
export function findCircularDeps(graph: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, pathArr: string[]): void {
    visited.add(node);
    recursionStack.add(node);

    for (const dep of graph[node] || []) {
      if (!visited.has(dep)) {
        dfs(dep, [...pathArr, dep]);
      } else if (recursionStack.has(dep)) {
        const cycleStart = pathArr.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push([...pathArr.slice(cycleStart), dep]);
        } else {
          cycles.push([...pathArr, dep]);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return cycles;
}

// ============================================================================
// LAYER VIOLATION DETECTION
// ============================================================================

/**
 * Check for layer violations between directories
 *
 * Uses pre-built lookup map for O(1) access (avoids O(n*m) complexity)
 */
function checkLayerViolations(
  dir: DirectoryWithCategory,
  deps: string[],
  dirLookup: Map<string, DirectoryWithCategory>,
): ArchViolation[] {
  const violations: ArchViolation[] = [];
  const dirLayer = NAMESPACE_INFO[dir.category].layer;

  for (const dep of deps) {
    const depDir = dirLookup.get(dep);
    if (!depDir) continue;

    const depLayer = NAMESPACE_INFO[depDir.category].layer;

    // Check if lower layer imports from higher layer
    if (depLayer > dirLayer && dir.category !== 'unknown') {
      violations.push({
        type: 'layer-violation',
        severity: 'error',
        from: dir.name,
        to: depDir.name,
        message: `${dir.name} (${dir.category}) imports from ${depDir.name} (${depDir.category})`,
        fix: 'Move shared code to a lower layer or use dependency injection',
      });
    }

    // Check if dependency is not in allowed list
    if (
      !ALLOWED_DEPS[dir.category].includes(depDir.category) &&
      dir.category !== depDir.category &&
      dir.category !== 'unknown'
    ) {
      violations.push({
        type: 'layer-violation',
        severity: 'warning',
        from: dir.name,
        to: depDir.name,
        message: `${dir.category} should not directly import from ${depDir.category}`,
        fix: 'Use abstraction or move code to appropriate layer',
      });
    }
  }

  return violations;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Analyze architecture health of a target directory
 */
export function analyzeArchHealth(targetPath: string, _projectRoot: string): ArchHealth {
  const violations: ArchViolation[] = [];
  const dependencyGraph: Record<string, string[]> = {};
  const layerCompliance: ArchHealth['layerCompliance'] = {};

  // Get all directories with their categories
  const dirs = getDirectoriesWithCategories(targetPath);

  // Pre-build lookup map for O(1) access (avoids O(n^2) in checkLayerViolations)
  const dirLookup = buildDirLookupMaps(dirs);

  // Build dependency graph and check violations
  for (const dir of dirs) {
    const deps = analyzeDependencies(dir.path, dirs);
    dependencyGraph[dir.name] = deps;

    layerCompliance[dir.name] = {
      expected: dir.category,
      actual: dir.category,
      compliant: true,
    };

    // Check for layer violations (uses pre-built lookup map)
    const dirViolations = checkLayerViolations(dir, deps, dirLookup);
    violations.push(...dirViolations);

    // Mark non-compliant
    if (dirViolations.some((v) => v.severity === 'error')) {
      const compliance = layerCompliance[dir.name];
      if (compliance) compliance.compliant = false;
    }
  }

  // Check for circular dependencies
  const cycles = findCircularDeps(dependencyGraph);
  for (const cycle of cycles) {
    if (cycle.length === 0) continue;
    violations.push({
      type: 'circular',
      severity: 'error',
      from: cycle[0]!,
      to: cycle[cycle.length - 1]!,
      message: `Circular dependency: ${cycle.join(' → ')}`,
      fix: 'Break the cycle by extracting shared code or using interfaces',
    });
  }

  // Calculate score
  const score = Math.max(
    0,
    100 - violations.reduce((sum, v) => sum + (v.severity === 'error' ? 15 : 5), 0),
  );

  return { score, violations, dependencyGraph, layerCompliance };
}
