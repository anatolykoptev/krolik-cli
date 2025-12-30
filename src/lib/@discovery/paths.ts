/**
 * @module lib/@discovery/paths
 * @description Dynamic path resolution for any project structure
 *
 * Reads tsconfig.json to understand path aliases and provides utilities
 * for resolving import paths dynamically without hardcoded assumptions.
 *
 * @example
 * ```ts
 * import { createPathResolver } from '@/lib/@discovery/paths';
 *
 * const resolver = createPathResolver('/path/to/project');
 * const resolved = resolver.resolveAlias('@/lib/utils');
 * // => 'src/lib/utils'
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// TYPES
// ============================================================================

export interface TsConfigPaths {
  /** Base URL for non-relative imports */
  baseUrl?: string;
  /** Path mappings (e.g., "@/*": ["src/*"]) */
  paths?: Record<string, string[]>;
}

export interface PathResolver {
  /** Project root directory */
  projectRoot: string;
  /** Base URL from tsconfig (default: ".") */
  baseUrl: string;
  /** Path aliases from tsconfig.paths */
  aliases: Map<string, string>;
  /** Source directory (detected or from baseUrl) */
  sourceDir: string;

  /** Resolve an aliased path to relative path */
  resolveAlias(aliasedPath: string): string | null;
  /** Convert relative path to aliased path */
  toAlias(relativePath: string): string | null;
  /** Find source directory in project */
  findSourceDir(): string;
  /** Check if path is an alias */
  isAlias(importPath: string): boolean;
}

// ============================================================================
// TSCONFIG PARSING
// ============================================================================

/**
 * Parse tsconfig.json and extract paths configuration
 *
 * Handles:
 * - compilerOptions.baseUrl
 * - compilerOptions.paths
 * - extends (follows the chain)
 */
export function parseTsConfig(projectRoot: string): TsConfigPaths {
  const tsconfigPath = findTsConfig(projectRoot);
  if (!tsconfigPath) {
    return { baseUrl: '.', paths: {} };
  }

  try {
    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    // Remove comments (simple approach for JSON with comments)
    const jsonContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const config = JSON.parse(jsonContent) as {
      extends?: string;
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
      };
    };

    // Handle extends
    let basePaths: TsConfigPaths = { baseUrl: '.', paths: {} };
    if (config.extends) {
      const extendsPath = resolveExtends(tsconfigPath, config.extends);
      if (extendsPath) {
        basePaths = parseTsConfig(path.dirname(extendsPath));
      }
    }

    // Merge with current config
    return {
      baseUrl: config.compilerOptions?.baseUrl ?? basePaths.baseUrl ?? '.',
      paths: {
        ...basePaths.paths,
        ...config.compilerOptions?.paths,
      },
    };
  } catch {
    return { baseUrl: '.', paths: {} };
  }
}

/**
 * Find tsconfig.json in project
 */
