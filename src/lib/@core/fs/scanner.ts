/**
 * @module lib/@core/fs/scanner
 * @description Unified directory scanner with flexible filtering
 *
 * Provides a single, powerful scanning function that covers all use cases:
 * - Pattern-based file filtering
 * - Extension filtering
 * - Skip directories (node_modules, .git, etc.)
 * - Depth limiting
 * - File type filtering (regular files, test files, etc.)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Default directories to skip during scanning
 */
export const DEFAULT_SKIP_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.pnpm',
] as const;

/**
 * Options for directory scanning
 */
export interface ScanOptions {
  /**
   * File name patterns to match (case-insensitive)
   * @example ['booking', 'payment']
   */
  patterns?: string[];

  /**
   * File extensions to include (with or without leading dot)
   * @example ['.ts', '.tsx'] or ['ts', 'tsx']
   */
  extensions?: string[];

  /**
   * Maximum directory depth to scan (0 = current dir only)
   * @default Infinity
   */
  maxDepth?: number;

  /**
   * Directories to skip (defaults to DEFAULT_SKIP_DIRS)
   */
  skipDirs?: string[];

  /**
   * Skip hidden directories (starting with .)
   * @default true
   */
  skipHidden?: boolean;

  /**
   * Include test files (.test.ts, .spec.ts)
   * @default false
   */
  includeTests?: boolean;

  /**
   * Only include test files
   * @default false
   */
  onlyTests?: boolean;

  /**
   * Custom file filter function
   */
  fileFilter?: (entry: fs.Dirent, fullPath: string) => boolean;

  /**
   * Custom directory filter function (in addition to skipDirs)
   */
  dirFilter?: (entry: fs.Dirent, fullPath: string) => boolean;
}

/**
 * Callback invoked for each matching file
 */
export type ScanCallback = (fullPath: string, entry: fs.Dirent) => void;

/**
 * Scan a directory recursively and invoke callback for each matching file
 *
 * @param dir - Root directory to scan
 * @param callback - Function invoked for each matching file
 * @param options - Scan configuration
 *
 * @example
 * // Find all TypeScript files matching "booking"
 * const files: string[] = [];
 * scanDirectory('src', (filePath) => files.push(filePath), {
 *   patterns: ['booking'],
 *   extensions: ['.ts', '.tsx'],
 * });
 *
 * @example
 * // Find all test files
 * const testFiles: string[] = [];
 * scanDirectory('src', (filePath) => testFiles.push(filePath), {
 *   onlyTests: true,
 * });
 */
export function scanDirectory(
  dir: string,
  callback: ScanCallback,
  options: ScanOptions = {},
): void {
  const {
    patterns = [],
    extensions = [],
    maxDepth = Infinity,
    skipDirs = [...DEFAULT_SKIP_DIRS],
    skipHidden = true,
    includeTests = false,
    onlyTests = false,
    fileFilter,
    dirFilter,
  } = options;

  // Normalize extensions (ensure they start with .)
  const normalizedExtensions = extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));

  function scan(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return; // Directory not readable
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (skipHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Skip excluded directories
        if (skipDirs.includes(entry.name)) {
          continue;
        }

        // Custom directory filter
        if (dirFilter && !dirFilter(entry, fullPath)) {
          continue;
        }

        // Recurse
        scan(fullPath, depth + 1);
        continue;
      }

      // Only process regular files
      if (!entry.isFile()) continue;

      // Test file filtering
      const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name);
      if (onlyTests && !isTestFile) continue;
      if (!includeTests && !onlyTests && isTestFile) continue;

      // Extension filtering
      if (normalizedExtensions.length > 0) {
        const hasMatchingExt = normalizedExtensions.some((ext) => entry.name.endsWith(ext));
        if (!hasMatchingExt) continue;
      }

      // Pattern filtering (case-insensitive)
      if (patterns.length > 0) {
        const nameLower = entry.name.toLowerCase();
        const matchesPattern = patterns.some((p) => nameLower.includes(p.toLowerCase()));
        if (!matchesPattern) continue;
      }

      // Custom file filter
      if (fileFilter && !fileFilter(entry, fullPath)) {
        continue;
      }

      // File matches all filters - invoke callback
      callback(fullPath, entry);
    }
  }

  scan(dir, 0);
}

/**
 * Scan directory and return array of matching file paths
 *
 * @param dir - Root directory to scan
 * @param options - Scan configuration
 * @returns Array of absolute file paths
 *
 * @example
 * const files = scanDirectorySync('src', {
 *   patterns: ['booking'],
 *   extensions: ['.ts', '.tsx'],
 * });
 */
export function scanDirectorySync(dir: string, options: ScanOptions = {}): string[] {
  const results: string[] = [];
  scanDirectory(dir, (fullPath) => results.push(fullPath), options);
  return results;
}

