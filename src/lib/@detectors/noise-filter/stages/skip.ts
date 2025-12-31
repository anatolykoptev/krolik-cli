/**
 * @module lib/@detectors/noise-filter/stages/skip
 * @description Stage 0: Fast Path Skip Filter
 *
 * Binary skip decisions based on path patterns.
 * O(1) checks for common cases, O(n) path scanning for directories.
 */

import * as path from 'node:path';

// ============================================================================
// SKIP PATTERNS
// ============================================================================

/** Directories to always skip */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.pnpm',
  '.cache',
  '.output',
  '__pycache__',
  '.venv',
]);

/** File extensions to always skip */
const SKIP_EXTENSIONS = new Set([
  '.d.ts',
  '.map',
  '.min.js',
  '.min.css',
  '.lock',
  '.log',
  '.tsbuildinfo',
  '.chunk.js',
  '.chunk.css',
]);

/** Specific files to always skip */
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  '.DS_Store',
  'Thumbs.db',
]);

// ============================================================================
// COMPILED PATTERNS
// ============================================================================

/** Pre-compiled directory patterns for faster matching */
const SKIP_DIR_PATTERNS: [string, string][] = [...SKIP_DIRS].map((dir) => [
  `/${dir}/`,
  `\\${dir}\\`,
]);

// ============================================================================
// PUBLIC API
// ============================================================================

export interface SkipResult {
  skip: boolean;
  reason?: 'dir' | 'extension' | 'file';
  pattern?: string;
}

/**
 * Check if a file should be skipped entirely (fast path).
 *
 * Performs O(1) checks first (filename, extension), then O(n) path check.
 *
 * @param filepath - Path to check
 * @returns Whether to skip this file and why
 */
export function shouldSkip(filepath: string): SkipResult {
  // O(1): Check specific files first
  const filename = path.basename(filepath);
  if (SKIP_FILES.has(filename)) {
    return { skip: true, reason: 'file', pattern: filename };
  }

  // O(1): Check extension
  const ext = path.extname(filepath);
  if (SKIP_EXTENSIONS.has(ext)) {
    return { skip: true, reason: 'extension', pattern: ext };
  }

  // O(n): Check directory patterns
  for (const [unix, win] of SKIP_DIR_PATTERNS) {
    if (filepath.includes(unix) || filepath.includes(win)) {
      return { skip: true, reason: 'dir', pattern: unix.replace(/\//g, '') };
    }
  }

  return { skip: false };
}

/**
 * Simple boolean check for skip status.
 */
export function isSkippable(filepath: string): boolean {
  return shouldSkip(filepath).skip;
}

/**
 * Filter an array of file paths, removing skippable ones.
 *
 * @param paths - Array of file paths
 * @returns Filtered paths (non-skippable only)
 */
export function filterSkippable(paths: string[]): string[] {
  return paths.filter((p) => !isSkippable(p));
}

/**
 * Add a directory to the skip list (runtime extension).
 */
export function addSkipDir(dir: string): void {
  SKIP_DIRS.add(dir);
  SKIP_DIR_PATTERNS.push([`/${dir}/`, `\\${dir}\\`]);
}

/**
 * Add an extension to the skip list (runtime extension).
 */
export function addSkipExtension(ext: string): void {
  const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
  SKIP_EXTENSIONS.add(normalizedExt);
}

/**
 * Get current skip configuration.
 */
export function getSkipConfig(): {
  dirs: string[];
  extensions: string[];
  files: string[];
} {
  return {
    dirs: [...SKIP_DIRS],
    extensions: [...SKIP_EXTENSIONS],
    files: [...SKIP_FILES],
  };
}
