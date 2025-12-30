/**
 * @module commands/refactor/migration/imports
 * @description Import analysis and update utilities
 *
 * Provides:
 * - Finding files that import a given module
 * - Updating import statements in files
 * - Updating internal imports when files move
 *
 * Uses dynamic path resolution from @discovery/paths to support
 * any project structure without hardcoded paths.
 */

import * as path from 'node:path';
import { exists, findFiles, readFile, writeFile } from '../../../lib/@core/fs';
import { createPathResolver, type PathResolver } from '../../../lib/@discovery/paths';
import { escapeRegex, escapeReplacement } from '../../../lib/@security';

// ============================================================================
// TYPES
// ============================================================================

export interface UpdateImportsResult {
  success: boolean;
  changed: boolean;
  errors: string[];
}

// ============================================================================
// PATH RESOLVER CACHE
// ============================================================================

/** Cached path resolver per project root */
const resolverCache = new Map<string, PathResolver>();

/**
 * Get or create path resolver for project
 */
function getResolver(projectRoot: string): PathResolver {
  let resolver = resolverCache.get(projectRoot);
  if (!resolver) {
    resolver = createPathResolver(projectRoot);
    resolverCache.set(projectRoot, resolver);
  }
  return resolver;
}

/**
 * Clear resolver cache (for testing or project changes)
 */
export function clearResolverCache(): void {
  resolverCache.clear();
}

// ============================================================================
// IMPORT ANALYSIS
// ============================================================================

/**
 * Find all files that import a given module
 *
 * Uses dynamic path resolution to work with any project structure.
 * Scans the source directory detected from tsconfig.json.
 */
export async function findAffectedImports(
  modulePath: string,
  projectRoot: string,
): Promise<string[]> {
  const affected: string[] = [];
  const moduleBasename = path.basename(modulePath, '.ts');
  const escapedBasename = escapeRegex(moduleBasename);
  const escapedPath = escapeRegex(modulePath.replace('.ts', ''));

  // Use dynamic source directory detection
  const resolver = getResolver(projectRoot);
  const srcPath = path.join(projectRoot, resolver.sourceDir);
  const files = await findFiles(srcPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  // Filter out .d.ts files
  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Check if file imports from this module - improved patterns
    const patterns = [
      // Match imports ending with the basename (with or without trailing slash before)
      new RegExp(`from\\s+['"][^'"]*[/]${escapedBasename}['"]`),
      new RegExp(`from\\s+['"][^'"]*${escapedPath}['"]`),
      // Match direct file imports like './fs' or '../lib/fs'
      new RegExp(`from\\s+['"][^'"]*/${escapedBasename}['"]`),
      new RegExp(`from\\s+['"]\\./${escapedBasename}['"]`),
    ];

    if (patterns.some((p) => p.test(content))) {
      affected.push(path.relative(projectRoot, file));
    }
  }

  return affected;
}

// ============================================================================
// IMPORT UPDATES
// ============================================================================

/**
 * Calculate new relative import path after a file move
 *
 * @param importingFile - File containing the import (relative to project root)
 * @param newModulePath - New module path (relative to source directory)
 * @param projectRoot - Project root directory
 * @param resolver - Path resolver instance
 */
function calculateNewImportPath(
  importingFile: string,
  newModulePath: string,
  projectRoot: string,
  resolver: PathResolver,
): string {
  const importingDir = path.dirname(path.join(projectRoot, importingFile));

  // Resolve new module path - could be aliased or relative
  let newModuleAbs: string;

  if (resolver.isAlias(newModulePath)) {
    // Aliased path: @/lib/utils -> src/lib/utils
    const resolved = resolver.resolveAlias(newModulePath);
    if (resolved) {
      newModuleAbs = path.join(projectRoot, resolved);
    } else {
      newModuleAbs = path.join(projectRoot, resolver.sourceDir, newModulePath);
    }
  } else if (newModulePath.startsWith('/') || path.isAbsolute(newModulePath)) {
    // Absolute path
    newModuleAbs = newModulePath;
  } else {
    // Relative to source directory
    newModuleAbs = path.join(projectRoot, resolver.sourceDir, newModulePath);
  }

  let relativePath = path.relative(importingDir, newModuleAbs);

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }

  // Remove .ts extension
  return relativePath.replace(/\.ts$/, '');
}

