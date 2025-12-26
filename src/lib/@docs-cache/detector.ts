/**
 * @module lib/@docs-cache/detector
 * @description Auto-detect libraries from package.json with monorepo support
 *
 * Scans project dependencies to identify libraries that have Context7 documentation.
 * Supports both single-package projects and monorepos (pnpm, npm, yarn workspaces).
 *
 * Now uses dynamic registry for library resolution, allowing detection of any
 * library with Context7 documentation, not just predefined ones.
 *
 * @example
 * ```ts
 * import { detectLibraries, getSuggestions } from '@/lib/@docs-cache';
 *
 * const detected = await detectLibraries('/path/to/project');
 * const { toFetch, toRefresh } = getSuggestions(detected);
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { detectMonorepo, readPackageJson } from '../@discovery';
import { initializeRegistry, resolveLibraryIdSync } from './registry';
import { getLibraryByName } from './storage';
import type { DetectedLibrary } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common libraries known to have Context7 documentation.
 * Used for quick sync detection. Other libraries are resolved via API.
 */
const COMMON_LIBRARIES: ReadonlyArray<{
  readonly patterns: readonly string[];
  readonly name: string;
}> = [
  { patterns: ['next', '@next/'], name: 'next.js' },
  { patterns: ['@prisma/client', 'prisma'], name: 'prisma' },
  { patterns: ['@trpc/server', '@trpc/client', '@trpc/react-query'], name: 'trpc' },
  { patterns: ['react', 'react-dom'], name: 'react' },
  { patterns: ['zod'], name: 'zod' },
  { patterns: ['tailwindcss'], name: 'tailwindcss' },
  { patterns: ['drizzle-orm'], name: 'drizzle-orm' },
  { patterns: ['typescript'], name: 'typescript' },
  { patterns: ['expo'], name: 'expo' },
  { patterns: ['react-native'], name: 'react-native' },
  { patterns: ['zustand'], name: 'zustand' },
  { patterns: ['@tanstack/react-query', '@tanstack/query-core'], name: 'tanstack-query' },
  { patterns: ['express'], name: 'express' },
  { patterns: ['fastify'], name: 'fastify' },
  { patterns: ['hono'], name: 'hono' },
  { patterns: ['@supabase/supabase-js'], name: 'supabase' },
  { patterns: ['mongoose'], name: 'mongoose' },
  { patterns: ['@clerk/nextjs', '@clerk/clerk-react'], name: 'clerk' },
  { patterns: ['@auth/core', 'next-auth'], name: 'auth.js' },
  { patterns: ['lucide-react', 'lucide'], name: 'lucide' },
  { patterns: ['@radix-ui/'], name: 'radix-ui' },
  { patterns: ['@shadcn/ui'], name: 'shadcn-ui' },
  { patterns: ['vitest'], name: 'vitest' },
  { patterns: ['playwright'], name: 'playwright' },
] as const;

// ============================================================================
// TYPES
// ============================================================================

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DependencyInfo {
  name: string;
  version: string;
  source: string; // package.json path for debugging
}

// ============================================================================
// PACKAGE.JSON PARSING
// ============================================================================

/**
 * Extract dependencies from a package.json.
 *
 * Merges dependencies and devDependencies into a single map.
 *
 * @param pkg - Parsed package.json
 * @param source - Source path for debugging
 * @returns Array of dependency info objects
 */
function extractDependencies(pkg: PackageJson, source: string): DependencyInfo[] {
  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  return Object.entries(allDeps).map(([name, version]) => ({
    name,
    version: version.replace(/^[\^~>=<]/, ''),
    source,
  }));
}

// ============================================================================
// MONOREPO DETECTION
// ============================================================================

/**
 * Collect all package.json paths in a project.
 *
 * For monorepos, includes root and all workspace packages.
 * For single projects, returns only the root package.json.
 *
 * @param projectRoot - Project root directory
 * @returns Array of package.json paths
 */
function collectPackageJsonPaths(projectRoot: string): string[] {
  const paths: string[] = [];

  // Always include root
  const rootPkg = path.join(projectRoot, 'package.json');
  if (fs.existsSync(rootPkg)) {
    paths.push(rootPkg);
  }

  // Check for monorepo
  const monorepo = detectMonorepo(projectRoot);
  if (monorepo) {
    for (const pkgDir of monorepo.packages) {
      const pkgPath = path.join(pkgDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        paths.push(pkgPath);
      }
    }
  }

  return paths;
}

/**
 * Collect all dependencies from a project.
 *
 * Scans all package.json files in the project (including monorepo packages)
 * and returns a deduplicated list of dependencies.
 *
 * @param projectRoot - Project root directory
 * @returns Map of dependency name to version (highest version wins)
 */
