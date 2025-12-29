/**
 * @module lib/@discovery/routes
 * @description API route discovery (tRPC, Next.js API, Express)
 *
 * Provides utilities for:
 * - Finding tRPC router directory
 * - Finding Next.js API routes
 * - Finding Express/Fastify routes
 *
 * Uses dynamic detection based on package.json dependencies
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { walk } from '../@core/fs';

// ============================================================================
// DYNAMIC CANDIDATE GENERATION
// ============================================================================

/**
 * Framework-to-candidates mapping
 * Key: dependency name pattern, Value: candidate paths
 */
const FRAMEWORK_CANDIDATES: Record<string, { deps: string[]; paths: string[] }> = {
  trpc: {
    deps: ['@trpc/server', '@trpc/client'],
    paths: [
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
    ],
  },
  nextjs: {
    deps: ['next'],
    paths: ['src/app/api', 'app/api', 'src/pages/api', 'pages/api'],
  },
  express: {
    deps: ['express', 'fastify', 'hono', 'koa'],
    paths: ['src/routes', 'src/api/routes', 'routes', 'api/routes', 'server/routes'],
  },
};

/**
 * Cache for detected frameworks per project
 */
const frameworkCache = new Map<string, Set<string>>();

/**
 * Detect installed frameworks from package.json
 */
function detectFrameworks(projectRoot: string): Set<string> {
  const cached = frameworkCache.get(projectRoot);
  if (cached) return cached;

  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return new Set();
  }

  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ]);

    const detected = new Set<string>();

    for (const [framework, config] of Object.entries(FRAMEWORK_CANDIDATES)) {
      if (config.deps.some((dep) => allDeps.has(dep))) {
        detected.add(framework);
      }
    }

    frameworkCache.set(projectRoot, detected);
    return detected;
  } catch {
    return new Set();
  }
}

/**
 * Get route candidates for a specific framework
 */
function getCandidates(
  projectRoot: string,
  framework: keyof typeof FRAMEWORK_CANDIDATES,
): string[] {
  const frameworks = detectFrameworks(projectRoot);
  const config = FRAMEWORK_CANDIDATES[framework];

  // If framework is detected, return its paths
  if (frameworks.has(framework)) {
    return config?.paths ?? [];
  }

  // If no package.json or detection failed, return all paths as fallback
  if (frameworks.size === 0) {
    return config?.paths ?? [];
  }

  // Framework not installed - return empty
  return [];
}

/**
 * Clear framework cache (for testing or project changes)
 */
export function clearRouteDiscoveryCache(): void {
  frameworkCache.clear();
}

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
export function findRoutersDir(projectRoot: string, customPath?: string): string | null {
  // Check custom path first
  if (customPath) {
    const fullPath = path.isAbsolute(customPath) ? customPath : path.join(projectRoot, customPath);

    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Search candidates based on detected frameworks
  const candidates = getCandidates(projectRoot, 'trpc');
  for (const candidate of candidates) {
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

  walk(
    dir,
    (fullPath) => {
      const fileName = path.basename(fullPath);
      // Check for router file patterns
      if (
        fileName.endsWith('.router.ts') ||
        fileName.endsWith('Router.ts') ||
        fileName === 'index.ts' ||
        fileName === '_app.ts'
      ) {
        files.push(fullPath);
      }
    },
    { extensions: ['.ts'], exclude: ['node_modules'] },
  );

  return files;
}

// ============================================================================
// NEXT.JS API DISCOVERY
// ============================================================================

/**
 * Find Next.js API routes directory
 */
export function findNextjsApiDir(projectRoot: string): string | null {
  const candidates = getCandidates(projectRoot, 'nextjs');
  for (const candidate of candidates) {
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

  walk(
    dir,
    (fullPath) => {
      const fileName = path.basename(fullPath);
      // App Router: route.ts
      if (fileName === 'route.ts' || fileName === 'route.js') {
        files.push(fullPath);
      }
      // Pages Router: any .ts/.js file (except _*.ts)
      else if (!fileName.startsWith('_')) {
        files.push(fullPath);
      }
    },
    { extensions: ['.ts', '.js'], exclude: [] },
  );

  return files;
}

// ============================================================================
// EXPRESS/FASTIFY DISCOVERY
// ============================================================================

/**
 * Find Express/Fastify routes directory
 */
export function findExpressRoutesDir(projectRoot: string): string | null {
  const candidates = getCandidates(projectRoot, 'express');
  for (const candidate of candidates) {
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

  walk(
    dir,
    (fullPath) => {
      const fileName = path.basename(fullPath);
      // Common patterns: *.route.ts, *.routes.ts, index.ts
      if (
        fileName.endsWith('.route.ts') ||
        fileName.endsWith('.routes.ts') ||
        fileName.endsWith('.route.js') ||
        fileName.endsWith('.routes.js') ||
        fileName === 'index.ts' ||
        fileName === 'index.js'
      ) {
        files.push(fullPath);
      }
    },
    { extensions: ['.ts', '.js'], exclude: ['node_modules'] },
  );

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
