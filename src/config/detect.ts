/**
 * @module config/detect
 * @description Auto-detection of project features and paths
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, isDirectory, readJson } from '../lib/@core/fs';
import type { FeatureConfig, PathConfig, PrismaConfig, TrpcConfig } from '../types/config';

/**
 * Package.json structure (partial)
 */
interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

/**
 * Detect features from package.json
 */
export function detectFeatures(projectRoot: string): Partial<FeatureConfig> {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = readJson<PackageJson>(pkgPath);

  if (!pkg) {
    return {};
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasWorkspaces = Boolean(pkg.workspaces);

  return {
    prisma: '@prisma/client' in allDeps || 'prisma' in allDeps,
    trpc: '@trpc/server' in allDeps || '@trpc/client' in allDeps,
    nextjs: 'next' in allDeps,
    react: 'react' in allDeps,
    monorepo: hasWorkspaces || exists(path.join(projectRoot, 'pnpm-workspace.yaml')),
    typescript: 'typescript' in allDeps || exists(path.join(projectRoot, 'tsconfig.json')),
  };
}

/**
 * Detect path configuration
 */
export function detectPaths(projectRoot: string, isMonorepo: boolean): Partial<PathConfig> {
  const detected: Partial<PathConfig> = {};

  if (isMonorepo) {
    // Common monorepo structures
    const monorepoPatterns = [
      { web: 'apps/web', api: 'packages/api', db: 'packages/db', shared: 'packages/shared' },
      { web: 'packages/web', api: 'packages/api', db: 'packages/db', shared: 'packages/shared' },
      {
        web: 'apps/frontend',
        api: 'apps/backend',
        db: 'packages/database',
        shared: 'packages/common',
      },
    ];

    for (const pattern of monorepoPatterns) {
      if (exists(path.join(projectRoot, pattern.web))) {
        detected.web = pattern.web;
        detected.api = pattern.api;
        detected.db = pattern.db;
        detected.shared = pattern.shared;
        break;
      }
    }
  } else {
    // Single project structures
    if (exists(path.join(projectRoot, 'src'))) {
      detected.web = 'src';
      detected.lib = 'src/lib';
      detected.components = 'src/components';
      detected.hooks = 'src/hooks';
    }

    if (exists(path.join(projectRoot, 'app'))) {
      detected.web = 'app';
    }
  }

  return detected;
}

/**
 * Detect Prisma configuration
 */
export function detectPrisma(projectRoot: string, _webPath?: string): Partial<PrismaConfig> {
  const detected: Partial<PrismaConfig> = {};

  // Check for multi-file schema
  const multiSchemaPath = path.join(projectRoot, 'prisma/schema');
  if (isDirectory(multiSchemaPath)) {
    detected.schemaDir = 'prisma/schema';
    return detected;
  }

  // Check for single schema file
  const singleSchemaPath = path.join(projectRoot, 'prisma/schema.prisma');
  if (exists(singleSchemaPath)) {
    detected.schemaDir = 'prisma/schema.prisma';
    return detected;
  }

  // Check in packages/db for monorepo
  const pkgDbSchema = path.join(projectRoot, 'packages/db/prisma/schema');
  if (isDirectory(pkgDbSchema)) {
    detected.schemaDir = 'packages/db/prisma/schema';
    return detected;
  }

  const pkgDbSingleSchema = path.join(projectRoot, 'packages/db/prisma/schema.prisma');
  if (exists(pkgDbSingleSchema)) {
    detected.schemaDir = 'packages/db/prisma/schema.prisma';
    return detected;
  }

  return detected;
}

/**
 * Detect tRPC configuration
 */
export function detectTrpc(projectRoot: string, _apiPath?: string): Partial<TrpcConfig> {
  const detected: Partial<TrpcConfig> = {};

  // Common router locations
  const routerPatterns = [
    'src/server/routers',
    'src/trpc/routers',
    'server/routers',
    'packages/api/src/routers',
    'apps/api/src/routers',
  ];

  for (const pattern of routerPatterns) {
    const fullPath = path.join(projectRoot, pattern);
    if (isDirectory(fullPath)) {
      detected.routersDir = pattern;

      // Try to find app router
      const indexPath = path.join(fullPath, 'index.ts');
      if (exists(indexPath)) {
        detected.appRouter = `${pattern}/index.ts`;
      }
      break;
    }
  }

  return detected;
}

/**
 * Detect project name from package.json
 */
export function detectProjectName(projectRoot: string): string | undefined {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = readJson<PackageJson>(pkgPath);
  return pkg?.name;
}

/**
 * Monorepo package info for refactor command
 */
export interface MonorepoPackage {
  /** Package name (e.g., 'web', 'api') */
  name: string;
  /** Path to package root relative to project root */
  path: string;
  /** Path to lib directory relative to project root */
  libPath: string;
  /** All source paths relative to project root (lib, components, app, etc.) */
  srcPaths: string[];
  /** Path to tsconfig.json */
  tsconfigPath: string;
  /** Package type */
  type: 'app' | 'package';
}

/**
 * Detect all source paths in a package directory dynamically
 * Scans for actual directories containing source files without hardcoded patterns
 *
 * @param projectRoot - Project root directory
 * @param pkgPath - Relative path to package (e.g., 'apps/web' or 'src')
 * @returns Array of relative paths to source directories
 */
export function detectSrcPaths(projectRoot: string, pkgPath: string): string[] {
  const srcPaths: string[] = [];
  const fullPkgPath = path.join(projectRoot, pkgPath);

  if (!isDirectory(fullPkgPath)) return srcPaths;

  // Get all immediate subdirectories (excluding hidden and node_modules)
  const subdirs = fs.readdirSync(fullPkgPath).filter((name: string) => {
    const fullPath = path.join(fullPkgPath, name);
    return (
      isDirectory(fullPath) &&
      !name.startsWith('.') &&
      name !== 'node_modules' &&
      name !== 'dist' &&
      name !== 'build' &&
      name !== '.next'
    );
  });

  // Check each subdir for source content
  for (const subdir of subdirs) {
    const subdirPath = path.join(pkgPath, subdir);
    const fullSubdirPath = path.join(projectRoot, subdirPath);

    if (containsSourceFiles(fullSubdirPath)) {
      srcPaths.push(subdirPath);
    }
  }

  return srcPaths;
}

/**
 * Check if directory contains TypeScript/JavaScript source files
 * Recursively checks up to 2 levels deep
 */
function containsSourceFiles(dir: string, depth = 0): boolean {
  if (!isDirectory(dir)) return false;
  if (depth > 2) return false; // Limit recursion depth

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Direct source files (including Next.js patterns like page.tsx, layout.tsx)
      if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx'))
      ) {
        return true;
      }
      // Recurse into subdirectories (for nested structures like app/profile/page.tsx)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        if (containsSourceFiles(path.join(dir, entry.name), depth + 1)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Detect all packages with lib directories in a monorepo
 */
export function detectMonorepoPackages(projectRoot: string): MonorepoPackage[] {
  const packages: MonorepoPackage[] = [];

  // Common lib locations within packages
  const libPatterns = ['lib', 'src/lib'];

  // Check apps/
  const appsDir = path.join(projectRoot, 'apps');
  if (isDirectory(appsDir)) {
    const apps = fs.readdirSync(appsDir).filter((name: string) => {
      const fullPath = path.join(appsDir, name);
      return isDirectory(fullPath) && !name.startsWith('.');
    });

    for (const app of apps) {
      const appPath = path.join('apps', app);

      for (const libPattern of libPatterns) {
        const libPath = path.join(appPath, libPattern);
        const fullLibPath = path.join(projectRoot, libPath);

        if (isDirectory(fullLibPath)) {
          // Find tsconfig
          let tsconfigPath = path.join(appPath, 'tsconfig.json');
          if (!exists(path.join(projectRoot, tsconfigPath))) {
            tsconfigPath = 'tsconfig.base.json';
          }

          // Detect all source paths
          const srcPaths = detectSrcPaths(projectRoot, appPath);

          packages.push({
            name: app,
            path: appPath,
            libPath,
            srcPaths,
            tsconfigPath,
            type: 'app',
          });
          break;
        }
      }
    }
  }

  // Check packages/
  const packagesDir = path.join(projectRoot, 'packages');
  if (isDirectory(packagesDir)) {
    const pkgs = fs.readdirSync(packagesDir).filter((name: string) => {
      const fullPath = path.join(packagesDir, name);
      return isDirectory(fullPath) && !name.startsWith('.');
    });

    for (const pkg of pkgs) {
      const pkgPath = path.join('packages', pkg);

      for (const libPattern of libPatterns) {
        const libPath = path.join(pkgPath, libPattern);
        const fullLibPath = path.join(projectRoot, libPath);

        if (isDirectory(fullLibPath)) {
          // Find tsconfig
          let tsconfigPath = path.join(pkgPath, 'tsconfig.json');
          if (!exists(path.join(projectRoot, tsconfigPath))) {
            tsconfigPath = 'tsconfig.base.json';
          }

          // Detect all source paths
          const srcPaths = detectSrcPaths(projectRoot, pkgPath);

          packages.push({
            name: pkg,
            path: pkgPath,
            libPath,
            srcPaths,
            tsconfigPath,
            type: 'package',
          });
          break;
        }
      }
    }
  }

  return packages;
}

/**
 * Run all detections and return partial config
 */
export function detectAll(projectRoot: string): {
  name: string | undefined;
  features: Partial<FeatureConfig>;
  paths: Partial<PathConfig>;
  prisma: Partial<PrismaConfig>;
  trpc: Partial<TrpcConfig>;
} {
  const features = detectFeatures(projectRoot);
  const paths = detectPaths(projectRoot, features.monorepo ?? false);
  const prisma = features.prisma ? detectPrisma(projectRoot, paths.web) : {};
  const trpc = features.trpc ? detectTrpc(projectRoot, paths.api) : {};
  const name = detectProjectName(projectRoot);

  return {
    name,
    features,
    paths,
    prisma,
    trpc,
  };
}
