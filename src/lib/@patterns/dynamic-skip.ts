/**
 * @module lib/@patterns/dynamic-skip
 * @description Dynamic skip patterns generator for directory traversal
 *
 * Generates skip patterns by:
 * 1. Reading .gitignore and extracting directory patterns
 * 2. Detecting tool-specific directories from package.json devDependencies
 * 3. Combining with a minimal base set (node_modules, .git)
 *
 * Results are cached per project root to avoid re-parsing on every call.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Types
// ============================================================================

interface CachedSkipPatterns {
  patterns: Set<string>;
  timestamp: number;
  packageJsonMtime: number | null;
  gitignoreMtime: number | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimal base directories that should always be skipped
 * These are fundamental and don't depend on project configuration
 */
const BASE_SKIP_DIRS = ['node_modules', '.git'] as const;

/**
 * Common build/cache directories that most projects have
 * These are fallbacks when detection fails or for common patterns
 */
const COMMON_SKIP_DIRS = ['dist', 'build', 'coverage', '.pnpm'] as const;

/**
 * Tool-to-directory mapping for devDependency detection
 * Maps package names (or patterns) to their generated directories
 */
const TOOL_DIR_MAP: Record<string, string[]> = {
  // Build tools
  next: ['.next'],
  nuxt: ['.nuxt', '.output'],
  vite: ['.vite'],
  turbo: ['.turbo'],
  nx: ['.nx'],
  webpack: ['.cache'],
  parcel: ['.parcel-cache'],
  rollup: ['.rollup.cache'],
  esbuild: ['.esbuild'],
  tsup: ['.tsup'],

  // Testing tools
  jest: ['coverage'],
  vitest: ['coverage'],
  nyc: ['.nyc_output', 'coverage'],
  c8: ['coverage'],
  playwright: ['playwright-report', 'test-results'],
  cypress: ['cypress/screenshots', 'cypress/videos'],

  // Linting/Formatting
  eslint: ['.eslintcache'],
  biome: ['.biome'],
  prettier: ['.prettiercache'],

  // Package managers
  pnpm: ['.pnpm'],

  // Storybook
  storybook: ['storybook-static'],
  '@storybook/react': ['storybook-static'],

  // Documentation
  typedoc: ['docs/api'],
  docusaurus: ['.docusaurus', 'build'],

  // Bundler output
  '@vercel/ncc': ['ncc'],
};

/**
 * Cache TTL in milliseconds (5 minutes)
 * Patterns are re-validated if this time has passed
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// Cache
// ============================================================================

/**
 * Per-project cache for skip patterns
 * Key: absolute project root path
 */
const skipPatternsCache = new Map<string, CachedSkipPatterns>();

// ============================================================================
// Gitignore Parsing
// ============================================================================

/**
 * Extract directory patterns from .gitignore content
 *
 * Only extracts simple directory names (no complex globs).
 * Patterns like "*.log" or "!important/" are ignored.
 *
 * @param content - .gitignore file content
 * @returns Set of directory names to skip
 */
function parseGitignoreDirectories(content: string): Set<string> {
  const dirs = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Skip negation patterns
    if (trimmed.startsWith('!')) {
      continue;
    }

    // Skip patterns with wildcards or complex globs
    if (trimmed.includes('*') || trimmed.includes('?') || trimmed.includes('[')) {
      continue;
    }

    // Extract directory name
    let dirName = trimmed;

    // Handle patterns ending with /
    if (dirName.endsWith('/')) {
      dirName = dirName.slice(0, -1);
    }

    // Handle patterns starting with /
    if (dirName.startsWith('/')) {
      dirName = dirName.slice(1);
    }

    // Skip if still contains path separators (nested paths)
    // We only want top-level directory names for the Set
    if (dirName.includes('/')) {
      // For nested paths like "cypress/screenshots", extract the top-level dir
      const topLevel = dirName.split('/')[0];
      if (topLevel) {
        dirs.add(topLevel);
      }
      continue;
    }

    // Skip empty after processing
    if (!dirName) {
      continue;
    }

    // Skip patterns that look like file extensions
    if (dirName.startsWith('.') && !dirName.includes('/') && dirName.length <= 10) {
      // Likely a file extension pattern like ".env" - skip
      // But keep directory-like patterns like ".next", ".turbo"
      if (!COMMON_SKIP_DIRS.includes(dirName as (typeof COMMON_SKIP_DIRS)[number])) {
        // Check if it's a known tool directory
        const isToolDir = Object.values(TOOL_DIR_MAP).some((dirs) => dirs.includes(dirName));
        if (!isToolDir) {
          continue;
        }
      }
    }

    dirs.add(dirName);
  }

  return dirs;
}

/**
 * Read and parse .gitignore file
 *
 * @param projectRoot - Project root directory
 * @returns Set of directory names to skip, or null if .gitignore doesn't exist
 */
function readGitignorePatterns(projectRoot: string): Set<string> | null {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return parseGitignoreDirectories(content);
  } catch {
    return null;
  }
}

// ============================================================================
// Package.json Detection
// ============================================================================

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detect skip directories from package.json dependencies
 *
 * Examines both dependencies and devDependencies to detect
 * which tools are used and their associated directories.
 *
 * @param projectRoot - Project root directory
 * @returns Set of directory names to skip based on detected tools
 */
