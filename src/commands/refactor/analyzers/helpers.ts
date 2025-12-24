/**
 * @module commands/refactor/analyzers/helpers
 * @description Shared helper utilities for analyzers
 *
 * Common file system operations and package.json reading.
 */

import * as fs from 'node:fs';
import * as path from 'path';
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
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}
