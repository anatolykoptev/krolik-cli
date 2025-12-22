/**
 * @module config/detect
 * @description Auto-detection of project features and paths
 */

import * as path from 'node:path';
import { exists, readJson, isDirectory } from '../lib/fs';
import type { FeatureConfig, PathConfig, PrismaConfig, TrpcConfig } from '../types';

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
      { web: 'apps/frontend', api: 'apps/backend', db: 'packages/database', shared: 'packages/common' },
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
