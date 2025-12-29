/**
 * @module lib/@detectors/skip-patterns
 * @description Centralized file skip patterns for all analyzers
 *
 * This file defines which files should be excluded from analysis.
 * For directory traversal skip patterns, see ./dynamic-skip.ts
 *
 * Uses:
 * - Dynamic directory patterns from ./dynamic-skip.ts (generated from .gitignore + package.json)
 * - Test file patterns (detected from package.json test frameworks)
 * - Semantic patterns for analyzer-specific needs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateSkipPatterns } from './dynamic-skip';

// ============================================================================
// TEST FILE PATTERNS (detected from package.json)
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

// ============================================================================
// SEMANTIC PATTERNS (analyzer-specific, cannot be auto-detected)
// ============================================================================

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

// ============================================================================
// CACHED DYNAMIC PATTERNS
// ============================================================================

let cachedProjectRoot: string | null = null;
let cachedPatterns: string[] | null = null;

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
 * Legacy export for backward compatibility
 * @deprecated Use getAnalyzerSkipPatterns() instead
 */
export const ANALYZER_SKIP_PATTERNS = SEMANTIC_SKIP_PATTERNS;

/**
 * Additional patterns to skip for hardcoded value detection only
 */
export const HARDCODED_SKIP_PATTERNS = ['tailwind', '.css', '.scss', '.stories.'] as const;

/**
 * Additional patterns to skip for lint rules only
 */
export const LINT_SKIP_PATTERNS = [
  '/cli/', // CLI files can use console
  'bin/', // Binary entry points can use console
  'logger', // Logger files can use console
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
 * Check if file should be skipped by all analyzers
 * Uses dynamic patterns from .gitignore, package.json, and semantic patterns
 *
 * @param filepath - File path to check
 * @param projectRoot - Optional project root for dynamic pattern detection
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
