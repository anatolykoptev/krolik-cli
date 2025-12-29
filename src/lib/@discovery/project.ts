/**
 * @module lib/@discovery/project
 * @description Project root and monorepo detection
 *
 * Provides utilities for:
 * - Finding project root (package.json, git root)
 * - Detecting monorepo structure
 * - Finding workspace packages
 *
 * Features:
 * - Cached package.json parsing (5-second TTL)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// PACKAGE.JSON CACHE
// ============================================================================

const CACHE_TTL_MS = 5000; // 5 seconds

interface PackageJsonCache {
  data: Record<string, unknown>;
  timestamp: number;
  mtime: number;
}

const packageJsonCache = new Map<string, PackageJsonCache>();

/**
 * Read and parse package.json with caching
 *
 * Uses file mtime + TTL for cache invalidation.
 * Returns undefined if file doesn't exist or parse fails.
 *
 * @param pkgPath - Absolute path to package.json
 * @returns Parsed package.json or undefined if not found/invalid
 */
export function readPackageJson<T = Record<string, unknown>>(pkgPath: string): T | undefined {
  try {
    const stats = fs.statSync(pkgPath);
    const mtime = stats.mtimeMs;
    const now = Date.now();

    const cached = packageJsonCache.get(pkgPath);
    if (cached && cached.mtime === mtime && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }

    const content = fs.readFileSync(pkgPath, 'utf-8');
    const data = JSON.parse(content) as Record<string, unknown>;

    packageJsonCache.set(pkgPath, { data, timestamp: now, mtime });
    return data as T;
  } catch {
    return undefined;
  }
}

/**
 * Clear package.json cache
 */
export function clearPackageJsonCache(): void {
  packageJsonCache.clear();
}

// ============================================================================
// TYPES
// ============================================================================

export interface MonorepoInfo {
  /** Monorepo type */
  type: 'pnpm' | 'npm' | 'yarn' | 'turbo' | 'nx' | 'lerna' | 'unknown';
  /** Root package.json path */
  root: string;
  /** Workspace package paths */
  packages: string[];
  /** Workspace patterns from package.json */
  patterns: string[];
}

export interface ProjectInfo {
  /** Project root path */
  root: string;
  /** Whether it's a monorepo */
  isMonorepo: boolean;
  /** Package name from package.json */
  name?: string;
  /** Whether git repo */
  isGitRepo: boolean;
}

// ============================================================================
// PROJECT ROOT DETECTION
// ============================================================================

/**
 * Find project root by looking for package.json or .git
 *
 * Walks up the directory tree until finding a marker file.
 *
 * @param startDir - Directory to start searching from
 * @returns Project root path
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    // Check for package.json
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }

    // Check for .git as fallback
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }

    dir = path.dirname(dir);
  }

  // Fallback to start directory
  return startDir;
}

/**
 * Find package.json path
 *
 * @returns Path to package.json or null if not found
 */
export function findPackageJson(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Find nearest git repository root
 */
export function findGitRoot(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return null;
}

// ============================================================================
// MONOREPO DETECTION
// ============================================================================

/**
 * Parse pnpm-workspace.yaml to extract package patterns.
 *
 * Only extracts entries under the 'packages:' section.
 * Handles YAML list items like:
 *   - apps/*
 *   - packages/*
 *
 * @param content - Raw YAML file content
 * @returns Array of workspace patterns
 */
function parsePnpmWorkspaceYaml(content: string): string[] {
  const patterns: string[] = [];
  const lines = content.split('\n');

  let inPackagesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers (no leading whitespace, ends with colon)
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':')) {
      inPackagesSection = trimmed === 'packages:';
      continue;
    }

    // Parse list items under packages section
    if (inPackagesSection && trimmed.startsWith('-')) {
      // Extract value after '- ', removing quotes if present
      const value = trimmed
        .slice(1) // Remove leading '-'
        .trim()
        .replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes

      if (value && !value.includes(':')) {
        patterns.push(value);
      }
    }
  }

  return patterns;
}

/**
 * Detect monorepo structure and type
 */
export function detectMonorepo(projectRoot: string): MonorepoInfo | null {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = readPackageJson(pkgPath);
  if (!pkg) return null;

  try {
    // Check for workspace patterns
    let patterns: string[] = [];
    let type: MonorepoInfo['type'] = 'unknown';

    // pnpm workspaces (pnpm-workspace.yaml)
    const pnpmWorkspace = path.join(projectRoot, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmWorkspace)) {
      type = 'pnpm';
      // Parse yaml for patterns - only under 'packages:' section
      const content = fs.readFileSync(pnpmWorkspace, 'utf-8');
      patterns = parsePnpmWorkspaceYaml(content);
    }

    // npm/yarn workspaces (package.json)
    const workspaces = pkg.workspaces as string[] | { packages?: string[] } | undefined;
    if (workspaces) {
      patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || [];
      type = fs.existsSync(path.join(projectRoot, 'yarn.lock')) ? 'yarn' : 'npm';
    }

    // Turbo
    if (fs.existsSync(path.join(projectRoot, 'turbo.json'))) {
      type = 'turbo';
    }

    // Nx
    if (fs.existsSync(path.join(projectRoot, 'nx.json'))) {
      type = 'nx';
    }

    // Lerna
    if (fs.existsSync(path.join(projectRoot, 'lerna.json'))) {
      type = 'lerna';
    }

    if (patterns.length === 0) return null;

    // Find actual packages
    const packages = findWorkspacePackages(projectRoot, patterns);

    return {
      type,
      root: projectRoot,
      packages,
      patterns,
    };
  } catch {
    return null;
  }
}

/**
 * Find workspace packages matching patterns
 */
function findWorkspacePackages(root: string, patterns: string[]): string[] {
  const packages: string[] = [];

  for (const pattern of patterns) {
    // Handle glob patterns like "packages/*"
    const cleanPattern = pattern.replace(/\*+$/, '');
    const searchDir = path.join(root, cleanPattern);

    if (!fs.existsSync(searchDir)) continue;

    const entries = fs.readdirSync(searchDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pkgPath = path.join(searchDir, entry.name, 'package.json');
      if (fs.existsSync(pkgPath)) {
        packages.push(path.join(searchDir, entry.name));
      }
    }
  }

  return packages;
}

// ============================================================================
// PROJECT INFO
// ============================================================================

/**
 * Get comprehensive project information
 */
export function getProjectInfo(startDir: string = process.cwd()): ProjectInfo {
  const root = findProjectRoot(startDir);
  const gitRoot = findGitRoot(startDir);
  const monorepo = detectMonorepo(root);

  let name: string | undefined;
  const pkgPath = path.join(root, 'package.json');
  const pkg = readPackageJson(pkgPath);
  if (pkg && typeof pkg.name === 'string') {
    name = pkg.name;
  }

  return {
    root,
    isMonorepo: monorepo !== null,
    ...(name ? { name } : {}),
    isGitRepo: gitRoot !== null,
  };
}
