/**
 * @module lib/discovery/routes
 * @description API route discovery (tRPC, Next.js API, Express)
 *
 * Provides utilities for:
 * - Finding tRPC router directory
 * - Finding Next.js API routes
 * - Finding Express/Fastify routes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common tRPC router locations */
const TRPC_CANDIDATES = [
  'packages/api/src/routers',
  'packages/api/src/router',
  'src/server/routers',
  'src/server/router',
  'src/routers',
  'src/router',
  'server/routers',
  'server/router',
  'api/routers',
  'api/router',
];

/** Common Next.js API route locations */
const NEXTJS_API_CANDIDATES = [
  'src/app/api',
  'app/api',
  'src/pages/api',
  'pages/api',
];

/** Common Express/Fastify route locations */
const EXPRESS_CANDIDATES = [
  'src/routes',
  'src/api/routes',
  'routes',
  'api/routes',
  'server/routes',
];

// ============================================================================
// TRPC DISCOVERY
// ============================================================================

/**
 * Find tRPC routers directory
 *
 * @param projectRoot - Project root path
 * @param customPath - Optional custom path to check first
 * @returns Path to routers directory or null
 */
export function findRoutersDir(
  projectRoot: string,
  customPath?: string,
): string | null {
  // Check custom path first
  if (customPath) {
    const fullPath = path.isAbsolute(customPath)
      ? customPath
      : path.join(projectRoot, customPath);

    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Search candidates
  for (const candidate of TRPC_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find tRPC router files
 *
 * Searches for files matching common tRPC patterns:
 * - *.router.ts
 * - *Router.ts
 * - index.ts in routers/
 */
export function findTrpcRouters(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Check for router file patterns
        if (
          entry.name.endsWith('.router.ts') ||
          entry.name.endsWith('Router.ts') ||
          entry.name === 'index.ts' ||
          entry.name === '_app.ts'
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// NEXT.JS API DISCOVERY
// ============================================================================

/**
 * Find Next.js API routes directory
 */
export function findNextjsApiDir(projectRoot: string): string | null {
  for (const candidate of NEXTJS_API_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find all Next.js API route files
 *
 * Handles both:
 * - Pages Router: pages/api/[route].ts
 * - App Router: app/api/[route]/route.ts
 */
export function findNextjsApiRoutes(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // App Router: route.ts
        if (entry.name === 'route.ts' || entry.name === 'route.js') {
          files.push(fullPath);
        }
        // Pages Router: any .ts/.js file (except _*.ts)
        else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
          !entry.name.startsWith('_')
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// EXPRESS/FASTIFY DISCOVERY
// ============================================================================

/**
 * Find Express/Fastify routes directory
 */
export function findExpressRoutesDir(projectRoot: string): string | null {
  for (const candidate of EXPRESS_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find all Express/Fastify route files
 */
export function findExpressRoutes(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Common patterns: *.route.ts, *.routes.ts, index.ts
        if (
          entry.name.endsWith('.route.ts') ||
          entry.name.endsWith('.routes.ts') ||
          entry.name.endsWith('.route.js') ||
          entry.name.endsWith('.routes.js') ||
          entry.name === 'index.ts' ||
          entry.name === 'index.js'
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// GENERIC API DISCOVERY
// ============================================================================

export type ApiType = 'trpc' | 'nextjs' | 'express' | 'unknown';

export interface ApiRoutesInfo {
  type: ApiType;
  path: string;
  files: string[];
}

/**
 * Discover all API route types in project
 */
export function discoverApiRoutes(projectRoot: string): ApiRoutesInfo[] {
  const routes: ApiRoutesInfo[] = [];

  // tRPC
  const trpcDir = findRoutersDir(projectRoot);
  if (trpcDir) {
    routes.push({
      type: 'trpc',
      path: trpcDir,
      files: findTrpcRouters(trpcDir),
    });
  }

  // Next.js API
  const nextjsDir = findNextjsApiDir(projectRoot);
  if (nextjsDir) {
    routes.push({
      type: 'nextjs',
      path: nextjsDir,
      files: findNextjsApiRoutes(nextjsDir),
    });
  }

  // Express
  const expressDir = findExpressRoutesDir(projectRoot);
  if (expressDir && expressDir !== trpcDir) {
    routes.push({
      type: 'express',
      path: expressDir,
      files: findExpressRoutes(expressDir),
    });
  }

  return routes;
}