function findTsConfig(projectRoot: string): string | null {
  const candidates = ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json'];

  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Resolve extends path in tsconfig
 */
function resolveExtends(tsconfigPath: string, extendsPath: string): string | null {
  const dir = path.dirname(tsconfigPath);

  // Handle node_modules paths
  if (!extendsPath.startsWith('.')) {
    // Try to resolve from node_modules
    try {
      const resolved = require.resolve(extendsPath, { paths: [dir] });
      return resolved;
    } catch {
      return null;
    }
  }

  // Relative path
  const resolved = path.resolve(dir, extendsPath);
  if (fs.existsSync(resolved)) {
    return resolved;
  }

  // Try adding .json extension
  const withJson = `${resolved}.json`;
  if (fs.existsSync(withJson)) {
    return withJson;
  }

  return null;
}

// ============================================================================
// PATH RESOLVER
// ============================================================================

/**
 * Create a path resolver for a project
 *
 * Automatically detects:
 * - tsconfig.json path aliases
 * - Source directory structure
 * - Common patterns (src/, lib/, etc.)
 */
export function createPathResolver(projectRoot: string): PathResolver {
  const config = parseTsConfig(projectRoot);
  const aliases = new Map<string, string>();

  // Parse path aliases
  if (config.paths) {
    for (const [alias, targets] of Object.entries(config.paths)) {
      // Remove trailing /* from alias pattern
      const cleanAlias = alias.replace(/\/\*$/, '');
      // Get first target and remove trailing /*
      const target = targets[0]?.replace(/\/\*$/, '') ?? '';
      if (cleanAlias && target) {
        aliases.set(cleanAlias, target);
      }
    }
  }

  // Determine source directory
  const baseUrl = config.baseUrl ?? '.';
  const sourceDir = findSourceDir(projectRoot, baseUrl);

  function resolveAlias(aliasedPath: string): string | null {
    // Try exact match first
    if (aliases.has(aliasedPath)) {
      return aliases.get(aliasedPath) ?? null;
    }

    // Try prefix match
    for (const [alias, target] of aliases) {
      if (aliasedPath.startsWith(`${alias}/`)) {
        const suffix = aliasedPath.slice(alias.length + 1);
        return path.join(target, suffix);
      }
    }

    return null;
  }

  function toAlias(relativePath: string): string | null {
    // Normalize path
    const normalized = relativePath.replace(/\\/g, '/');

    // Try to find matching alias
    for (const [alias, target] of aliases) {
      const normalizedTarget = target.replace(/\\/g, '/');
      if (normalized.startsWith(normalizedTarget)) {
        const suffix = normalized.slice(normalizedTarget.length);
        return `${alias}${suffix}`;
      }
    }

    return null;
  }

  function isAlias(importPath: string): boolean {
    // Check if starts with any known alias
    for (const alias of aliases.keys()) {
      if (importPath === alias || importPath.startsWith(`${alias}/`)) {
        return true;
      }
    }
    return false;
  }

  return {
    projectRoot,
    baseUrl,
    aliases,
    sourceDir,
    resolveAlias,
    toAlias,
    isAlias,
    findSourceDir: () => sourceDir,
  };
}

/**
 * Find source directory in project
 *
 * Checks common patterns:
 * - baseUrl from tsconfig
 * - src/
 * - lib/
 * - packages/{name}/src/
 */
function findSourceDir(projectRoot: string, baseUrl: string): string {
  // If baseUrl is explicitly set, use it
  if (baseUrl !== '.') {
    const baseUrlPath = path.join(projectRoot, baseUrl);
    if (fs.existsSync(baseUrlPath)) {
      return baseUrl;
    }
  }

  // Common source directories
  const candidates = ['src', 'lib', 'source', 'app'];

  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      return candidate;
    }
  }

  // Default to project root
  return '.';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert aliased import to relative import
 *
 * @param fromFile - File that contains the import
 * @param aliasedImport - Import with alias (e.g., "@/lib/utils")
 * @param resolver - Path resolver instance
 * @returns Relative import path or null if not resolvable
 */
export function aliasToRelative(
  fromFile: string,
  aliasedImport: string,
  resolver: PathResolver,
): string | null {
  const resolved = resolver.resolveAlias(aliasedImport);
  if (!resolved) return null;

  const fromDir = path.dirname(fromFile);
  const toPath = path.join(resolver.projectRoot, resolved);
  let relative = path.relative(fromDir, toPath);

  // Ensure it starts with ./
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }

  // Normalize slashes
  return relative.replace(/\\/g, '/');
}

/**
 * Convert relative import to aliased import
 *
 * @param fromFile - File that contains the import
 * @param relativeImport - Relative import path
 * @param resolver - Path resolver instance
 * @returns Aliased import path or null if no alias matches
 */
export function relativeToAlias(
  fromFile: string,
  relativeImport: string,
  resolver: PathResolver,
): string | null {
  // Resolve relative path to absolute
  const fromDir = path.dirname(fromFile);
  const absolutePath = path.resolve(fromDir, relativeImport);
  const relativePath = path.relative(resolver.projectRoot, absolutePath);

  return resolver.toAlias(relativePath);
}

/**
 * Normalize import path (remove .ts extension, handle index)
 */
export function normalizeImportPath(importPath: string): string {
  // Remove .ts/.tsx/.js/.jsx extension
  let normalized = importPath.replace(/\.(tsx?|jsx?|mjs)$/, '');

  // Remove /index suffix
  normalized = normalized.replace(/\/index$/, '');

  return normalized;
}

/**
 * Get all path aliases as array of patterns
 */
export function getAliasPatterns(resolver: PathResolver): string[] {
  return Array.from(resolver.aliases.keys());
}