function detectToolDirectories(projectRoot: string): Set<string> {
  const dirs = new Set<string>();
  const packageJsonPath = path.join(projectRoot, 'package.json');

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    // Combine all dependencies
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    // Check each tool in our map
    for (const [tool, toolDirs] of Object.entries(TOOL_DIR_MAP)) {
      // Check if tool is a dependency (exact match or pattern)
      const hasExactMatch = tool in allDeps;
      const hasPatternMatch = Object.keys(allDeps).some(
        (dep) => dep === tool || dep.startsWith(`${tool}/`) || dep.startsWith(`@${tool}/`),
      );

      if (hasExactMatch || hasPatternMatch) {
        for (const dir of toolDirs) {
          // Handle nested paths by extracting top-level
          const topLevel = dir.split('/')[0];
          if (topLevel) {
            dirs.add(topLevel);
          }
        }
      }
    }
  } catch {
    // package.json doesn't exist or is invalid - return empty set
  }

  return dirs;
}

// ============================================================================
// File Modification Time Helpers
// ============================================================================

/**
 * Get file modification time in milliseconds
 *
 * @param filepath - Path to file
 * @returns mtime in ms, or null if file doesn't exist
 */
function getFileMtime(filepath: string): number | null {
  try {
    const stat = fs.statSync(filepath);
    return stat.mtime.getTime();
  } catch {
    return null;
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate skip patterns for a project
 *
 * Combines:
 * 1. Base skip directories (node_modules, .git)
 * 2. Directories from .gitignore
 * 3. Tool-specific directories detected from package.json
 * 4. Common fallback directories
 *
 * Results are cached per project root and automatically invalidated when:
 * - Cache TTL expires (5 minutes)
 * - package.json or .gitignore modification time changes
 *
 * @param projectRoot - Absolute path to project root
 * @returns Set of directory names to skip during traversal
 */
export function generateSkipPatterns(projectRoot: string): Set<string> {
  const absoluteRoot = path.resolve(projectRoot);

  // Check cache
  const cached = skipPatternsCache.get(absoluteRoot);
  if (cached) {
    const now = Date.now();

    // Check if cache is still fresh
    if (now - cached.timestamp < CACHE_TTL_MS) {
      // Validate file mtimes haven't changed
      const packageJsonMtime = getFileMtime(path.join(absoluteRoot, 'package.json'));
      const gitignoreMtime = getFileMtime(path.join(absoluteRoot, '.gitignore'));

      if (
        packageJsonMtime === cached.packageJsonMtime &&
        gitignoreMtime === cached.gitignoreMtime
      ) {
        return cached.patterns;
      }
    }
  }

  // Generate fresh patterns
  const patterns = new Set<string>(BASE_SKIP_DIRS);

  // Add common directories as fallback
  for (const dir of COMMON_SKIP_DIRS) {
    patterns.add(dir);
  }

  // Add .gitignore patterns
  const gitignorePatterns = readGitignorePatterns(absoluteRoot);
  if (gitignorePatterns) {
    for (const dir of gitignorePatterns) {
      patterns.add(dir);
    }
  }

  // Add tool-detected patterns
  const toolPatterns = detectToolDirectories(absoluteRoot);
  for (const dir of toolPatterns) {
    patterns.add(dir);
  }

  // Cache the result
  const packageJsonMtime = getFileMtime(path.join(absoluteRoot, 'package.json'));
  const gitignoreMtime = getFileMtime(path.join(absoluteRoot, '.gitignore'));

  skipPatternsCache.set(absoluteRoot, {
    patterns,
    timestamp: Date.now(),
    packageJsonMtime,
    gitignoreMtime,
  });

  return patterns;
}

/**
 * Get skip patterns with additional custom patterns
 *
 * Convenience function that merges generated patterns with custom ones.
 *
 * @param projectRoot - Absolute path to project root
 * @param additionalPatterns - Extra patterns to include
 * @returns Combined Set of directory names to skip
 */
export function getSkipPatterns(projectRoot: string, additionalPatterns?: string[]): Set<string> {
  const patterns = generateSkipPatterns(projectRoot);

  if (additionalPatterns) {
    for (const pattern of additionalPatterns) {
      patterns.add(pattern);
    }
  }

  return patterns;
}

/**
 * Check if a directory name should be skipped
 *
 * @param projectRoot - Absolute path to project root
 * @param dirName - Directory name to check
 * @returns true if directory should be skipped
 */
export function shouldSkipDir(projectRoot: string, dirName: string): boolean {
  const patterns = generateSkipPatterns(projectRoot);
  return patterns.has(dirName);
}

/**
 * Clear the skip patterns cache
 *
 * Useful for testing or when you know the project configuration has changed.
 */
export function clearSkipPatternsCache(): void {
  skipPatternsCache.clear();
}

/**
 * Clear cache for a specific project
 *
 * @param projectRoot - Absolute path to project root
 */
export function invalidateSkipPatterns(projectRoot: string): void {
  const absoluteRoot = path.resolve(projectRoot);
  skipPatternsCache.delete(absoluteRoot);
}

// ============================================================================
// Exports for constants (for backward compatibility)
// ============================================================================

export { BASE_SKIP_DIRS, COMMON_SKIP_DIRS, TOOL_DIR_MAP };