/**
 * Check if file name matches any pattern (case-insensitive)
 *
 * @param fileName - File name to check
 * @param patterns - Patterns to match against
 * @returns True if file matches any pattern, or if patterns is empty
 */
export function matchesPatterns(fileName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Check if entry should be skipped during scan
 *
 * @param name - Entry name
 * @param skipDirs - Directories to skip
 * @param skipHidden - Whether to skip hidden entries
 * @returns True if entry should be skipped
 */
export function shouldSkipEntry(
  name: string,
  skipDirs: string[] = [...DEFAULT_SKIP_DIRS],
  skipHidden = true,
): boolean {
  if (skipHidden && name.startsWith('.')) return true;
  return skipDirs.includes(name);
}

/**
 * Simple walk options (subset of ScanOptions for common use cases)
 */
export interface WalkOptions {
  /**
   * File extensions to include (with or without leading dot)
   * @example ['.ts', '.tsx'] or ['ts', 'tsx']
   */
  extensions?: string[];

  /**
   * Directories to exclude (defaults to DEFAULT_SKIP_DIRS)
   */
  exclude?: string[];

  /**
   * Maximum directory depth to scan (0 = current dir only)
   * @default Infinity
   */
  maxDepth?: number;
}

/**
 * Walk a directory tree and invoke callback for each matching file
 *
 * This is a simplified version of scanDirectory for common use cases.
 * For more complex filtering, use scanDirectory directly.
 *
 * @param dir - Root directory to walk
 * @param callback - Function invoked for each matching file (receives full path)
 * @param options - Walk configuration
 *
 * @example
 * // Walk all TypeScript files
 * walk('src', (file) => console.log(file), {
 *   extensions: ['.ts', '.tsx'],
 * });
 *
 * @example
 * // Walk with custom exclusions
 * walk('src', (file) => files.push(file), {
 *   extensions: ['.ts'],
 *   exclude: ['node_modules', 'dist', '__tests__'],
 * });
 */
export function walk(
  dir: string,
  callback: (file: string) => void,
  options: WalkOptions = {},
): void {
  const { extensions = [], exclude = [...DEFAULT_SKIP_DIRS], maxDepth = Infinity } = options;

  scanDirectory(dir, (fullPath) => callback(fullPath), {
    extensions,
    skipDirs: exclude,
    maxDepth,
    includeTests: true, // walk includes all files matching extensions
  });
}

/**
 * Walk a directory and return array of matching file paths
 *
 * @param dir - Root directory to walk
 * @param options - Walk configuration
 * @returns Array of absolute file paths
 *
 * @example
 * const files = walkSync('src', { extensions: ['.ts', '.tsx'] });
 */
export function walkSync(dir: string, options: WalkOptions = {}): string[] {
  const results: string[] = [];
  walk(dir, (fullPath) => results.push(fullPath), options);
  return results;
}

// ============================================================================
// DIRECTORY WALKER
// ============================================================================

/**
 * Options for directory walking
 */
export interface WalkDirsOptions {
  /**
   * Maximum directory depth to walk (0 = current dir only)
   * @default Infinity
   */
  maxDepth?: number;

  /**
   * Directories to skip (defaults to DEFAULT_SKIP_DIRS)
   */
  skipDirs?: string[];

  /**
   * Skip hidden directories (starting with .)
   * @default true
   */
  skipHidden?: boolean;
}

/**
 * Callback invoked for each directory
 */
export type DirCallback = (fullPath: string, name: string, depth: number) => void;

/**
 * Walk directories recursively and invoke callback for each directory
 *
 * Unlike scanDirectory which focuses on files, this walks directories only.
 * Useful for architecture scanning, module detection, etc.
 *
 * @param dir - Root directory to walk
 * @param callback - Function invoked for each directory (fullPath, dirName, depth)
 * @param options - Walk configuration
 *
 * @example
 * // Find all directories
 * walkDirectories('src', (fullPath, name, depth) => {
 *   console.log(`${' '.repeat(depth * 2)}${name}`);
 * });
 *
 * @example
 * // Find directories up to depth 2
 * const dirs: string[] = [];
 * walkDirectories('src', (fullPath) => dirs.push(fullPath), { maxDepth: 2 });
 */
export function walkDirectories(
  dir: string,
  callback: DirCallback,
  options: WalkDirsOptions = {},
): void {
  const { maxDepth = Infinity, skipDirs = [...DEFAULT_SKIP_DIRS], skipHidden = true } = options;

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return; // Directory not readable
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip hidden directories
      if (skipHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip excluded directories
      if (skipDirs.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      // Invoke callback for this directory
      callback(fullPath, entry.name, depth);

      // Recurse into subdirectory
      walk(fullPath, depth + 1);
    }
  }

  walk(dir, 0);
}
