/**
 * @module lib/@detectors/patterns/skip-logic
 * @description Unified skip patterns for directory traversal and file analysis
 *
 * Combines:
 * - Dynamic skip patterns generator (from .gitignore + package.json)
 * - Centralized file skip patterns for all analyzers
 *
 * For directory traversal: generateSkipPatterns(), shouldSkipDir()
 * For file analysis: shouldSkipForAnalysis(), shouldSkipForHardcoded(), etc.
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
// DIRECTORY SKIP CONSTANTS
// ============================================================================

/**
 * Minimal base directories that should always be skipped
 * These are fundamental and don't depend on project configuration
 */
export const BASE_SKIP_DIRS = ['node_modules', '.git'] as const;

/**
 * Common build/cache directories that most projects have
 * These are fallbacks when detection fails or for common patterns
 */
export const COMMON_SKIP_DIRS = ['dist', 'build', 'coverage', '.pnpm'] as const;

/**
 * Tool-to-directory mapping for devDependency detection
 * Maps package names (or patterns) to their generated directories
 */
export const TOOL_DIR_MAP: Record<string, string[]> = {
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

// ============================================================================
// FILE SKIP CONSTANTS
// ============================================================================

/**
 * Test framework to file pattern mapping
 * Used to detect test files based on installed test frameworks
 */
const TEST_FILE_PATTERNS: Record<string, readonly string[]> = {
  vitest: ['.test.', '.spec.', '__tests__', '__mocks__'],
  jest: ['.test.', '.spec.', '__tests__', '__mocks__'],
  mocha: ['.test.', '.spec.'],
  ava: ['.test.'],
  tap: ['.test.'],
  playwright: ['.spec.', 'e2e/'],
  cypress: ['.cy.'],
  storybook: ['.stories.'],
} as const;

/**
 * Semantic patterns that are specific to analyzer behavior
 * These define what the analyzer itself should skip
 */
const SEMANTIC_SKIP_PATTERNS = [
  // Internal infrastructure (pattern definitions - would cause recursion)
  '/@detectors/',
  '/@swc/',
  '/lib/@',
  // Configuration files (contain intentional "hardcoded" values)
  '.config.',
  '/constants/',
] as const;

/**
 * Additional patterns to skip for hardcoded value detection only
 */
export const HARDCODED_SKIP_PATTERNS = ['tailwind', '.css', '.scss', '.stories.'] as const;

/**
 * Additional patterns to skip for lint rules only
 * These files use console.log intentionally for output/debugging
 */
export const LINT_SKIP_PATTERNS = [
  '/cli/', // CLI files can use console
  'bin/', // Binary entry points can use console
  'logger', // Logger files can use console
  '/seed', // Seed files use console for progress output
  '/seeds/', // Seed directory
  'prisma/seed', // Prisma seed files
  '/webhook', // Webhook handlers need console for debugging
  '/webhooks/', // Webhook directory
  'validate-', // Validation scripts (CLI output)
  'migrate-', // Migration scripts (CLI output)
] as const;

/**
 * Additional patterns to skip for environment config detection
 * These files are allowed to have environment-specific values
 */
export const ENV_CONFIG_SKIP_PATTERNS = [
  '.env',
  '.env.',
  'env.ts',
  'env.js',
  'environment.ts',
  'environment.js',
  '.config.',
  'config.ts',
  'config.js',
  'config/',
  'constants/',
  '.stories.',
  '.storybook',
  'jest.',
  'vitest.',
  'playwright.',
  'cypress.',
  'e2e/',
  'fixtures/',
  'mock',
  'seed',
  'migration',
] as const;

/**
 * Legacy export for backward compatibility
 * @deprecated Use getAnalyzerSkipPatterns() instead
 */
export const ANALYZER_SKIP_PATTERNS = SEMANTIC_SKIP_PATTERNS;

// ============================================================================
// CACHE
// ============================================================================

/**
 * Cache TTL in milliseconds (5 minutes)
 * Patterns are re-validated if this time has passed
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Per-project cache for skip patterns
 * Key: absolute project root path
 */
const skipPatternsCache = new Map<string, CachedSkipPatterns>();

/** Cached analyzer patterns */
let cachedProjectRoot: string | null = null;
let cachedPatterns: string[] | null = null;

// ============================================================================
// GITIGNORE PARSING
// ============================================================================

/**
 * Extract directory patterns from .gitignore content
 *
 * Only extracts simple directory names (no complex globs).
 * Patterns like "*.log" or "!important/" are ignored.
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
// PACKAGE.JSON DETECTION
// ============================================================================

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detect skip directories from package.json dependencies
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

/**
 * Detect test file patterns from package.json dependencies
 */
function detectTestFilePatterns(projectRoot: string): string[] {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const patterns: string[] = [];

    for (const [framework, frameworkPatterns] of Object.entries(TEST_FILE_PATTERNS)) {
      const hasFramework = Object.keys(allDeps).some(
        (dep) => dep === framework || dep.includes(framework),
      );
      if (hasFramework) {
        patterns.push(...frameworkPatterns);
      }
    }

    return [...new Set(patterns)];
  } catch {
    return [];
  }
}