/**
 * Update imports in a file with proper validation
 *
 * Uses dynamic path resolution to support any project structure.
 *
 * @param filePath - File to update imports in
 * @param oldPath - Old import path (module being replaced)
 * @param newPath - New import path (replacement module)
 * @param projectRoot - Project root directory
 * @param libPath - DEPRECATED: ignored, uses dynamic detection
 */
export async function updateImports(
  filePath: string,
  oldPath: string,
  newPath: string,
  projectRoot: string,
  _libPath?: string, // Kept for backwards compatibility, but ignored
): Promise<UpdateImportsResult> {
  const errors: string[] = [];
  const resolver = getResolver(projectRoot);

  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

    if (!exists(fullPath)) {
      return { success: false, changed: false, errors: ['File not found'] };
    }

    const content = readFile(fullPath);
    if (!content) {
      return { success: false, changed: false, errors: ['Could not read file'] };
    }

    // Normalize paths for replacement
    const oldImport = oldPath.replace('.ts', '').replace(/\\/g, '/');
    const newImport = newPath.replace('.ts', '').replace(/\\/g, '/');

    // Get basenames
    const oldBasename = path.basename(oldImport);
    const newBasename = path.basename(newImport);

    // Escape for regex and replacement
    const oldEscaped = escapeRegex(oldBasename);
    const newEscaped = escapeReplacement(newBasename);

    // Build new import path relative to the importing file
    const newRelativePath = calculateNewImportPath(
      path.relative(projectRoot, fullPath),
      newPath,
      projectRoot,
      resolver,
    );

    // Import patterns - improved to catch more cases
    // Uses dynamic path detection instead of hardcoded patterns
    const patterns = [
      // Match './oldname' or '../path/oldname'
      {
        find: new RegExp(`(from\\s+['"])([^'"]*/)${oldEscaped}(['"])`, 'g'),
        replace: `$1${escapeReplacement(newRelativePath)}$3`,
      },
      // Match direct imports like 'from "./fs"'
      {
        find: new RegExp(`(from\\s+['"]\\./)${oldEscaped}(['"])`, 'g'),
        replace: `$1${newEscaped}$2`,
      },
      // Match aliased imports (e.g., @/lib/oldname)
      {
        find: new RegExp(`(from\\s+['"]@[^'"]*/)${oldEscaped}(['"])`, 'g'),
        replace: `$1${newEscaped}$2`,
      },
    ];

    let updated = content;
    let changed = false;

    for (const { find, replace } of patterns) {
      const newContent = updated.replace(find, replace);
      if (newContent !== updated) {
        updated = newContent;
        changed = true;
      }
    }

    if (changed) {
      const writeSuccess = writeFile(fullPath, updated);
      if (!writeSuccess) {
        errors.push('Failed to write file');
        return { success: false, changed: false, errors };
      }
    }

    return { success: true, changed, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    return { success: false, changed: false, errors };
  }
}

// ============================================================================
// INTERNAL IMPORTS
// ============================================================================

/**
 * Update internal imports within a moved file
 * When a file moves from lib/fs.ts to lib/@fs/fs.ts, its internal imports need adjustment
 */
export function updateInternalImports(
  content: string,
  oldFilePath: string,
  newFilePath: string,
): string {
  const oldDir = path.dirname(oldFilePath);
  const newDir = path.dirname(newFilePath);

  // If the directory didn't change, no updates needed
  if (oldDir === newDir) {
    return content;
  }

  // Calculate depth difference
  const oldDepth = oldDir.split('/').filter(Boolean).length;
  const newDepth = newDir.split('/').filter(Boolean).length;
  const depthDiff = newDepth - oldDepth;

  if (depthDiff === 0) {
    return content;
  }

  // Update relative imports
  // Pattern: from './something' or from '../something'
  const importRegex = /(from\s+['"])(\.\.[/]|\.[/])([^'"]+)(['"])/g;

  return content.replace(importRegex, (match, prefix, dots, importPath, suffix) => {
    // Calculate new relative path
    if (dots === './') {
      // Same directory imports - need to go up now
      const ups = '../'.repeat(Math.max(1, depthDiff));
      return `${prefix}${ups}${importPath}${suffix}`;
    } else if (dots === '../') {
      // Already going up - may need more ups
      if (depthDiff > 0) {
        const additionalUps = '../'.repeat(depthDiff);
        return `${prefix}${additionalUps}${importPath}${suffix}`;
      }
    }
    return match;
  });
}