function collectAllDependencies(projectRoot: string): Map<string, DependencyInfo> {
  const deps = new Map<string, DependencyInfo>();
  const pkgPaths = collectPackageJsonPaths(projectRoot);

  for (const pkgPath of pkgPaths) {
    const pkg = readPackageJson<PackageJson>(pkgPath);
    if (!pkg) continue;

    const pkgDeps = extractDependencies(pkg, pkgPath);
    for (const dep of pkgDeps) {
      // Keep the first occurrence (or could implement version comparison)
      if (!deps.has(dep.name)) {
        deps.set(dep.name, dep);
      }
    }
  }

  return deps;
}

// ============================================================================
// LIBRARY DETECTION
// ============================================================================

/**
 * Check if a dependency matches a supported library pattern.
 *
 * @param depName - NPM package name
 * @param patterns - Library patterns to match against
 * @returns True if dependency matches any pattern
 */
function matchesLibrary(depName: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => depName === pattern || depName.startsWith(pattern));
}

/**
 * Check cache status for a library (synchronous).
 *
 * Uses the registry for library ID resolution.
 *
 * @param libraryName - Canonical library name
 * @returns Object with cache status info
 */
function checkCacheStatus(libraryName: string): {
  isCached: boolean;
  isExpired: boolean;
  context7Id: string | undefined;
} {
  // Use sync resolution from registry
  const context7Id = resolveLibraryIdSync(libraryName) ?? undefined;

  if (!context7Id) {
    return { isCached: false, isExpired: false, context7Id: undefined };
  }

  const cached = getLibraryByName(libraryName);
  if (!cached) {
    return { isCached: false, isExpired: false, context7Id };
  }

  const isExpired = new Date(cached.expiresAt).getTime() < Date.now();
  return { isCached: true, isExpired, context7Id };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Detect libraries with Context7 documentation in a project.
 *
 * Scans all package.json files (including monorepo workspaces) and identifies
 * libraries that have Context7 documentation available.
 *
 * Uses the dynamic registry for resolution, allowing detection of any
 * library with Context7 documentation, not just predefined ones.
 *
 * @param projectRoot - Project root directory
 * @returns Array of detected libraries with cache status
 *
 * @example
 * ```ts
 * const detected = detectLibraries('/path/to/monorepo');
 * // Returns: [
 * //   { name: 'next.js', version: '14.0.0', isCached: true, isExpired: false, context7Id: '/vercel/next.js' },
 * //   { name: 'prisma', version: '5.0.0', isCached: false, isExpired: false, context7Id: '/prisma/docs' },
 * // ]
 * ```
 */
export function detectLibraries(projectRoot: string): DetectedLibrary[] {
  // Initialize registry with default mappings
  initializeRegistry();

  const allDeps = collectAllDependencies(projectRoot);
  const depNames = Array.from(allDeps.keys());

  const detected: DetectedLibrary[] = [];
  const seen = new Set<string>();

  // First, detect common libraries (fast path)
  for (const lib of COMMON_LIBRARIES) {
    // Find matching dependency
    const matchedDepName = depNames.find((dep) => matchesLibrary(dep, lib.patterns));

    if (matchedDepName && !seen.has(lib.name)) {
      seen.add(lib.name);

      const depInfo = allDeps.get(matchedDepName);
      const cacheStatus = checkCacheStatus(lib.name);

      detected.push({
        name: lib.name,
        version: depInfo?.version ?? 'unknown',
        isCached: cacheStatus.isCached,
        isExpired: cacheStatus.isExpired,
        context7Id: cacheStatus.context7Id,
      });
    }
  }

  return detected;
}

/**
 * Get suggestions for which libraries to fetch or refresh.
 *
 * Analyzes detected libraries and returns:
 * - `toFetch`: Libraries not in cache that should be fetched
 * - `toRefresh`: Libraries in cache that have expired
 *
 * @param detected - Array of detected libraries from detectLibraries()
 * @returns Object with fetch and refresh suggestions
 *
 * @example
 * ```ts
 * const detected = detectLibraries('/path/to/project');
 * const { toFetch, toRefresh } = getSuggestions(detected);
 *
 * if (toFetch.length > 0) {
 *   console.log(`Fetch docs for: ${toFetch.join(', ')}`);
 * }
 * ```
 */
export function getSuggestions(detected: DetectedLibrary[]): {
  toFetch: string[];
  toRefresh: string[];
} {
  const toFetch = detected.filter((d) => !d.isCached && d.context7Id).map((d) => d.name);

  const toRefresh = detected.filter((d) => d.isCached && d.isExpired).map((d) => d.name);

  return { toFetch, toRefresh };
}

/**
 * Get list of supported library names.
 *
 * Useful for documentation or validation.
 *
 * @returns Array of canonical library names
 */
export function getSupportedLibraries(): string[] {
  return COMMON_LIBRARIES.map((lib) => lib.name);
}
