/**
 * @module commands/refactor/migration/imports
 * @description Import analysis and update utilities
 *
 * Provides:
 * - Finding files that import a given module
 * - Updating import statements in files
 * - Updating internal imports when files move
 */

import * as path from 'path';
import {
  findFiles,
  readFile,
  writeFile,
  exists,
  escapeRegex,
  escapeReplacement,
} from '../../../lib';

// ============================================================================
// TYPES
// ============================================================================

export interface UpdateImportsResult {
  success: boolean;
  changed: boolean;
  errors: string[];
}

// ============================================================================
// IMPORT ANALYSIS
// ============================================================================

/**
 * Find all files that import a given module
 */
export async function findAffectedImports(
  modulePath: string,
  projectRoot: string,
): Promise<string[]> {
  const affected: string[] = [];
  const moduleBasename = path.basename(modulePath, '.ts');
  const escapedBasename = escapeRegex(moduleBasename);
  const escapedPath = escapeRegex(modulePath.replace('.ts', ''));

  const srcPath = path.join(projectRoot, 'src');
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
 */
function calculateNewImportPath(
  importingFile: string,
  _oldModulePath: string,
  newModulePath: string,
  projectRoot: string,
): string {
  const importingDir = path.dirname(path.join(projectRoot, importingFile));
  const newModuleAbs = path.join(projectRoot, 'src', 'lib', newModulePath);

  let relativePath = path.relative(importingDir, newModuleAbs);

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  // Remove .ts extension
  return relativePath.replace(/\.ts$/, '');
}

/**
 * Update imports in a file with proper validation
 */
export async function updateImports(
  filePath: string,
  oldPath: string,
  newPath: string,
  projectRoot: string,
): Promise<UpdateImportsResult> {
  const errors: string[] = [];

  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectRoot, filePath);

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
      oldPath,
      newPath,
      projectRoot,
    );

    // Import patterns - improved to catch more cases
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
      // Match lib direct imports like '../../lib/fs'
      {
        find: new RegExp(`(from\\s+['"][^'"]*lib/)${oldEscaped}(['"])`, 'g'),
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
