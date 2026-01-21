/**
 * @module lib/@context/routes
 * @description Cached tRPC routes access with mtime-based invalidation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '@/lib/@core/logger/logger';

// ============================================================================
// CACHE
// ============================================================================

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  value: string | undefined;
  timestamp: number;
  mtime: number;
}

const routesCache = new Map<string, CacheEntry>();

/**
 * Clear routes cache
 */
export function clearRoutesCache(): void {
  routesCache.clear();
  logger.debug('[context/routes] Cache cleared');
}

// ============================================================================
// ROUTES DETECTION
// ============================================================================

/** Default locations to search for tRPC routers */
const ROUTERS_CANDIDATES = [
  'packages/api/src/routers',
  'src/server/routers',
  'src/routers',
  'server/routers',
  'api/routers',
];

interface RoutesLocation {
  path: string;
  files: string[];
}

/**
 * Find tRPC routers location in project
 */
export function findRoutesLocation(projectRoot: string): RoutesLocation | undefined {
  for (const candidate of ROUTERS_CANDIDATES) {
    const routersDir = path.join(projectRoot, candidate);

    if (fs.existsSync(routersDir) && fs.statSync(routersDir).isDirectory()) {
      const files = fs
        .readdirSync(routersDir)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => path.join(routersDir, f));

      if (files.length > 0) {
        return { path: routersDir, files };
      }
    }
  }

  return undefined;
}

/**
 * Get latest mtime from router files
 */
function getLatestMtime(files: string[]): number {
  let latest = 0;
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    } catch {
      // File might have been deleted
    }
  }
  return latest;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get tRPC routes summary (cached with mtime invalidation)
 *
 * @param projectRoot - Project root directory
 * @returns Routes summary or undefined if not found
 */
export function getTrpcRoutes(projectRoot: string): string | undefined {
  const location = findRoutesLocation(projectRoot);
  if (!location) return undefined;

  const currentMtime = getLatestMtime(location.files);

  // Check cache
  const cached = routesCache.get(projectRoot);
  if (cached) {
    const isValid = Date.now() - cached.timestamp < CACHE_TTL_MS;
    const mtimeMatch = cached.mtime === currentMtime;

    if (isValid && mtimeMatch) {
      logger.debug('[context/routes] Returning from cache');
      return cached.value;
    }
  }

  // Build routes summary
  const routerNames = location.files.map((f) => path.basename(f, '.ts'));
  const value = `Available routers:\n${routerNames.map((n) => `- ${n}`).join('\n')}`;

  // Update cache
  routesCache.set(projectRoot, {
    value,
    timestamp: Date.now(),
    mtime: currentMtime,
  });

  logger.debug(`[context/routes] Found ${routerNames.length} routers`);
  return value;
}

/**
 * Check if project has tRPC routers
 */
export function hasTrpcRoutes(projectRoot: string): boolean {
  return findRoutesLocation(projectRoot) !== undefined;
}

/**
 * Get list of router names
 */
export function getRouterNames(projectRoot: string): string[] {
  const location = findRoutesLocation(projectRoot);
  if (!location) return [];
  return location.files.map((f) => path.basename(f, '.ts'));
}
