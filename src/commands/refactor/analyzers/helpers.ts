/**
 * @module commands/refactor/analyzers/helpers
 * @description Shared helper utilities for analyzers
 *
 * Common file system operations and package.json reading.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, readFile } from '../../../lib';

// ============================================================================
// TYPES
// ============================================================================

export interface PackageJson {
  name?: string;
  main?: string;
  bin?: unknown;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ============================================================================
// PACKAGE.JSON
// ============================================================================

/**
 * Read and parse package.json from project root
 */
export function readPackageJson(projectRoot: string): PackageJson | null {
  try {
    const content = readFile(path.join(projectRoot, 'package.json'));
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get combined dependencies (dependencies + devDependencies)
 */
export function getAllDependencies(pkg: PackageJson | null): Record<string, string> {
  if (!pkg) return {};
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

// ============================================================================
// FILE SYSTEM HELPERS
// ============================================================================

/**
 * Check if a file exists at path relative to project root
 */
export function hasFile(projectRoot: string, filePath: string): boolean {
  return exists(path.join(projectRoot, filePath));
}

/**
 * Check if a directory exists at path relative to project root
 */
export function hasDir(projectRoot: string, dirPath: string): boolean {
  const fullPath = path.join(projectRoot, dirPath);
  try {
    return exists(fullPath) && fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find first existing directory from candidates
 */
export function findDir(projectRoot: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (hasDir(projectRoot, c)) return c;
  }
  return null;
}

/**
 * Find first existing file from candidates
 */
export function findFile(projectRoot: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (hasFile(projectRoot, c)) return c;
  }
  return null;
}

/**
 * List directory entries
 */
export function listDirectory(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Get subdirectory names
 */
export function getSubdirectories(dirPath: string): string[] {
  return listDirectory(dirPath)
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Find tsconfig.json in monorepo structures
 *
 * Tries multiple locations:
 * 1. Alongside the target path (e.g., apps/web/tsconfig.json)
 * 2. In the package root if target is lib/src/lib
 * 3. At project root (tsconfig.json)
 * 4. At project root (tsconfig.base.json)
 *
 * @param targetPath - The path being analyzed (e.g., apps/web/lib)
 * @param projectRoot - The project root
 * @returns Path to tsconfig.json or null if not found
 */
export function findTsConfig(targetPath: string, projectRoot: string): string | null {
  // Get relative path from project root
  const relPath = path.relative(projectRoot, targetPath);
  const parts = relPath.split(path.sep);

  // Candidates to try
  const candidates: string[] = [];

  // 1. Check in the same directory as target
  candidates.push(path.join(targetPath, 'tsconfig.json'));

  // 2. Check in parent directories up to package root
  // e.g., apps/web/lib -> apps/web/tsconfig.json
  if (parts.length >= 2 && parts[0] && parts[1]) {
    // For apps/web/lib or packages/api/src/lib, try apps/web or packages/api
    if (parts[0] === 'apps' || parts[0] === 'packages') {
      const packageRoot = path.join(projectRoot, parts[0], parts[1]);
      candidates.push(path.join(packageRoot, 'tsconfig.json'));
    }
  }

  // 3. Check at project root
  candidates.push(path.join(projectRoot, 'tsconfig.json'));

  // 4. Check for tsconfig.base.json at project root (common in monorepos)
  candidates.push(path.join(projectRoot, 'tsconfig.base.json'));

  // Return first existing
  for (const c of candidates) {
    if (exists(c)) {
      return c;
    }
  }

  return null;
}

// ============================================================================
// TS-MORPH PROJECT CREATION
// ============================================================================

/**
 * Create a shared ts-morph Project for AST analysis
 * This allows multiple analyzers to reuse the same project instance,
 * avoiding expensive re-parsing of the same files
 *
 * @param targetPath - The path being analyzed
 * @param projectRoot - The project root
 * @returns ts-morph Project instance
 */
export function createSharedProject(
  targetPath: string,
  projectRoot: string,
): ReturnType<typeof import('../../../lib/@ast').createProject> {
  const { createProject } = require('../../../lib/@ast');
  const tsConfigPath = findTsConfig(targetPath, projectRoot);

  return tsConfigPath ? createProject({ tsConfigPath }) : createProject({});
}
