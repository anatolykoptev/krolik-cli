/**
 * @module commands/refactor/analyzers/architecture/namespace/fs-utils
 * @description File system utilities for namespace analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '__tests__',
  '__mocks__',
];

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Check if a directory name is namespaced (starts with @)
 */
export function isNamespaced(name: string): boolean {
  return name.startsWith('@');
}

/**
 * Count TypeScript files recursively in a directory
 */
export function countTsFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      count++;
    } else if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
      count += countTsFiles(path.join(dir, entry.name));
    }
  }

  return count;
}

/**
 * Get subdirectories in a directory
 */
export function getSubdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name))
    .map((e) => e.name);
}

/**
 * Find lib directory in project
 */
export function findLibDir(projectRoot: string): string | null {
  const candidates = [
    path.join(projectRoot, 'lib'),
    path.join(projectRoot, 'src', 'lib'),
    path.join(projectRoot, 'apps', 'web', 'lib'),
    path.join(projectRoot, 'packages', 'shared', 'src'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