// ============================================================================
// FILE MODIFICATION TIME HELPERS
// ============================================================================

/**
 * Get file modification time in milliseconds
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
// DIRECTORY SKIP API
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
 */
export function invalidateSkipPatterns(projectRoot: string): void {
  const absoluteRoot = path.resolve(projectRoot);
  skipPatternsCache.delete(absoluteRoot);
}

// ============================================================================
// FILE SKIP API
// ============================================================================

/**
 * Get analyzer skip patterns dynamically
 *
 * Combines:
 * - Directory patterns from dynamic-skip.ts (converted to path patterns)
 * - Test file patterns (detected from package.json)
 * - Semantic patterns (analyzer-specific)
 */
export function getAnalyzerSkipPatterns(projectRoot?: string): readonly string[] {
  const root = projectRoot ?? process.cwd();

  // Return cached if same project
  if (cachedProjectRoot === root && cachedPatterns) {
    return cachedPatterns;
  }

  // Get directory patterns from dynamic-skip and convert to path patterns
  const dirPatterns = generateSkipPatterns(root);
  const dirPathPatterns = [...dirPatterns].map((dir) => `/${dir}/`);

  // Get test file patterns
  const testPatterns = detectTestFilePatterns(root);

  // Combine all patterns, deduplicate
  const allPatterns = [
    ...new Set([...dirPathPatterns, ...testPatterns, ...SEMANTIC_SKIP_PATTERNS]),
  ];

  // Cache for performance
  cachedProjectRoot = root;
  cachedPatterns = allPatterns;

  return allPatterns;
}

/**
 * Clear pattern cache (useful for testing or when project changes)
 */
export function clearSkipPatternCache(): void {
  cachedProjectRoot = null;
  cachedPatterns = null;
}

/**
 * Check if file should be skipped by all analyzers
 * Uses dynamic patterns from .gitignore, package.json, and semantic patterns
 */
export function shouldSkipForAnalysis(filepath: string, projectRoot?: string): boolean {
  const patterns = getAnalyzerSkipPatterns(projectRoot);
  return patterns.some((pattern) => filepath.includes(pattern));
}

/**
 * Check if file should be skipped for hardcoded detection
 */
export function shouldSkipForHardcoded(filepath: string, projectRoot?: string): boolean {
  return (
    shouldSkipForAnalysis(filepath, projectRoot) ||
    HARDCODED_SKIP_PATTERNS.some((pattern) => filepath.includes(pattern))
  );
}

/**
 * Check if file should be skipped for lint rules
 */
export function shouldSkipForLint(filepath: string, projectRoot?: string): boolean {
  return (
    shouldSkipForAnalysis(filepath, projectRoot) ||
    LINT_SKIP_PATTERNS.some((pattern) => filepath.includes(pattern))
  );
}

/**
 * Check if file should be skipped for environment config detection
 */
export function shouldSkipForEnvConfig(filepath: string, projectRoot?: string): boolean {
  const normalized = filepath.toLowerCase().replace(/\\/g, '/');
  return (
    shouldSkipForAnalysis(filepath, projectRoot) ||
    ENV_CONFIG_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))
  );
}
